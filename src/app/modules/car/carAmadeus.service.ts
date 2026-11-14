import { JwtPayload } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { AmadeusCarApi } from "../../../integrations/amadeus/amadeusCar.api";
import {
  extractTravelRefs,
  mapLedgerBookingSummary,
  mapOffersResponse,
  mapOrderResponse,
  mapSingleOfferResponse,
  maybeAttachRaw,
} from "../../../util/carAmadeusMapper";
import {
  clearInflightSearchJobId,
  getCachedCarSearch,
  getInflightSearchJobId,
  hashCarSearchBody,
  setCachedCarSearch,
  setInflightSearchJobId,
} from "../../../util/carSearchCache";
import {
  isSoftAmadeusSearchFailure,
  resolveIataSubtype,
  shortenAmadeusSearchError,
  withLocationSubtype,
} from "../../../util/amadeusPlace";
import { carSearchQueue } from "../../../config/bullMQ.config";
import {
  AmadeusCarOfferSearchBody,
  AmadeusTravelOrderRefs,
  CarAmadeusOrderStatus,
  CreateCarAmadeusOrderPayload,
  IssueCarAmadeusVoucherPayload,
} from "./car.interface";
import { CarAmadeusOrderModel } from "./carOrder.model";
import {
  CarPaymentModel,
  CarPaymentStatus,
} from "./carPayment.model";
import { CarPaymentService } from "./carPayment.service";
import { Types } from "mongoose";
import { Job } from "bullmq";

/** App tabs: Upcoming | Running | Completed | Canceled */
const resolveUiBookingStatus = (
  status?: string,
  pickupDateTime?: string | null,
  dropoffDateTime?: string | null
) => {
  const s = String(status || "").toUpperCase();
  if (s === CarAmadeusOrderStatus.CANCELLED || s === "CANCELED") {
    return "Canceled";
  }

  const now = Date.now();
  const startMs = pickupDateTime ? new Date(pickupDateTime).getTime() : NaN;
  const endMs = dropoffDateTime ? new Date(dropoffDateTime).getTime() : NaN;

  if (!Number.isNaN(endMs) && endMs < now) {
    return "Completed";
  }
  if (!Number.isNaN(startMs) && startMs <= now) {
    return "Running";
  }

  // Before pickup, or no dates yet (paid / CREATED pending Amadeus).
  return "Upcoming";
};

const withUiStatus = (summary: Record<string, any>): Record<string, any> => ({
  ...summary,
  isPaid: summary.isPaid !== false,
  uiStatus: resolveUiBookingStatus(
    summary.status,
    summary.pickupDateTime || summary.offer?.pickupDateTime,
    summary.dropoffDateTime || summary.offer?.dropoffDateTime
  ),
});

const mapPaymentToBookingSummary = (row: any) => {
  const snap =
    row.metadata &&
    typeof row.metadata === "object" &&
    (row.metadata as any).offerSnapshot &&
    typeof (row.metadata as any).offerSnapshot === "object"
      ? (row.metadata as any).offerSnapshot
      : {};
  const id = String(row._id);
  return withUiStatus({
    ledgerId: `pay_${id}`,
    paymentId: id,
    offerId: row.offerId || "",
    status: CarAmadeusOrderStatus.CREATED,
    pnrRecordReference: "",
    confirmationNumber: "",
    currencyCode: row.currencyCode || snap.currency || "",
    totalAmount: row.amount || snap.total || "",
    driver: {
      email: row.driverEmail || "",
      firstName: "",
      lastName: "",
      phone: "",
    },
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || row.createdAt || null,
    model: snap.model || "",
    companyCode: snap.companyCode || "",
    companyName: snap.companyName || "",
    acrissCode: snap.acrissCode || "",
    vehicleCategory: snap.vehicleCategory || "",
    imageUrl: snap.imageUrl || snap.logoUrl || "",
    pickupDateTime: snap.pickupDateTime || "",
    dropoffDateTime: snap.dropoffDateTime || "",
    offer: snap,
    source: "payment_pending_booking",
    isPaid: true,
  });
};

const requireUserId = (user: JwtPayload): string => {
  if (!user?.id) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  return user.id as string;
};

const DEFAULT_OFFER_PAGE_LIMIT = 20;
const MAX_OFFER_PAGE_LIMIT = 50;

type OfferPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  total: number;
};

type MotlyOfferFilters = {
  agencyNames: string[];
  companyNames: string[];
  vehicleCategories: string[];
  doors: number[];
  seats: number[];
};

const emptyMotlyFilters = (): MotlyOfferFilters => ({
  agencyNames: [],
  companyNames: [],
  vehicleCategories: [],
  doors: [],
  seats: [],
});

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
};

const asNumberList = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    const n = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(n)) out.push(Math.floor(n));
  }
  return out;
};

const extractMotlyOfferFilters = (
  body: AmadeusCarOfferSearchBody
): MotlyOfferFilters => {
  const raw = (body as Record<string, unknown>).filters;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyMotlyFilters();
  }
  const filters = raw as Record<string, unknown>;
  return {
    agencyNames: asStringList(filters.agencyNames),
    companyNames: asStringList(filters.companyNames),
    vehicleCategories: asStringList(filters.vehicleCategories),
    doors: asNumberList(filters.doors),
    seats: asNumberList(filters.seats),
  };
};

