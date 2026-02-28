import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISurveyVote extends Document {
  question: string;
  vote: "yes" | "no";
  createdAt: Date;
}

const SurveyVoteSchema = new Schema<ISurveyVote>(
  {
    question: { type: String, required: true, index: true },
    vote: { type: String, required: true, enum: ["yes", "no"] },
  },
  { timestamps: true }
);

export const SurveyVote: Model<ISurveyVote> =
  mongoose.models.SurveyVote ||
  mongoose.model<ISurveyVote>("SurveyVote", SurveyVoteSchema);
