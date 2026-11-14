import { StatusCodes } from "http-status-codes";
import ApiError from "../../errors/ApiErrors";
import {
  amadeusFetch,
  assertAmadeusPrdAllowed,
  buildAmadeusUrl,
  extractAmadeusErrorMessage,
} from "../../helpers/amadeusHelper";
import { AmadeusAuthService } from "./amadeusAuth.service";

type RequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  retryOnUnauthorized?: boolean;
};

export const amadeusRequest = async <T = unknown>(
  options: RequestOptions
): Promise<{ data: T; amaClientRef: string; status: number }> => {
  assertAmadeusPrdAllowed();

  const { accessToken, amaClientRef } =
    await AmadeusAuthService.getAccessToken();
  const url = buildAmadeusUrl(options.path, options.query);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Ama-Client-Ref": amaClientRef,
    Accept: "application/vnd.amadeus+json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/vnd.amadeus+json";
  }

  const { status, body } = await amadeusFetch(
    url,
    {
      method: options.method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    amaClientRef
  );

  if (status === 401 && options.retryOnUnauthorized !== false) {
    await AmadeusAuthService.clearAccessTokenCache();
    return amadeusRequest({ ...options, retryOnUnauthorized: false });
  }

  if (status >= 400) {
    const message = extractAmadeusErrorMessage(
      (body || {}) as Parameters<typeof extractAmadeusErrorMessage>[0]
    );
    const isOfferGet727 =
      options.method === "GET" &&
      /\/v1\/shopping\/car-offers\/[^/]+$/.test(options.path) &&
      (/\b727\b/.test(message) || /INTERNAL ERROR/i.test(message));
    // Offer-detail enrich 727 is common on PDT — keep booking/auth errors loud.
    if (isOfferGet727) {
      console.warn("[Amadeus offer enrich skipped]", {
        path: options.path,
        status,
        message,
        amaClientRef,
      });
    } else {
      console.error(
        "[Amadeus API error]",
        JSON.stringify({
          path: options.path,
          method: options.method,
          status,
          amaClientRef,
          message,
          body,
        })
      );
    }
    throw new ApiError(
      status || StatusCodes.BAD_GATEWAY,
      `${message} [Ama-Client-Ref: ${amaClientRef}]`
    );
  }

  return {
    data: body as T,
    amaClientRef,
    status,
  };
};
