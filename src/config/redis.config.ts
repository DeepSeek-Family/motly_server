import Redis, { RedisOptions } from "ioredis";
import dotenv from "dotenv";
import path from "path";
import { errorLogger, logger } from "../shared/logger";

// Ensure environment variables are loaded
dotenv.config({ path: path.join(process.cwd(), ".env") });

const redisHost = process.env.REDIS_HOST || process.env.redisIP || "127.0.0.1";
const redisPort = process.env.REDIS_PORT
  ? parseInt(process.env.REDIS_PORT, 10)
  : 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const redisOptions: RedisOptions = {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis reconnecting, attempt: ${times}, delay: ${delay}ms`);
    return delay;
  },
};

export const redisClient = new Redis(redisOptions);

redisClient.on("connect", () => {
  logger.info("✅ Redis client connected successfully");
});

redisClient.on("ready", () => {
  logger.info("🚀 Redis client is ready to receive commands");
});

redisClient.on("error", (error) => {
  errorLogger.error("❌ Redis client error:", error);
});

redisClient.on("close", () => {
  logger.warn("⚠️ Redis client connection closed");
});

export default redisClient;
