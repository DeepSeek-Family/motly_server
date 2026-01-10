import { Model, Types } from "mongoose";
import { USER_ROLES } from "../../../enums/user";

interface IStripeAccountInfo {
  status: string;
  stripeAccountId: string;
  externalAccountId: string;
  currency: string;
}

interface IAuthenticationProps {
  isResetPassword: boolean;
  oneTimeCode: number;
  expireAt: Date;
}
interface ILicenseDetails {
  licenseNumber: number;
  expireDate: string;
  issueCountry: string;
  licenseImage: string;
}

export type IUser = {
  name: string;
  email: string;
  loginWith: "email" | "google";
  password: string;
  confirmPassword: string;
  image: string;
  DOB?: string;
  role: USER_ROLES;
  contact?: string;
  residentialAddress?: string;
  postalCode?: string;
  country?: string;
  city?: string;
  verified: boolean;
  drivingDetails?: ILicenseDetails;
  authentication?: IAuthenticationProps;
  accountInformation?: IStripeAccountInfo;
};

export type UserModal = {
  isExistUserById(id: string): any;
  isExistUserByEmail(email: string): any;
  isAccountCreated(id: string): any;
  isMatchPassword(password: string, hashPassword: string): boolean;
} & Model<IUser>;
