import mongoose, { Schema, Document } from "mongoose";

export interface ISearchLog extends Document {
  userId: string | null;
  userLogin: string | null;
  query: string;
  programmingLanguage: string;
  difficulty: string;
  sort: string;
  resultCount: number;
  timestamp: Date;
}

const SearchLogSchema = new Schema<ISearchLog>({
  userId: { type: String, default: null },
  userLogin: { type: String, default: null },
  query: { type: String, default: "" },
  programmingLanguage: { type: String, default: "" },
  difficulty: { type: String, default: "all" },
  sort: { type: String, default: "newest" },
  resultCount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// Indexes for analytics queries
SearchLogSchema.index({ timestamp: -1 });
SearchLogSchema.index({ userId: 1, timestamp: -1 });
SearchLogSchema.index({ programmingLanguage: 1 });
SearchLogSchema.index({ query: "text" });

export const SearchLog =
  mongoose.models.SearchLog ||
  mongoose.model<ISearchLog>("SearchLog", SearchLogSchema);
