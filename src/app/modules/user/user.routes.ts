import { Router } from "express";
import { USER_ROLES } from "../../../enums/user";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { getSingleFilePath } from "../../../shared/getFilePath";
import catchAsync from "../../../shared/catchAsync";

const router = Router();

const attachProfilePayload = catchAsync(async (req, _res, next) => {
  const image = getSingleFilePath(req.files, "image");

  if (req.body.data) {
    req.body =
      typeof req.body.data === "string"
        ? JSON.parse(req.body.data)
        : req.body.data;
  }

  if (image) {
    req.body.image = image;
  }

  next();
});

router.get(
  "/profile",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER, USER_ROLES.AGENCY),
  UserController.getUserProfile
);

router
  .route("/")
  .post(
    validateRequest(UserValidation.createUserZodSchema),
    UserController.createUser
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER, USER_ROLES.AGENCY),
    fileUploadHandler() as any,
    attachProfilePayload,
    UserController.updateProfile
  );

export const UserRoutes = router;