const hasMotlyOfferFilters = (filters: MotlyOfferFilters) =>
  filters.agencyNames.length > 0 ||
  filters.companyNames.length > 0 ||
  filters.vehicleCategories.length > 0 ||
  filters.doors.length > 0 ||
  filters.seats.length > 0;

const needsDenseOfferFields = (filters: MotlyOfferFilters) =>
  filters.doors.length > 0 || filters.seats.length > 0;

const matchesMotlyOfferFilter = (
  offer: Record<string, any>,
  filters: MotlyOfferFilters
) => {
  const agencyNeed = [...filters.agencyNames, ...filters.companyNames];
  if (agencyNeed.length > 0) {
    const name = String(offer.companyName || "").toLowerCase();
    const code = String(offer.companyCode || "").toLowerCase();
    const hit = agencyNeed.some((needle) => {
      const n = needle.toLowerCase();
      return name.includes(n) || code === n;
    });
    if (!hit) return false;
  }

  if (filters.vehicleCategories.length > 0) {
    const cat = String(offer.vehicleCategory || "").toLowerCase();
    if (!cat) return false;
    const hit = filters.vehicleCategories.some((needle) => {
      const n = needle.toLowerCase();
      return cat === n || cat.includes(n);
    });
    if (!hit) return false;
  }

  if (filters.doors.length > 0) {
    const doors = Number(offer.doors);
    if (!Number.isFinite(doors) || !filters.doors.includes(doors)) {
      return false;
    }
  }

  if (filters.seats.length > 0) {
    const seats = Number(offer.seats);
    if (!Number.isFinite(seats) || !filters.seats.includes(seats)) {
      return false;
    }
  }

  return true;
};

const applyMotlyOfferFilters = (
  offers: Record<string, any>[],
  filters: MotlyOfferFilters
) => {
  if (!hasMotlyOfferFilters(filters)) return offers;
  return offers.filter((offer) => matchesMotlyOfferFilter(offer, filters));
};

const extractSearchPagination = (body: AmadeusCarOfferSearchBody) => {
  const raw = body as Record<string, unknown>;
  // Motly-only fields — never send to Amadeus or put in the cache hash.
  const { cursor, limit, filters: _filters, ...amadeusBody } = raw;
  return {
    amadeusBody: amadeusBody as AmadeusCarOfferSearchBody,
    cursor: typeof cursor === "string" ? cursor : undefined,
    limit:
      typeof limit === "number"
        ? limit
        : typeof limit === "string"
          ? Number(limit)
          : undefined,
  };
};

const encodeOfferCursor = (offset: number) =>
  Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");

const decodeOfferCursor = (cursor?: string): number => {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { o?: unknown };
    const offset = Number(parsed?.o);
    return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
  } catch {
    return 0;
  }
};

const paginateOffers = <T>(
  offers: T[],
  cursor?: string,
  limit?: number
): { offers: T[]; pageInfo: OfferPageInfo } => {
  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_OFFER_PAGE_LIMIT, 1),
    MAX_OFFER_PAGE_LIMIT
  );
  const offset = decodeOfferCursor(cursor);
  const page = offers.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < offers.length;

  return {
    offers: page,
    pageInfo: {
      nextCursor: hasMore ? encodeOfferCursor(nextOffset) : null,
      hasMore,
      limit: pageSize,
      total: offers.length,
    },
  };
};

const normalizeSearchBody = (
  body: AmadeusCarOfferSearchBody
): AmadeusCarOfferSearchBody => {
  // Never send Motly pagination fields to Amadeus or into the cache hash.
  const { amadeusBody } = extractSearchPagination(body);
  const pickUp = (amadeusBody.pickUp || {}) as Record<string, any>;
  const location = (pickUp.location || {}) as Record<string, any>;
  const searchRadius = pickUp.searchRadius as
    | { unit?: string; value: number }
    | undefined;

  const resolvedSubtype = resolveIataSubtype(location);
  const nextLocation =
    location.iataCode && resolvedSubtype
      ? { ...location, subtype: resolvedSubtype, iataCode: String(location.iataCode).toUpperCase() }
      : location;

  const nextPickUp: Record<string, any> = {
    ...pickUp,
    location: nextLocation,
  };

  if (searchRadius && !searchRadius.unit) {
    nextPickUp.searchRadius = {
      ...searchRadius,
      unit: "KILOMETERS",
    };
  }

  return {
    ...amadeusBody,
    pickUp: nextPickUp,
  };
};

// Enrich only the current page. Full-set enrich blew past mobile timeouts;
// budgeted enrich returns a fast first paint, then finishes in the background.
const SEARCH_ENRICH_CONCURRENCY = 12;
/** Soft wall for the HTTP response path — leftover sparse rows finish async. */
const SEARCH_ENRICH_BUDGET_MS = 2800;

const isSparseOffer = (offer: Record<string, any>) =>
  !offer?.model || !offer?.acrissCode || !offer?.imageUrl;

