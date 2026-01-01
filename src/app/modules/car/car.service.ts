import { JwtPayload } from "jsonwebtoken";
import { ICar } from "./car.interface";
import { CarModel } from "./car.model";
import { USER_ROLES } from "../../../enums/user";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import { createCarIndex } from "../../../handlers/elasticSearch.helper";

/**
 * create car service:
 *  1. take payload from controller
 *  2. save car into data base
 *  3. return result
 * */

const createCarServiceIntoDB = async (payload: ICar, user: JwtPayload) => {
  if (user.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.AGENCY) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  payload.user = user.id;
  const result = await CarModel.create(payload);
  createCarIndex(result);
  return result;
};

/**
 * for public route
 * */
const getAllCarsFromDB = async (query: any) => {
  const result = await CarModel.find();
  return result;
};

export const CarService = {
  createCarServiceIntoDB,
  getAllCarsFromDB,
};
