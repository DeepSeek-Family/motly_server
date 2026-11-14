import { model, Schema } from "mongoose";
import { ContactModel, ContactStatus, IContact } from "./contact.interface";

const contactSchema = new Schema<IContact, ContactModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: ContactStatus.NEW,
      index: true,
    },
    adminNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

contactSchema.index({ createdAt: -1 });

export const Contact = model<IContact, ContactModel>("Contact", contactSchema);
