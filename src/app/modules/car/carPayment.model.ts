import { model, Schema } from "mongoose";

export enum CarPaymentStatus {
  REQUIRES_PAYMENT = "REQUIRES_PAYMENT",
  PROCESSING = "PROCESSING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export type ICarPayment = {
  user: Schema.Types.ObjectId | string;
  offerId: string;
  amount: string;
  currencyCode: string;
  driverEmail: string;
  /** Motly payment id — Checkout Session id (cs_…). */
  paymentIntentId: string;
  checkoutSessionId?: string;
  /** Stripe Hosted Checkout URL for the client to open. */
  paymentUrl?: string;
  clientSecret?: string;
  status: CarPaymentStatus;
  stripeStatus?: string;
  /** Stripe PaymentIntent id (pi_…) once available. */
  stripePaymentIntentId?: string;
  bookingLedgerId?: Schema.Types.ObjectId | string;
  refundId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

const carPaymentSchema = new Schema<ICarPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    offerId: { type: String, required: true, index: true },
    amount: { type: String, required: true },
    currencyCode: { type: String, required: true },
    driverEmail: { type: String, required: true },
    paymentIntentId: { type: String, required: true, unique: true, index: true },
    checkoutSessionId: { type: String, index: true },
    paymentUrl: { type: String },
    clientSecret: { type: String },
    status: {
      type: String,
      enum: Object.values(CarPaymentStatus),
      required: true,
      index: true,
    },
    stripeStatus: { type: String },
    stripePaymentIntentId: { type: String, index: true },
    bookingLedgerId: { type: Schema.Types.ObjectId, ref: "CarAmadeusOrder" },
    refundId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

carPaymentSchema.index({ user: 1, offerId: 1, status: 1 });
/** My Bookings orphan-payment scan: user + succeeded + missing ledger. */
carPaymentSchema.index({ user: 1, status: 1, createdAt: -1 });
carPaymentSchema.index({ user: 1, status: 1, bookingLedgerId: 1 });

export const CarPaymentModel = model<ICarPayment>(
  "CarPayment",
  carPaymentSchema
);
