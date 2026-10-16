import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";
import redis from "../../../shared/redis/redis.js";

export const agent = async (req, res, next) => {
  try {
    const { prompt, conversationId, agent } = req.body;
    const file = req.file;

    console.log("prompt: ", prompt, "agent: ", agent);

    await redis.del(`messages-${conversationId}`);

    const userId = req.headers["x-user-id"];

    // 1. Generate response first
    const result = await graph.invoke({
      prompt,
      conversationId,
      agent,
      userId,
      file,
    });

    console.log("result:", result);

    const response = result.aiResponse;

    // 2. Save user message
    await addMessage(conversationId, "user", prompt);

    await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
      conversationId,
      role: "user",
      content: prompt,
    });

    // 3. Save assistant response
    await addMessage(conversationId, "assistant", response);

    await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
      conversationId,
      role: "assistant",
      content: response,
      images: result.images,
    });

    return res.status(200).json({
      answer:response,
      images: result.images,
      success: true,
    });
  } catch (error) {
    console.error(
      "Error occurred in agent controller:",
      error.response?.data || error.message,
    );

    next(error)
  }
};
