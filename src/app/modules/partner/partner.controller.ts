import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { PartnerService } from "./partner.service";

const getActivePartners = catchAsync(async (_req: Request, res: Response) => {
  const result = await PartnerService.getActivePartnersFromDB();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partners retrieved successfully",
    data: result,
  });
});

const getAllPartners = catchAsync(async (_req: Request, res: Response) => {
  const result = await PartnerService.getAllPartnersFromDB();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "All partners retrieved successfully",
    data: result,
  });
});

const createPartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerService.createPartnerToDB(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Partner created successfully",
    data: result,
  });
});

const updatePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerService.updatePartnerToDB(req.params.id, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partner updated successfully",
    data: result,
  });
});

const deletePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerService.deletePartnerFromDB(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partner deleted successfully",
    data: result,
  });
});

export const PartnerController = {
  getActivePartners,
  getAllPartners,
  createPartner,
  updatePartner,
  deletePartner,
};
