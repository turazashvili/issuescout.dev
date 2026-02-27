import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  githubId: string;
  login: string;
  name: string;
  avatarUrl: string;
  email: string;
  languages: string[];
  bookmarkedIssues: string[];
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
    languages: [{ type: String }],
    bookmarkedIssues: [{ type: String }],
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
