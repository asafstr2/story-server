import { Schema, model, Document, Types } from "mongoose";
import { CloudinaryAsset } from "../types/CloudinaryAsset";

export interface IStory extends Document {
  userId: Types.ObjectId;
  title: string;
  content: string[];
  images: CloudinaryAsset[];
  heroImage: string;
  createdAt: Date;
}

const storySchema = new Schema<IStory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: [String],
    required: true,
  },
  images: {
    type: [{ type: String }],
    required: true,
  },
  heroImage: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups by userId
storySchema.index({ userId: 1, createdAt: -1 });

export const Story = model<IStory>("Story", storySchema);
