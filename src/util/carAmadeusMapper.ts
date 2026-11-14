import config from "../config";
import { AmadeusTravelOrderRefs } from "../app/modules/car/car.interface";

type AnyRecord = Record<string, any>;

const asArray = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? (value as AnyRecord[]) : [];

const findClauseTerm = (clauses: AnyRecord[], code: string): AnyRecord => {
  const clause = clauses.find((item) => item?.code === code);
  return (clause?.terms?.[0] as AnyRecord) || {};
};

export const extractTravelRefs = (
  orderPayload: AnyRecord
): AmadeusTravelOrderRefs => {
  const data = (orderPayload?.data || orderPayload || {}) as AnyRecord;
  const orderItems = asArray(data.orderItems);
  const services = asArray(orderItems[0]?.services);
  const extRefs = asArray(services[0]?.measure?.externalRecordReferences);

  let confirmationNumber = "";
  let pnrRecordReference = "";

  extRefs.forEach((ref) => {
    if (ref?.referenceType === "PROVIDER_RESERVATION_RECORD") {
      confirmationNumber = String(ref.confirmationNumber || "");
    }
    if (ref?.referenceType === "PNR" && ref?.pnr) {
      pnrRecordReference = String(ref.pnr.reference || "");
    }
  });

  return { confirmationNumber, pnrRecordReference };
};

const firstMediaHref = (
  medias: AnyRecord[],
  category: string
): string => {
  const match = medias.find((m) => m?.category === category);
  const scales = asArray(match?.mediaScales);
  const href = scales[0]?.href;
  return typeof href === "string" ? href : "";
};

export const mapOfferSummary = (offer: AnyRecord) => {
  const offerItem = asArray(offer.offerItems)[0] || {};
  const price = (offerItem.price || {}) as AnyRecord;
  const clauses = asArray(
    offerItem.contractRules?.termsAndConditions?.clauses
  );
  const pickupTerm = findClauseTerm(clauses, "PICKUP");
  const dropoffTerm = findClauseTerm(clauses, "DROPOFF");
  const mileageTerm = findClauseTerm(clauses, "MILEAGE");
  const companyCtx = (offer.context?.companyContext || {}) as AnyRecord;
  const rateInfo = (offer.context?.pricingOptions || {}) as AnyRecord;
  const carService =
    asArray(offerItem.serviceItems).find(
      (item) => item?.product?.productType === "CAR"
    ) || {};
  const car = (carService.product || {}) as AnyRecord;
  const medias = asArray(offer.retailing?.medias);
  const boot = (car.bootCapacity || {}) as AnyRecord;

  return {
    offerId: offer.id || "",
    status: offer.status || "",
    companyCode: companyCtx.companyCode || car.company?.code || "",
    companyName: car.company?.name || "",
    rateCode: rateInfo.rateCode || "",
    currency: price.currencyCode || "",
    total: price.total?.amount ?? "",
    acrissCode: car.acrissCode || "",
    model: car.carMakeAndModelDescription || "",
    airConditioning: Boolean(car.airConditioning),
    automaticTransmission: Boolean(car.automaticTransmission),
    doors: typeof car.numberOfDoors === "number" ? car.numberOfDoors : null,
    seats: typeof car.numberOfSeats === "number" ? car.numberOfSeats : null,
    smallSuitcases:
      typeof boot.smallSuitcaseCapacity === "number"
        ? boot.smallSuitcaseCapacity
        : null,
    largeSuitcases:
      typeof boot.largeSuitcaseCapacity === "number"
        ? boot.largeSuitcaseCapacity
        : null,
    vehicleCategory: car.vehicleCategory?.description || "",
    imageUrl: firstMediaHref(medias, "CAR_IMAGE"),
    logoUrl: firstMediaHref(medias, "COMPANY_LOGO"),
    pickupDateTime: pickupTerm.localDateTime || "",
    dropoffDateTime: dropoffTerm.localDateTime || "",
    mileageUnlimited: Boolean(mileageTerm.includedMileage?.isUnlimited),
    expirationDateTime: offer.lifecycle?.expirationDateTime || "",
  };
};

export const mapOffersResponse = (payload: AnyRecord) => {
  const result: AnyRecord = {
    offers: asArray(payload?.data).map(mapOfferSummary),
    warnings: asArray(payload?.warnings),
  };

  if (config.ama.includeRaw) {
    result.raw = payload;
  }

  return result;
};

