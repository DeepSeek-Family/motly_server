import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ContactStatus } from "./contact.interface";
import { ContactService } from "./contact.service";

const createContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.createContact(req.user!, {
    name: String(req.body.name || ""),
    subject: String(req.body.subject || ""),
    message: String(req.body.message || ""),
  });
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const listContacts = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.listContacts({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
  });
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contact messages retrieved successfully",
    pagination: result.pagination,
    data: result.data,
  });
});

const getContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.getContactById(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contact message retrieved successfully",
    data: result,
  });
});

const updateContact = catchAsync(async (req: Request, res: Response) => {
  const status = req.body.status as ContactStatus;
  const result = await ContactService.updateContactStatus(
    req.params.id,
    status
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contact message updated successfully",
    data: result,
  });
});

const deleteContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.deleteContact(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contact message deleted successfully",
    data: result,
  });
});

export const ContactController = {
  createContact,
  listContacts,
  getContact,
  updateContact,
  deleteContact,
};
