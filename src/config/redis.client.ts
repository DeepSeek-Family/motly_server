import Redis from "ioredis";
import config from ".";
export const redisClient = new Redis({
  host: config.redisHost.redisIP,
  port: 6379,
});
