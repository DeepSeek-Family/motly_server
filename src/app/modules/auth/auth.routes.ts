import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
// import passport from '../../../config/passport'
const router = express.Router();

router.post(
  "/login",
  validateRequest(AuthValidation.createLoginZodSchema),
  AuthController.loginUser,
);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.createForgetPasswordZodSchema),
  AuthController.forgetPassword,
);

router.post(
  "/refresh-token",
  validateRequest(AuthValidation.createRefreshTokenZodSchema),
  AuthController.newAccessToken,
);

router.post(
  "/resend-otp",
  validateRequest(AuthValidation.createResendOtpZodSchema),
  AuthController.resendVerificationEmail,
);

router.post(
  "/verify-email",
  (req: Request, _res: Response, next: NextFunction) => {
    const { email, oneTimeCode } = req.body || {};
    req.body = {
      email,
      oneTimeCode:
        oneTimeCode === undefined || oneTimeCode === null
          ? oneTimeCode
          : Number(oneTimeCode),
    };
    next();
  },
  validateRequest(AuthValidation.createVerifyEmailZodSchema),
  AuthController.verifyEmail,
);

router.post(
  "/reset-password",
  validateRequest(AuthValidation.createResetPasswordZodSchema),
  AuthController.resetPassword,
);

router.post(
  "/change-password",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER, USER_ROLES.AGENCY),
  validateRequest(AuthValidation.createChangePasswordZodSchema),
  AuthController.changePassword,
);

// router.post(
//     '/social-login',
//     AuthController.socialLogin
// );

router.delete(
  "/delete-account",
  auth(USER_ROLES.SUPER_ADMIN),
  AuthController.deleteUser,
);

// Google Auth Routes
// router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// router.get("/google/callback",
//     passport.authenticate("google", { failureRedirect: "/" }),
//     (req, res) => {
//         res.redirect("/"); // Redirect after successful login
//     }
// );

// Facebook Auth Routes
// router.get("/facebook", passport.authenticate("facebook", { scope: ["email"] }));

// router.get("/facebook/callback",
//     passport.authenticate("facebook", { failureRedirect: "/" }),
//     (req, res) => {
//         res.redirect("/dashboard"); // Redirect after successful login
//     }
// );

export const AuthRoutes = router;
