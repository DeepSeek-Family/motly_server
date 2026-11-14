import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import Stripe from "stripe";
import config from "../../../config";
import stripe from "../../../config/stripe";
import ApiError from "../../../errors/ApiErrors";
import { AmadeusCarApi } from "../../../integrations/amadeus/amadeusCar.api";
import { mapOfferSummary } from "../../../util/carAmadeusMapper";
import {
  CarPaymentModel,
  CarPaymentStatus,
  ICarPayment,
} from "./carPayment.model";

/** Stripe zero-decimal currencies (amount is already the smallest unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const toMinorUnits = (amount: string, currencyCode: string): number => {
  const normalized = amount.trim().replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid payment amount");
  }
  const code = currencyCode.trim().toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return Math.round(value);
  }
  return Math.round(value * 100);
};

const fromMinorUnits = (amount: number): string => (amount / 100).toFixed(2);

const mapStripeStatus = (status: Stripe.PaymentIntent.Status): CarPaymentStatus => {
  switch (status) {
    case "succeeded":
      return CarPaymentStatus.SUCCEEDED;
    case "processing":
    case "requires_action":
    case "requires_confirmation":
      return CarPaymentStatus.PROCESSING;
    case "requires_payment_method":
      return CarPaymentStatus.REQUIRES_PAYMENT;
    case "canceled":
      return CarPaymentStatus.FAILED;
    default:
      return CarPaymentStatus.FAILED;
  }
};

const assertStripeConfigured = () => {
  const key = config.stripe.stripeSecretKey || "";
  if (!key || key.includes("your_stripe") || !key.startsWith("sk_")) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "Stripe is not configured. Set STRIPE_SECRET_KEY (sk_test_...)."
    );
  }
};

const requireUserId = (user: JwtPayload): string => {
  if (!user?.id) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  return String(user.id);
};

const publicApiOrigin = () => {
  const fromEnv = String(config.publicApiUrl || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const ip = String(config.ip_address || "127.0.0.1").trim();
  const port = String(config.port || "5000").trim();
  return `http://${ip}:${port}`;
};

const checkoutReturnBase = () =>
  `${publicApiOrigin()}/api/v1/car/payments/checkout-return`;

/** Per-checkout return URLs (success supports Stripe {CHECKOUT_SESSION_ID}). */
const buildCheckoutReturnUrls = (opts: {
  offerId: string;
  userId: string;
  client: "app" | "web";
}) => {
  const base = checkoutReturnBase();
  const q = new URLSearchParams({
    client: opts.client,
    offerId: opts.offerId,
    userId: opts.userId,
  });
  const envSuccess = (config.stripe.successUrl || "").trim();
  const envCancel = (config.stripe.cancelUrl || "").trim();
  return {
    success_url:
      envSuccess ||
      `${base}?status=success&session_id={CHECKOUT_SESSION_ID}&${q.toString()}`,
    cancel_url: envCancel || `${base}?status=cancel&${q.toString()}`,
  };
};

const webFrontendOrigin = () =>
  String(config.webFrontendUrl || "").trim().replace(/\/$/, "");

/** Legacy rows may still have a stored URL; new rows never persist it. */
const resolveStoredPaymentUrl = (row: ICarPayment) =>
  row.paymentUrl ||
  (row.metadata && typeof row.metadata.checkoutUrl === "string"
    ? row.metadata.checkoutUrl
    : row.metadata && typeof row.metadata.paymentUrl === "string"
      ? row.metadata.paymentUrl
      : undefined);

const resolveCheckoutSessionId = (row: ICarPayment) =>
  row.checkoutSessionId ||
  (row.metadata && typeof row.metadata.checkoutSessionId === "string"
    ? row.metadata.checkoutSessionId
    : row.paymentIntentId.startsWith("cs_")
      ? row.paymentIntentId
      : undefined);

/** Checkout URL for the client only — prefer live Stripe session, never require DB URL. */
const resolveLivePaymentUrl = async (row: ICarPayment) => {
  const stored = resolveStoredPaymentUrl(row);
  if (stored) return stored;

  const sessionId = resolveCheckoutSessionId(row);
  if (!sessionId) return undefined;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.url || undefined;
  } catch {
    return undefined;
  }
};

