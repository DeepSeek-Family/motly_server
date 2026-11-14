import { model, Schema } from "mongoose";
import {
  CarAmadeusOrderStatus,
  ICarAmadeusOrder,
} from "./car.interface";

const carAmadeusOrderSchema = new Schema<ICarAmadeusOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    offerId: { type: String, required: true, index: true },
    pnrRecordReference: { type: String, index: true },
    confirmationNumber: { type: String, index: true },
    driver: {
      age: { type: Number, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },
    currencyCode: { type: String },
    totalAmount: { type: String },
    status: {
      type: String,
      enum: Object.values(CarAmadeusOrderStatus),
      default: CarAmadeusOrderStatus.CREATED,
      required: true,
      index: true,
    },
    amaClientRef: { type: String },
    offerSnapshot: {
      model: { type: String },
      companyCode: { type: String },
      companyName: { type: String },
      acrissCode: { type: String },
      vehicleCategory: { type: String },
      imageUrl: { type: String },
      logoUrl: { type: String },
      pickupDateTime: { type: String },
      dropoffDateTime: { type: String },
    },
    rawOrder: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const CarAmadeusOrderModel = model<ICarAmadeusOrder>(
  "CarAmadeusOrder",
  carAmadeusOrderSchema
);
