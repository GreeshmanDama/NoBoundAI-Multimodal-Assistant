
import crypto from "node:crypto";
import cloudinary from "../config/cloudinary.js";
import FileExpiry from "../models/fileExpiry.js";

const EXPIRY_MINUTES = 10;

function uploadBuffer(pdfBuffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);

        if (!result?.public_id || !result?.secure_url) {
          return reject(new Error("Cloudinary returned an invalid upload result."));
        }

        resolve(result);
      }
    );

    stream.on("error", reject);
    stream.end(pdfBuffer);
  });
}

export const uploadPdf = async (pdfBuffer, filename) => {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("A non-empty PDF buffer is required.");
  }

  const baseName = filename
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80) || "document";

  // Unique public IDs prevent one upload from overwriting another.
  const publicId = `${baseName}-${crypto.randomUUID()}`;

  const result = await uploadBuffer(pdfBuffer, {
    resource_type: "image",
    type: "upload",
    folder: "cortexAI/pdfs",
    format: "pdf",
    public_id: publicId,
    overwrite: false,
  });

  const expiresAt = new Date(
    Date.now() + EXPIRY_MINUTES * 60 * 1000
  );

  try {
    await FileExpiry.create({
      publicId: result.public_id,
      resourceType: result.resource_type || "image",
      deliveryType: result.type || "upload",
      expiresAt,
      status: "pending",
      nextAttemptAt: expiresAt,
    });
  } catch (error) {
    // Compensate if the expiry job could not be persisted.
    try {
      await cloudinary.uploader.destroy(result.public_id, {
        resource_type: result.resource_type || "image",
        type: result.type || "upload",
      });
    } catch (cleanupError) {
      console.error(
        "CRITICAL: Could not register PDF expiry or clean up upload:",
        {
          publicId: result.public_id,
          registrationError: error.message,
          cleanupError: cleanupError.message,
        }
      );
    }

    throw new Error(
      `Could not schedule PDF deletion: ${error.message}`
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    expiresAt,
    expiresInMinutes: EXPIRY_MINUTES,
  };
};