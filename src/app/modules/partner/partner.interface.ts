import { Model } from "mongoose";

export type IPartner = {
  name: string;
  companyCode?: string;
  logoUrl: string;
  websiteUrl?: string;
  isActive: boolean;
  sortOrder: number;
};

export type PartnerModel = Model<IPartner>;
