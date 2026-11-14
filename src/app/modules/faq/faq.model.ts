import { Schema, model } from "mongoose";
import { IFaq, FaqModel } from "./faq.interface";

const faqSchema = new Schema<IFaq, FaqModel>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FAQ = model<IFaq, FaqModel>("FAQ", faqSchema);