const enrichOneOffer = async (
  offer: Record<string, any>
): Promise<Record<string, any> | null> => {
  const offerId = String(offer?.offerId || "").trim();
  if (!offerId) return null;
  try {
    const { data } = await AmadeusCarApi.getCarOfferById(offerId);
    const mapped = mapSingleOfferResponse(data as Record<string, any>);
    const full = (mapped as any)?.offer || mapped;
    if (!full || typeof full !== "object") return null;
    return {
      ...offer,
      ...full,
      offerId: offer.offerId || full.offerId,
    };
  } catch (err: any) {
    // Offer GET often returns Amadeus 727 on PDT; search-row data is still usable.
    const msg = String(err?.message || err || "");
    if (/\b727\b/.test(msg) || /INTERNAL ERROR/i.test(msg)) {
      return null;
    }
    return null;
  }
};

/**
 * Detail-hydrate sparse search rows with a response-time budget.
 * When the budget expires, return whatever is ready (prices still usable).
 */
const enrichSparseOffers = async (
  offers: Record<string, any>[],
  options?: { budgetMs?: number | null }
): Promise<Record<string, any>[]> => {
  const targets = offers
    .map((offer, index) => ({ offer, index }))
    .filter(({ offer }) => isSparseOffer(offer));

  if (targets.length === 0) {
    return offers;
  }

  const enriched = [...offers];
  const budgetMs = options?.budgetMs;
  const deadline =
    budgetMs == null || budgetMs <= 0 ? null : Date.now() + budgetMs;

  for (let i = 0; i < targets.length; i += SEARCH_ENRICH_CONCURRENCY) {
    if (deadline != null && Date.now() >= deadline) {
      break;
    }

    const batch = targets.slice(i, i + SEARCH_ENRICH_CONCURRENCY);
    const remainingMs =
      deadline == null ? null : Math.max(deadline - Date.now(), 0);

    const batchWork = Promise.allSettled(
      batch.map(async ({ offer, index }) => {
        const full = await enrichOneOffer(offer);
        return { index, full };
      })
    );

    const settled =
      remainingMs == null
        ? await batchWork
        : await Promise.race([
            batchWork,
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), remainingMs)
            ),
          ]);

    if (settled == null) {
      // Budget hit mid-batch — keep whatever earlier batches wrote.
      break;
    }

    settled.forEach((result) => {
      if (result.status !== "fulfilled") return;
      const { index, full } = result.value;
      if (!full) return;
      enriched[index] = full;
    });
  }

  return enriched;
};

/** Finish current-page enrich + warm the next cursor page in Redis. */
const continueEnrichAndPrefetch = async (
  searchHash: string,
  allOffers: Record<string, any>[],
  offset: number,
  pageSize: number,
  alreadyReturned: Record<string, any>[]
) => {
  if (!searchHash || allOffers.length === 0) return;

  try {
    // 1) Finish any sparse rows still on the served page (no budget).
    const pageDone = await enrichSparseOffers(alreadyReturned, {
      budgetMs: null,
    });
    await mergeEnrichedPageIntoCache(searchHash, offset, pageDone);

    // 2) Prefetch + enrich the next page so "load more" is mostly cache HIT.
    const nextOffset = offset + pageSize;
    if (nextOffset >= allOffers.length) return;

    const nextSlice = allOffers.slice(nextOffset, nextOffset + pageSize);
    if (nextSlice.length === 0) return;

    const nextEnriched = await enrichSparseOffers(nextSlice, {
      budgetMs: null,
    });
    await mergeEnrichedPageIntoCache(searchHash, nextOffset, nextEnriched);
  } catch {
    // Background warm must never affect the client response path.
  }
};

/** Persist page-level DETAIL enrichments so later cursors stay fast. */
const mergeEnrichedPageIntoCache = async (
  searchHash: string,
  offset: number,
  page: Record<string, any>[]
) => {
  if (!searchHash || page.length === 0) return;
  const cached = await getCachedCarSearch<{
    offers: Record<string, any>[];
    warnings?: unknown[];
  }>(searchHash);
  if (!cached?.offers?.length) return;

  const nextOffers = [...cached.offers];
  for (let i = 0; i < page.length; i += 1) {
    const at = offset + i;
    if (at < 0 || at >= nextOffers.length) continue;
    nextOffers[at] = {
      ...nextOffers[at],
      ...page[i],
      offerId: nextOffers[at]?.offerId || page[i]?.offerId,
    };
  }
  await setCachedCarSearch(searchHash, { ...cached, offers: nextOffers });
};

/** Safe when Motly filters reorder/slice the Amadeus result set. */
const mergeEnrichedOffersById = async (
  searchHash: string,
  page: Record<string, any>[]
) => {
  if (!searchHash || page.length === 0) return;
  const cached = await getCachedCarSearch<{
    offers: Record<string, any>[];
    warnings?: unknown[];
  }>(searchHash);
  if (!cached?.offers?.length) return;

  const byId = new Map<string, Record<string, any>>();
  for (const offer of page) {
    const id = String(offer?.offerId || "").trim();
    if (id) byId.set(id, offer);
  }
  if (byId.size === 0) return;

  const nextOffers = cached.offers.map((row) => {
    const id = String(row?.offerId || "").trim();
    const full = id ? byId.get(id) : undefined;
    if (!full) return row;
    return { ...row, ...full, offerId: row.offerId || full.offerId };
  });
  await setCachedCarSearch(searchHash, { ...cached, offers: nextOffers });
};

