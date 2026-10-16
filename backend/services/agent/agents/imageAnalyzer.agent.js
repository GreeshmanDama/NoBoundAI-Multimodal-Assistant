import { readFile } from "node:fs/promises";
import freeLLM from "../config/FreeLlm.js";
import { getMemory } from "../config/memory.js";
import { deductCredits } from "../utils/deductCredits.js";
import fs from "fs/promises";
import { checkLimit } from "../config/agentLimit.js";

const VISION_MODELS = [
  "qwen3.8-27b",
  "dots3-note-preview",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemma-4-26b-it",
  "gemini-2.5-flash",
  "llama-4-scout",
  "mistral-small-3.1-24b",
  "llama-3.2-11b-vision",
  "llama-3.2-11b-vision-instruct",
  "llama-3.2-90b-vision",
  "muse-glimmer-30b",
  "gemma-4-26b-a4b-it",
  "nemotron-3-nano-omni-30b-a3b-reasoning",

  "auto",
];

const systemPrompt = `
You are NoBound AI, an expert image analysis assistant.

Your responsibilities:
- Analyze uploaded images accurately.
- Answer the user's specific question about the image.
- Extract visible text using OCR-style reading when possible.
- Explain charts, graphs, tables, diagrams, screenshots, and documents.
- Explain code and error messages visible in screenshots.
- Describe relevant visual details, objects, layouts, and relationships.
- Use Markdown, headings, lists, and code blocks when helpful.
- Clearly distinguish visible facts from reasonable interpretations.
- State when text or visual details are too unclear to determine.
- Never invent text, values, objects, or image details.
- Analyze the provided image rather than claiming access to other files.
- If the user asks a general question about the image, answer directly.
- If the user provides no specific question, give a useful overview
  of the image and its important details.
`;

export const imageAnalyzerAgent = async (state) => {
  await checkLimit(state.userId, "vision");

  let lastError = null;

  try {
    if (!state.file?.path) {
      throw new Error("No image file was provided.");
    }

    const mimeType = state.file?.mimetype;

    if (!mimeType?.startsWith("image/")) {
      throw new Error("The uploaded file must be an image.");
    }

    const imageBuffer = await readFile(state.file.path);
    const base64 = imageBuffer.toString("base64");
    const imageUrl = `data:${mimeType};base64,${base64}`;

    const history = state.conversationId
      ? await getMemory(state.conversationId)
      : [];

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    // Preserve relevant conversation context.
    for (const msg of history || []) {
      if (
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string" &&
        msg.content.trim()
      ) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Attach the actual image to the current user message.
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text:
            state.prompt?.trim() ||
            "Analyze this image and explain its important details.",
        },
        {
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        },
      ],
    });

    for (const model of VISION_MODELS) {
      try {
        console.log(`Trying image analysis model: ${model}`);

        const response = await freeLLM.chat.completions.create({
          model,
          messages,
          max_tokens: 4096,
        });

        const choice = response.choices?.[0];
        const aiResponse = choice?.message?.content;
        const finishReason = choice?.finish_reason;

        console.log("Vision model:", model);
        console.log("Finish reason:", finishReason);
        console.log("Response length:", aiResponse?.length);
        console.log("Token usage:", response.usage);

        if (typeof aiResponse !== "string" || !aiResponse.trim()) {
          throw new Error(`${model} returned an empty response.`);
        }

        // Do not accept a known truncated response.
        if (finishReason === "length") {
          lastError = new Error(`${model} reached its output token limit.`);

          console.warn(lastError.message);
          continue;
        }

        // Deduct credits only after obtaining a valid response.
        // Keep billing outside the model retry loop.
        await deductCredits({
          userId: state.userId,
          agent: "code",
        });

        console.log(`Image analysis succeeded with ${model}`);

        return {
          ...state,
          aiResponse,
        };
      } catch (error) {
        lastError = error;

        console.error(`Image analysis model failed: ${model}`, error.message);
      }
    }

    console.error("All image analysis models failed:", lastError);

    return {
      ...state,
      aiResponse:
        "Sorry, I couldn't analyze this image right now. " +
        "Please try again with a supported image or a clearer upload.",
      error: lastError?.message || "All vision models failed.",
      isComplete: false,
    };
  } catch (error) {
    console.error("Image analyzer agent error:", error);

    return {
      ...state,
      aiResponse:
        error?.data?.message ||
        "I couldn't process the uploaded image. " +
          "Please check the file and try again.",
    };
    
  } finally {
    await fs.unlink(state.file.path);
  }
};
