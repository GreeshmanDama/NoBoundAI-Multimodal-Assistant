
import { getMemory } from "../config/memory.js";
import freeLLM from "../config/FreeLlm.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

const CODE_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "qwen3.8-27b",
  "dots3-note-preview",
  "gemini-3.5-flash",
  "auto",
];

// Generation configuration
const MAX_OUTPUT_TOKENS = 8192;
const MAX_CONTINUATIONS = 3;

const systemPrompt = `
You are NoBound AI, an expert AI coding assistant.

Your responsibilities:
- Write, debug, explain, and optimize code.
- Build complete solutions using the user's requested stack.
- Follow existing project conventions when code context is provided.
- Provide maintainable, secure, production-quality implementations.

Conversation and context awareness:
1. Always review available previous conversation messages.
2. Determine whether the current request relates to previous code,
   errors, files, features, or projects.
3. Use relevant previous messages to understand the implementation,
   project structure, technology stack, APIs, and previous fixes.
4. Continue existing implementations instead of unnecessarily
   starting over.
5. Preserve existing architecture unless a change is necessary.
6. Consider previous errors and failed solutions.
7. Treat newly provided code as the latest version.
8. Resolve references such as "this code", "that error", and
   "continue" using available conversation history.
9. Follow previously established requirements and constraints.
10. Use only relevant conversation history.
11. Ask concise questions when essential context is missing.
12. Never claim to inspect unavailable files or code.

Rules for code generation:
1. Understand the complete request before answering.
2. Provide complete working code when requested.
3. Never intentionally omit required code.
4. Never stop in the middle of a function or code block.
5. Include necessary imports and dependencies.
6. Explain important implementation details.
7. Organize large implementations into clearly labeled files.
8. If necessary, split large answers into multiple parts.
9. Follow the requested programming language and framework.
10. Identify root causes when debugging.
11. Prefer targeted fixes unless a complete rewrite is requested.
12. Distinguish verified facts from assumptions.
13. Never invent technical details.

Response quality:
- Give detailed, comprehensive, technically accurate answers.
- Do not unnecessarily shorten explanations.
- Include practical examples and implementation details.
- Provide complete code rather than fragments when requested.
- Explain important edge cases, security considerations, and errors.
- Use clear headings and structured formatting.
- Prioritize correctness and completeness over brevity.
- Avoid repetitive explanations.

When generating large implementations, ensure the answer
is complete and logically organized.
`;

export const codeAgent = async (state) => {
  await checkLimit(state.userId, "code");

  let lastError = null;

  const history = await getMemory(state.conversationId);

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  // Add conversation history
  history.forEach((msg) => {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role,
        content: String(msg.content || ""),
      });
    }
  });

  // Add current user message
  messages.push({
    role: "user",
    content: state.prompt,
  });

  for (const model of CODE_MODELS) {
    try {
      console.log(`Trying code model: ${model}`);

      let completeResponse = "";
      let finishReason = null;
      let continuationCount = 0;

      let currentMessages = [...messages];

      while (continuationCount <= MAX_CONTINUATIONS) {
        const response = await freeLLM.chat.completions.create({
          model,
          messages: currentMessages,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        });

        const choice = response.choices?.[0];
        const content = choice?.message?.content;
        finishReason = choice?.finish_reason;

        console.log("Model:", model);
        console.log("Finish reason:", finishReason);
        console.log("Token usage:", response.usage);

        if (!content?.trim()) {
          throw new Error(
            `Model ${model} returned an empty response.`,
          );
        }

        // Append the generated content
        completeResponse += content;

        console.log(
          "Total response characters:",
          completeResponse.length,
        );

        // Response completed successfully
        if (finishReason !== "length") {
          break;
        }

        console.warn(
          `${model} reached its output limit. Continuing...`,
        );

        if (continuationCount >= MAX_CONTINUATIONS) {
          console.warn("Maximum continuation attempts reached.");
          break;
        }

        continuationCount++;

        // Continue the same model from the previous response
        currentMessages = [
          ...currentMessages,
          {
            role: "assistant",
            content,
          },
          {
            role: "user",
            content: `
Continue your previous response exactly where it stopped.

IMPORTANT:
- Do not repeat previously generated content.
- Do not restart the explanation.
- Continue incomplete code, functions, and files.
- Maintain the same formatting and structure.
- Complete all unfinished code blocks.
- Do not unnecessarily summarize.
- Finish the remaining implementation.
`,
          },
        ];
      }

      if (!completeResponse.trim()) {
        throw new Error(`Model ${model} generated no usable response.`);
      }

      console.log(`Code model succeeded: ${model}`);
      console.log("Final response length:", completeResponse.length);
      console.log("Final finish reason:", finishReason);

      await deductCredits({
        userId: state.userId,
        agent: "code",
      });

      return {
        ...state,
        aiResponse: completeResponse,
        modelUsed: model,
        finishReason,
        isComplete: finishReason !== "length",
        continuationCount,
      };

    } catch (error) {
      lastError = error;

      console.error(
        `Code model failed: ${model}`,
        error.message,
      );
    }
  }

  console.error("All code models failed:", lastError);

  return {
    ...state,
    aiResponse:
      lastError?.response?.data?.error?.message ||
      lastError?.message ||
      "Sorry, I couldn't generate a response. Please try again.",
    isComplete: false,
  };
};