const callAmadeusSearch = async (body: AmadeusCarOfferSearchBody) => {
  // Cache the full sparse search quickly — enrich per page on respond.
  const { data } = await AmadeusCarApi.searchCarOffers(body);
  return mapOffersResponse(data as Record<string, any>);
};

const fetchAndCacheOffers = async (body: AmadeusCarOfferSearchBody) => {
  const normalized = normalizeSearchBody(body);
  const searchHash = hashCarSearchBody(normalized);
  const cached = await getCachedCarSearch<{
    offers: unknown[];
    warnings: unknown[];
  }>(searchHash);

  if (cached?.offers) {
    return { ...cached, searchHash, cache: "HIT" as const };
  }

  try {
    const mapped = await callAmadeusSearch(normalized);
    await setCachedCarSearch(searchHash, mapped);
    return { ...mapped, searchHash, cache: "MISS" as const };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : String((error as Error)?.message || error);
    const loc = ((normalized.pickUp as any)?.location || {}) as {
      subtype?: string;
      iataCode?: string;
    };

    // App often sends metro codes (LON/PAR/NYC) as AIRPORT → Amadeus 8324 wall.
    // Retry once as CITY before failing the client.
    if (
      isSoftAmadeusSearchFailure(message) &&
      loc.iataCode &&
      loc.subtype === "AIRPORT"
    ) {
      const cityBody = withLocationSubtype(normalized, "CITY");
      const cityHash = hashCarSearchBody(cityBody);
      const cityCached = await getCachedCarSearch<{
        offers: unknown[];
        warnings: unknown[];
      }>(cityHash);

      if (cityCached?.offers) {
        return { ...cityCached, searchHash: cityHash, cache: "HIT" as const };
      }

      try {
        const mapped = await callAmadeusSearch(cityBody);
        await setCachedCarSearch(cityHash, mapped);
        // Also alias under original hash so the same app request hits next time.
        await setCachedCarSearch(searchHash, mapped);
        return { ...mapped, searchHash: cityHash, cache: "MISS" as const };
      } catch (cityError) {
        const cityMessage =
          cityError instanceof ApiError
            ? cityError.message
            : String((cityError as Error)?.message || cityError);
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          shortenAmadeusSearchError(cityMessage)
        );
      }
    }

    if (error instanceof ApiError && isSoftAmadeusSearchFailure(message)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        shortenAmadeusSearchError(message)
      );
    }

    throw error;
  }
};

const searchOffers = async (body: AmadeusCarOfferSearchBody) => {
  const { cursor, limit } = extractSearchPagination(body);
  const motlyFilters = extractMotlyOfferFilters(body);
  const fetched = (await fetchAndCacheOffers(body)) as {
    searchHash: string;
    cache: "HIT" | "MISS";
    offers?: unknown[];
    warnings?: unknown[];
    [key: string]: unknown;
  };
  const { searchHash, cache: cacheState, ...result } = fetched;
  let allOffers = Array.isArray(result.offers)
    ? (result.offers as Record<string, any>[])
    : [];

  // Doors/seats live on detail enrich — hydrate sparse rows before Motly filter.
  if (needsDenseOfferFields(motlyFilters)) {
    allOffers = await enrichSparseOffers(allOffers, { budgetMs: null });
    void mergeEnrichedPageIntoCache(searchHash, 0, allOffers);
  }

  const filteredOffers = applyMotlyOfferFilters(allOffers, motlyFilters);
  const paged = paginateOffers(filteredOffers, cursor, limit);
  const offset = decodeOfferCursor(cursor);
  const pageSize = paged.pageInfo.limit;

  // Cache HIT pages are usually already dense — keep a short budget anyway.
  const enrichedPage = await enrichSparseOffers(
    paged.offers as Record<string, any>[],
    {
      budgetMs:
        cacheState === "HIT" ? Math.min(SEARCH_ENRICH_BUDGET_MS, 1200) : SEARCH_ENRICH_BUDGET_MS,
    }
  );

  // Merge enrichments back into Amadeus cache (by id when Motly filters slice).
  if (hasMotlyOfferFilters(motlyFilters)) {
    void mergeEnrichedOffersById(searchHash, enrichedPage);
  } else {
    void mergeEnrichedPageIntoCache(searchHash, offset, enrichedPage);
    void continueEnrichAndPrefetch(
      searchHash,
      allOffers,
      offset,
      pageSize,
      enrichedPage
    );
  }

  return {
    ...result,
    offers: enrichedPage,
    pageInfo: paged.pageInfo,
    filtersApplied: hasMotlyOfferFilters(motlyFilters) ? motlyFilters : null,
    searchHash,
    cache: cacheState,
  };
};

