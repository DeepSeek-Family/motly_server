import { model, Schema, Types } from "mongoose";
import { ICar } from "./car.interface";
import { carClass } from "../../../enums/carClass";
import { fuelType } from "../../../enums/fuelType";
import { bookingStatus } from "../../../enums/bookingStatus";
import { paymentStatus } from "../../../enums/paymentStatus";

const carModelSchema = new Schema<ICar>(
  {
    name: {
      type: String,
      required: true,
    },
    class: {
      type: String,
      enum: Object.values(carClass),
      required: true,
    },
    doors: {
      type: Number,
      required: true,
    },
    transmission: {
      type: String,
      required: true,
    },
    suitcases: {
      type: Number,
      required: true,
    },
    airCondition: {
      type: Boolean,
      required: true,
    },
    seats: {
      type: Number,
      required: true,
    },
    pricePerDay: {
      type: Number,
      required: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lon: {
        type: Number,
        required: true,
      },
    },
    fuelPolicy: {
      type: String,
      enum: Object.values(fuelType),
      required: true,
    },
    kilometers: {
      type: Number,
      required: true,
    },
    carImages: {
      type: [String],
      required: true,
    },
    pickupLocationType: {
      type: String,
      required: true,
    },
    bookingStatus: {
      type: String,
      enum: Object.values(bookingStatus),
      default: bookingStatus.Pending,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(paymentStatus),
      default: paymentStatus.Pending,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// for geo location
carModelSchema.index({ location: "2dsphere" });

export const CarModel = model<ICar>("CarList", carModelSchema);
