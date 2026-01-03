import express from "express";
import { UserRoutes } from "../modules/user/user.routes";
import { AuthRoutes } from "../modules/auth/auth.routes";
import carRoute from "../modules/car/car.routes";
import { CarAccessoriesRoutes } from "../modules/carAccessories/carAccessories.route";
const router = express.Router();

const apiRoutes = [
  { path: "/user", route: UserRoutes },
  { path: "/auth", route: AuthRoutes },
  { path: "/car", route: carRoute },
  { path: "/car-accessories", route: CarAccessoriesRoutes },
];

apiRoutes.forEach((route) => router.use(route?.path, route?.route));
export default router;
