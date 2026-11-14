import { z } from "zod";
import { USER_ROLES } from "../../../enums/user";

const createUserZodSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: "Name is required" }).min(1),
      email: z
        .string({ required_error: "Email is required" })
        .email({ message: "Invalid email address" }),
      password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string({
        required_error: "Confirm password is required",
      }),
      role: z.nativeEnum(USER_ROLES, {
        required_error: "Role is required",
      }),
      loginWith: z.enum(["email", "google"], {
        required_error: "loginWith is required",
      }),
      contact: z.string().optional(),
      DOB: z.string().optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      residentialAddress: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Password and Confirm password doesn't match!",
      path: ["confirmPassword"],
    }),
});

const createAdminZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Name is required" }),
    email: z
      .string({ required_error: "Email is required" })
      .email({ message: "Invalid email address" }),
    password: z.string({ required_error: "Password is required" }),
    role: z.string({ required_error: "Role is required" }),
  }),
});

export const UserValidation = {
  createUserZodSchema,
  createAdminZodSchema,
};
