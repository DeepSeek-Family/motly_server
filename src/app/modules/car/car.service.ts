import { JwtPayload } from "jsonwebtoken";
import { ICar } from "./car.interface";
import { CarModel } from "./car.model";
import { USER_ROLES } from "../../../enums/user";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import QueryBuilder from "../../builder/QueryBuilder";
import { clearCarIdsCache, getCachedCarIds } from "../../../util/getCachedCarIds";


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
const getAllCarsFromDB = async (
  query: Record<string, any>,
  user?: JwtPayload
) => {
  const qb = new QueryBuilder(
    CarModel.find(),
    query
  )
    .sort()
    .partialSearch(["name", "description", "class", "transmission", "fuelType"])
    .populate(
      ["user"],
      {
        user: "name email image",
      }
    );



  if (query.lat && query.lon && query.radius) {
    const lat = parseFloat(query.lat as string);
    const lon = parseFloat(query.lon as string);
    const radius = parseFloat(query.radius as string);
    qb.geoFilter(lat, lon, radius);
  }

  const [data, pagination] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);

  return {
    data,
    pagination,
  };
};

/**
 * Private route
 *
 * */

/**
 * Find car by id and update service in DB
 * */

const findCarFromDBById = async (id: string) => {
  const car = await CarModel.findById(id).populate("user", "name email image");
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
  if (![USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY].includes(user.role)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }

  const result = await CarModel.findByIdAndUpdate(id, payload, { new: true });
  if (result) await clearCarIdsCache(result.user.toString());
  return result;
};

const deleteCarServiceInDB = async (id: string, user: JwtPayload) => {
  if (![USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY].includes(user.role)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }

  const result = await CarModel.findByIdAndDelete(id);
  if (result) await clearCarIdsCache(result.user.toString());
  return result;
};

// get all data base on user
const getAllUserCarsDataFromDB = async (
  query: Record<string, any>,
  user: JwtPayload
) => {
  const carIds = await getCachedCarIds(user.id);

  const qb = new QueryBuilder(
    CarModel.find({ _id: { $in: carIds } }),
    query
  )
    .sort()
    .fields()
    .populate(["user"], { user: "name email image" });

  const [data, pagination] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);

  return {
    data,
    pagination,
  };
};

export const CarService = {
  createCarServiceIntoDB,
  getAllCarsFromDB,
  findCarFromDBById,
  updateCarServiceInDB,
  deleteCarServiceInDB,
  getAllUserCarsDataFromDB,
};
