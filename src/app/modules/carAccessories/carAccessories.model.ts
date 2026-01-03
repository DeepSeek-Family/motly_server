import { Schema, model } from "mongoose";
import { IcarAccessories } from "./carAccessories.interface";

const CarAccessoriesSchema = new Schema<IcarAccessories>(
  {
    icon: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const CarAccessoriesModel = model<IcarAccessories>(
  "CarAccessories",
  CarAccessoriesSchema
);
