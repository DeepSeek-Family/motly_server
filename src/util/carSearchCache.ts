import { createHash } from "crypto";
import { redisGet, redisSet, redisDel } from "../helpers/redisHelper";

/**
 * Amadeus offer windows are tight, but 3m forced cold Amadeus round-trips on
 * every filter tweak. 5m keeps page/filter navigation snappy while still
 * inside typical offer validity for shopping.
 */
export const CAR_SEARCH_CACHE_TTL_SEC = 300;

const SEARCH_CACHE_PREFIX = "amadeus:car:offers:search:";
const INFLIGHT_PREFIX = "amadeus:car:offers:inflight:";

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
};

export const hashCarSearchBody = (body: unknown): string =>
  createHash("sha256").update(stableStringify(body)).digest("hex");

export const carSearchCacheKey = (searchHash: string): string =>
  `${SEARCH_CACHE_PREFIX}${searchHash}`;

export const carSearchInflightKey = (searchHash: string): string =>
  `${INFLIGHT_PREFIX}${searchHash}`;

export const getCachedCarSearch = async <T>(searchHash: string) => {
  return (await redisGet(carSearchCacheKey(searchHash))) as T | null;
};

export const setCachedCarSearch = async (
  searchHash: string,
  value: unknown,
  ttlSec: number = CAR_SEARCH_CACHE_TTL_SEC
) => {
  await redisSet(carSearchCacheKey(searchHash), value, ttlSec);
};

export const getInflightSearchJobId = async (searchHash: string) => {
  const value = await redisGet(carSearchInflightKey(searchHash));
  if (value && typeof value === "object" && typeof value.jobId === "string") {
    return value.jobId as string;
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
};

export const setInflightSearchJobId = async (
  searchHash: string,
  jobId: string,
  ttlSec: number = 90
) => {
  await redisSet(carSearchInflightKey(searchHash), { jobId }, ttlSec);
};

export const clearInflightSearchJobId = async (searchHash: string) => {
  await redisDel(carSearchInflightKey(searchHash));
};
