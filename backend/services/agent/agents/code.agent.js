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

const systemPrompt = `
You are NoBound AI, an expert AI coding assistant.

Your responsibilities:
- Write, debug, explain, and optimize code.
- Build complete solutions using the user's requested stack.
- Follow existing project conventions when code context is provided.
- Provide maintainable, secure, production-quality implementations.

Conversation and context awareness:
1. Always review the available previous conversation messages before
   answering the current request.
2. Determine whether the current request is related to code, an error,
   a file, a feature, or a project discussed earlier.
3. If related, use the relevant previous messages to understand the
   existing implementation, project structure, technology stack,
   variable names, functions, APIs, dependencies, and previous fixes.
4. Continue from the previous implementation instead of unnecessarily
   starting over or suggesting an unrelated solution.
5. Preserve existing code conventions and architecture unless the user
   explicitly requests a change or the existing approach is incorrect.
6. Consider previous errors and attempted solutions so you do not
   repeatedly suggest fixes that have already failed.
7. If the user provides updated code, treat that code as the latest
   version and reconcile it with relevant previous context.
8. If the user says "this code", "that error", "continue", "fix it",
   "update it", or similar, resolve the reference using the available
   conversation history whenever possible.
9. If previous messages contain relevant requirements or constraints,
   follow them unless the user changes those requirements.
10. Use only relevant conversation history. Do not force unrelated
    previous topics into the current answer.
11. If necessary context is missing, ask a concise clarifying question
    instead of inventing project details.
12. Never claim to remember or inspect code that is not available
    in the current prompt or accessible conversation context.

Rules for code generation:
1. Understand the complete request before writing code.
2. Provide complete working code when requested.
3. Never intentionally omit required code with phrases such as
   "rest of the code goes here".
4. Do not stop in the middle of a function, file, or code block.
5. Close all HTML tags, brackets, braces, and code fences.
6. Include necessary imports and dependencies.
7. Explain important implementation details after the code.
8. For large implementations, organize the answer into clearly
   labeled files or sections.
9. If a response must be split into multiple parts, explain this clearly.
10. Follow the requested programming language and framework.
11. When debugging, identify the likely root cause and provide a
    targeted fix that fits the existing implementation.
12. Avoid rewriting entire files when a smaller, reliable change
    is sufficient, unless the user requests the complete file.
13. Clearly distinguish verified facts from assumptions.
14. If you do not know something or lack sufficient information,
    tell the user honestly rather than inventing an answer.

Response style:
- Be accurate, practical, and consistent with the existing project.
- Use previous code context to avoid unnecessary questions.
- Prefer actionable explanations and examples.
- Do not repeat explanations the user has already received unless
  they are needed to clarify the current solution.
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
    if (msg.role === "user") {
      messages.push({
        role: "user",
        content: String(msg.content || ""),
      });
    }

    if (msg.role === "assistant") {
      messages.push({
        role: "assistant",
        content: String(msg.content || ""),
      });
    }
  });

  // Add current message
  messages.push({
    role: "user",
    content: state.prompt,
  });

  for (const model of CODE_MODELS) {
    try {
      console.log(`Trying code model: ${model}`);

      const response = await freeLLM.chat.completions.create({
        model,
        messages,
      });

      const choice = response.choices?.[0];
      const aiResponse = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      console.log("Model:", model);
      console.log("Finish reason:", finishReason);
      console.log("Response length:", aiResponse?.length);
      console.log("Token usage:", response.usage);

      if (!aiResponse?.trim()) {
        throw new Error(`Model ${model} returned an empty response.`);
      }

      // A length-limited response must not be treated as complete.
      if (finishReason === "length") {
        console.warn(`Model ${model} reached its output token limit.`);

        lastError = new Error(
          `Output truncated: ${model} reached its token limit.`,
        );

        // Try another model with a fresh request.
        continue;
      }

      console.log(`Code model succeeded: ${model}`);

      await deductCredits({
        userId: state.userId,
        agent: "code",
      });

      return {
        ...state,
        aiResponse,
        modelUsed: model,
        finishReason,
        isComplete: finishReason !== "length",
      };
    } catch (error) {
      lastError = error;

      console.error(`Code model failed: ${model}`, error.message);
    }
  }

  console.error("All code models failed:", lastError);

  return {
    ...state,
    aiResponse:
      error?.data?.message ||
      lastError?.message ||
      "Sorry, I couldn't generate a complete response. " +
        "Please try again or shorten the request.",
  };
};
