import { z } from "zod";

const createCarAccessoriesZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Name is required" }),
    icon: z.string({ required_error: "Icon is required" }).optional(),
    price: z.number({ required_error: "Price is required" }),
  }),
});

const updateCarAccessoriesZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    icon: z.string().optional(),
    price: z.number().optional(),
  }),
});

export const carAccessoriesValidation = {
  createCarAccessoriesZodSchema,
  updateCarAccessoriesZodSchema,
};
