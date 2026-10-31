import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { getSingleFilePath } from "../../../shared/getFilePath";
const router = express.Router();

router.get(
  "/profile",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
  UserController.getUserProfile,
);

router
  .route("/")
  .post(UserController.createUser)
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    fileUploadHandler() as any,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
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
      } catch (error) {
        next(error);
      }
    },
    UserController.updateProfile,
  );

export const UserRoutes = router;
