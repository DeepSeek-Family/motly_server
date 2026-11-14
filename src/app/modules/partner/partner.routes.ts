import express from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { PartnerController } from "./partner.controller";
import { PartnerValidation } from "./partner.validation";

const router = express.Router();

/** Public — app/website trusted partners strip */
router.route("/").get(PartnerController.getActivePartners);

/** Dashboard admin */
router
  .route("/admin")
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    PartnerController.getAllPartners
  )
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(PartnerValidation.createPartnerZodSchema),
    PartnerController.createPartner
  );

router
  .route("/admin/:id")
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(PartnerValidation.updatePartnerZodSchema),
    PartnerController.updatePartner
  )
  .delete(auth(USER_ROLES.SUPER_ADMIN), PartnerController.deletePartner);

export const PartnerRoutes = router;