export const mapSingleOfferResponse = (payload: AnyRecord) => {
  const offer = (payload?.data || payload) as AnyRecord;
  const result: AnyRecord = {
    offer: mapOfferSummary(offer),
  };

  if (config.ama.includeRaw) {
    result.raw = payload;
  }

  return result;
};

export const mapOrderResponse = (payload: AnyRecord) => {
  const refs = extractTravelRefs(payload);
  const data = (payload?.data || {}) as AnyRecord;
  const included = (payload?.included || {}) as AnyRecord;
  const carOffers = (included.carOffers || {}) as AnyRecord;
  const offerKey = Object.keys(carOffers)[0];
  const offer = (offerKey ? carOffers[offerKey] : {}) as AnyRecord;
  const offerItem = asArray(offer.offerItems)[0] || {};
  const price = (offerItem.price || {}) as AnyRecord;
  const stakeholders = asArray(data.stakeholders);
  const driverStakeholder =
    stakeholders.find((s) => s?.role === "DRIVER") || {};
  const individual = (driverStakeholder?.party?.individual ||
    {}) as AnyRecord;

  const result: AnyRecord = {
    confirmationNumber: refs.confirmationNumber,
    pnrRecordReference: refs.pnrRecordReference,
    currencyCode: price.currencyCode || "",
    totalAmount: price.total?.amount ?? "",
    driver: {
      firstName: individual.firstName || "",
      lastName: individual.lastName || "",
    },
    offer: offerKey ? mapOfferSummary(offer) : null,
  };

  if (config.ama.includeRaw) {
    result.raw = payload;
  }

  return result;
};

export const maybeAttachRaw = <T extends AnyRecord>(
  mapped: T,
  raw: unknown
): T => {
  if (config.ama.includeRaw) {
    return { ...mapped, raw };
  }
  return mapped;
};

const offerSnapshotFromMapped = (offer: AnyRecord | null | undefined) => {
  if (!offer || typeof offer !== "object") return null;
  const snap = {
    model: String(offer.model || ""),
    companyCode: String(offer.companyCode || ""),
    companyName: String(offer.companyName || ""),
    acrissCode: String(offer.acrissCode || ""),
    vehicleCategory: String(offer.vehicleCategory || ""),
    imageUrl: String(offer.imageUrl || ""),
    logoUrl: String(offer.logoUrl || ""),
    pickupDateTime: String(offer.pickupDateTime || ""),
    dropoffDateTime: String(offer.dropoffDateTime || ""),
  };
  const hasValue = Object.values(snap).some((v) => v.trim().length > 0);
  return hasValue ? snap : null;
};

/** Prefer saved snapshot; fall back to offer embedded in raw Amadeus order. */
const resolveOfferSnapshot = (order: AnyRecord) => {
  const saved = offerSnapshotFromMapped(order.offerSnapshot);
  if (saved) return saved;

  if (order.rawOrder) {
    try {
      const mapped = mapOrderResponse(order.rawOrder as AnyRecord);
      return offerSnapshotFromMapped(mapped.offer);
    } catch {
      return null;
    }
  }
  return null;
};

/** Motly ledger row → FE booking summary (never expose full raw by default). */
export const mapLedgerBookingSummary = (order: AnyRecord) => {
  const offer = resolveOfferSnapshot(order);
  const summary: AnyRecord = {
    ledgerId: String(order._id || order.id || ""),
    offerId: order.offerId || "",
    status: order.status || "",
    pnrRecordReference: order.pnrRecordReference || "",
    confirmationNumber: order.confirmationNumber || "",
    currencyCode: order.currencyCode || "",
    totalAmount: order.totalAmount || "",
    driver: {
      age: order.driver?.age,
      firstName: order.driver?.firstName || "",
      lastName: order.driver?.lastName || "",
      phone: order.driver?.phone || "",
      email: order.driver?.email || "",
    },
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    // Flat fields for FE booking cards (avoid rendering raw offerId as vehicle type)
    model: offer?.model || "",
    companyCode: offer?.companyCode || "",
    companyName: offer?.companyName || "",
    acrissCode: offer?.acrissCode || "",
    vehicleCategory: offer?.vehicleCategory || "",
    imageUrl: offer?.imageUrl || offer?.logoUrl || "",
    pickupDateTime: offer?.pickupDateTime || "",
    dropoffDateTime: offer?.dropoffDateTime || "",
    offer,
  };

  if (config.ama.includeRaw && order.rawOrder !== undefined) {
    summary.raw = order.rawOrder;
  }

  return summary;
};
