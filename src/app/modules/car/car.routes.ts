import { Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { CarController } from "./car.controller";
import validateRequest from "../../middlewares/validateRequest";
import { CarValidation } from "./car.validation";
import { CarAmadeusValidation } from "./carAmadeus.validation";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { parseCarPayload } from "../../../util/parseCarPayload";
import catchAsync from "../../../shared/catchAsync";

const carRoute = Router();

const attachParsedCarPayload = catchAsync(async (req, _res, next) => {
  req.body = parseCarPayload(req);
  next();
});

carRoute
  .route("/")
  .post(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler() as any,
    attachParsedCarPayload,
    validateRequest(CarValidation.createCarValidation),
    CarController.createCar
  )
  .get(CarController.getAllCar);

carRoute
  .route("/for-user")
  .get(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.getAllUserCarsData
  );

// Amadeus Cars Quick-Connect (keep before /:id)
carRoute
  .route("/agencies")
  .get(
    validateRequest(CarAmadeusValidation.agenciesQueryValidation),
    CarController.searchCarAgencies
  );

carRoute
  .route("/offers/search")
  .post(
    validateRequest(CarAmadeusValidation.searchOffersValidation),
    CarController.searchCarOffers
  );

carRoute
  .route("/offers/search/async")
  .post(
    validateRequest(CarAmadeusValidation.searchOffersValidation),
    CarController.enqueueSearchCarOffers
  );

carRoute
  .route("/offers/search/jobs/:jobId")
  .get(
    validateRequest(CarAmadeusValidation.searchJobParamsValidation),
    CarController.getSearchCarOffersJob
  );

carRoute
  .route("/offers/:offerId/revalidate")
  .post(
    validateRequest(CarAmadeusValidation.offerIdParamsValidation),
    CarController.revalidateCarOffer
  );

carRoute
  .route("/offers/:offerId")
  .get(
    validateRequest(CarAmadeusValidation.offerIdParamsValidation),
    CarController.getCarOfferById
  );

carRoute
  .route("/payments/config")
  .get(CarController.getPaymentConfig);

carRoute
  .route("/payments/checkout-return")
  .get(CarController.checkoutReturn);

carRoute
  .route("/payments/create-intent")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.createPaymentIntentValidation),
    CarController.createPaymentIntent
  );

/** Must be before /payments/:paymentIntentId so "me" is not captured as an id. */
carRoute
  .route("/payments/me")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.myPaymentsQueryValidation),
    CarController.getMyPayments
  );

carRoute
  .route("/payments/:paymentIntentId")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.paymentIntentParamsValidation),
    CarController.getPaymentStatus
  );

carRoute
  .route("/payments/:paymentIntentId/refund")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.paymentIntentParamsValidation),
    CarController.refundPayment
  );

carRoute
  .route("/payments/:paymentIntentId/cancel")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.paymentIntentParamsValidation),
    CarController.cancelPayment
  );

carRoute
  .route("/orders")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.createOrderValidation),
    CarController.createCarOrder
  );

carRoute
  .route("/orders/me")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.myOrdersQueryValidation),
    CarController.getMyCarBookings
  );

/** Full View Details payload (summary + payment + grouped details). */
carRoute
  .route("/orders/me/:ledgerId/details")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.ledgerIdParamsValidation),
    CarController.getMyCarBookingDetails
  );

carRoute
  .route("/orders/me/:ledgerId")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.ledgerIdParamsValidation),
    CarController.getMyCarBookingById
  );

carRoute
  .route("/orders/by-travel-order")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.travelOrderQueryValidation),
    CarController.getCarOrderByTravelOrder
  )
  .delete(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.travelOrderQueryValidation),
    CarController.deleteCarOrderByTravelOrder
  );

carRoute
  .route("/orders/voucher")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(CarAmadeusValidation.issueVoucherValidation),
    CarController.issueCarVoucher
  );

carRoute
  .route("/:id")
  .get(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.getCarById
  )
  .patch(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler() as any,
    attachParsedCarPayload,
    validateRequest(CarValidation.updateCarValidation),
    CarController.updateCar
  )
  .delete(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.deleteCar
  );

export default carRoute;
