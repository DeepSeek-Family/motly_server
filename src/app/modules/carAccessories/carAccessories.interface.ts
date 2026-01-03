import { Types } from "mongoose";

export interface IcarAccessories {
  icon: string;
  name: string;
  price: number;
  user: Types.ObjectId;
}

export type IcarAccessoriesFilters = {
  searchTerm?: string;
};
