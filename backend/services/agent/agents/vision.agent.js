import cloudinary from "../config/cloudinary.js";
import dotenv from "dotenv";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

dotenv.config();

const IMAGE_MODELS = [
  "@cf/black-forest-labs/flux-2-dev",
  "@cf/black-forest-labs/flux-2-klein-9b",
  "@cf/black-forest-labs/flux-2-klein-4b",
  "@cf/black-forest-labs/flux-1-schnell",
  "@cf/leonardo/lucid-origin",
  "@cf/leonardo/phoenix-1.0",
  "@cf/bytedance/stable-diffusion-xl-lightning",
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "@cf/lykon/dreamshaper-8-lcm",
];

const IMAGE_SYSTEM_PROMPT = `
You are NoBound AI's expert image prompt engineer.

Your task is to create visually compelling images that accurately
match the user's request.

Image generation rules:
1. Preserve the user's main subject, intent, and requested details.
2. Improve the prompt with useful composition, lighting, color,
   perspective, materials, and atmosphere.
3. Prefer clear, coherent, visually appealing compositions.
4. Use photorealism when appropriate, but follow any style the
   user explicitly requests.
5. Do not add unrelated subjects or unnecessary elements.
6. For text-heavy designs, minimize unnecessary text and spelling
   complexity.
7. Return only the final image prompt, without explanations.
`;

const BASE_URL = (
  process.env.FREELLMAPI_BASE_URL || "http://127.0.0.1:31415/v1"
).replace(/\/+$/, "");

const IMAGE_API_URL = BASE_URL.endsWith("/images/generations")
  ? BASE_URL
  : `${BASE_URL}/images/generations`;

const enhancePrompt = (userPrompt) => `
${IMAGE_SYSTEM_PROMPT}

User's image request:
${userPrompt}

Generate an image following these instructions.
`;

const requestImage = async (model, prompt) => {
  if (!process.env.FREELLMAPI_API_KEY) {
    throw new Error("FREELLMAPI_API_KEY is missing.");
  }

  console.log("Image API URL:", IMAGE_API_URL);

  let response;

  try {
    response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FREELLMAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        width: 1280,
        height: 720,
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    console.error("Image API network error:", {
      name: error.name,
      message: error.message,
      cause: error.cause
        ? {
            code: error.cause.code,
            message: error.cause.message,
          }
        : undefined,
    });

    throw new Error(
      `Image API connection failed: ${
        error.cause?.code || error.name || error.message
      }`,
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Image API returned invalid JSON (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error?.message || result.message || `HTTP ${response.status}`,
    );
  }

  const image = result.data?.[0];

  if (!image?.b64_json && !image?.url) {
    throw new Error("No image data returned.");
  }

  return image;
};

// Final fallback: generate an image using Pollinations.
const requestPollinationsImage = async (prompt) => {
  const imageUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    "?width=1280&height=720";

  const response = await fetch(imageUrl, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Pollinations failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Pollinations returned unexpected content type: ${
        contentType || "unknown"
      }`,
    );
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());

  if (!imageBuffer.length) {
    throw new Error("Pollinations returned an empty image.");
  }

  return `data:${contentType};base64,${imageBuffer.toString("base64")}`;
};

export const visionAgent = async (state) => {
  await checkLimit(state.userId, "vision");

  const userPrompt = state.prompt?.trim();

  console.log("prompt:", userPrompt);

  if (!userPrompt) {
    return {
      ...state,
      aiResponse: "Sorry, I couldn't process your request.",
      generatedImage: null,
      visionError: "Please provide an image prompt.",
    };
  }

  const prompt = enhancePrompt(userPrompt);

  let image;
  let modelUsed;
  let lastError;

  // Try FreeLLM models first.
  for (const model of IMAGE_MODELS) {
    try {
      console.log(`Trying image model: ${model}`);

      image = await requestImage(model, prompt);
      modelUsed = model;

      break;
    } catch (error) {
      lastError = error;

      console.error(`Image generation failed: ${model}`, error.message);

      // These failures affect all models using the same endpoint.
      if (
        error.message.startsWith("Image API connection failed:") ||
        error.message === "FREELLMAPI_API_KEY is missing."
      ) {
        break;
      }
    }
  }

  let uploadSource;

  if (image) {
    uploadSource = image.b64_json
      ? `data:image/png;base64,${image.b64_json}`
      : image.url;
  } else {
    // All FreeLLM models failed. Try Pollinations.
    try {
      console.warn("All FreeLLM image models failed. Trying Pollinations...");

      uploadSource = await requestPollinationsImage(state?.prompt.trim());
      modelUsed = "pollinations";
    } catch (error) {
      lastError = error;

      console.error("Pollinations fallback failed:", error.message);

      return {
        ...state,
        aiResponse: "Sorry, I couldn't generate your image.",
        generatedImage: null,
        visionError: lastError?.message || "All image models failed.",
      };
    }
  }

  // Upload the generated image to Cloudinary.
  try {
    const uploaded = await cloudinary.uploader.upload(uploadSource, {
      folder: "cortexai/generated",
      resource_type: "image",
    });

    const uploadedImage = uploaded.secure_url;

    await deductCredits({
      userId: state.userId,
      agent: "vision",
    });

    return {
      ...state,
      generatedImage: uploadedImage,
      aiResponse: `Image generated successfully using ${modelUsed}.`,
      images: [...(state.images ?? []), uploadedImage],
      modelUsed,
      visionError: null,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);

    return {
      ...state,
      aiResponse:
        error?.data?.message || "Sorry, I couldn't generate your image.",
    };
  }
};
