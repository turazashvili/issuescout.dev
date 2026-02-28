import mongoose, { Schema, Document } from "mongoose";
import type { DifficultyLevel } from "@/types";

/**
 * CachedIssue — L1 cache for issue-level difficulty estimation (24h TTL).
 * Health scores are now stored in IndexedRepo (permanent, per-repo).
 */
export interface ICachedIssue extends Document {
  issueId: string;
  difficulty: DifficultyLevel;
  difficultyReason: string;
  difficultyUsedAI: boolean;
  repoFullName: string;
  language: string;
  cachedAt: Date;
}

const CachedIssueSchema = new Schema<ICachedIssue>({
  issueId: { type: String, required: true, unique: true },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard", "unknown"],
    default: "unknown",
  },
  difficultyReason: { type: String, default: "" },
  difficultyUsedAI: { type: Boolean, default: false },
  repoFullName: { type: String, default: "" },
  language: { type: String, default: "" },
  cachedAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 hours
});

CachedIssueSchema.index({ repoFullName: 1 });
CachedIssueSchema.index({ language: 1 });

export const CachedIssue =
  mongoose.models.CachedIssue ||
  mongoose.model<ICachedIssue>("CachedIssue", CachedIssueSchema);
