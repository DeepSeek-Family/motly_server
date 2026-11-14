import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  ip_address: process.env.IP,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  node_env: process.env.NODE_ENV,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt: {
    jwt_secret: process.env.JWT_SECRET!,
    jwt_expire_in: process.env.JWT_EXPIRE_IN!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRE_IN!,
    issuer: process.env.ISSUER!,
    audience: process.env.AUDIENCE!,
    tokenVersion: process.env.TOKEN_VERSION!,
  },
  stripe: {
    stripeSecretKey:
      process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_SECRET,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret:
      process.env.STRIPE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET,
    /** Redirect after Checkout / subscription success (URL, not a webhook secret). */
    paymentSuccess: process.env.STRIPE_SUCCESS_URL || "",
    successUrl: process.env.STRIPE_SUCCESS_URL || "",
    cancelUrl: process.env.STRIPE_CANCEL_URL || "",
  },
  /** Public origin of this API (for Stripe success/cancel return URLs). */
  publicApiUrl: (
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    ""
  ).replace(/\/$/, ""),
  /** Website origin — Stripe cancel/success can bounce here after Motly return. */
  webFrontendUrl: (
    process.env.WEB_FRONTEND_URL ||
    process.env.CLIENT_WEB_URL ||
    ""
  ).replace(/\/$/, ""),
  email: {
    from: process.env.EMAIL_FROM,
    user: process.env.EMAIL_USER,
    port: process.env.EMAIL_PORT,
    host: process.env.EMAIL_HOST,
    pass: process.env.EMAIL_PASS,
  },
  social: {
    google_client_id: process.env.GOOGLE_CLIENT_ID,
    facebook_client_id: process.env.FACEBOOK_CLIENT_ID,
    google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
    facebook_client_secret: process.env.FACEBOOK_CLIENT_SECRET,
  },
  admin: {
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    confirmPassword: process.env.CONFIRM_PASSWORD,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    twilioNumber: process.env.TWILIO_NUMBER,
  },
  // elasticsearch
  elasticSearchIndex: {
    carIndex: process.env.ELASTICSEARCH_CAR_INDEX,
  },
  // redis
  redis: {
    host: process.env.REDIS_HOST || process.env.redisIP || "127.0.0.1",
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  redisHost: {
    redisIP: process.env.REDIS_HOST || process.env.redisIP || "127.0.0.1",
  },
  ISSUER: process.env.ISSUER,
  bullMQ: {
    host: process.env.BULLMQIP!,
    port: process.env.BULLMQPORT!,
  },
  ama: {
    baseUrl:
      process.env.AMA_BASE_URL || "https://test.travel.api.amadeus.com",
    clientId: process.env.AMA_TEST_API_KEY,
    clientSecret: process.env.AMA_API_SECRET,
    officeId: (process.env.AMA_OFFICE_ID || "").trim() || undefined,
    companyCode: (process.env.AMA_COMPANY_CODE || "").trim() || undefined,
    allowPrd: process.env.AMA_ALLOW_PRD === "true",
    includeRaw: process.env.AMA_INCLUDE_RAW === "true",
    timeoutMs: process.env.AMA_TIMEOUT_MS
      ? parseInt(process.env.AMA_TIMEOUT_MS, 10)
      : 30000,
  },
};
