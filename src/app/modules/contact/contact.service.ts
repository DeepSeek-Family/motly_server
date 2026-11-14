import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { emailHelper } from "../../../helpers/emailHelper";
import { User } from "../user/user.model";
import { ContactStatus, IContact } from "./contact.interface";
import { Contact } from "./contact.model";

const requireUserId = (user: JwtPayload): string => {
  if (!user?.id) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }
  return String(user.id);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const notifyAdmin = async (row: IContact & { _id?: unknown }) => {
  const adminEmail = String(config.admin.email || "").trim();
  if (!adminEmail) return;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">New Motly contact message</h2>
      <p><b>Name:</b> ${escapeHtml(row.name)}</p>
      <p><b>Email:</b> ${escapeHtml(row.email)}</p>
      <p><b>Subject:</b> ${escapeHtml(row.subject)}</p>
      <p><b>Message:</b></p>
      <pre style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:8px">${escapeHtml(row.message)}</pre>
      <p style="color:#666;font-size:12px">Ref: ${String(row._id || "")}</p>
    </div>
  `;

  await emailHelper.sendEmail({
    to: adminEmail,
    subject: `[Motly Contact] ${row.subject}`,
    html,
  });
};

const createContact = async (
  user: JwtPayload,
  payload: { name: string; subject: string; message: string }
) => {
  const userId = requireUserId(user);
  const dbUser = await User.findById(userId).select("name email").lean();
  if (!dbUser?.email) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User account not found");
  }

  const name = String(payload.name || dbUser.name || "").trim();
  const subject = String(payload.subject || "").trim();
  const message = String(payload.message || "").trim();

  if (!name || !subject || !message) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Name, subject and feedback are required"
    );
  }

  const row = await Contact.create({
    user: userId,
    name,
    email: String(dbUser.email).toLowerCase(),
    subject,
    message,
    status: ContactStatus.NEW,
  });

  try {
    await notifyAdmin(row.toObject());
    row.adminNotifiedAt = new Date();
    await row.save();
  } catch {
    // Message is stored even if SMTP fails — admin can still read it in dashboard.
  }

  return {
    id: String(row._id),
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
  };
};

const listContacts = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit =
    query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search?.trim()) {
    const q = query.search.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { subject: { $regex: q, $options: "i" } },
      { message: { $regex: q, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);

  return {
    data: rows.map((row: any) => ({
      id: String(row._id),
      userId: row.user ? String(row.user) : null,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      status: row.status,
      adminNotifiedAt: row.adminNotifiedAt || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

const getContactById = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid contact id");
  }
  const row = await Contact.findById(id).lean();
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Contact message not found");
  }
  return {
    id: String(row._id),
    userId: row.user ? String(row.user) : null,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminNotifiedAt: row.adminNotifiedAt || null,
    createdAt: (row as any).createdAt,
    updatedAt: (row as any).updatedAt,
  };
};

const updateContactStatus = async (id: string, status: ContactStatus) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid contact id");
  }
  const row = await Contact.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).lean();
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Contact message not found");
  }
  return getContactById(id);
};

const deleteContact = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid contact id");
  }
  const row = await Contact.findByIdAndDelete(id).lean();
  if (!row) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Contact message not found");
  }
  return { id };
};

export const ContactService = {
  createContact,
  listContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
};
