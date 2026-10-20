import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";
import redis from "../../../shared/redis/redis.js";

export const agent = async (req, res, next) => {
  try {
    const { prompt, conversationId, agent } = req.body;
    const file = req.file;

    console.log("prompt:", prompt, "agent:", agent);

    await redis.del(`messages-${conversationId}`);

    const userId = req.headers["x-user-id"];

    // Build attachment metadata only; do not store the file itself.
    const attachment = file
      ? {
          name: file.originalname,
          type:
            file.mimetype === "application/pdf"
              ? "pdf"
              : file.mimetype.startsWith("image/")
                ? "image"
                : "file",
          size: file.size,
        }
      : undefined;

    // 1. Generate response
    const result = await graph.invoke({
      prompt,
      conversationId,
      agent,
      userId,
      file,
    });

    const response = result.aiResponse;

    // 2. Save user message in Redis memory
    await addMessage(
      conversationId,
      "user",
      prompt || (attachment ? `Uploaded file: ${attachment.name}` : ""),
    );

    // 3. Persist user message and attachment metadata in Chat service
    await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
      conversationId,
      role: "user",
      content: prompt || "",
      ...(attachment && { attachment }),
    });

    // 4. Save assistant response in Redis memory
    await addMessage(conversationId, "assistant", response);

    // 5. Persist assistant response
    await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
      conversationId,
      role: "assistant",
      content: response,
      images: result.images ?? [],
    });

    return res.status(200).json({
      answer: response,
      images: result.images ?? [],
      success: true,
    });
  } catch (error) {
    console.error(
      "Error occurred in agent controller:",
      error.response?.data || error.message,
    );

    next(error);
  }
};