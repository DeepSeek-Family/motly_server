import { Schema, model } from "mongoose";
import { IPartner, PartnerModel } from "./partner.interface";

const partnerSchema = new Schema<IPartner, PartnerModel>(
  {
    name: { type: String, required: true, trim: true },
    companyCode: { type: String, trim: true, uppercase: true },
    logoUrl: { type: String, required: true, trim: true },
    websiteUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

partnerSchema.index({ isActive: 1, sortOrder: 1 });

export const Partner = model<IPartner, PartnerModel>("Partner", partnerSchema);
