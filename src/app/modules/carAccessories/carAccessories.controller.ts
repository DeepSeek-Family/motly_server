import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { carAccessoriesService } from "./carAccessories.service";

const createCarAccessories = catchAsync(async (req: Request, res: Response) => {
  const result = await carAccessoriesService.createCarAccessories(
    req.body,
    req.user!
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Car Accessories created successfully",
    data: result,
  });
});

const getAllCarAccessoriess = catchAsync(
  async (req: Request, res: Response) => {
    const result = await carAccessoriesService.getAllCarAccessoriess(req.query);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Car Accessories retrieved successfully",
      pagination: result.meta,
      data: result.data,
    });
  }
);

const updateCarAccessories = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await carAccessoriesService.updateCarAccessories(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Car Accessories updated successfully",
    data: result,
  });
});

const getSingleCarAccessories = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await carAccessoriesService.getSingleCarAccessories(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Car Accessories retrieved successfully",
      data: result,
    });
  }
);

const deleteCarAccessories = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await carAccessoriesService.deleteCarAccessories(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Car Accessories deleted successfully",
    data: result,
  });
});

export const carAccessoriesController = {
  createCarAccessories,
  getAllCarAccessoriess,
  updateCarAccessories,
  deleteCarAccessories,
  getSingleCarAccessories,
};
