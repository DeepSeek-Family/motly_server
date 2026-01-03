import { Types } from "mongoose";
import { carClass } from "../../../enums/carClass";
import { fuelType } from "../../../enums/fuelType";
import { bookingStatus } from "../../../enums/bookingStatus";
import { paymentStatus } from "../../../enums/paymentStatus";

export interface ICar {
  name: string;
  class: carClass;
  doors: number;
  transmission: string;
  suitcases: number;
  airCondition: boolean;
  seats: number;
  pricePerDay: number;
  location: {
    lat: number;
    lon: number;
  };
  fuelPolicy: fuelType;
  kilometers: number;
  carImages: string[];
  pickupLocationType: string;
  bookingStatus: bookingStatus;
  paymentStatus: paymentStatus;
  rating?: number;
  description?: string;
  insurance?: string;
  user: Types.ObjectId;
}
