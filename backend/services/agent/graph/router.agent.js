import freeLLM from "../config/FreeLlm.js";
import { getMemory } from "../config/memory.js";
import { getConversationPdfContext } from "../utils/getConversationPdfContext.js";

const validAgents = [
  "chat",
  "search",
  "code",
  "pdf",
  "pdfRag",
  "ppt",
  "vision",
  "imageAnalyzer",
];

export const routerAgent = async (state) => {
  // 1. Route actual file uploads directly.
  if (state.file?.mimetype === "application/pdf") {
    return {
      ...state,
      agent: "pdfRag",
    };
  }

  if (state.file?.mimetype?.startsWith("image/")) {
    return {
      ...state,
      agent: "imageAnalyzer",
    };
  }

  if (state.agent && state.agent !== "auto") {
    return {
      ...state,
      agent: state.agent,
    };
  }

  try {
    // 2. Retrieve recent conversation history and PDF context.
    const [history, pdfContext] = await Promise.all([
      getMemory(state.conversationId),
      getConversationPdfContext(state.conversationId),
    ]);

    const hasPdf = Boolean(pdfContext?.collectionName);

    const recentHistory = (history || [])
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-8)
      .map((msg) => ({
        role: msg.role,
        content: String(msg.content || "").slice(0, 10),
      }));

    // 3. Ask the LLM to classify the latest message.
    const prompt = `
You are the intent router for NoBound AI.

Choose exactly ONE agent for the user's LATEST message.

AVAILABLE AGENTS:

chat:
General conversation, explanations, learning, personal questions,
and unrelated follow-up discussions.

search:
Latest news, current information, internet research, and web lookup.

code:
Programming, debugging, software architecture, APIs, and code generation.

pdf:
Creating or generating a new PDF document, report, resume,
or other downloadable PDF.

pdfRag:
Answering questions about an uploaded PDF, summarizing it,
explaining its contents, or continuing a discussion about its content.

ppt:
Creating or generating PowerPoint presentations and slides.

vision:
Generating new images from text prompts.

imageAnalyzer:
Understanding, describing, or answering questions about an uploaded image.

CURRENT PDF AVAILABILITY:
${
  hasPdf
    ? "An uploaded PDF is available in this conversation."
    : "No previously uploaded PDF is available in this conversation."
}

ROUTING RULES:

1. Classify the latest message using its meaning and recent conversation history.
2. Use pdfRag only when the user is asking about an uploaded PDF
   or clearly continuing a discussion about that PDF.
3. Use pdf when the user wants to generate a new PDF document.
4. Having a PDF available does not mean every message is about that PDF.
5. If the user changes to an unrelated topic, select the appropriate
   agent for the new topic.
6. Use recent history to resolve references such as "explain that",
   "what about the second point", or "go back to the PDF".
7. If no PDF is available and the user asks about a previously uploaded
   document, do not pretend you can access it. Use chat to explain
   that the document needs to be uploaded again.
8. Use vision for creating images and imageAnalyzer for analyzing
   uploaded images.
9. Do not confuse PDF generation with PDF question answering.
10. Return exactly one agent name from this list:
    chat, search, code, pdf, pdfRag, ppt, vision, imageAnalyzer

RECENT CONVERSATION:
${JSON.stringify(recentHistory)}

LATEST USER MESSAGE:
${state.prompt}

Return only the agent name.
`;

    const response = await freeLLM.chat.completions.create({
      model: "auto:fast",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // 4. Normalize the result without losing camelCase agent names.
    const result = String(response.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/[`"'*]/g, "")
      .split(/\s+/)[0]
      .toLowerCase();

    const agentMap = {
      chat: "chat",
      search: "search",
      code: "code",
      pdf: "pdf",
      pdfrag: "pdfRag",
      ppt: "ppt",
      vision: "vision",
      imageanalyzer: "imageAnalyzer",
    };

    const selectedAgent = agentMap[result] || "chat";

    // 5. Preserve the active PDF reference for follow-up questions.
    console.log("LLM Router:", selectedAgent);

    return {
      ...state,
      agent: validAgents.includes(selectedAgent) ? selectedAgent : "chat",
      ...(hasPdf ? { pdfCollection: pdfContext.collectionName } : {}),
    };
  } catch (error) {
    console.error("Router Agent Error:", error);

    return {
      ...state,
      agent: "chat",
    };
  }
};
