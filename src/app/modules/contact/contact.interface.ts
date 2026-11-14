import { Model, Types } from "mongoose";

export enum ContactStatus {
  NEW = "NEW",
  READ = "READ",
  RESOLVED = "RESOLVED",
}

export type IContact = {
  user?: Types.ObjectId | string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  adminNotifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ContactModel = Model<IContact>;
