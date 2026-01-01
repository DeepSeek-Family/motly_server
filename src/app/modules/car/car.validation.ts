import { z } from "zod";
import { carClass } from "../../../enums/carClass";
import { fuelType } from "../../../enums/fuelType";
import { bookingStatus } from "../../../enums/bookingStatus";
import { paymentStatus } from "../../../enums/paymentStatus";

const createCarValidation = z.object({
  body: z.object({
    name: z.string({
      required_error: "Car name is required",
    }),
    class: z.nativeEnum(carClass, {
      required_error: "Car class is required",
    }),
    doors: z
      .number({
        required_error: "Number of doors is required",
      })
      .int()
      .positive(),
    transmission: z.string({
      required_error: "Transmission type is required",
    }),
    suitcases: z
      .number({
        required_error: "Number of suitcases is required",
      })
      .int()
      .nonnegative(),
    airCondition: z.boolean({
      required_error: "Air condition availability is required",
    }),
    seats: z
      .number({
        required_error: "Number of seats is required",
      })
      .int()
      .positive(),
    pricePerDay: z
      .number({
        required_error: "Price per day is required",
      })
      .positive(),
    location: z.object({
      lat: z
        .number({
          required_error: "Latitude is required",
        })
        .min(-90)
        .max(90),
      lon: z
        .number({
          required_error: "Longitude is required",
        })
        .min(-180)
        .max(180),
    }),
    fuelPolicy: z.nativeEnum(fuelType, {
      required_error: "Fuel policy is required",
    }),
    kilometers: z
      .number({
        required_error: "Kilometers is required",
      })
      .nonnegative(),
    carImages: z.array(z.string()).min(1, "At least one image is required"),
    pickupLocationType: z.string({
      required_error: "Pickup location type is required",
    }),
    user: z.string({
      required_error: "User ID is required",
    }),
    bookingStatus: z.nativeEnum(bookingStatus).optional(),
    paymentStatus: z.nativeEnum(paymentStatus).optional(),
  }),
});

const updateCarValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    class: z.nativeEnum(carClass).optional(),
    doors: z.number().int().positive().optional(),
    transmission: z.string().optional(),
    suitcases: z.number().int().nonnegative().optional(),
    airCondition: z.boolean().optional(),
    seats: z.number().int().positive().optional(),
    pricePerDay: z.number().positive().optional(),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .optional(),
    fuelPolicy: z.nativeEnum(fuelType).optional(),
    kilometers: z.number().nonnegative().optional(),
    carImages: z.array(z.string()).optional(),
    pickupLocationType: z.string().optional(),
    user: z.string().optional(),
    bookingStatus: z.nativeEnum(bookingStatus).optional(),
    paymentStatus: z.nativeEnum(paymentStatus).optional(),
  }),
});

export const CarValidation = {
  createCarValidation,
  updateCarValidation,
};
