import { redisClient } from "../config/redis.client";

// Set simple key with TTL
const redisSet = async (key: string, value: any, expireTime: number = 300) => {
  await redisClient.set(key, JSON.stringify(value), "EX", expireTime);
};

// Get value by key
const redisGet = async (key: string) => {
  const data = await redisClient.get(key);

  if (data) {
    console.log(`🟢 REDIS HIT → ${key}`);
    return JSON.parse(data);
  }
  console.log(`🔴 REDIS MISS → ${key}`);
  return null;
};
// Delete key
const redisDel = async (key: string) => {
  await redisClient.del(key);
};

export { redisSet, redisGet, redisDel };