const toPublicPayment = async (row: ICarPayment & { _id?: unknown }) => {
  const paymentUrl = await resolveLivePaymentUrl(row);
  const checkoutSessionId = resolveCheckoutSessionId(row);
  return {
    paymentIntentId: row.paymentIntentId,
    checkoutSessionId,
    /** SELE-style alias — client opens this Hosted Checkout URL (not stored in DB). */
    paymentUrl,
    checkoutUrl: paymentUrl,
    status: row.status,
    offerId: row.offerId,
    amount: row.amount,
    currencyCode: row.currencyCode,
  };
};

const syncPaymentFromCheckoutSession = async (row: ICarPayment) => {
  const sessionId = resolveCheckoutSessionId(row) || null;
  if (!sessionId) return null;

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
  const intent =
    typeof session.payment_intent === "object" && session.payment_intent
      ? (session.payment_intent as Stripe.PaymentIntent)
      : null;

  const stripePaymentIntentId =
    intent?.id ||
    (typeof session.payment_intent === "string" ? session.payment_intent : null);

  let status = row.status;
  if (session.payment_status === "paid" || intent?.status === "succeeded") {
    status = CarPaymentStatus.SUCCEEDED;
  } else if (session.status === "expired") {
    status = CarPaymentStatus.FAILED;
  } else if (intent) {
    status = mapStripeStatus(intent.status);
  }

  const nextMeta = { ...(row.metadata || {}) } as Record<string, unknown>;
  delete nextMeta.paymentUrl;
  delete nextMeta.checkoutUrl;
  nextMeta.checkoutSessionId = sessionId;
  if (stripePaymentIntentId) {
    nextMeta.stripePaymentIntentId = stripePaymentIntentId;
  }

  const updated = await CarPaymentModel.findOneAndUpdate(
    { _id: (row as any)._id },
    {
      $set: {
        status,
        stripeStatus: intent?.status || session.status || row.stripeStatus,
        clientSecret: intent?.client_secret || row.clientSecret,
        checkoutSessionId: sessionId,
        ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
        metadata: nextMeta,
      },
      $unset: { paymentUrl: "" },
    },
    { new: true }
  );

  return updated;
};

const resolveStripePaymentIntentId = (row: ICarPayment): string | null => {
  if (
    typeof row.stripePaymentIntentId === "string" &&
    row.stripePaymentIntentId.startsWith("pi_")
  ) {
    return row.stripePaymentIntentId;
  }
  if (
    row.metadata &&
    typeof row.metadata.stripePaymentIntentId === "string" &&
    row.metadata.stripePaymentIntentId.startsWith("pi_")
  ) {
    return row.metadata.stripePaymentIntentId;
  }
  if (row.paymentIntentId.startsWith("pi_")) {
    return row.paymentIntentId;
  }
  return null;
};

const syncPaymentFromStripe = async (paymentIntentId: string) => {
  assertStripeConfigured();

  const existing = await CarPaymentModel.findOne({ paymentIntentId });
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }

  if (
    paymentIntentId.startsWith("cs_") ||
    (existing.metadata && existing.metadata.checkoutSessionId)
  ) {
    const fromSession = await syncPaymentFromCheckoutSession(existing);
    if (fromSession) return fromSession;
  }

  const stripePiId =
    resolveStripePaymentIntentId(existing) || paymentIntentId;
  const intent = await stripe.paymentIntents.retrieve(stripePiId);
  const status = mapStripeStatus(intent.status);

  const row = await CarPaymentModel.findOneAndUpdate(
    { paymentIntentId },
    {
      status:
        intent.amount_received > 0 && intent.status === "succeeded"
          ? CarPaymentStatus.SUCCEEDED
          : status,
      stripeStatus: intent.status,
      clientSecret: intent.client_secret || undefined,
      metadata: {
        ...(existing.metadata || {}),
        stripePaymentIntentId: intent.id,
      },
    },
    { new: true }
  );

  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }

  return row;
};

