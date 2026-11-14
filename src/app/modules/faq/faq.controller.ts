import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { FaqService } from "./faq.service";

const createFaq = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqService.createFaqToDB(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FAQ created successfully",
    data: result,
  });
});

const getAllFaqs = catchAsync(async (_req: Request, res: Response) => {
  const result = await FaqService.getAllFaqsFromDB();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FAQs retrieved successfully",
    data: result,
  });
});

const getSingleFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FaqService.getSingleFaqFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FAQ retrieved successfully",
    data: result,
  });
});

const updateFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FaqService.updateFaqToDB(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FAQ updated successfully",
    data: result,
  });
});

const deleteFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FaqService.deleteFaqFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "FAQ deleted successfully",
    data: result,
  });
});

export const FaqController = {
  createFaq,
  getAllFaqs,
  getSingleFaq,
  updateFaq,
  deleteFaq,
};

