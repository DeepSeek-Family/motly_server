import { redisClient } from "../config/redis.config";
import { errorLogger } from "../shared/logger";

export interface IRedisPostPayload {
  key: string;
  value: string | number | object;
  expiration: number; // TTL in seconds
}

/**
 * Store key-value in Redis with TTL using "EX" (expiration in seconds)
 */
const post = async ({
  key,
  value,
  expiration,
}: IRedisPostPayload): Promise<void> => {
  try {
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    await redisClient.set(key, stringValue, "EX", expiration);
  } catch (error) {
    errorLogger.error(`Error saving key "${key}" to Redis:`, error);
    throw error;
  }
};

/**
 * Retrieve value from Redis by key
 */
const get = async (key: string): Promise<string | null> => {
  try {
    const data = await redisClient.get(key);
    return data;
  } catch (error) {
    errorLogger.error(`Error retrieving key "${key}" from Redis:`, error);
    throw error;
  }
};

/**
 * Delete key from Redis
 */
const del = async (key: string): Promise<number> => {
  try {
    return await redisClient.del(key);
  } catch (error) {
    errorLogger.error(`Error deleting key "${key}" from Redis:`, error);
    throw error;
  }
};

/**
 * Update key TTL in Redis
 */
const expire = async (key: string, expiration: number): Promise<number> => {
  try {
    return await redisClient.expire(key, expiration);
  } catch (error) {
    errorLogger.error(
      `Error setting expiration for key "${key}" in Redis:`,
      error
    );
    throw error;
  }
};

export const redisService = {
  post,
  get,
  del,
  expire,
};

export { post, get, del, expire };
export default redisService;