const markPaymentFailedByIds = async (opts: {
  paymentIntentId?: string;
  sessionId?: string;
  offerId?: string;
  userId?: string;
}) => {
  const or: Record<string, unknown>[] = [];
  if (opts.paymentIntentId) {
    or.push({ paymentIntentId: opts.paymentIntentId });
    or.push({ checkoutSessionId: opts.paymentIntentId });
  }
  if (opts.sessionId) {
    or.push({ paymentIntentId: opts.sessionId });
    or.push({ checkoutSessionId: opts.sessionId });
    or.push({ "metadata.checkoutSessionId": opts.sessionId });
  }

  const filter: Record<string, unknown> = {
    status: {
      $in: [
        CarPaymentStatus.REQUIRES_PAYMENT,
        CarPaymentStatus.PROCESSING,
      ],
    },
  };

  if (or.length) {
    filter.$or = or;
  } else if (opts.offerId && opts.userId) {
    filter.offerId = opts.offerId;
    filter.user = opts.userId;
  } else {
    return null;
  }

  const row = await CarPaymentModel.findOneAndUpdate(
    filter,
    {
      $set: {
        status: CarPaymentStatus.FAILED,
        stripeStatus: "canceled",
      },
      $unset: {
        paymentUrl: "",
        "metadata.paymentUrl": "",
        "metadata.checkoutUrl": "",
      },
    },
    { sort: { createdAt: -1 }, new: true }
  );

  // Best-effort expire open Stripe Checkout session so it cannot be paid later.
  const sessionId =
    row?.checkoutSessionId ||
    (row?.paymentIntentId?.startsWith("cs_") ? row.paymentIntentId : undefined) ||
    opts.sessionId;
  if (sessionId?.startsWith("cs_")) {
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // already completed / expired
    }
  }

  return row;
};

const cancelOpenPayment = async (
  paymentIntentId: string,
  user: JwtPayload
) => {
  const userId = requireUserId(user);
  const row = await CarPaymentModel.findOne({
    paymentIntentId,
    user: userId,
  });
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }
  if (row.status === CarPaymentStatus.SUCCEEDED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Paid sessions cannot be cancelled here"
    );
  }
  if (row.status === CarPaymentStatus.FAILED) {
    return await toPublicPayment(row);
  }

  const updated = await markPaymentFailedByIds({
    paymentIntentId,
    sessionId: row.checkoutSessionId,
    offerId: row.offerId,
    userId,
  });
  return await toPublicPayment(updated || row);
};

const createPaymentIntent = async (
  payload: {
    offerId: string;
    amount: string;
    currencyCode: string;
    driverEmail: string;
    client?: "app" | "web";
  },
  user: JwtPayload
) => {
  assertStripeConfigured();
  const userId = requireUserId(user);
  const client: "app" | "web" =
    payload.client === "web" ? "web" : "app";

  // Re-read offer so amount cannot be spoofed blindly.
  const { data } = await AmadeusCarApi.getCarOfferById(payload.offerId);
  const offerPayload = (data as any)?.data || data;
  const mapped = mapOfferSummary(offerPayload as Record<string, any>);

  const amount = String(mapped.total || payload.amount || "").trim();
  const currencyCode = String(
    mapped.currency || payload.currencyCode || ""
  )
    .trim()
    .toUpperCase();

  if (!amount || !currencyCode) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Offer amount/currency unavailable. Refresh the offer and try again."
    );
  }

  // Prefer server amount when present; still accept FE amount if equal.
  if (
    payload.amount &&
    Number(payload.amount) > 0 &&
    Math.abs(Number(payload.amount) - Number(amount)) > 0.009
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Payment amount mismatch. Expected ${amount} ${currencyCode}`
    );
  }

  const existing = await CarPaymentModel.findOne({
    user: userId,
    offerId: payload.offerId,
    status: {
      $in: [
        CarPaymentStatus.REQUIRES_PAYMENT,
        CarPaymentStatus.PROCESSING,
        CarPaymentStatus.SUCCEEDED,
      ],
    },
  }).sort({ createdAt: -1 });

  if (existing?.status === CarPaymentStatus.SUCCEEDED) {
    return {
      ...(await toPublicPayment(existing)),
      status: existing.status,
    };
  }

  if (
    existing &&
    (existing.status === CarPaymentStatus.REQUIRES_PAYMENT ||
      existing.status === CarPaymentStatus.PROCESSING)
  ) {
    const synced = await syncPaymentFromStripe(existing.paymentIntentId);
    if (synced.status === CarPaymentStatus.SUCCEEDED) {
      return await toPublicPayment(synced);
    }
    // Reuse open session — URL comes from Stripe live, not DB.
    const live = await toPublicPayment(synced);
    if (live.paymentUrl || synced.status === CarPaymentStatus.PROCESSING) {
      return live;
    }
  }

  // Stripe Hosted Checkout (same pattern as SELE): return session.url to client.
  // Motly is not a Connect marketplace — no transfer_data / application_fee.
  // Persist everything except checkout/payment URLs.
  const carName = String(mapped.model || "").trim();
  const companyName = String(mapped.companyName || "").trim();
  const productName = (
    carName
      ? companyName
        ? `${carName} · ${companyName}`
        : carName
      : companyName || "Motly car rental"
  ).slice(0, 120);

  const productDescription = [
    mapped.pickupDateTime
      ? `Pickup ${String(mapped.pickupDateTime).slice(0, 16).replace("T", " ")}`
      : "",
    mapped.dropoffDateTime
      ? `Return ${String(mapped.dropoffDateTime).slice(0, 16).replace("T", " ")}`
      : "",
    mapped.acrissCode ? `Class ${mapped.acrissCode}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 500);

  const stripeMeta = {
    offerId: payload.offerId,
    userId,
    driverEmail: payload.driverEmail,
    source: "motly_car_booking",
    carName: carName || productName,
    companyName,
  };

  const returnUrls = buildCheckoutReturnUrls({
    offerId: payload.offerId,
    userId,
    client,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: payload.driverEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: currencyCode.toLowerCase(),
          unit_amount: toMinorUnits(amount, currencyCode),
          product_data: {
            name: productName,
            ...(productDescription
              ? { description: productDescription }
              : {}),
            // Avoid remote product images in Checkout — some Android WebViews
            // surface ORB / mixed-content noise from third-party image hosts.
          },
        },
      },
    ],
    success_url: returnUrls.success_url,
    cancel_url: returnUrls.cancel_url,
    metadata: { ...stripeMeta, client },
    payment_intent_data: {
      metadata: stripeMeta,
    },
  });

  if (!session.url) {
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      "Stripe did not return a Checkout URL"
    );
  }

  const paymentIntentId = session.id;
  const row = await CarPaymentModel.create({
    user: userId,
    offerId: payload.offerId,
    amount,
    currencyCode: currencyCode,
    driverEmail: payload.driverEmail,
    paymentIntentId,
    checkoutSessionId: session.id,
    status: CarPaymentStatus.REQUIRES_PAYMENT,
    stripeStatus: session.status || "open",
    metadata: {
      checkoutSessionId: session.id,
      source: "motly_car_booking",
      userId,
      driverEmail: payload.driverEmail,
      offerSnapshot: mapped,
      amount,
      currencyCode,
    },
  });

  // URL is returned to the client only — not written to Mongo.
  return {
    ...(await toPublicPayment(row)),
    paymentUrl: session.url,
    checkoutUrl: session.url,
  };
};

