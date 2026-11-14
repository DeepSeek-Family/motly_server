import {
  AmadeusCarOfferSearchBody,
  AmadeusCarOrderCreateBody,
  AmadeusTravelOrderRefs,
  AmadeusVoucherBody,
} from "../../app/modules/car/car.interface";
import ApiError from "../../errors/ApiErrors";
import { amadeusRequest } from "./amadeusHttp.client";

const searchCarOffers = (body: AmadeusCarOfferSearchBody) =>
  amadeusRequest({
    method: "POST",
    path: "/v1/shopping/car-offers",
    body,
  });

const getCarOfferById = (offerId: string) =>
  amadeusRequest({
    method: "GET",
    path: `/v1/shopping/car-offers/${encodeURIComponent(offerId)}`,
  });

const revalidateCarOffer = (offerId: string) =>
  amadeusRequest({
    method: "POST",
    path: `/v1/shopping/car-offers/${encodeURIComponent(offerId)}/revalidations`,
  });

const createCarOrder = (body: AmadeusCarOrderCreateBody) =>
  amadeusRequest({
    method: "POST",
    path: "/v1/booking/car-orders",
    body,
  });

const getCarOrderByTravelOrder = async (params: AmadeusTravelOrderRefs) => {
  try {
    return await amadeusRequest({
      method: "GET",
      path: "/v1/booking/car-orders/by-travel-order",
      query: {
        pnrRecordReference: params.pnrRecordReference,
        confirmationNumber: params.confirmationNumber,
      },
    });
  } catch (error) {
    // Bruno retrieve sample uses ConfirmationNumber; retry once for PDT casing quirks.
    if (!(error instanceof ApiError) || error.statusCode >= 500) {
      throw error;
    }

    return amadeusRequest({
      method: "GET",
      path: "/v1/booking/car-orders/by-travel-order",
      query: {
        pnrRecordReference: params.pnrRecordReference,
        ConfirmationNumber: params.confirmationNumber,
      },
    });
  }
};

const deleteCarOrderByTravelOrder = (params: AmadeusTravelOrderRefs) =>
  amadeusRequest({
    method: "DELETE",
    path: "/v1/booking/car-orders/by-travel-order",
    query: {
      pnrRecordReference: params.pnrRecordReference,
      confirmationNumber: params.confirmationNumber,
    },
  });

const issueCarVoucher = (body: AmadeusVoucherBody) =>
  amadeusRequest({
    method: "POST",
    path: "/v1/booking/car-orders/voucher-issuances-by-travel-order",
    body,
  });

const searchCarRentalAgencies = (
  query: Record<string, string | number | undefined | null>
) =>
  amadeusRequest({
    method: "GET",
    path: "/v1/reference-data/car-rental-agencies",
    query,
  });

export const AmadeusCarApi = {
  searchCarOffers,
  getCarOfferById,
  revalidateCarOffer,
  createCarOrder,
  getCarOrderByTravelOrder,
  deleteCarOrderByTravelOrder,
  issueCarVoucher,
  searchCarRentalAgencies,
};
