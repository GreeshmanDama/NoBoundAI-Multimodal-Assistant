import axios from "axios";
import { graph } from "../graph/graph.js";
import { addMessage } from "../config/memory.js";
import redis from "../../../shared/redis/redis.js";

export const agent = async (req, res, next) => {
  const abortController = new AbortController();
  let streamingStarted = false;

  try {
    const { prompt, conversationId, agent: selectedAgent } = req.body;
    const controllerStart = performance.now();

    const file = req.file;
    const userId = req.headers["x-user-id"];

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

    const userContent =
      prompt || (attachment ? `Uploaded file: ${attachment.name}` : "");

    // 1. Headers FIRST, then flush.
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    streamingStarted = true;

    const sendEvent = (event, data) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const handleDisconnect = () => {
      if (!res.writableEnded) abortController.abort();
    };
    res.on("close", handleDisconnect);

    // 2. Redis write must finish before the graph runs (chatAgent reads history).
    await addMessage(conversationId, "user", userContent);

    // 3. Chat-service save runs in the background; don't block streaming.
    const saveUserPromise = axios
      .post(`${process.env.CHAT_SERVICE}/save-message`, {
        conversationId,
        role: "user",
        content: prompt || "",
        ...(attachment && { attachment }),
      })
      .catch((err) =>
        console.error("[CONTROLLER] user save failed:", err.message),
      );

    const onChunk = (chunk) => sendEvent("chunk", { text: chunk });

    const result = await graph.invoke(
      { prompt, conversationId, agent: selectedAgent, userId, file },
      { configurable: { onChunk }, signal: abortController.signal },
    );

    if (abortController.signal.aborted) return;

    const response = result.aiResponse || "";
    const images = result.images ?? [];

    // 4. Tell the client we're done first, then persist.
    sendEvent("done", { answer: response, images, success: true });
    res.off("close", handleDisconnect);
    res.end();

    await saveUserPromise;
    await Promise.allSettled([
      addMessage(conversationId, "assistant", response),
      axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
        conversationId,
        role: "assistant",
        content: response,
        images,
      }),
    ]);

    console.log(
      "[CONTROLLER] Total time:",
      (performance.now() - controllerStart).toFixed(2),
      "ms",
    );
  } catch (error) {
    console.error(
      "Error occurred in agent controller:",
      error.response?.data || error.message,
    );

    if (streamingStarted) {
      if (!res.writableEnded && !res.destroyed) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: error.message || "Agent generation failed",
          })}\n\n`,
        );
        res.end();
      }
      return;
    }

    next(error);
  }
};
