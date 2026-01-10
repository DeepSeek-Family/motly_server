import { CarModel } from "../app/modules/car/car.model";
import { redisGet, redisSet, redisDel } from "../helpers/redisHelper";

/**
 * Get car IDs from Redis or MongoDB
 */
export const getCachedCarIds = async (userId?: string, ttl = 3600) => {
  const cacheKey = userId ? `cars:owner:${userId}:ids` : "cars:all:ids";

  let carIds: string[] = await redisGet(cacheKey);
  if (carIds) return carIds;

  const query = userId ? { user: userId } : {};
  carIds = (await CarModel.find(query).select("_id").lean()).map((c) =>
    c._id.toString()
  );

  await redisSet(cacheKey, carIds, ttl);
  return carIds;
};

/**
 * Clear cached car IDs after create/update/delete
 */
export const clearCarIdsCache = async (userId?: string) => {
  const keys = userId
    ? [`cars:owner:${userId}:ids`, "cars:all:ids"]
    : ["cars:all:ids"];
  for (const key of keys) {
    await redisDel(key);
  }
};
