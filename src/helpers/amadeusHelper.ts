import { StatusCodes } from "http-status-codes";
import config from "../config";
import ApiError from "../errors/ApiErrors";

const PRD_HOST = "travel.api.amadeus.com";

type AmadeusErrorBody = {
  error?: string | { message?: string; title?: string; detail?: string };
  error_description?: string;
  errors?: Array<{
    code?: string;
    title?: string;
    detail?: string;
    message?: string;
  }>;
  title?: string;
  detail?: string;
  message?: string;
};

export const buildAmaClientRef = (): string => {
  const companyCode = config.ama.companyCode || "MOTLY";
  return `${companyCode}-${new Date().toISOString()}`;
};

export const assertAmadeusPrdAllowed = (): void => {
  let host = "";
  try {
    host = new URL(config.ama.baseUrl).hostname;
  } catch {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Invalid AMA_BASE_URL"
    );
  }

  if (host === PRD_HOST && !config.ama.allowPrd) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Amadeus production is blocked. Set AMA_ALLOW_PRD=true to enable."
    );
  }
};

export const extractAmadeusErrorMessage = (body: AmadeusErrorBody): string => {
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    return body.errors
      .map((err) => {
        const parts = [err.code, err.title || err.message, err.detail]
          .filter(Boolean)
          .join(": ");
        return parts || "Amadeus error";
      })
      .join(" | ");
  }

  if (typeof body.error === "string") {
    return body.error_description
      ? `${body.error}: ${body.error_description}`
      : body.error;
  }

  if (body.error && typeof body.error === "object") {
    return (
      body.error.detail ||
      body.error.title ||
      body.error.message ||
      "Amadeus request failed"
    );
  }

  return body.detail || body.title || body.message || "Amadeus request failed";
};

export const toAmadeusNetworkError = (
  error: unknown,
  amaClientRef?: string
): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  const suffix = amaClientRef ? ` [Ama-Client-Ref: ${amaClientRef}]` : "";

  if ((error as Error)?.name === "AbortError") {
    return new ApiError(
      StatusCodes.GATEWAY_TIMEOUT,
      `Amadeus request timed out${suffix}`
    );
  }

  return new ApiError(
    StatusCodes.BAD_GATEWAY,
    `${(error as Error)?.message || "Amadeus request failed"}${suffix}`
  );
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export const amadeusFetch = async (
  url: string,
  init: RequestInit,
  amaClientRef?: string
): Promise<{ status: number; body: unknown }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ama.timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    return {
      status: response.status,
      body: await parseResponseBody(response),
    };
  } catch (error) {
    throw toAmadeusNetworkError(error, amaClientRef);
  } finally {
    clearTimeout(timeout);
  }
};

export const buildAmadeusUrl = (
  path: string,
  query?: Record<string, string | number | undefined | null>
): string => {
  const url = new URL(
    path.startsWith("http") ? path : `${config.ama.baseUrl}${path}`
  );

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};
