import { z } from "zod";

const createPartnerZodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    companyCode: z.string().trim().toUpperCase().optional(),
    logoUrl: z.string().url(),
    websiteUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

const updatePartnerZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    companyCode: z.string().trim().toUpperCase().optional(),
    logoUrl: z.string().url().optional(),
    websiteUrl: z.string().url().optional().nullable(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
});

export const PartnerValidation = {
  createPartnerZodSchema,
  updatePartnerZodSchema,
};
