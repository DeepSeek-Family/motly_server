import { JwtPayload } from "jsonwebtoken";
import { ICar } from "./car.interface";
import { CarModel } from "./car.model";
import { USER_ROLES } from "../../../enums/user";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import QueryBuilder from "../../builder/QueryBuilder";

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

  return result;
};

/**
 * for public route
 * */
const getAllCarsFromDB = async (query: Record<string, any>) => {
  const qb = new QueryBuilder(CarModel.find(), query)
    .partialSearch(["name", "description", "class", "transmission", "fuelType", ])
    .sort()
    .paginate()
    .fields()
    .populate(["user"], { user: "name email image" });

  const [data, pagination] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);

  return { data, pagination };
};

/**
 * Find car by id and update service in DB
 * */

const findCarFromDBById = async (id: string) => {
  const car = await CarModel.findById(id).populate("user", {
    name: 1,
    email: 1,
    image: 1,
  });
  if (!car) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Car not found");
  }
  return car;
};

/**
 * for private route
 *  1.
 * */

const updateCarServiceInDB = async (
  id: string,
  payload: ICar,
  user: JwtPayload
) => {
  if (user.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.AGENCY) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  const result = await CarModel.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const deleteCarServiceInDB = async (id: string, user: JwtPayload) => {
  if (user.role !== USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.AGENCY) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  const result = await CarModel.findByIdAndDelete(id);
  return result;
};

export const CarService = {
  createCarServiceIntoDB,
  getAllCarsFromDB,
  findCarFromDBById,
  updateCarServiceInDB,
  deleteCarServiceInDB,
};
