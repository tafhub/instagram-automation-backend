import mongoose, { Document, Schema } from "mongoose";

// Interface for the Comment document
export interface IComment extends Document {
  username: string; // The bot's username that made the comment
  postUrl: string; // URL of the post that was commented on
  postCaption: string; // The original post's caption
  commentText: string; // The comment that was posted
  postOwner?: string; // Username of the post owner (optional)
  timestamp: Date; // When the comment was posted
  isDeleted: boolean; // Whether the comment has been deleted
  deletedAt?: Date; // When the comment was deleted
}

// Define the Comment schema
const CommentSchema = new Schema<IComment>({
  username: { type: String, required: true, index: true },
  postUrl: { type: String, required: true },
  postCaption: { type: String, required: true },
  commentText: { type: String, required: true },
  postOwner: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
});

// Create indexes for efficient queries
CommentSchema.index({ username: 1, timestamp: -1 });
CommentSchema.index({ isDeleted: 1, timestamp: -1 });

// Export the Comment model
export const Comment = mongoose.model<IComment>("Comment", CommentSchema);


