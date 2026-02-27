import mongoose, { Schema, Document } from "mongoose";
import type { DifficultyLevel, HealthDetails } from "@/types";

export interface ICachedIssue extends Document {
  issueId: string;
  data: Record<string, unknown>;
  healthScore: number;
  healthDetails: HealthDetails;
  difficulty: DifficultyLevel;
  difficultyReason: string;
  repoOwner: string;
  repoName: string;
  language: string;
  cachedAt: Date;
}

const CachedIssueSchema = new Schema<ICachedIssue>({
  issueId: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  healthScore: { type: Number, default: 0 },
  healthDetails: { type: Schema.Types.Mixed, default: {} },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard", "unknown"],
    default: "unknown",
  },
  difficultyReason: { type: String, default: "" },
  repoOwner: { type: String, default: "" },
  repoName: { type: String, default: "" },
  language: { type: String, default: "" },
  cachedAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 hours
});

CachedIssueSchema.index({ language: 1 });
CachedIssueSchema.index({ healthScore: -1 });
CachedIssueSchema.index({ cachedAt: 1 });

export const CachedIssue =
  mongoose.models.CachedIssue ||
  mongoose.model<ICachedIssue>("CachedIssue", CachedIssueSchema);
