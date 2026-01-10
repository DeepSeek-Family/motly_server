import { model, Schema } from "mongoose";
import { ICar } from "./car.interface";
import { carClass } from "../../../enums/carClass";
import { fuelType } from "../../../enums/fuelType";
import { bookingStatus } from "../../../enums/bookingStatus";
import { paymentStatus } from "../../../enums/paymentStatus";
import { MileageEnum, transmission } from "../../../types/transmission";
// export interface ICar {
//   name: string;
//   class: carClass;
//   doors: number;
//   seats: number;
//   suitcases: number;
//   transmission: transmission;
//   airCondition: boolean;
//   fuelPolicy: fuelType;
//   kilometers: number;
//   description?: string;
//   pricePerDay: number;
//   bookingDate: Date;
//   relaseDate: Date;
//   location: {
//     lat: number;
//     lon: number;
//   };

//   carImages: string[];
//   bookingStatus: bookingStatus;

//   rating?: number;

//   milegLimit: MileageEnum

//   insurance?: string;
//   carAccessories?: Types.ObjectId;
//   user: Types.ObjectId;
// }

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
    seats: {
      type: Number,
      required: true,
    },
    suitcases: {
      type: Number,
      required: true,
    },

    transmission: {
      type: String,
      enum: Object.values(transmission),
      required: true,
    },

    airCondition: {
      type: Boolean,
      required: true,
    },
    pricePerDay: { type: Number, required: true, index: true },

    bookingStatus: {
      type: String,
      enum: Object.values(bookingStatus),
      default: bookingStatus.Pending,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (value: number[]) {
            return value.length === 2;
          },
          message: "Coordinates must be an array of [longitude, latitude]",
        },
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
    rating: {
      type: Number,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    insurance: {
      type: String,
      required: false,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    milegLimit: {
      type: Number,
      enum: [0, 150, 200, 300, 400],
      required: true,
      default: 0,
    } as any,
  },
  { timestamps: true }
);

// for geo location
carModelSchema.index({ location: "2dsphere" });

export const CarModel = model<ICar>("CarList", carModelSchema);
