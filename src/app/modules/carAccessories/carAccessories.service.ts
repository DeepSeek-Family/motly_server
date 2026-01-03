import { StatusCodes } from "http-status-codes";
import { IcarAccessories } from "./carAccessories.interface";
import QueryBuilder from "../../builder/QueryBuilder";
import { CarAccessoriesModel } from "./carAccessories.model";
import { JwtPayload } from "jsonwebtoken";
import { USER_ROLES } from "../../../enums/user";
import ApiError from "../../../errors/ApiErrors";
import unlinkFile from "../../../shared/unlinkFile";

const createCarAccessories = async (
  payload: IcarAccessories,
  user: JwtPayload
): Promise<IcarAccessories> => {
  if (user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  payload.user = user.id;
  if (payload.icon) {
    unlinkFile(payload.icon);
  }
  const result = await CarAccessoriesModel.create(payload);
  return result;
};

const getAllCarAccessoriess = async (query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(CarAccessoriesModel.find(), query)
    .partialSearch(["name"])
    .sort()
    .fields()
    .paginate();
  const [data, meta] = await Promise.all([
    queryBuilder.modelQuery.exec(),
    queryBuilder.getPaginationInfo(),
  ]);
  return { data, meta };
};

const getSingleCarAccessories = async (id: string) => {
  const result = await CarAccessoriesModel.findById({ _id: id }).exec();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Car Accessories not found");
  }
  return result;
};

const updateCarAccessories = async (
  id: string,
  payload: Partial<IcarAccessories>
) => {
  const result = await CarAccessoriesModel.findById({ _id: id }).exec();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Car Accessories not found");
  }
  const data = await CarAccessoriesModel.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return data;
};

const deleteCarAccessories = async (id: string) => {
  const result = await CarAccessoriesModel.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Car Accessories not found");
  }
  return result;
};

export const carAccessoriesService = {
  createCarAccessories,
  getAllCarAccessoriess,
  updateCarAccessories,
  deleteCarAccessories,
  getSingleCarAccessories,
};
