import { getMemory } from "../config/memory.js";
import freeLLM from "../config/FreeLlm.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

/* -------------------------------------------------------------------------- */
/*                                Configuration                               */
/* -------------------------------------------------------------------------- */

const CODE_MODELS = ["auto"];

const MAX_OUTPUT_TOKENS = 8192;
const TEMPERATURE = 0.4;

// Set to false to use plain (non-streaming) requests everywhere.
const USE_STREAMING = true;

/**
 * Per-level settings.
 *  - firstCallMaxTokens: output cap for the first call only. Simple requests
 *    use a lower cap; if one overflows, continuations use the full cap.
 *  - maxContinuations: extra calls allowed to finish a cut-off answer.
 */
const LEVEL_SETTINGS = {
  simple: { firstCallMaxTokens: 3072, maxContinuations: 3 },
  standard: { firstCallMaxTokens: MAX_OUTPUT_TOKENS, maxContinuations: 5 },
  production: { firstCallMaxTokens: MAX_OUTPUT_TOKENS, maxContinuations: 10 },
};

// Conversation history budget.
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARS = 24000;

// How much of the generated answer is replayed to the model when continuing.
const MAX_CONTEXT_TAIL_CHARS = 12000;

// Overlap detection when stitching continuation chunks together.
const MAX_OVERLAP_CHARS = 800;
const MIN_OVERLAP_CHARS = 24;

// Transient error handling.
const REQUEST_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

const DONE_MARKER = /\[\[DONE\]\]/g;

/* -------------------------------------------------------------------------- */
/*                             Request classification                         */
/* -------------------------------------------------------------------------- */

const PRODUCTION_INTENT_PATTERNS = [
  /\bproduction\b/i,
  /\bproduction[- ]ready\b/i,
  /\bproduction[- ]level\b/i,
  /\benterprise[- ]grade\b/i,
  /\benterprise[- ]level\b/i,
  /\bscalable\b/i,
  /\bhigh[- ]availability\b/i,
  /\bfull[- ]stack\b/i,
  /\bend[- ]to[- ]end\b/i,
  /\bfrom scratch\b/i,
  /\bsystem design\b/i,
  /\bsoftware architecture\b/i,
  /\bmicroservices?\b/i,
  /\bclone\b/i,
  /\bcomplete (application|system|platform|project)\b/i,
];

const SIMPLE_INTENT_PATTERNS = [
  /\bsimple\b/i,
  /\bbasic\b/i,
  /\bbeginner\b/i,
  /\bquick example\b/i,
  /\bsmall example\b/i,
  /\bshort code\b/i,
  /\bsimple example\b/i,
  /\bcode snippet\b/i,
  /\bjust the code\b/i,
  /\bonly the code\b/i,
];

const COMPLEXITY_PATTERNS = [
  /\b(authentication|authorization|jwt|oauth|rbac|permissions?)\b/i,
  /\b(database|mongodb|postgresql|mysql|redis|schema|migrations?)\b/i,
  /\b(api|rest api|graphql|websocket|webhooks?)\b/i,
  /\b(unit tests?|integration tests?|e2e tests?|testing)\b/i,
  /\b(caching|message queue|background jobs?|workers?)\b/i,
  /\b(rate limiting|monitoring|logging|observability|tracing)\b/i,
  /\b(docker|kubernetes|ci\/cd|deployment pipeline)\b/i,
  /\b(validation|error handling|retry logic|encryption)\b/i,
];

const BUILD_REQUEST_PATTERN =
  /\b(build|create|develop|implement|design|generate|write)\b/i;

/**
 * Returns "simple" | "standard" | "production".
 */
const classifyRequest = (prompt = "") => {
  const request = String(prompt).trim();

  if (!request) return "simple";

  if (PRODUCTION_INTENT_PATTERNS.some((p) => p.test(request))) {
    return "production";
  }

  if (SIMPLE_INTENT_PATTERNS.some((p) => p.test(request))) {
    return "simple";
  }

  const complexityCount = COMPLEXITY_PATTERNS.filter(
    (p) => p.test(request)
  ).length;

  if (
    BUILD_REQUEST_PATTERN.test(request) &&
    complexityCount >= 3
  ) {
    return "production";
  }

  // Ordinary questions should use the fast generation profile.
  if (!BUILD_REQUEST_PATTERN.test(request)) {
    return "simple";
  }

  return "standard";
};

/* -------------------------------------------------------------------------- */
/*                                System prompt                               */
/* -------------------------------------------------------------------------- */

