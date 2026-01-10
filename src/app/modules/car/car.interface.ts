import { Types } from "mongoose";
import { carClass } from "../../../enums/carClass";
import { fuelType } from "../../../enums/fuelType";
import { bookingStatus } from "../../../enums/bookingStatus";
import { MileageEnum, transmission } from "../../../types/transmission";

export interface ICar {
  name: string;
  class: carClass;
  doors: number;
  seats: number;
  suitcases: number;
  transmission: transmission;
  airCondition: boolean;
  fuelPolicy: fuelType;
  kilometers: number;
  description?: string;
  pricePerDay: number;
  location: {
    type: string;
    coordinates: number[];
  };
  carImages: string[];
  bookingStatus: bookingStatus;
  rating?: number;
  milegLimit: MileageEnum
  insurance?: string;
  user: Types.ObjectId;
}
