import { NextFunction, Request, Response, Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { CarController } from "./car.controller";
import validateRequest from "../../middlewares/validateRequest";
import { CarValidation } from "./car.validation";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { parseCarPayload } from "../../../util/parseCarPayload";

const carRoute = Router();

carRoute
  .route("/")
  /**
   * for create car
   * */
  .post(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler() as any,
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
  // get all cars
  .get(CarController.getAllCar);

carRoute
  .route("/for-user")
  .get(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.getAllUserCarsData
  );

carRoute
  .route("/:id")
  /**
   * for get car by id
   * */
  .get(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.getCarById
  )
  /**
   * for update car
   * */
  .patch(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    fileUploadHandler() as any,
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        req.body = parseCarPayload(req);
        next();
      } catch (error) {
        console.log(error);
        next(error);
      }
    },
    validateRequest(CarValidation.updateCarValidation),
    CarController.updateCar
  )
  // delete car
  .delete(
    auth(USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    CarController.deleteCar
  );

export default carRoute;
