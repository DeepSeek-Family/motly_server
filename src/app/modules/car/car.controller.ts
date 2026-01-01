import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { CarService } from "./car.service";
import sendResponse from "../../../shared/sendResponse";

const createCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.createCarServiceIntoDB(req.body, req.user!);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Car created successfully",
    data: result,
  });
});

//! public route
const getAllCar = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.getAllCarsFromDB(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cars retrieved successfully",
    data: result,
  });
});

export const CarController = {
  createCar,
  getAllCar,
};
