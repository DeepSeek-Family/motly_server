import { redisClient } from "../config/redis.client";

const redisSet = async (
  key: string,
  value: string,
  ttl: number = 60,
  query: Record<string, any>
) => {
  const queryString = new URLSearchParams(
    query as Record<string, string>
  ).toString();
  const result = await redisClient.set(`${key}?${queryString}`,JSON.stringify(value),"EX",ttl
  );
};

const redisGet = async (key: string, query: Record<string, any>) => {
  const queryString = new URLSearchParams(
    query as Record<string, string>
  ).toString();
  const data = JSON.parse(
    (await redisClient.get(`${key}:${queryString}`)) || "[]"
  );
  if (Array.isArray(data) && !data.length) {
    return null;
  }

  return data;
};

const redisHset = async () => {};

const redisHget = async () => {};

const keyDelete = async () => {};

const HKeyDelete = async () => {};
