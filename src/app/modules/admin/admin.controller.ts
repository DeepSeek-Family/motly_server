import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AdminService } from "./admin.service";

const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getDashboardOverview({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard overview retrieved",
    data: result,
  });
});

const getBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listBookings({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Bookings retrieved",
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPage: result.pagination.totalPage,
    },
    data: result.data,
  });
});

const getPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listPayments({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payments retrieved",
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPage: result.pagination.totalPage,
    },
    data: result.data,
  });
});

const getPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getPaymentById(String(req.params.id));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment retrieved",
    data: result,
  });
});

const getClients = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listClients({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Clients retrieved",
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPage: result.pagination.totalPage,
    },
    data: result.data,
  });
});

const getAgencies = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listAgencies({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Agencies retrieved",
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPage: result.pagination.totalPage,
    },
    data: result.data,
  });
});

const getCalendar = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.listCalendar({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Calendar events retrieved",
    data: result,
  });
});

const getPartners = catchAsync(async (_req: Request, res: Response) => {
  const result = await AdminService.listPartnersAdmin();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partners retrieved",
    data: result,
  });
});

const createPartner = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.createPartnerAdmin(req.body || {});
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Partner created",
    data: result,
  });
});

const updatePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.updatePartnerAdmin(
    String(req.params.id),
    req.body || {}
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partner updated",
    data: result,
  });
});

const deletePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.deletePartnerAdmin(String(req.params.id));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Partner deleted",
    data: result,
  });
});

const patchUserVerified = catchAsync(async (req: Request, res: Response) => {
  const verified = Boolean(req.body?.verified);
  const result = await AdminService.setUserVerified(req.params.id, verified);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User updated",
    data: result,
  });
});

export const AdminController = {
  getDashboard,
  getBookings,
  getPayments,
  getPayment,
  getClients,
  getAgencies,
  getCalendar,
  getPartners,
  createPartner,
  updatePartner,
  deletePartner,
  patchUserVerified,
};