const enqueueSearchOffers = async (body: AmadeusCarOfferSearchBody) => {
  const { cursor, limit } = extractSearchPagination(body);
  const motlyFilters = extractMotlyOfferFilters(body);
  const normalized = normalizeSearchBody(body);
  const searchHash = hashCarSearchBody(normalized);

  const cached = await getCachedCarSearch<{
    offers: unknown[];
    warnings: unknown[];
  }>(searchHash);

  if (cached?.offers) {
    let allOffers = Array.isArray(cached.offers)
      ? (cached.offers as Record<string, any>[])
      : [];
    if (needsDenseOfferFields(motlyFilters)) {
      allOffers = await enrichSparseOffers(allOffers, { budgetMs: null });
      void mergeEnrichedPageIntoCache(searchHash, 0, allOffers);
    }
    const filteredOffers = applyMotlyOfferFilters(allOffers, motlyFilters);
    const paged = paginateOffers(filteredOffers, cursor, limit);
    return {
      mode: "CACHE" as const,
      status: "COMPLETED" as const,
      searchHash,
      result: {
        ...cached,
        offers: paged.offers,
        pageInfo: paged.pageInfo,
        filtersApplied: hasMotlyOfferFilters(motlyFilters)
          ? motlyFilters
          : null,
      },
    };
  }

  const inflightJobId = await getInflightSearchJobId(searchHash);
  if (inflightJobId) {
    return {
      mode: "ASYNC" as const,
      status: "QUEUED" as const,
      jobId: inflightJobId,
      searchHash,
      pollPath: `/api/v1/car/offers/search/jobs/${inflightJobId}`,
    };
  }

  const job = await carSearchQueue.add(
    "search",
    { body: normalized, searchHash },
    {
      removeOnComplete: { age: 600, count: 200 },
      removeOnFail: { age: 3600 },
    }
  );

  const jobId = String(job.id);
  await setInflightSearchJobId(searchHash, jobId);

  return {
    mode: "ASYNC" as const,
    status: "QUEUED" as const,
    jobId,
    searchHash,
    pollPath: `/api/v1/car/offers/search/jobs/${jobId}`,
  };
};

const getSearchJobStatus = async (jobId: string) => {
  const job: Job | undefined = await carSearchQueue.getJob(jobId);

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Search job not found");
  }

  const state = await job.getState();
  const searchHash =
    typeof job.data?.searchHash === "string" ? job.data.searchHash : null;

  if (state === "completed") {
    const cached = searchHash
      ? await getCachedCarSearch<{ offers: unknown[]; warnings: unknown[] }>(
          searchHash
        )
      : null;
    const result = cached || job.returnvalue || null;

    return {
      jobId,
      status: "COMPLETED" as const,
      searchHash,
      result,
    };
  }

  if (state === "failed") {
    if (searchHash) {
      await clearInflightSearchJobId(searchHash);
    }

    return {
      jobId,
      status: "FAILED" as const,
      searchHash,
      error: job.failedReason || "Car search job failed",
    };
  }

  return {
    jobId,
    status: "PENDING" as const,
    searchHash,
    state,
  };
};

/** Used by BullMQ worker — keep cache write here so sync/async share one path. */
const processSearchJob = async (body: AmadeusCarOfferSearchBody) => {
  const { searchHash, cache: _cache, ...result } =
    await fetchAndCacheOffers(body);
  await clearInflightSearchJobId(searchHash);
  return result;
};

const getOfferById = async (offerId: string) => {
  const { data } = await AmadeusCarApi.getCarOfferById(offerId);
  return mapSingleOfferResponse(data as Record<string, any>);
};

const revalidateOffer = async (offerId: string) => {
  const { data, amaClientRef } = await AmadeusCarApi.revalidateCarOffer(
    offerId
  );

  return maybeAttachRaw(
    {
      offerId,
      amaClientRef,
      result: data,
    },
    data
  );
};

const normalizeDriverPhone = (raw: string) => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return trimmed;
  // Keep leading + for international; strip spaces/dashes/parens.
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return keepPlus ? `+${digits}` : digits;
};