const getPaymentStatus = async (paymentIntentId: string, user: JwtPayload) => {
  const userId = requireUserId(user);
  const row = await CarPaymentModel.findOne({ paymentIntentId, user: userId });
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }

  // Keep Motly ledger fresh from Stripe before FE books.
  if (
    row.status !== CarPaymentStatus.REFUNDED &&
    row.status !== CarPaymentStatus.SUCCEEDED
  ) {
    const synced = await syncPaymentFromStripe(paymentIntentId);
    return await toPublicPayment(synced);
  }

  return await toPublicPayment(row);
};

const refundPayment = async (
  paymentIntentId: string,
  user: JwtPayload,
  reason = "requested_by_customer"
) => {
  assertStripeConfigured();
  const userId = requireUserId(user);
  const row = await CarPaymentModel.findOne({ paymentIntentId, user: userId });
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payment not found");
  }
  if (row.status === CarPaymentStatus.REFUNDED) {
    return await toPublicPayment(row);
  }
  if (row.status !== CarPaymentStatus.SUCCEEDED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only succeeded payments can be refunded"
    );
  }

  const stripePiId = resolveStripePaymentIntentId(row);
  if (!stripePiId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Stripe payment intent not ready for refund yet"
    );
  }

  const refund = await stripe.refunds.create({
    payment_intent: stripePiId,
    reason: reason as Stripe.RefundCreateParams.Reason,
  });

  row.status = CarPaymentStatus.REFUNDED;
  row.refundId = refund.id;
  await row.save();
  return await toPublicPayment(row);
};

const assertPaymentAllowsBooking = async (params: {
  userId: string;
  offerId: string;
  paymentIntentId: string;
}) => {
  const row = await CarPaymentModel.findOne({
    paymentIntentId: params.paymentIntentId,
    user: params.userId,
  });

  if (!row) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      "Payment not found for this booking"
    );
  }

  let current = row;
  if (current.status !== CarPaymentStatus.SUCCEEDED) {
    current = await syncPaymentFromStripe(params.paymentIntentId);
  }

  if (current.status !== CarPaymentStatus.SUCCEEDED) {
    throw new ApiError(
      StatusCodes.PAYMENT_REQUIRED,
      `Payment not completed (status=${current.status})`
    );
  }

  if (current.offerId !== params.offerId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Payment offerId does not match booking offerId"
    );
  }

  if (current.bookingLedgerId) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "This payment was already used for a booking"
    );
  }

  return current;
};

