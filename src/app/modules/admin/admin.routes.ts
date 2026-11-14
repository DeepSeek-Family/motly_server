import { Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { AdminController } from "./admin.controller";
import fileUploadHandler from "../../middlewares/fileUploaderHandler";
import { getSingleFilePath } from "../../../shared/getFilePath";
import catchAsync from "../../../shared/catchAsync";

const router = Router();

const adminAuth = auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.AGENCY);

/** Multipart partner form → body + optional logo file as `image`. */
const attachPartnerPayload = catchAsync(async (req, _res, next) => {
  const image = getSingleFilePath(req.files, "image");
  if (image) {
    req.body.logoUrl = image;
  }
  if (typeof req.body.isActive === "string") {
    req.body.isActive = req.body.isActive === "true";
  }
  if (typeof req.body.sortOrder === "string") {
    const n = Number(req.body.sortOrder);
    req.body.sortOrder = Number.isFinite(n) ? n : 0;
  }
  next();
});

router.get("/dashboard", adminAuth, AdminController.getDashboard);
router.get("/bookings", adminAuth, AdminController.getBookings);
router.get("/payments", adminAuth, AdminController.getPayments);
router.get("/payments/:id", adminAuth, AdminController.getPayment);
router.get("/clients", adminAuth, AdminController.getClients);
router.get("/agencies", adminAuth, AdminController.getAgencies);
router.get("/calendar", adminAuth, AdminController.getCalendar);
router.get(
  "/partners",
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getPartners
);
router.post(
  "/partners",
  auth(USER_ROLES.SUPER_ADMIN),
  fileUploadHandler() as any,
  attachPartnerPayload,
  AdminController.createPartner
);
router.patch(
  "/partners/:id",
  auth(USER_ROLES.SUPER_ADMIN),
  fileUploadHandler() as any,
  attachPartnerPayload,
  AdminController.updatePartner
);
router.delete(
  "/partners/:id",
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.deletePartner
);
router.patch(
  "/users/:id/verified",
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.patchUserVerified
);

export const AdminRoutes = router;