const extractOfferIdFromAmadeusPayload = (
  payload: unknown,
  fallback: string
): string => {
  const root = (payload || {}) as Record<string, any>;
  const data = root.data;
  if (typeof data?.id === "string" && data.id.trim()) return data.id.trim();
  if (Array.isArray(data) && typeof data[0]?.id === "string" && data[0].id) {
    return String(data[0].id).trim();
  }
  if (typeof root.id === "string" && root.id.trim()) return root.id.trim();
  const included = root.included?.carOffers;
  if (included && typeof included === "object") {
    const firstKey = Object.keys(included)[0];
    const id = firstKey && included[firstKey]?.id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return fallback;
};

const isTransientAmadeusBookError = (error: unknown) => {
  if (!(error instanceof ApiError)) return false;
  const msg = String(error.message || "");
  const code = error.statusCode || 0;
  return (
    code >= 500 ||
    /\b727\b/.test(msg) ||
    /INTERNAL ERROR/i.test(msg) ||
    /timed out/i.test(msg) ||
    /BAD_GATEWAY/i.test(msg)
  );
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const createOrder = async (
  payload: CreateCarAmadeusOrderPayload,
  user: JwtPayload
) => {
  const userId = requireUserId(user);

  if (!payload.paymentIntentId) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      "paymentIntentId is required. Pay first, then book."
    );
  }

  const payment = await CarPaymentService.assertPaymentAllowsBooking({
    userId,
    offerId: payload.offerId,
    paymentIntentId: payload.paymentIntentId,
  });

  try {
    // Revalidate immediately before book; use returned offer id when Amadeus rotates it.
    const revalidated = await AmadeusCarApi.revalidateCarOffer(payload.offerId);
    const bookOfferId = extractOfferIdFromAmadeusPayload(
      revalidated.data,
      payload.offerId
    );

    const phone = normalizeDriverPhone(payload.driver.phone);

    // Motly collects money via Stripe. Amadeus booking is reservation-only —
    // do NOT send `payments` / CREDIT_LINE. Offers without PAY_AT_BOOKING
    // return 42600 "NO PAYMENT NEEDED" if a payments block is sent.
    const orderBody = {
      offerId: bookOfferId,
      driver: {
        age: Number(payload.driver.age),
        contacts: [
          { phone: { text: phone } },
          { email: { address: String(payload.driver.email).trim() } },
        ],
        names: [
          {
            firstName: String(payload.driver.firstName).trim(),
            lastName: String(payload.driver.lastName).trim(),
          },
        ],
      },
    };

    let data: unknown;
    let amaClientRef = "";
    try {
      const first = await AmadeusCarApi.createCarOrder(orderBody);
      data = first.data;
      amaClientRef = first.amaClientRef;
    } catch (firstError) {
      if (!isTransientAmadeusBookError(firstError)) throw firstError;
      // One short retry — Amadeus 727 is often transient on PDT.
      await sleep(1200);
      const second = await AmadeusCarApi.createCarOrder(orderBody);
      data = second.data;
      amaClientRef = second.amaClientRef;
    }

    const mapped = mapOrderResponse(data as Record<string, any>);
    const refs = extractTravelRefs(data as Record<string, any>);

    const offerSnap = mapped.offer
      ? {
          model: mapped.offer.model || "",
          companyCode: mapped.offer.companyCode || "",
          companyName: mapped.offer.companyName || "",
          acrissCode: mapped.offer.acrissCode || "",
          vehicleCategory: mapped.offer.vehicleCategory || "",
          imageUrl: mapped.offer.imageUrl || "",
          logoUrl: mapped.offer.logoUrl || "",
          pickupDateTime: mapped.offer.pickupDateTime || "",
          dropoffDateTime: mapped.offer.dropoffDateTime || "",
        }
      : undefined;

    const ledger = await CarAmadeusOrderModel.create({
      user: userId,
      offerId: bookOfferId,
      pnrRecordReference: refs.pnrRecordReference || undefined,
      confirmationNumber: refs.confirmationNumber || undefined,
      driver: payload.driver,
      currencyCode: mapped.currencyCode || payment.currencyCode || undefined,
      totalAmount: mapped.totalAmount || payment.amount,
      status: CarAmadeusOrderStatus.CREATED,
      amaClientRef,
      ...(offerSnap ? { offerSnapshot: offerSnap } : {}),
      rawOrder: data,
    });

    await CarPaymentService.attachBookingToPayment(
      payload.paymentIntentId,
      String(ledger._id)
    );

    const summary = mapLedgerBookingSummary(ledger.toObject());

    return {
      ...mapped,
      ledgerId: ledger._id,
      paymentIntentId: payload.paymentIntentId,
      amaClientRef,
      status: ledger.status,
      summary,
    };
  } catch (error) {
    // Pay-OK / book-fail → automatic refund (HLD-03).
    try {
      await CarPaymentService.refundPaymentInternal(
        payload.paymentIntentId,
        "requested_by_customer"
      );
    } catch {
      // Keep original booking error as primary signal.
    }

    if (error instanceof ApiError) {
      const msg = String(error.message || "");
      if (/\b42600\b/.test(msg) || /NO PAYMENT NEEDED/i.test(msg)) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          `Amadeus booking rejected payment block for this offer (pay-at-counter). Motly Stripe payment was refunded — retry booking; Motly no longer sends Amadeus payments. ${msg}`
        );
      }
      if (/\b727\b/.test(msg) || /INTERNAL ERROR/i.test(msg)) {
        throw new ApiError(
          StatusCodes.BAD_GATEWAY,
          [
            "Amadeus booking failed with host error 727 INTERNAL ERROR (Amadeus PDT host — not a Motly/Stripe bug).",
            "Motly Stripe payment was refunded automatically.",
            "With these keys, search/revalidate can succeed while POST /v1/booking/car-orders still returns 727 for some markets (DE cities like HAM/BER/MUC often fail; LON CITY has booked successfully on the same credentials).",
            "Retry with a London (LON CITY) offer to verify the Motly pay→book path, or open an Amadeus ticket with the Ama-Client-Ref below and ask them to enable Cars Quick-Connect booking for your office/market on PDT.",
            config.ama.officeId
              ? `AMA_OFFICE_ID=${config.ama.officeId} (guest_office_id).`
              : "AMA_OFFICE_ID is empty — set your portal DefaultOfficeID if Amadeus assigned one.",
            `Ref: ${msg}`,
          ].join(" ")
        );
      }
    }
    throw error;
  }
};

