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
  milegLimit: MileageEnum;
  insurance?: string;
  user: Types.ObjectId;
}

export enum CarAmadeusOrderStatus {
  CREATED = "CREATED",
  CANCELLED = "CANCELLED",
  VOUCHER_ISSUED = "VOUCHER_ISSUED",
}

export interface ICarAmadeusDriver {
  age: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface ICarAmadeusOfferSnapshot {
  model?: string;
  companyCode?: string;
  companyName?: string;
  acrissCode?: string;
  vehicleCategory?: string;
  imageUrl?: string;
  logoUrl?: string;
  pickupDateTime?: string;
  dropoffDateTime?: string;
}

export interface ICarAmadeusOrder {
  user: Types.ObjectId;
  offerId: string;
  pnrRecordReference?: string;
  confirmationNumber?: string;
  driver: ICarAmadeusDriver;
  currencyCode?: string;
  totalAmount?: string;
  status: CarAmadeusOrderStatus;
  amaClientRef?: string;
  /** Denormalized offer fields for booking list/cards (avoid showing raw offerId). */
  offerSnapshot?: ICarAmadeusOfferSnapshot;
  rawOrder?: unknown;
}

export type AmadeusCarOfferSearchBody = Record<string, unknown>;

export type AmadeusCarOrderCreateBody = {
  offerId: string;
  driver: {
    age: number;
    contacts: Array<
      { phone: { text: string } } | { email: { address: string } }
    >;
    names: Array<{ firstName: string; lastName: string }>;
  };
  payments?: Array<{
    amount: { currencyCode: string; amount: string };
    paymentInstrument: { instrumentType: string };
  }>;
};

export type AmadeusVoucherBody = {
  data: {
    travelOrder: { pnrRecordReference: string };
    carOrder: {
      confirmationNumber: string;
      driverLastName: string;
      driverFirstName: string;
    };
    issuanceCriteria: {
      coverage: string;
      coveredAmount: { amount: string; currencyCode: string };
      travelSellerBillingNumber?: string;
    };
  };
};

export type AmadeusTravelOrderRefs = {
  pnrRecordReference: string;
  confirmationNumber: string;
};

export type CreateCarAmadeusOrderPayload = {
  offerId: string;
  paymentIntentId: string;
  driver: ICarAmadeusDriver;
};

export type IssueCarAmadeusVoucherPayload = {
  pnrRecordReference: string;
  confirmationNumber: string;
  driverFirstName: string;
  driverLastName: string;
  coverage?: "PARTIAL" | "FULL_CREDIT";
  coveredAmount: { amount: string; currencyCode: string };
  travelSellerBillingNumber?: string;
};
