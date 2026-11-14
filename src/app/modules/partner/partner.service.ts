import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { redisDel, redisGet, redisSet } from "../../../helpers/redisHelper";
import { IPartner } from "./partner.interface";
import { Partner } from "./partner.model";

const PARTNERS_PUBLIC_CACHE_KEY = "partners:public:active";
const CACHE_TTL_SEC = 300;

const invalidatePartnerCache = async () => {
  await redisDel(PARTNERS_PUBLIC_CACHE_KEY);
};

const getActivePartnersFromDB = async () => {
  const cached = await redisGet(PARTNERS_PUBLIC_CACHE_KEY);
  if (Array.isArray(cached)) {
    return cached;
  }

  const result = await Partner.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  await redisSet(PARTNERS_PUBLIC_CACHE_KEY, result, CACHE_TTL_SEC);
  return result;
};

const getAllPartnersFromDB = async () => {
  return Partner.find().sort({ sortOrder: 1, name: 1 }).lean();
};

const createPartnerToDB = async (payload: IPartner) => {
  const result = await Partner.create(payload);
  await invalidatePartnerCache();
  return result;
};

const updatePartnerToDB = async (id: string, payload: Partial<IPartner>) => {
  const result = await Partner.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Partner not found");
  }
  await invalidatePartnerCache();
  return result;
};

const deletePartnerFromDB = async (id: string) => {
  const result = await Partner.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Partner not found");
  }
  await invalidatePartnerCache();
  return result;
};

export const PartnerService = {
  getActivePartnersFromDB,
  getAllPartnersFromDB,
  createPartnerToDB,
  updatePartnerToDB,
  deletePartnerFromDB,
};
