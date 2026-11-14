import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { UserService } from "./user.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

const createUser = catchAsync(async (req: Request, res: Response) => {
  await UserService.createUserToDB(req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message:
      "Your account has been successfully created. Verify Your Email By OTP. Check your email",
  });
});

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserProfileFromDB(req.user!);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Profile data retrieved successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateProfileToDB(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Profile updated successfully",
    data: result,
  });
});

export const UserController = {
  createUser,
  getUserProfile,
  updateProfile,
};
