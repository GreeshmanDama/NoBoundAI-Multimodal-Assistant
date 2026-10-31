
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

export async function sendMessageStream(
  formData,
  { onChunk, onDone, signal } = {},
) {
  const response = await fetch(`${SERVER_URL}/api/agent/chat`, {
    method: "POST",
    body: formData,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = await response.json();
      message = error.message || error.error || message;
    } catch {
      // Use fallback message.
    }

    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";

  // Backward compatibility if the server returns normal JSON.
  if (contentType.includes("application/json")) {
    const data = await response.json();
    onDone?.(data);
    return data;
  }

  if (!response.body) {
    throw new Error("Streaming is not supported by this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let completed = false;
  let finalData = null;

  const processEvent = (rawEvent) => {
    if (!rawEvent.trim()) return;

    let eventName = "message";
    const dataLines = [];

    for (const line of rawEvent.split("\n")) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (!dataLines.length) return;

    let data;

    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (eventName === "chunk") {
      if (data.text) onChunk?.(data.text);
      return;
    }

    if (eventName === "done") {
      completed = true;
      finalData = data;
      onDone?.(data);
      return;
    }

    if (eventName === "error") {
      throw new Error(data.message || "Agent generation failed.");
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let boundary;

      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        processEvent(rawEvent);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (!completed) {
      throw new Error("The server closed the stream before completing the response.");
    }

    return finalData;
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed.
    }

    throw error;
  }
}
