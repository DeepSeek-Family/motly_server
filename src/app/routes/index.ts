import express from "express";
import { UserRoutes } from "../modules/user/user.routes";
import { AuthRoutes } from "../modules/auth/auth.routes";
import carRoute from "../modules/car/car.routes";
import { CarAccessoriesRoutes } from "../modules/carAccessories/carAccessories.route";
import { RuleRoutes } from "../modules/rule/rule.route";
import { FaqRoutes } from "../modules/faq/faq.routes";
import { PartnerRoutes } from "../modules/partner/partner.routes";
import { AdminRoutes } from "../modules/admin/admin.routes";
import { ContactRoutes } from "../modules/contact/contact.routes";
const router = express.Router();

const apiRoutes = [
  { path: "/user", route: UserRoutes },
  { path: "/auth", route: AuthRoutes },
  { path: "/car", route: carRoute },
  { path: "/car-accessories", route: CarAccessoriesRoutes },
  { path: "/rule", route: RuleRoutes },
  { path: "/faq", route: FaqRoutes },
  { path: "/partner", route: PartnerRoutes },
  { path: "/contact", route: ContactRoutes },
  { path: "/admin", route: AdminRoutes },
];

apiRoutes.forEach((route) => router.use(route?.path, route?.route));
export default router;
