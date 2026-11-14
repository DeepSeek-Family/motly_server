import { z } from "zod";

const geoCodeSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const searchRadiusSchema = z.object({
  unit: z.enum(["KILOMETERS", "MILES"]).optional(),
  value: z.number().positive(),
});

const locationSchema = z
  .object({
    subtype: z.enum(["AIRPORT", "CITY"]).optional(),
    iataCode: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().length(3).regex(/^[A-Z]{3}$/))
      .optional(),
    geoCode: geoCodeSchema.optional(),
  })
  .refine(
    (loc) => Boolean(loc.iataCode) || Boolean(loc.geoCode),
    "Location requires iataCode or geoCode"
  );

const companiesSearchParameterSchema = z.object({
  companyCode: z.string().min(1),
  pricingOptions: z
    .object({
      corporateDiscountCode: z.string().optional(),
      promotionalCode: z.string().optional(),
    })
    .optional(),
});

/** Motly post-filters on mapped offers (not sent to Amadeus / not in cache hash). */
const offerFiltersSchema = z
  .object({
    /** Agency / rental company display name (matches companyName, case-insensitive). */
    agencyNames: z.array(z.string().min(1)).max(20).optional(),
    companyNames: z.array(z.string().min(1)).max(20).optional(),
    vehicleCategories: z.array(z.string().min(1)).max(20).optional(),
    doors: z.array(z.coerce.number().int().min(1).max(9)).max(10).optional(),
    seats: z.array(z.coerce.number().int().min(1).max(15)).max(10).optional(),
  })
  .optional();

const searchOffersValidation = z.object({
  body: z
    .object({
      pickUp: z.object({
        location: locationSchema,
        localDateTime: z.string().min(1),
        searchRadius: searchRadiusSchema.optional(),
      }),
      dropOff: z.object({
        location: locationSchema.optional(),
        localDateTime: z.string().min(1),
      }),
      vehicle: z
        .object({
          acrissCode: z.string().min(1).optional(),
        })
        .optional(),
      driver: z
        .object({
          age: z.number().int().min(18).max(99).optional(),
        })
        .optional(),
      companiesSearchParameters: z
        .array(companiesSearchParameterSchema)
        .optional(),
      // Motly-only: filter cached search results by mapped offer fields.
      filters: offerFiltersSchema,
      // Cursor pagination over Motly-cached Amadeus result set.
      cursor: z.string().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    })
    .superRefine((body, ctx) => {
      if (body.pickUp.location.geoCode && !body.pickUp.searchRadius) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "searchRadius is required when using geoCode",
          path: ["pickUp", "searchRadius"],
        });
      }
    }),
});

const offerIdParamsValidation = z.object({
  params: z.object({
    offerId: z.string().min(1),
  }),
});

const searchJobParamsValidation = z.object({
  params: z.object({
    jobId: z.string().min(1),
  }),
});

const createOrderValidation = z.object({
  body: z.object({
    offerId: z.string().min(1),
    paymentIntentId: z.string().min(1),
    driver: z.object({
      age: z.number().int().min(18).max(99),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email(),
    }),
  }),
});

const createPaymentIntentValidation = z.object({
  body: z.object({
    offerId: z.string().min(1),
    amount: z.string().min(1),
    currencyCode: z.string().min(3).max(3),
    driverEmail: z.string().email(),
    /** Where Stripe should bounce after Motly checkout-return. */
    client: z.enum(["app", "web"]).optional(),
  }),
});

const paymentIntentParamsValidation = z.object({
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
});

const travelOrderQueryValidation = z.object({
  query: z.object({
    pnrRecordReference: z.string().min(1),
    confirmationNumber: z.string().min(1),
  }),
});

const issueVoucherValidation = z.object({
  body: z.object({
    pnrRecordReference: z.string().min(1),
    confirmationNumber: z.string().min(1),
    driverFirstName: z.string().min(1),
    driverLastName: z.string().min(1),
    coverage: z.enum(["PARTIAL", "FULL_CREDIT"]).optional(),
    coveredAmount: z.object({
      amount: z.string().min(1),
      currencyCode: z.string().min(1),
    }),
    travelSellerBillingNumber: z.string().optional(),
  }),
});

const agenciesQueryValidation = z.object({
  query: z
    .object({
      cityCode: z.string().optional(),
      airportCode: z.string().optional(),
      countryCode: z.string().optional(),
      stateCode: z.string().optional(),
      carRentalCompanyCodes: z.string().optional(),
      vicinity: z.string().optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
      limit: z.coerce.number().int().positive().optional(),
    })
    .refine(
      (q) =>
        Boolean(
          q.cityCode ||
            q.airportCode ||
            q.countryCode ||
            q.carRentalCompanyCodes ||
            q.vicinity
        ),
      "Provide at least one agency search criterion"
    ),
});

const myOrdersQueryValidation = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    status: z
      .enum(["CREATED", "CANCELLED", "VOUCHER_ISSUED"])
      .optional(),
  }),
});

const myPaymentsQueryValidation = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    status: z
      .enum([
        "REQUIRES_PAYMENT",
        "PROCESSING",
        "SUCCEEDED",
        "FAILED",
        "REFUNDED",
      ])
      .optional(),
  }),
});

const ledgerIdParamsValidation = z.object({
  params: z.object({
    ledgerId: z.string().min(1),
  }),
});

export const CarAmadeusValidation = {
  searchOffersValidation,
  offerIdParamsValidation,
  searchJobParamsValidation,
  createOrderValidation,
  createPaymentIntentValidation,
  paymentIntentParamsValidation,
  travelOrderQueryValidation,
  issueVoucherValidation,
  agenciesQueryValidation,
  myOrdersQueryValidation,
  myPaymentsQueryValidation,
  ledgerIdParamsValidation,
};