const attachBookingToPayment = async (
  paymentIntentId: string,
  ledgerId: string
) => {
  await CarPaymentModel.findOneAndUpdate(
    { paymentIntentId },
    { bookingLedgerId: ledgerId }
  );
};

const refundPaymentInternal = async (
  paymentIntentId: string,
  reason = "requested_by_customer"
) => {
  assertStripeConfigured();
  const row = await CarPaymentModel.findOne({ paymentIntentId });
  if (!row || row.status === CarPaymentStatus.REFUNDED) {
    return row;
  }
  if (row.status !== CarPaymentStatus.SUCCEEDED) {
    return row;
  }

  const stripePiId = resolveStripePaymentIntentId(row) || paymentIntentId;
  if (!stripePiId.startsWith("pi_")) {
    return row;
  }

  const refund = await stripe.refunds.create({
    payment_intent: stripePiId,
    reason: reason as Stripe.RefundCreateParams.Reason,
  });

  row.status = CarPaymentStatus.REFUNDED;
  row.refundId = refund.id;
  await row.save();
  return row;
};

const applyStripeWebhookEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      let status = CarPaymentStatus.REQUIRES_PAYMENT;
      if (
        event.type === "checkout.session.expired" ||
        event.type === "checkout.session.async_payment_failed" ||
        session.status === "expired"
      ) {
        status = CarPaymentStatus.FAILED;
      } else if (
        session.payment_status === "paid" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        status = CarPaymentStatus.SUCCEEDED;
      } else if (session.payment_status === "unpaid" && session.status === "complete") {
        // Hosted Checkout closed without pay — treat as failed, not pending.
        status = CarPaymentStatus.FAILED;
      } else {
        status = CarPaymentStatus.PROCESSING;
      }

      await CarPaymentModel.findOneAndUpdate(
        {
          $or: [
            { paymentIntentId: session.id },
            { checkoutSessionId: session.id },
            { "metadata.checkoutSessionId": session.id },
          ],
        },
        {
          $set: {
            status,
            stripeStatus: session.status || event.type,
            checkoutSessionId: session.id,
            ...(piId ? { stripePaymentIntentId: piId } : {}),
            ...(piId
              ? { "metadata.stripePaymentIntentId": piId }
              : {}),
            "metadata.checkoutSessionId": session.id,
          },
          $unset: {
            paymentUrl: "",
            "metadata.paymentUrl": "",
            "metadata.checkoutUrl": "",
          },
        }
      );
      break;
    }
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
    case "payment_intent.processing": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await CarPaymentModel.findOneAndUpdate(
        {
          $or: [
            { paymentIntentId: intent.id },
            { stripePaymentIntentId: intent.id },
            { "metadata.stripePaymentIntentId": intent.id },
          ],
        },
        {
          status: mapStripeStatus(intent.status),
          stripeStatus: intent.status,
          clientSecret: intent.client_secret || undefined,
          stripePaymentIntentId: intent.id,
          "metadata.stripePaymentIntentId": intent.id,
        }
      );
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (paymentIntentId) {
        await CarPaymentModel.findOneAndUpdate(
          {
            $or: [
              { paymentIntentId },
              { stripePaymentIntentId: paymentIntentId },
              { "metadata.stripePaymentIntentId": paymentIntentId },
            ],
          },
          {
            status: CarPaymentStatus.REFUNDED,
            stripeStatus: event.type,
          }
        );
      }
      break;
    }
    case "refund.created":
    case "refund.updated":
    case "charge.refund.updated": {
      const refund = event.data.object as Stripe.Refund;
      const paymentIntentId =
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id;
      if (paymentIntentId) {
        await CarPaymentModel.findOneAndUpdate(
          {
            $or: [
              { paymentIntentId },
              { stripePaymentIntentId: paymentIntentId },
              { "metadata.stripePaymentIntentId": paymentIntentId },
            ],
          },
          {
            status: CarPaymentStatus.REFUNDED,
            refundId: refund.id,
            stripeStatus: refund.status || event.type,
          }
        );
      }
      break;
    }
    default:
      break;
  }
};

