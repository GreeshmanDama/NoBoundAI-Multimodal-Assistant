import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { v2 as cloudinary } from "cloudinary";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// config -> agent -> services -> backend
const envPath = path.resolve(currentDir, "../.env");

dotenv.config({ path: envPath });

console.log("Env file:", envPath);
console.log("Cloud name loaded:", Boolean(process.env.CLOUDINARY_CLOUD_NAME));
console.log("API key loaded:", Boolean(process.env.CLOUDINARY_API_KEY));
console.log("API secret loaded:", Boolean(process.env.CLOUDINARY_API_SECRET));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:true
});

export default cloudinary;