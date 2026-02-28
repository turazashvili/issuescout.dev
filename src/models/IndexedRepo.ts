import mongoose, { Schema, Document } from "mongoose";
import type { HealthDetails } from "@/types";

export interface IIndexedRepo extends Document {
  fullName: string;
  owner: string;
  name: string;
  healthScore: number;
  healthDetails: HealthDetails;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: string;
  description: string;
  lastEnrichedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IndexedRepoSchema = new Schema<IIndexedRepo>(
  {
    fullName: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    healthScore: { type: Number, default: 0 },
    healthDetails: { type: Schema.Types.Mixed, default: {} },
    stargazerCount: { type: Number, default: 0 },
    forkCount: { type: Number, default: 0 },
    primaryLanguage: { type: String, default: "" },
    description: { type: String, default: "" },
    lastEnrichedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// For "best repos by language" queries
IndexedRepoSchema.index({ primaryLanguage: 1, healthScore: -1 });
// For finding stale repos
IndexedRepoSchema.index({ lastEnrichedAt: 1 });

export const IndexedRepo =
  mongoose.models.IndexedRepo ||
  mongoose.model<IIndexedRepo>("IndexedRepo", IndexedRepoSchema);
