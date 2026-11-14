import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { CarPaymentService } from "./carPayment.service";

const getPaymentConfig = catchAsync(async (_req: Request, res: Response) => {
  const result = CarPaymentService.getPublishableConfig();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment config retrieved",
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

export const CarPaymentController = {
  getPaymentConfig,
  createPaymentIntent,
  getPaymentStatus,
  refundPayment,
};
