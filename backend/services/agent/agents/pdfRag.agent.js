import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import Conversation from "../models/conversation.model.js";
import { deductCredits } from "../utils/deductCredits.js";
import { getVectorStore } from "../config/vectorDB.js";
import freeLLM from "../config/FreeLlm.js";
import { getMemory } from "../config/memory.js";
import { getConversationPdfContext } from "../utils/getConversationPdfContext.js";
import { checkLimit } from "../config/agentLimit.js";

export const pdfRagAgent = async (state) => {
  await checkLimit(state.userId, "chat");

  let parser;
  const filePath = state.file?.path;

  try {
    const history = await getMemory(state.conversationId);

    let collectionName = state.pdfCollection;

    if (!collectionName && !filePath) {
      const pdfContext = await getConversationPdfContext(state.conversationId);

      collectionName = pdfContext?.collectionName;
    }

    console.log(filePath);

    // A new PDF upload: parse, hash, and index the document.
    if (filePath) {
      const buffer = await fs.readFile(filePath);

      const pdfHash = createHash("sha256").update(buffer).digest("hex");

      collectionName = `pdf-${pdfHash.slice(0, 32)}`;

      parser = new PDFParse({ data: buffer });

      const pdfResult = await parser.getText();
      const pdfText = pdfResult.text?.trim();

      if (!pdfText) {
        throw new Error("No readable text found in the uploaded PDF.");
      }

      const vectorStore = getVectorStore(collectionName);

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const docs = await splitter.createDocuments([pdfText]);

      const existingCount = await vectorStore.count();

      if (existingCount !== docs.length) {
        console.log(
          `Indexing PDF: ${existingCount}/${docs.length} chunks already exist`,
        );

        await vectorStore.addDocuments(docs);
      } else {
        console.log("PDF already indexed. Skipping embedding generation.");
      }

      // Persist the PDF collection against this conversation.
      const updatedConversation = await Conversation.findByIdAndUpdate(
        state.conversationId,
        {
          $set: {
            activePdfCollection: collectionName,
          },
        },
        {
          returnDocument: "after",
        },
      );

      console.log("Conversation ID:", state.conversationId);
      console.log("Generated collection name:", collectionName);
      console.log("MongoDB database:", Conversation.db.name);
      console.log("MongoDB collection:", Conversation.collection.name);

      console.log(
        "Updated conversation:",
        updatedConversation
          ? {
              id: updatedConversation?._id,
              activePdfCollection: updatedConversation?.activePdfCollection,
            }
          : null,
      );

      if (!updatedConversation) {
        throw new Error(`Conversation not found: ${state.conversationId}`);
      }

      console.log(
        "Saved PDF collection:",
        updatedConversation.activePdfCollection,
      );
    }

    // A follow-up: use the existing collection, without needing the file.
    if (!collectionName) {
      throw new Error(
        "No active PDF was found for this conversation. Please upload the PDF again.",
      );
    }

    const vectorStore = getVectorStore(collectionName);

    const relevantDocs = await vectorStore.search(state.prompt, 5);

    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    if (!context.trim()) {
      throw new Error("No relevant content was retrieved from the PDF.");
    }

    const systemPrompt = `
You are NoBound AI, a PDF question-answering assistant.

Answer questions about the active PDF using the supplied PDF context.

Rules:
- Ground answers in the PDF context.
- If the context does not contain the answer, say you could not find it in the PDF.
- Do not invent document facts.
- Use conversation history to understand follow-up references such as
  "it", "that concept", or "explain the previous answer".
- Always verify your answer against the retrieved PDF context.
- Use clear Markdown formatting.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    for (const msg of history || []) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({
          role: msg.role,
          content: String(msg.content || ""),
        });
      }
    }

    messages.push({
      role: "user",
      content: `Retrieved PDF context:
              ${context}
              
              Current question:
              ${state.prompt}`,
    });

    const response = await freeLLM.chat.completions.create({
      model: "auto",
      messages,
    });

    const aiResponse = response.choices?.[0]?.message?.content || "";

    await deductCredits({
      userId: state.userId,
      agent: "pdf",
    });

    return {
      ...state,
      agent: "pdfRag",
      pdfCollection: collectionName,
      aiResponse,
    };
  } catch (error) {
    console.error("PDF RAG Agent Error:", error);

    return {
      ...state,
      aiResponse:
        error?.data?.message ||
        "Sorry, I couldn't process your PDF question. Please try again.",
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (error) {
        console.error("PDF parser cleanup error:", error);
      }
    }

    // Only delete the temporary upload. The vector collection remains.
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log("Uploaded PDF deleted:", filePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("Failed to delete uploaded PDF:", error);
        }
      }
    }
  }
};