const isUsableStripeSecret = (key?: string) =>
  Boolean(
    key &&
      key.startsWith("sk_") &&
      !key.includes("your_stripe") &&
      key.length > 20
  );

const getPublishableConfig = () => {
  const publishableKey = String(config.stripe.publishableKey || "").trim();
  const secretOk = isUsableStripeSecret(
    String(config.stripe.stripeSecretKey || "")
  );
  return {
    publishableKey,
    // Server payment is ready when secret is set. Publishable key is only
    // needed by Flutter PaymentSheet (client); omit it if unused.
    configured: secretOk,
    clientReady:
      secretOk &&
      publishableKey.startsWith("pk_") &&
      !publishableKey.includes("your_stripe"),
  };
};

const toMotlyInvoiceId = (mongoId: string) =>
  `INV-${String(mongoId).slice(-8).toUpperCase()}`;

const formatTxnDateTime = (raw?: string | Date | null) => {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatTxnBookingDate = (raw?: string | Date | null) => {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const rentalDurationLabel = (
  pickup?: string | null,
  dropoff?: string | null
) => {
  if (!pickup || !dropoff) return "";
  const start = new Date(pickup);
  const end = new Date(dropoff);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return "";
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  return days === 1 ? "1 day" : `${days} days`;
};

const mapPaymentTransaction = (row: any) => {
  const snap =
    row.metadata &&
    typeof row.metadata === "object" &&
    row.metadata.offerSnapshot &&
    typeof row.metadata.offerSnapshot === "object"
      ? (row.metadata.offerSnapshot as Record<string, any>)
      : {};

  const mongoId = String(row._id);
  const pickup =
    typeof snap.pickupDateTime === "string" ? snap.pickupDateTime : "";
  const dropoff =
    typeof snap.dropoffDateTime === "string" ? snap.dropoffDateTime : "";
  const carName =
    (typeof snap.model === "string" && snap.model.trim()) ||
    (typeof snap.vehicleCategory === "string" && snap.vehicleCategory.trim()) ||
    (typeof snap.companyName === "string" && snap.companyName.trim()) ||
    "Car booking";
  const location =
    (typeof snap.companyName === "string" && snap.companyName.trim()) ||
    (typeof snap.companyCode === "string" && snap.companyCode.trim()) ||
    "";
  const currency = String(row.currencyCode || snap.currency || "EUR").toUpperCase();
  const amount = String(row.amount || snap.total || "");

  return {
    id: mongoId,
    invoiceId: toMotlyInvoiceId(mongoId),
    paymentIntentId: row.paymentIntentId,
    status: row.status,
    bookingDate: formatTxnBookingDate(row.createdAt),
    bookingDateRaw: row.createdAt || null,
    carName,
    rentalDuration: rentalDurationLabel(pickup, dropoff),
    pickupDateTime: formatTxnDateTime(pickup),
    dropoffDateTime: formatTxnDateTime(dropoff),
    pickupDateTimeRaw: pickup || null,
    dropoffDateTimeRaw: dropoff || null,
    location,
    amount,
    currencyCode: currency,
    totalDisplay: amount ? `${currency} ${amount}` : "",
    offerId: row.offerId || "",
    bookingLedgerId: row.bookingLedgerId
      ? String(row.bookingLedgerId)
      : null,
    createdAt: row.createdAt || null,
  };
};

/** JWT user → own payment/transaction history only. */
const getMyPayments = async (
  user: JwtPayload,
  query: { page?: number; limit?: number; status?: string }
) => {
  const userId = requireUserId(user);
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit =
    query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 20;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { user: userId };
  if (query.status) {
    filter.status = String(query.status).toUpperCase();
  }

  const [rows, total] = await Promise.all([
    CarPaymentModel.find(filter)
      .select(
        "offerId amount currencyCode driverEmail paymentIntentId status bookingLedgerId metadata createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CarPaymentModel.countDocuments(filter),
  ]);

  return {
    data: rows.map(mapPaymentTransaction),
    pagination: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

export const CarPaymentService = {
  createPaymentIntent,
  getPaymentStatus,
  getMyPayments,
  refundPayment,
  cancelOpenPayment,
  markPaymentFailedByIds,
  syncPaymentFromStripe,
  webFrontendOrigin,
  assertPaymentAllowsBooking,
  attachBookingToPayment,
  refundPaymentInternal,
  applyStripeWebhookEvent,
  getPublishableConfig,
};
