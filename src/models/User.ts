import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  githubId: string;
  login: string;
  name: string;
  avatarUrl: string;
  email: string;
  languages: string[];
  frameworks: string[];
  topics: string[];
  preferredLanguages: string[];
  preferredFrameworks: string[];
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    githubId: { type: String, required: true, unique: true },
    login: { type: String, required: true },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    email: { type: String, default: "" },
    // Auto-detected from GitHub profile
    languages: [{ type: String }],
    frameworks: [{ type: String }],
    topics: [{ type: String }],
    // User-curated preferences (from onboarding + manual edits)
    preferredLanguages: [{ type: String }],
    preferredFrameworks: [{ type: String }],
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
