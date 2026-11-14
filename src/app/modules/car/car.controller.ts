import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { CarService } from "./car.service";
import { CarAmadeusService } from "./carAmadeus.service";
import { CarPaymentService } from "./carPayment.service";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.createCarServiceIntoDB(req.body, req.user!);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Car created successfully",
    data: result,
  });
});

//! public route
const getAllCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.getAllCarsFromDB(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Cars retrieved successfully",
    pagination: result.pagination,
    data: result.data,
  });
});

const getCarById = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.findCarFromDBById(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car retrieved successfully",
    data: result,
  });
});

const updateCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.updateCarServiceInDB(
    req.params.id,
    req.body,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car updated successfully",
    data: result,
  });
});

const deleteCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.deleteCarServiceInDB(
    req.params.id,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car deleted successfully",
    data: result,
  });
});

const getAllUserCarsData = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.getAllUserCarsDataFromDB(
    req.query,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User's cars retrieved successfully",
    data: result.data,
    pagination: result.pagination,
  });
});

const searchCarOffers = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.searchOffers(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car offers retrieved successfully",
    data: result,
  });
});

const enqueueSearchCarOffers = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CarAmadeusService.enqueueSearchOffers(req.body);
    const completed = result.status === "COMPLETED";

    sendResponse(res, {
      statusCode: completed ? StatusCodes.OK : StatusCodes.ACCEPTED,
      success: true,
      message: completed
        ? "Car offers retrieved from cache"
        : "Car offer search queued",
      data: result,
    });
  }
);

const getSearchCarOffersJob = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CarAmadeusService.getSearchJobStatus(
      req.params.jobId
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Car offer search job status",
      data: result,
    });
  }
);

const getCarOfferById = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.getOfferById(req.params.offerId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car offer retrieved successfully",
    data: result,
  });
});

const revalidateCarOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.revalidateOffer(req.params.offerId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car offer revalidated successfully",
    data: result,
  });
});

const getPaymentConfig = catchAsync(async (_req: Request, res: Response) => {
  const result = CarPaymentService.getPublishableConfig();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment config retrieved",
    data: result,
  });
});

const checkoutReturn = catchAsync(async (req: Request, res: Response) => {
  const status = String(req.query.status || "").toLowerCase();
  const sessionId = String(req.query.session_id || "").trim();
  const offerId = String(req.query.offerId || "").trim();
  const userId = String(req.query.userId || "").trim();
  const client = String(req.query.client || "app").toLowerCase();
  const ok = status === "success" || status === "paid";
  const failed =
    status === "cancel" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "failed";

  if (failed) {
    await CarPaymentService.markPaymentFailedByIds({
      sessionId: sessionId || undefined,
      offerId: offerId || undefined,
      userId: userId || undefined,
    });
  } else if (ok && sessionId) {
    try {
      await CarPaymentService.syncPaymentFromStripe(sessionId);
    } catch {
      // WebView / website still continue; webhook may catch up.
    }
  }

  const webOrigin = CarPaymentService.webFrontendOrigin();
  if (client === "web" && webOrigin) {
    if (ok) {
      const dest = offerId
        ? `${webOrigin}/checkout/${encodeURIComponent(offerId)}?payment=success&session_id=${encodeURIComponent(sessionId)}&step=2`
        : `${webOrigin}/my-booking?payment=success`;
      return res.redirect(StatusCodes.FOUND, dest);
    }
    const dest = offerId
      ? `${webOrigin}/view-details/${encodeURIComponent(offerId)}?payment=failed`
      : `${webOrigin}/car-details?payment=failed`;
    return res.redirect(StatusCodes.FOUND, dest);
  }

  // App WebView intercepts this URL (path contains checkout-return).
  res.status(StatusCodes.OK).type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Motly Payment</title>
<style>
body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f6f7f8;color:#111}
.card{background:#fff;padding:28px 24px;border-radius:14px;max-width:420px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#555;line-height:1.5}
</style></head><body><div class="card" data-motly-payment="${ok ? "success" : "cancel"}">
<h1>${ok ? "Payment received" : "Payment failed"}</h1>
<p>${ok
  ? "Return to the Motly app — booking details will open next."
  : "Payment was cancelled. Return to the Motly app to try again from the car details page."}</p>
</div></body></html>`);
});

const cancelPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await CarPaymentService.cancelOpenPayment(
    req.params.paymentIntentId,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment marked as failed",
    data: result,
  });
});

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
  const result = await CarPaymentService.createPaymentIntent(
    req.body,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Payment intent created successfully",
    data: result,
  });
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await CarPaymentService.getPaymentStatus(
    req.params.paymentIntentId,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment status retrieved successfully",
    data: result,
  });
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await CarPaymentService.getMyPayments(req.user!, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User payment transactions retrieved successfully",
    pagination: result.pagination,
    data: result.data,
  });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await CarPaymentService.refundPayment(
    req.params.paymentIntentId,
    req.user!
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment refund initiated successfully",
    data: result,
  });
});

const createCarOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.createOrder(req.body, req.user!);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Car order created successfully",
    data: result,
  });
});

const getCarOrderByTravelOrder = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CarAmadeusService.getOrderByTravelOrder({
      pnrRecordReference: String(req.query.pnrRecordReference),
      confirmationNumber: String(req.query.confirmationNumber),
    });
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Car order retrieved successfully",
      data: result,
    });
  }
);

const deleteCarOrderByTravelOrder = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CarAmadeusService.deleteOrderByTravelOrder(
      {
        pnrRecordReference: String(req.query.pnrRecordReference),
        confirmationNumber: String(req.query.confirmationNumber),
      },
      req.user!
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Car order deleted successfully",
      data: result,
    });
  }
);

const issueCarVoucher = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.issueVoucher(req.body, req.user!);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car voucher issued successfully",
    data: result,
  });
});

const searchCarAgencies = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.searchAgencies(
    req.query as Record<string, string | number | undefined>
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Car rental agencies retrieved successfully",
    data: result,
  });
});

const getMyCarBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.getMyBookingSummaries(req.user!, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User car bookings retrieved successfully",
    pagination: result.pagination,
    data: result.data,
  });
});

const getMyCarBookingById = catchAsync(async (req: Request, res: Response) => {
  const result = await CarAmadeusService.getMyBookingSummaryById(
    req.user!,
    req.params.ledgerId
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User car booking summary retrieved successfully",
    data: result,
  });
});

const getMyCarBookingDetails = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CarAmadeusService.getMyBookingDetailsById(
      req.user!,
      req.params.ledgerId
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "User car booking details retrieved successfully",
      data: result,
    });
  }
);

export const CarController = {
  createCar,
  getAllCar,
  getCarById,
  updateCar,
  deleteCar,
  getAllUserCarsData,
  searchCarOffers,
  enqueueSearchCarOffers,
  getSearchCarOffersJob,
  getCarOfferById,
  revalidateCarOffer,
  getPaymentConfig,
  checkoutReturn,
  createPaymentIntent,
  getPaymentStatus,
  getMyPayments,
  refundPayment,
  cancelPayment,
  createCarOrder,
  getCarOrderByTravelOrder,
  deleteCarOrderByTravelOrder,
  issueCarVoucher,
  searchCarAgencies,
  getMyCarBookings,
  getMyCarBookingById,
  getMyCarBookingDetails,
};
