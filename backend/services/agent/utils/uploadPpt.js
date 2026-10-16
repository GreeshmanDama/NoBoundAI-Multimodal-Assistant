import crypto from "node:crypto";
import cloudinary from "../config/cloudinary.js";
import FileExpiry from "../models/fileExpiry.js";

const EXPIRY_MINUTES = 10;

function uploadBuffer(pptBuffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);

        if (!result?.public_id || !result?.secure_url) {
          return reject(
            new Error("Cloudinary returned an invalid upload result.")
          );
        }

        resolve(result);
      }
    );

    stream.on("error", reject);
    stream.end(pptBuffer);
  });
}

export const uploadPpt = async (pptBuffer, filename = "presentation.pptx") => {
  if (!Buffer.isBuffer(pptBuffer) || pptBuffer.length === 0) {
    throw new Error("A non-empty PowerPoint buffer is required.");
  }

  const baseName = filename
    .replace(/\.pptx?$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80) || "presentation";

  // Generate a unique ID to prevent overwriting existing presentations.
  const publicId = `${baseName}-${crypto.randomUUID()}`;

  const result = await uploadBuffer(pptBuffer, {
    resource_type: "raw",
    type: "upload",
    folder: "cortexAI/ppts",
    public_id: `${publicId}.pptx`,
    overwrite: false,
  });

  const expiresAt = new Date(
    Date.now() + EXPIRY_MINUTES * 60 * 1000
  );

  try {
    await FileExpiry.create({
      publicId: result.public_id,
      resourceType: result.resource_type || "raw",
      deliveryType: result.type || "upload",
      expiresAt,
      status: "pending",
      nextAttemptAt: expiresAt,
    });
  } catch (error) {
    // Remove the uploaded presentation if expiry registration fails.
    try {
      await cloudinary.uploader.destroy(result.public_id, {
        resource_type: result.resource_type || "raw",
        type: result.type || "upload",
      });
    } catch (cleanupError) {
      console.error(
        "CRITICAL: Could not register PPT expiry or clean up upload:",
        {
          publicId: result.public_id,
          registrationError: error.message,
          cleanupError: cleanupError.message,
        }
      );
    }

    throw new Error(
      `Could not schedule PPT deletion: ${error.message}`
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    expiresAt,
    expiresInMinutes: EXPIRY_MINUTES,
  };
};