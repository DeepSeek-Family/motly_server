import { NextFunction, Request, Response, Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { CarController } from "./car.controller";
import validateRequest from "../../middlewares/validateRequest";
import { CarValidation } from "./car.validation";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import parseCarPayload from "../../../util/parseCarPayload";

const carRoute = Router();

carRoute
  .route("/")
  .post(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        req.body = parseCarPayload(req);
        next();
      } catch (error) {
        console.log(error);
        next(error);
      }
    },
    validateRequest(CarValidation.createCarValidation),
    CarController.createCar
  )
  .get(CarController.getAllCar);

export default carRoute;