const systemPrompt = `
You are NoBound AI, an expert AI coding assistant.

Your responsibilities:
- Write, debug, explain, and optimize code.
- Build complete solutions using the user's requested stack.
- Follow existing project conventions when code context is provided.
- Provide maintainable, secure, production-quality implementations.

Environment limits (very important):
- You are a text-only chat assistant. You have NO tools, NO function calling,
  NO plugins, NO code execution, NO file system, NO web browsing, and NO
  image generation.
- Never output tool calls or function calls in any form: no JSON tool
  payloads, no <tool_call>, <function_call>, or similar tags, and never say
  things like "I will call a function/tool".
- This chat has NO file support. The user cannot upload or attach files, and
  you cannot create, save, attach, or send files or download links. Never say
  "I've created/saved/attached the file".
- If you need existing code, ask the user to paste it as text.
- Deliver everything inline as Markdown. For multi-file solutions, give each
  file its own fenced code block with the file path written on the line above.
- Never claim you ran, tested, or deployed anything. Describe expected
  behaviour or output instead.

Conversation and context awareness:
1. Review the previous conversation messages that are available.
2. Determine whether the request relates to previous code, errors, files,
   features, or projects.
3. Use relevant history to understand the implementation, project structure,
   technology stack, APIs, and previous fixes.
4. Continue existing implementations instead of starting over.
5. Preserve existing architecture unless a change is necessary.
6. Consider previous errors and failed solutions.
7. Treat newly provided code as the latest version.
8. Resolve references such as "this code", "that error", and "continue"
   using the conversation history.
9. Follow previously established requirements and constraints.
10. Use only relevant history.
11. Ask a concise question only when essential context is missing.
12. Never claim to inspect code or files that were not pasted into the chat.

Rules for code generation:
1. Understand the complete request before answering.
2. Provide complete, working code when requested.
3. Never omit required code. Never use placeholders such as
   "...rest of the code", "similar to above", or "implement here".
4. Never stop in the middle of a function, file, or code block.
5. Include all necessary imports and dependencies.
6. Always tag code fences with a language and always close them.
7. Explain important implementation details briefly.
8. Organize large implementations into clearly labelled files.
9. Follow the requested programming language and framework.
10. Identify root causes when debugging; prefer targeted fixes unless a
    rewrite is requested.
11. Distinguish verified facts from assumptions. Never invent APIs, packages,
    or technical details.
12. Never repeat a file path, heading, filename, or section.

Response quality:
- Match response length to the complexity of the request.
- Simple questions get direct answers.
- Algorithm and DSA problems get the implementation, explanation, and
  complexity analysis.
- Production-level work gets comprehensive, maintainable, secure solutions
  with error handling and edge cases.
- Use clear headings and structured formatting.
- Avoid repetition and long preambles; put the code first for large builds.

Long answers and continuation:
- Large answers may be cut off by an output limit. When you are asked to
  continue, resume from the exact character where you stopped, without
  repeating anything, without a preamble, and without re-opening a code
  fence that is already open.
- Plan large answers so that every file is delivered in full.
`;

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getStatus = (error) => error?.status ?? error?.response?.status;

const isLengthFinish = (reason) =>
  ["length", "max_tokens", "max_output_tokens"].includes(
    String(reason || "").toLowerCase(),
  );

/**
 * Returns the currently open Markdown code fence (or null).
 */
const getOpenFence = (text = "") => {
  let open = null;

  for (const line of text.split("\n")) {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/);
    if (!match) continue;

    const [, marker, info] = match;

    if (!open) {
      open = { marker, lang: info || "" };
    } else if (
      marker[0] === open.marker[0] &&
      marker.length >= open.marker.length &&
      !info
    ) {
      open = null;
    }
  }

  return open;
};

/**
 * Appends a continuation chunk to existing text, removing duplicated
 * overlap and accidental re-opened code fences.
 * The result always starts with `previous`.
 */
