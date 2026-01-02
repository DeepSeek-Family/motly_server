import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { CarService } from "./car.service";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

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
    pagination: result.pagination,
    data: result.data,
  });
});

const getCarById = catchAsync(async (req: Request, res: Response) => {
  const result = await CarService.findCarFromDBById(req.params.id);
  sendResponse(res, {
    statusCode: 200,
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
    statusCode: 200,
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
    statusCode: 200,
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

export const CarController = {
  createCar,
  getAllCar,
  getCarById,
  updateCar,
  deleteCar,
  getAllUserCarsData,
};
