
import mongoose from "mongoose";

const fileExpirySchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
    },
    resourceType: {
      type: String,
      enum: ["image", "raw", "video"],
      default: "image",
      required: true,
    },
    deliveryType: {
      type: String,
      default: "upload",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "failed"],
      default: "pending",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

fileExpirySchema.index({
  status: 1,
  expiresAt: 1,
  nextAttemptAt: 1,
});

export default mongoose.model("FileExpiry", fileExpirySchema);
