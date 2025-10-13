import mongoose, { Document, Schema } from "mongoose";

// Interface for the TargetAccounts document
export interface ITargetAccounts extends Document {
  username: string; // The bot's username
  targetAccounts: string[]; // Array of Instagram usernames to auto-comment on
  updatedAt: Date;
}

// Define the TargetAccounts schema
const TargetAccountsSchema = new Schema<ITargetAccounts>({
  username: { type: String, required: true, unique: true, index: true },
  targetAccounts: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
TargetAccountsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Export the TargetAccounts model
export const TargetAccounts = mongoose.model<ITargetAccounts>("TargetAccounts", TargetAccountsSchema);


