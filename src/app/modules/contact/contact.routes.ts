import express from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { ContactController } from "./contact.controller";
import { ContactValidation } from "./contact.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.AGENCY, USER_ROLES.SUPER_ADMIN),
    validateRequest(ContactValidation.createContactZodSchema),
    ContactController.createContact
  )
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY),
    validateRequest(ContactValidation.listContactQueryZodSchema),
    ContactController.listContacts
  );

router
  .route("/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY),
    validateRequest(ContactValidation.idParamsZodSchema),
    ContactController.getContact
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY),
    validateRequest(ContactValidation.updateContactZodSchema),
    ContactController.updateContact
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY),
    validateRequest(ContactValidation.idParamsZodSchema),
    ContactController.deleteContact
  );

export const ContactRoutes = router;