const getOrderByTravelOrder = async (params: AmadeusTravelOrderRefs) => {
  const { data, amaClientRef } =
    await AmadeusCarApi.getCarOrderByTravelOrder(params);

  return {
    ...mapOrderResponse(data as Record<string, any>),
    amaClientRef,
  };
};

const deleteOrderByTravelOrder = async (
  params: AmadeusTravelOrderRefs,
  user: JwtPayload
) => {
  const userId = requireUserId(user);
  const { data, amaClientRef } =
    await AmadeusCarApi.deleteCarOrderByTravelOrder(params);

  await CarAmadeusOrderModel.findOneAndUpdate(
    {
      user: userId,
      pnrRecordReference: params.pnrRecordReference,
      confirmationNumber: params.confirmationNumber,
    },
    { status: CarAmadeusOrderStatus.CANCELLED, amaClientRef }
  );

  return maybeAttachRaw(
    {
      deleted: true,
      ...params,
      amaClientRef,
    },
    data
  );
};

const issueVoucher = async (
  payload: IssueCarAmadeusVoucherPayload,
  user: JwtPayload
) => {
  const userId = requireUserId(user);
  const coverage = payload.coverage || "PARTIAL";

  const { data, amaClientRef } = await AmadeusCarApi.issueCarVoucher({
    data: {
      travelOrder: {
        pnrRecordReference: payload.pnrRecordReference,
      },
      carOrder: {
        confirmationNumber: payload.confirmationNumber,
        driverFirstName: payload.driverFirstName,
        driverLastName: payload.driverLastName,
      },
      issuanceCriteria: {
        coverage,
        coveredAmount: {
          amount: payload.coveredAmount.amount,
          currencyCode: payload.coveredAmount.currencyCode,
        },
        ...(payload.travelSellerBillingNumber
          ? {
              travelSellerBillingNumber: payload.travelSellerBillingNumber,
            }
          : {}),
      },
    },
  });

  await CarAmadeusOrderModel.findOneAndUpdate(
    {
      user: userId,
      pnrRecordReference: payload.pnrRecordReference,
      confirmationNumber: payload.confirmationNumber,
    },
    { status: CarAmadeusOrderStatus.VOUCHER_ISSUED, amaClientRef }
  );

  return maybeAttachRaw(
    {
      issued: true,
      pnrRecordReference: payload.pnrRecordReference,
      confirmationNumber: payload.confirmationNumber,
      coverage,
      amaClientRef,
    },
    data
  );
};

const searchAgencies = async (
  query: Record<string, string | number | undefined>
) => {
  const { data, amaClientRef } =
    await AmadeusCarApi.searchCarRentalAgencies(query);
  const payload = data as Record<string, any>;

  return maybeAttachRaw(
    {
      agencies: Array.isArray(payload?.data) ? payload.data : [],
      meta: payload?.meta || null,
      amaClientRef,
    },
    data
  );
};

const getMyBookingSummaries = async (
  user: JwtPayload,
  query: { page?: number; limit?: number; status?: string }
) => {
  const userId = requireUserId(user);
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 10;
  const filter: Record<string, unknown> = { user: userId };

  if (query.status) {
    filter.status = query.status;
  }

  // Bounded window for merge+page; drop rawOrder (multi-MB) from list reads.
  const fetchWindow = Math.min(Math.max(page * limit + limit, 40), 120);
  const includeOrphans =
    !query.status || query.status === CarAmadeusOrderStatus.CREATED;
  const orphanFilter = {
    user: userId,
    status: CarPaymentStatus.SUCCEEDED,
    $or: [
      { bookingLedgerId: { $exists: false } },
      { bookingLedgerId: null },
    ],
  };

  const [rows, orphanPayments, orderTotal, orphanTotal] = await Promise.all([
    CarAmadeusOrderModel.find(filter)
      .select("-rawOrder")
      .sort({ createdAt: -1 })
      .limit(fetchWindow)
      .lean(),
    includeOrphans
      ? CarPaymentModel.find(orphanFilter)
          .select(
            "offerId amount currencyCode driverEmail status bookingLedgerId metadata createdAt updatedAt"
          )
          .sort({ createdAt: -1 })
          .limit(Math.min(fetchWindow, 40))
          .lean()
      : Promise.resolve([]),
    CarAmadeusOrderModel.countDocuments(filter),
    includeOrphans
      ? CarPaymentModel.countDocuments(orphanFilter)
      : Promise.resolve(0),
  ]);

  const fromOrders = rows.map((row) =>
    withUiStatus(mapLedgerBookingSummary(row as any))
  );
  const bookedOfferIds = new Set(
    rows.map((row: any) => String(row.offerId || "")).filter(Boolean)
  );
  const fromPayments = (orphanPayments as any[])
    .filter((p) => !bookedOfferIds.has(String(p.offerId || "")))
    .map(mapPaymentToBookingSummary);

  const merged = [...fromPayments, ...fromOrders].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });

  const total = Math.max(
    merged.length,
    Number(orderTotal) + Number(orphanTotal)
  );
  const skip = (page - 1) * limit;
  const data = merged.slice(skip, skip + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

const getMyBookingSummaryById = async (
  user: JwtPayload,
  ledgerId: string
) => {
  const userId = requireUserId(user);

  // Paid-but-not-booked payment row (id = pay_<mongoId>)
  if (ledgerId.startsWith("pay_")) {
    const paymentId = ledgerId.slice(4);
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid booking id");
    }
    const payment = await CarPaymentModel.findOne({
      _id: paymentId,
      user: userId,
    }).lean();
    if (!payment) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
    }
    return mapPaymentToBookingSummary(payment);
  }

  if (!Types.ObjectId.isValid(ledgerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid booking id");
  }

  const order = await CarAmadeusOrderModel.findOne({
    _id: ledgerId,
    user: userId,
  }).lean();

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  return withUiStatus(mapLedgerBookingSummary(order as any));
};