const mergeChunks = (previous, next) => {
  let chunk = next;

  // Model re-opened a language-tagged fence we are already inside of.
  if (getOpenFence(previous)) {
    chunk = chunk.replace(/^\s*(`{3,}|~{3,})[\w+#.-]+[ \t]*\r?\n/, "");
  }

  const candidates = [chunk, chunk.replace(/^\s+/, "")];

  for (const candidate of candidates) {
    const max = Math.min(MAX_OVERLAP_CHARS, previous.length, candidate.length);

    for (let size = max; size >= MIN_OVERLAP_CHARS; size--) {
      if (previous.endsWith(candidate.slice(0, size))) {
        return previous + candidate.slice(size);
      }
    }
  }

  return previous + chunk;
};

/**
 * Removes tool-call artifacts in case the model hallucinates them.
 * Applied to the stored response only (streamed text is already sent).
 */
const TOOL_CALL_PATTERNS = [
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
  /<tool_use>[\s\S]*?<\/tool_use>/gi,
  /<function_calls?>[\s\S]*?<\/function_calls?>/gi,
];

const stripToolCallArtifacts = (text = "") =>
  TOOL_CALL_PATTERNS.reduce((out, pattern) => out.replace(pattern, ""), text);

/**
 * Keeps the most recent history that fits the budget.
 */
const buildHistory = (history = []) => {
  const valid = (Array.isArray(history) ? history : [])
    .filter(
      (msg) =>
        (msg?.role === "user" || msg?.role === "assistant") &&
        String(msg.content || "").trim(),
    )
    .slice(-MAX_HISTORY_MESSAGES);

  const kept = [];
  let total = 0;

  for (let i = valid.length - 1; i >= 0; i--) {
    const content = String(valid[i].content);

    if (kept.length > 0 && total + content.length > MAX_HISTORY_CHARS) {
      break;
    }

    total += content.length;
    kept.unshift({ role: valid[i].role, content });
  }

  return kept;
};

const buildContinuationPrompt = (text, contextWasTrimmed) => {
  const open = getOpenFence(text);
  const ending = text.slice(-200);

  return `
Your previous response was cut off by the output limit. Continue it from the exact character where it stopped.

The response currently ends with:
----- ENDING -----
${ending}
----- END OF ENDING -----

Rules:
- Output only the continuation. No preamble such as "Sure" or "Continuing".
- Do not repeat anything already written. Do not restart the answer, the explanation, or the current file.
- Never repeat a file path, heading, filename, or section that has already
  appeared in the previous response.
- If continuing a multi-file project, continue with the next unfinished
  file or the next file that has not yet been provided.
- Never regenerate a completed file.
- Do not provide a second file list or summary containing paths already shown.
${
  open
    ? `- You were inside a ${open.lang || "code"} code block. Continue the code directly WITHOUT opening a new code fence, and close it with ${open.marker} once that code is finished.`
    : "- You were not inside a code block. Open a new fence only when a new code block starts."
}
- Finish every unfinished function, file, and code block, then deliver any files or sections that are still remaining.
- Keep the same formatting, naming, and structure.
- Do not call tools or functions and do not reference files or attachments. Use plain text and code blocks only.
${contextWasTrimmed ? "- The earlier part of your response is omitted here for brevity, but it was already delivered to the user." : ""}
- If the response is already fully complete, reply with exactly: [[DONE]]
`.trim();
};

const buildContinuationMessages = (baseMessages, text) => {
  const contextWasTrimmed = text.length > MAX_CONTEXT_TAIL_CHARS;

  return [
    ...baseMessages,
    { role: "assistant", content: text.slice(-MAX_CONTEXT_TAIL_CHARS) },
    { role: "user", content: buildContinuationPrompt(text, contextWasTrimmed) },
  ];
};

/**
 * Wraps the client callback so a disconnected client never breaks generation.
 */
const createSafeEmitter = (onChunk) => {
  let broken = false;

  return (delta) => {
    if (typeof onChunk !== "function" || broken || !delta) return;

    try {
      onChunk(delta);
    } catch (error) {
      broken = true;
      console.warn(
        "[codeAgent] onChunk failed; streaming to the client stopped:",
        error.message,
      );
    }
  };
};

/**
 * Turns raw model deltas into clean text appended to `current`.
 *
 *  - First call of an answer: deltas are emitted immediately.
 *  - Continuation calls: the first ~800 chars are buffered so repeated
 *    overlap and re-opened fences can be removed before anything is sent;
 *    after that, deltas stream straight through.
 */
const createAssembler = (current, emit) => {
  let text = current;
  let pending = "";
  let buffering = current.length > 0;

  const flush = () => {
    if (!buffering) return;

    buffering = false;

    const clean = pending.replace(DONE_MARKER, "");
    pending = "";

    if (!clean.trim()) return;

    const merged = mergeChunks(text, clean);
    const added = merged.slice(text.length);

    text = merged;
    emit(added);
  };

  const push = (delta) => {
    if (!delta) return;

    if (buffering) {
      pending += delta;
      if (pending.length >= MAX_OVERLAP_CHARS * 1.5) flush();
      return;
    }

    text += delta;
    emit(delta);
  };

  return {
    push,
    flush,
    get text() {
      return text;
    },
  };
};

/* -------------------------------------------------------------------------- */
/*                               Model requests                               */
/* -------------------------------------------------------------------------- */

/**
 * Requests one completion. Streams deltas to `onDelta` when streaming is on.
 * Retries transient failures (only if nothing was received yet).
 * Falls back to a non-streaming request if the provider rejects streaming.
 *
 * Returns { finishReason }.
 */
const requestCompletion = async ({
  model,
  messages,
  maxTokens,
  signal,
  onDelta,
}) => {
  const params = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: TEMPERATURE,
  };
  const requestOptions = signal ? { signal } : undefined;

  const runPlain = async (progress) => {
    const response = await freeLLM.chat.completions.create(
      params,
      requestOptions,
    );
    const choice = response.choices?.[0];
    const content = choice?.message?.content ?? "";

    if (content) {
      progress.received = true;
      onDelta(content);
    }

    return { finishReason: choice?.finish_reason ?? null };
  };

  const runOnce = async (progress) => {
    if (!USE_STREAMING) return runPlain(progress);

    let stream;

    try {
      stream = await freeLLM.chat.completions.create(
        { ...params, stream: true },
        requestOptions,
      );
    } catch (error) {
      const status = getStatus(error);

      if (status === 400 || status === 404 || status === 501) {
        console.warn(
          `[codeAgent] Streaming rejected (${status}). Using a normal request.`,
        );
        return runPlain(progress);
      }

      throw error;
    }

    let finishReason = null;

    for await (const part of stream) {
      const choice = part?.choices?.[0];
      const delta = choice?.delta?.content;

      if (delta) {
        progress.received = true;
        onDelta(delta);
      }

      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }

    return { finishReason };
  };

  let lastError;

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt++) {
    const progress = { received: false };

    try {
      return await runOnce(progress);
    } catch (error) {
      lastError = error;

      if (signal?.aborted) throw error;

      const status = getStatus(error);
      const transient =
        !status || status === 408 || status === 429 || status >= 500;

      // Never retry after text was already received: it would duplicate output.
      if (progress.received || !transient || attempt === REQUEST_RETRIES) break;

      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[codeAgent] ${model} request failed (${status ?? error.message}). Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
};

/* -------------------------------------------------------------------------- */
/*                       Generation with auto-continuation                    */
/* -------------------------------------------------------------------------- */

/**
 * Generates a response and keeps continuing while it is cut off,
 * stitching every chunk into one complete answer and streaming it live.
 *
 * Continues when:
 *  - finish_reason is "length", or
 *  - the text ends inside an unclosed code fence (some providers report
 *    "stop" even when truncated; allowed once to avoid loops).
 *
 * If a call fails after text was already produced, the partial text is
 * returned (with `error` set) instead of being thrown away.
 */
const generateComplete = async ({
  model,
  baseMessages,
  firstCallMaxTokens,
  maxContinuations,
  initialText = "",
  emit,
  signal,
}) => {
  let text = initialText;
  let finishReason = initialText ? "length" : null;
  let continuations = 0;
  let fenceContinuationUsed = false;
  let error = null;
  let aborted = false;

  let messages = initialText
    ? buildContinuationMessages(baseMessages, text)
    : baseMessages;
  let maxTokens = initialText ? MAX_OUTPUT_TOKENS : firstCallMaxTokens;

  while (true) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }

    const before = text;
    const assembler = createAssembler(text, emit);

    try {
      const result = await requestCompletion({
        model,
        messages,
        maxTokens,
        signal,
        onDelta: assembler.push,
      });

      assembler.flush();
      finishReason = result.finishReason;
    } catch (err) {
      assembler.flush();
      text = assembler.text;

      if (signal?.aborted) {
        aborted = true;
        break;
      }

      if (!text.trim()) throw err;

      error = err;
      break;
    }

    text = assembler.text;

    console.log(
      `[codeAgent] ${model} | finish: ${finishReason} | added chars: ${text.length - before.length}`,
    );

    const isFirstChunk = before.length === 0;

    if (isFirstChunk && !text.trim()) {
      throw new Error(`Model ${model} returned an empty response.`);
    }

    // Nothing new (e.g. [[DONE]] or pure repetition).
    if (!isFirstChunk && text.length === before.length) break;

    const cutOff = isLengthFinish(finishReason);
    const suspectedCutOff =
      !cutOff && !fenceContinuationUsed && getOpenFence(text) !== null;

    if (!cutOff && !suspectedCutOff) break;

    if (continuations >= maxContinuations) {
      console.warn("[codeAgent] Maximum continuations reached.");
      break;
    }

    if (suspectedCutOff) fenceContinuationUsed = true;

    continuations++;
    console.warn(
      `[codeAgent] Response incomplete. Continuation ${continuations}/${maxContinuations}...`,
    );

    messages = buildContinuationMessages(baseMessages, text);
    maxTokens = MAX_OUTPUT_TOKENS;
  }

  return { model, text, finishReason, continuations, error, aborted };
};

/* -------------------------------------------------------------------------- */
/*                                   Agent                                    */
/* -------------------------------------------------------------------------- */

const finalizeResponse = async (state, result, emit) => {
  // Never store the client callback in the returned state.
  const { onChunk: _onChunk, ...cleanState } = state;

  let text = stripToolCallArtifacts(result.text).trim();

  const openFence = getOpenFence(text);
  const isComplete =
    !result.error &&
    !result.aborted &&
    !isLengthFinish(result.finishReason) &&
    !openFence;

  // Keep Markdown valid even when the answer could not be completed.
  if (openFence) {
    const closing = `\n${openFence.marker}`;
    text += closing;
    emit(closing);
  }

  console.log(
    `[codeAgent] Done | model: ${result.model} | chars: ${text.length} | continuations: ${result.continuations} | complete: ${isComplete}`,
  );

  // Deduct credits only after a usable response was generated.
  await deductCredits({
    userId: cleanState.userId,
    agent: "code",
  });

  return {
    ...cleanState,
    aiResponse: text,
    modelUsed: result.model,
    finishReason: result.finishReason,
    isComplete,
    continuationCount: result.continuations,
  };
};

/**
 * @param {object} state    { userId, conversationId, prompt, ... }
 * @param {object} options
 * @param {(delta: string) => void} [options.onChunk]  Called with each piece
 *        of the final, de-duplicated answer as soon as it is available.
 * @param {AbortSignal} [options.signal]  Abort to stop generation early.
 */
export const codeAgent = async (state, options = {}) => {
  await checkLimit(state.userId, "code");

  const history = await getMemory(state.conversationId);

  const emit = createSafeEmitter(options.onChunk ?? state.onChunk);
  const signal = options.signal;

  const level = classifyRequest(state.prompt);
  const { firstCallMaxTokens, maxContinuations } = LEVEL_SETTINGS[level];

  console.log("-----------------------------------------");
  console.log("Code Agent Request");
  console.log("Prompt:", state.prompt);
  console.log("Request level:", level);
  console.log("First call max tokens:", firstCallMaxTokens);
  console.log("Maximum continuations:", maxContinuations);
  console.log("Streaming:", USE_STREAMING);
  console.log("-----------------------------------------");

  const baseMessages = [
    { role: "system", content: systemPrompt },
    ...buildHistory(history),
    { role: "user", content: String(state.prompt ?? "") },
  ];

  let lastError = null;
  let partial = null; // Best partial result if a model fails mid-answer.

  for (const model of CODE_MODELS) {
    try {
      console.log(`[codeAgent] Trying model: ${model}`);

      const result = await generateComplete({
        model,
        baseMessages,
        firstCallMaxTokens,
        maxContinuations,
        initialText: partial?.text ?? "",
        emit,
        signal,
      });

      const isLastModel = model === CODE_MODELS[CODE_MODELS.length - 1];

      // A later model can pick up where this one failed.
      if (result.error && !isLastModel) {
        console.warn(
          `[codeAgent] ${model} failed mid-response: ${result.error.message}. Falling back...`,
        );
        partial = result;
        lastError = result.error;
        continue;
      }

      return await finalizeResponse(state, result, emit);
    } catch (error) {
      lastError = error;
      console.error(`[codeAgent] Model failed: ${model}`, error.message);
    }
  }

  // Every model failed, but we may still have a partial answer.
  if (partial?.text) {
    return await finalizeResponse(
      state,
      { ...partial, error: lastError },
      emit,
    );
  }

  console.error("[codeAgent] All code models failed:", lastError);

  const { onChunk: _onChunk, ...cleanState } = state;

  return {
    ...cleanState,
    aiResponse:
      lastError?.response?.data?.error?.message ||
      lastError?.message ||
      "Sorry, I couldn't generate a response. Please try again.",
    isComplete: false,
  };
};