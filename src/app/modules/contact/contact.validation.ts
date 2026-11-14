import { z } from "zod";
import { ContactStatus } from "./contact.interface";

const createContactZodSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    subject: z.string().trim().min(1, "Subject is required").max(200),
    message: z.string().trim().min(1, "Feedback is required").max(5000),
    // Email is never accepted from the client — server uses JWT user email.
  }),
});

const updateContactZodSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ContactStatus),
  }),
});

const listContactQueryZodSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
    search: z.string().optional(),
  }),
});

const idParamsZodSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const ContactValidation = {
  createContactZodSchema,
  updateContactZodSchema,
  listContactQueryZodSchema,
  idParamsZodSchema,
};