const mapPaymentDetail = (row: any | null | undefined) => {
  if (!row) return null;
  return {
    paymentId: String(row._id || ""),
    paymentIntentId: row.paymentIntentId || "",
    checkoutSessionId: row.checkoutSessionId || "",
    stripePaymentIntentId: row.stripePaymentIntentId || "",
    status: row.status || "",
    stripeStatus: row.stripeStatus || "",
    amount: row.amount || "",
    currencyCode: row.currencyCode || "",
    driverEmail: row.driverEmail || "",
    refundId: row.refundId || "",
    bookingLedgerId: row.bookingLedgerId
      ? String(row.bookingLedgerId)
      : "",
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
};

/** Full booking detail for app View Details (summary + payment + refs). */
const getMyBookingDetailsById = async (
  user: JwtPayload,
  ledgerId: string
) => {
  const userId = requireUserId(user);
  const summary = await getMyBookingSummaryById(user, ledgerId);

  let paymentRow: any = null;
  let amaClientRef = "";

  if (ledgerId.startsWith("pay_")) {
    const paymentId = ledgerId.slice(4);
    paymentRow = await CarPaymentModel.findOne({
      _id: paymentId,
      user: userId,
    }).lean();
  } else if (Types.ObjectId.isValid(ledgerId)) {
    const order = await CarAmadeusOrderModel.findOne({
      _id: ledgerId,
      user: userId,
    })
      .select("amaClientRef")
      .lean();
    amaClientRef = String((order as any)?.amaClientRef || "");
    paymentRow = await CarPaymentModel.findOne({
      user: userId,
      bookingLedgerId: ledgerId,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!paymentRow) {
      paymentRow = await CarPaymentModel.findOne({
        user: userId,
        offerId: summary.offerId,
        status: {
          $in: [CarPaymentStatus.SUCCEEDED, CarPaymentStatus.REFUNDED],
        },
      })
        .sort({ createdAt: -1 })
        .lean();
    }
  }

  const offer = (summary.offer && typeof summary.offer === "object"
    ? summary.offer
    : {}) as Record<string, any>;

  return {
    ...summary,
    logoUrl: summary.logoUrl || offer.logoUrl || "",
    amaClientRef: amaClientRef || summary.amaClientRef || "",
    payment: mapPaymentDetail(paymentRow),
    details: {
      vehicle: {
        model: summary.model || offer.model || "",
        companyName: summary.companyName || offer.companyName || "",
        companyCode: summary.companyCode || offer.companyCode || "",
        acrissCode: summary.acrissCode || offer.acrissCode || "",
        vehicleCategory:
          summary.vehicleCategory || offer.vehicleCategory || "",
        imageUrl: summary.imageUrl || offer.imageUrl || "",
        logoUrl: summary.logoUrl || offer.logoUrl || "",
      },
      schedule: {
        pickupDateTime:
          summary.pickupDateTime || offer.pickupDateTime || "",
        dropoffDateTime:
          summary.dropoffDateTime || offer.dropoffDateTime || "",
      },
      references: {
        ledgerId: summary.ledgerId,
        offerId: summary.offerId || "",
        pnrRecordReference: summary.pnrRecordReference || "",
        confirmationNumber: summary.confirmationNumber || "",
        amaClientRef: amaClientRef || "",
      },
      driver: summary.driver || null,
      pricing: {
        totalAmount: summary.totalAmount || "",
        currencyCode: summary.currencyCode || "",
      },
      status: {
        ledgerStatus: summary.status || "",
        uiStatus: summary.uiStatus || "",
        source: summary.source || "order",
        isPaid: summary.isPaid !== false,
      },
    },
  };
};

export const CarAmadeusService = {
  searchOffers,
  enqueueSearchOffers,
  getSearchJobStatus,
  processSearchJob,
  getOfferById,
  revalidateOffer,
  createOrder,
  getOrderByTravelOrder,
  deleteOrderByTravelOrder,
  issueVoucher,
  searchAgencies,
  getMyBookingSummaries,
  getMyBookingSummaryById,
  getMyBookingDetailsById,
};
