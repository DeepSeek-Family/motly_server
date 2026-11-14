import { StatusCodes } from "http-status-codes";
import config from "../../config";
import ApiError from "../../errors/ApiErrors";
import { redisDel, redisGet, redisSet } from "../../helpers/redisHelper";
import {
  amadeusFetch,
  assertAmadeusPrdAllowed,
  buildAmaClientRef,
  extractAmadeusErrorMessage,
} from "../../helpers/amadeusHelper";

const tokenCacheKey = () =>
  `amadeus:access_token:${config.ama.officeId || "no-office"}`;

type AmadeusTokenResponse = {
  access_token: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  title?: string;
  detail?: string;
};

const fetchAccessToken = async () => {
  assertAmadeusPrdAllowed();

  const { clientId, clientSecret, officeId, baseUrl } = config.ama;

  if (!clientId || !clientSecret) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Amadeus credentials missing. Set AMA_TEST_API_KEY and AMA_API_SECRET."
    );
  }

  // AMA_OFFICE_ID is optional. Self-Service / key-only apps authenticate with
  // client_id + client_secret. Include guest_office_id only when configured
  // (required for some Enterprise / AQC office-bound credentials).
  const amaClientRef = buildAmaClientRef();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  if (officeId) {
    body.set("guest_office_id", officeId);
  }

  const { status, body: responseBody } = await amadeusFetch(
    `${baseUrl}/v1/security/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Ama-Client-Ref": amaClientRef,
      },
      body,
    },
    amaClientRef
  );

  const data = responseBody as AmadeusTokenResponse;

  if (status >= 400 || !data.access_token) {
    throw new ApiError(
      status || StatusCodes.BAD_GATEWAY,
      data.error_description ||
        data.detail ||
        data.title ||
        data.error ||
        extractAmadeusErrorMessage(data) ||
        "Failed to obtain Amadeus access token"
    );
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 1800,
    amaClientRef,
  };
};

const getAccessToken = async () => {
  const cacheKey = tokenCacheKey();
  const cached = await redisGet(cacheKey);

  if (
    cached &&
    typeof cached === "object" &&
    typeof cached.accessToken === "string"
  ) {
    return {
      accessToken: cached.accessToken as string,
      amaClientRef: buildAmaClientRef(),
    };
  }

  const token = await fetchAccessToken();
  const ttl = Math.max((token.expiresIn || 1800) - 60, 60);
  await redisSet(cacheKey, { accessToken: token.accessToken }, ttl);
  console.log(
    `[Amadeus auth] token cached → ${cacheKey}${
      config.ama.officeId ? ` (guest_office_id=${config.ama.officeId})` : ""
    }`
  );

  return {
    accessToken: token.accessToken,
    amaClientRef: token.amaClientRef,
  };
};

const clearAccessTokenCache = async () => {
  await redisDel(tokenCacheKey());
  await redisDel("amadeus:access_token");
};

export const AmadeusAuthService = {
  getAccessToken,
  clearAccessTokenCache,
};
