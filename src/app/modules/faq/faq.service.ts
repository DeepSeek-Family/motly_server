import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import redisService from "../../../redis/redis.service";
import { IFaq } from "./faq.interface";
import { FAQ } from "./faq.model";

const FAQ_CACHE_KEY_ALL = "faq:all";
const FAQ_CACHE_KEY_PREFIX = "faq:";
const ONE_DAY_IN_SECONDS = 86400; // 24 * 60 * 60 = 1 day

const createFaqToDB = async (payload: IFaq): Promise<IFaq> => {
  const result = await FAQ.create(payload);

  // Invalidate all-faqs cache in Redis
  await redisService.del(FAQ_CACHE_KEY_ALL);

  // Cache the newly created single FAQ in Redis for 1 day
  await redisService.post({
    key: `${FAQ_CACHE_KEY_PREFIX}${result._id.toString()}`,
    value: result,
    expiration: ONE_DAY_IN_SECONDS,
  });

  return result;
};

const getAllFaqsFromDB = async (): Promise<IFaq[]> => {
  // Check Redis cache first
  const cachedData = await redisService.get(FAQ_CACHE_KEY_ALL);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  // Fetch from DB if cache miss
  const result = await FAQ.find().sort({ createdAt: -1 });

  // Store in Redis for 1 day
  await redisService.post({
    key: FAQ_CACHE_KEY_ALL,
    value: result,
    expiration: ONE_DAY_IN_SECONDS,
  });

  return result;
};

const getSingleFaqFromDB = async (id: string): Promise<IFaq> => {
  // Check Redis cache first
  const cachedData = await redisService.get(`${FAQ_CACHE_KEY_PREFIX}${id}`);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  // Fetch from DB if cache miss
  const result = await FAQ.findById(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found!");
  }

  // Store in Redis for 1 day
  await redisService.post({
    key: `${FAQ_CACHE_KEY_PREFIX}${id}`,
    value: result,
    expiration: ONE_DAY_IN_SECONDS,
  });

  return result;
};

const updateFaqToDB = async (
  id: string,
  payload: Partial<IFaq>
): Promise<IFaq> => {
  const result = await FAQ.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found!");
  }

  // Update single FAQ cache in Redis for 1 day
  await redisService.post({
    key: `${FAQ_CACHE_KEY_PREFIX}${id}`,
    value: result,
    expiration: ONE_DAY_IN_SECONDS,
  });

  // Invalidate all-faqs cache in Redis
  await redisService.del(FAQ_CACHE_KEY_ALL);

  return result;
};

const deleteFaqFromDB = async (id: string): Promise<IFaq> => {
  const result = await FAQ.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found!");
  }

  // Remove single FAQ from Redis
  await redisService.del(`${FAQ_CACHE_KEY_PREFIX}${id}`);

  // Invalidate all-faqs cache in Redis
  await redisService.del(FAQ_CACHE_KEY_ALL);

  return result;
};

export const FaqService = {
  createFaqToDB,
  getAllFaqsFromDB,
  getSingleFaqFromDB,
  updateFaqToDB,
  deleteFaqFromDB,
};

