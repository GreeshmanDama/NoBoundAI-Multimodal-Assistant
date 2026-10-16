import cloudinary from "../config/cloudinary.js";

export const uploadImage = async (image, folder = "cortexai/generated") => {
  try {
    if (!image) {
      throw new Error("Image data is required.");
    }

    const result = await cloudinary.uploader.upload(image, {
      folder,
      resource_type: "image",
    });

    return {
      url: result.secure_url,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw error;
  }
};