import { NextFunction, Request, Response, Router } from "express";
import { carAccessoriesController } from "./carAccessories.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { getSingleFilePath } from "../../../shared/getFilePath";
import validateRequest from "../../middlewares/validateRequest";
import { carAccessoriesValidation } from "./carAccessories.validation";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";

const carAccessoriesRoute = Router();

carAccessoriesRoute
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const payload = req.body;
        payload.price = Number(payload.price);
        const icon = getSingleFilePath(req.files, "icon");
        if (!icon) {
          throw new ApiError(StatusCodes.BAD_REQUEST, "Icon is required");
        }
        const parsedPayload = {
          ...payload,
          icon,
        };
        req.body = parsedPayload;
        next();
      } catch (error) {
        console.log(error);
        next(error);
      }
    },
    validateRequest(carAccessoriesValidation.createCarAccessoriesZodSchema),
    carAccessoriesController.createCarAccessories
  )
  .get(carAccessoriesController.getAllCarAccessoriess);

carAccessoriesRoute
  .route("/:id")
  .get(carAccessoriesController.getSingleCarAccessories)
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const payload = req.body;
        payload.price = Number(payload.price);
        const icon = getSingleFilePath(req.files, "icon");
        const parsedPayload = {
          ...payload,
          icon,
        };
        req.body = parsedPayload;
        next();
      } catch (error) {
        console.log(error);
        next(error);
      }
    },
    validateRequest(carAccessoriesValidation.updateCarAccessoriesZodSchema),
    carAccessoriesController.updateCarAccessories
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN),
    carAccessoriesController.deleteCarAccessories
  );

export const CarAccessoriesRoutes = carAccessoriesRoute;
