import express, { Request, Response } from "express";
import cors from "cors";
import { StatusCodes } from "http-status-codes";
import { Morgan } from "./shared/morgan";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import session from "express-session";
import router from "./app/routes";
import handleStripeWebhook from "./helpers/handleStripeWebhook";
const app = express();

// morgan
app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

//body parser
app.use(cors());

// Stripe webhooks require the raw body for signature verification.
app.post(
  "/api/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    Promise.resolve(handleStripeWebhook(req, res)).catch(next);
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//file retrieve
app.use(express.static("uploads"));
app.use(express.static("public"));

// Session middleware (must be before passport initialization)
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Secure should be true in production with HTTPS
  }) as express.RequestHandler
);

// Initialize Passport
// app.use(passport.initialize());
// app.use(passport.session());

//router
app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
  res.send("Hey Backend, How can I assist you ");
});

app.get("/health", (_req: Request, res: Response) => {
  res.sendFile("health.html", { root: "public" });
});

//global error handle
app.use(globalErrorHandler);

// handle not found route
app.use((req: Request, res: Response) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: "Not Found",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API DOESN'T EXIST",
      },
    ],
  });
});

export default app;
