import mongoose, { Schema, Document } from "mongoose";

export interface IBookmark extends Document {
  userId: string;
  issueId: string;
  issueData: Record<string, unknown>;
  archived: boolean;
  savedAt: Date;
  archivedAt: Date | null;
}

const BookmarkSchema = new Schema<IBookmark>({
  userId: { type: String, required: true },
  issueId: { type: String, required: true },
  issueData: { type: Schema.Types.Mixed, required: true },
  archived: { type: Boolean, default: false },
  savedAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null },
});

// Fast lookup: user's active/archived bookmarks
BookmarkSchema.index({ userId: 1, archived: 1 });
// Prevent duplicate bookmarks per user
BookmarkSchema.index({ userId: 1, issueId: 1 }, { unique: true });

export const Bookmark =
  mongoose.models.Bookmark ||
  mongoose.model<IBookmark>("Bookmark", BookmarkSchema);
