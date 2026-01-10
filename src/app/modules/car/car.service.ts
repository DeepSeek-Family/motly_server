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
  const isMyCarsView = query.view === "my" && user;
  const userId = isMyCarsView ? user.id : undefined;

  // Get cached IDs from Redis
  const carIds = await getCachedCarIds(userId);

  // Slice IDs for pagination
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const start = (page - 1) * limit;
  const end = page * limit;
  const paginatedIds = carIds.slice(start, end);

  // Use QueryBuilder for sorting, fields, populate
  const qb = new QueryBuilder(
    CarModel.find({ _id: { $in: paginatedIds } })
      .populate("user", "name email image")
      .populate("carAccessories", "name icon"),
    query
  )
    .sort()
    // .arrayFields(["carAccessories", "user"])
    .partialSearch(["name", "description", "class", "transmission", "fuelType"])
    .populate(["user", "carAccessories"], {
      user: "name email image",
      carAccessories: "name icon",
    }); // only required fields

  const [data] = await Promise.all([qb.modelQuery.exec()]);

  return {
    data,
    pagination: {
      total: carIds.length,
      page,
      limit,
      totalPage: Math.ceil(carIds.length / limit),
    },
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

  // Pagination
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const start = (page - 1) * limit;
  const end = page * limit;
  const paginatedIds = carIds.slice(start, end);

  // QueryBuilder for sorting, fields, populate
  const qb = new QueryBuilder(
    CarModel.find({ _id: { $in: paginatedIds } }),
    query
  )
    .sort()
    .fields()
    .populate(["user"], { user: "name email image" });

  const [data] = await Promise.all([qb.modelQuery.exec()]);

  return {
    data,
    pagination: {
      total: carIds.length,
      page,
      limit,
      totalPage: Math.ceil(carIds.length / limit),
    },
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
