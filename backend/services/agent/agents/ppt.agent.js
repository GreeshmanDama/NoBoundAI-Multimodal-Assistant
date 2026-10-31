import freeLLM from "../config/FreeLlm.js";
import generatePpt from "../utils/generatePpt.js";
import { uploadPpt } from "../utils/uploadPpt.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";
import { jsonrepair } from "jsonrepair";

const CONTENT_SLIDE_COUNT = 12;
const MAX_ATTEMPTS = 2;

const ALLOWED_LAYOUTS = new Set([
  "bullets",
  "cards",
  "chart",
  "table",
  "process",
  "comparison",
  "quote",
  "section",
]);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isStringArray = (value, min = 1, max = Infinity) =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every((item) => typeof item === "string");

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// --------------------------------------------------
// Presentation validation
// --------------------------------------------------

const validatePresentation = (content) => {
  if (
    !isObject(content) ||
    !isNonEmptyString(content.title) ||
    !isNonEmptyString(content.subtitle) ||
    !Array.isArray(content.slides) ||
    content.slides.length !== CONTENT_SLIDE_COUNT
  ) {
    throw new Error(
      `Invalid presentation structure. Expected a title, subtitle, and ${CONTENT_SLIDE_COUNT} content slides. Received ${
        Array.isArray(content?.slides)
          ? content.slides.length
          : "an invalid slides array"
      }.`,
    );
  }

  for (const [index, slide] of content.slides.entries()) {
    const slideNumber = index + 1;

    if (
      !isObject(slide) ||
      !isNonEmptyString(slide.title) ||
      !ALLOWED_LAYOUTS.has(slide.layout)
    ) {
      throw new Error(`Slide ${slideNumber} has an invalid title or layout.`);
    }

    switch (slide.layout) {
      case "bullets": {
        if (
          !isStringArray(slide.points, 3, 5) ||
          !slide.points.every(isNonEmptyString)
        ) {
          throw new Error(
            `Slide ${slideNumber}: bullets layout requires 3–5 non-empty string points.`,
          );
        }
        break;
      }

      case "cards": {
        if (
          !Array.isArray(slide.cards) ||
          slide.cards.length < 2 ||
          slide.cards.length > 4 ||
          !slide.cards.every(
            (card) =>
              isObject(card) &&
              isNonEmptyString(card.heading) &&
              isNonEmptyString(card.value) &&
              isNonEmptyString(card.description) &&
              (card.status === undefined || typeof card.status === "string"),
          )
        ) {
          throw new Error(`Slide ${slideNumber}: invalid cards data.`);
        }
        break;
      }

      case "chart": {
        const chart = slide.chart;

        if (
          !isObject(chart) ||
          !["bar", "line", "pie", "doughnut", "area"].includes(chart.type) ||
          !isStringArray(chart.categories, 2) ||
          !chart.categories.every(isNonEmptyString) ||
          !Array.isArray(chart.series) ||
          chart.series.length === 0 ||
          !chart.series.every(
            (series) =>
              isObject(series) &&
              isNonEmptyString(series.name) &&
              Array.isArray(series.values) &&
              series.values.length === chart.categories.length &&
              series.values.every(
                (value) => typeof value === "number" && Number.isFinite(value),
              ),
          ) ||
          (["pie", "doughnut"].includes(chart.type) &&
            (chart.series.length !== 1 ||
              chart.series[0].values.some((value) => value < 0)))
        ) {
          throw new Error(`Slide ${slideNumber}: invalid chart data.`);
        }
        break;
      }

      case "table": {
        const table = slide.table;

        if (
          !isObject(table) ||
          !isStringArray(table.headers, 1, 6) ||
          !table.headers.every(isNonEmptyString) ||
          !Array.isArray(table.rows) ||
          table.rows.length < 1 ||
          table.rows.length > 10 ||
          !table.rows.every(
            (row) =>
              Array.isArray(row) &&
              row.length === table.headers.length &&
              row.every(
                (cell) =>
                  (typeof cell === "string" && cell.trim().length > 0) ||
                  (typeof cell === "number" && Number.isFinite(cell)),
              ),
          )
        ) {
          throw new Error(`Slide ${slideNumber}: invalid table data.`);
        }
        break;
      }

      case "process": {
        if (
          !Array.isArray(slide.steps) ||
          slide.steps.length < 3 ||
          slide.steps.length > 6 ||
          !slide.steps.every(
            (step) =>
              isObject(step) &&
              isNonEmptyString(step.title) &&
              isNonEmptyString(step.description),
          )
        ) {
          throw new Error(`Slide ${slideNumber}: invalid process steps.`);
        }
        break;
      }

      case "comparison": {
        const isValidSide = (side) =>
          isObject(side) &&
          isNonEmptyString(side.heading) &&
          isStringArray(side.points, 2, 5) &&
          side.points.every(isNonEmptyString);

        if (!isValidSide(slide.left) || !isValidSide(slide.right)) {
          throw new Error(`Slide ${slideNumber}: invalid comparison data.`);
        }
        break;
      }

      case "quote": {
        if (
          !isNonEmptyString(slide.quote) ||
          (slide.attribution !== undefined &&
            typeof slide.attribution !== "string")
        ) {
          throw new Error(`Slide ${slideNumber}: invalid quote data.`);
        }
        break;
      }

      case "section": {
        if (
          slide.subtitle !== undefined &&
          typeof slide.subtitle !== "string"
        ) {
          throw new Error(`Slide ${slideNumber}: invalid section subtitle.`);
        }
        break;
      }
    }

    if (slide.takeaway !== undefined && typeof slide.takeaway !== "string") {
      throw new Error(`Slide ${slideNumber}: takeaway must be a string.`);
    }
  }

  return content;
};

// --------------------------------------------------
// Extract and parse model JSON
// --------------------------------------------------

const parseModelJson = (rawResponse) => {
  if (typeof rawResponse !== "string" || !rawResponse.trim()) {
    throw new Error("The model returned an empty response.");
  }

  let cleaned = rawResponse
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Remove any explanatory text surrounding the JSON object.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(
      "The model response does not contain a complete JSON object.",
    );
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn(
      "Invalid PPT JSON. Attempting JSON repair:",
      parseError.message,
    );

    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      const position = Number(
        parseError.message.match(/position\s+(\d+)/i)?.[1] ?? 0,
      );

      console.error("PPT JSON repair failed:", repairError.message);
      console.error(
        "Response excerpt:",
        cleaned.slice(Math.max(0, position - 150), position + 150),
      );

      throw new Error(
        "The AI returned invalid JSON. Please retry the presentation.",
      );
    }
  }
};

// --------------------------------------------------
// Extract text from different model response formats
// --------------------------------------------------

const extractResponseText = (response) => {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }

  return "";
};

// --------------------------------------------------
// System prompt
// --------------------------------------------------

const buildSystemPrompt = (topic) => `
You are NoBound AI, an expert PowerPoint designer and information architect.
Create a polished, accurate, informative presentation on the user's topic.

OUTPUT RULES
- Return ONLY one valid JSON object: no Markdown, code fences, comments or text outside it. Use double-quoted keys and strings and no trailing commas.
- Shape: {"title":"","subtitle":"","slides":[]}. Title and subtitle must be non-empty.
- "slides" must hold exactly ${CONTENT_SLIDE_COUNT} content slides, all complete in this one object. The renderer adds the cover and a closing "Thank you" slide (${CONTENT_SLIDE_COUNT + 2} total), so never add title, thank-you or Q&A slides.
- Never invent statistics, sources, quotations or attributions. Label any illustrative numbers "illustrative" in the slide title.
- Do not add fields that are not listed for a layout.

TEXT FORMAT (slides are drawn by code, not Markdown)
- Plain text only. No asterisks, "#", or "- ", "•", "1." prefixes: the renderer draws bullets and step numbers itself. No emoji or decorative symbols.
- Do not wrap a quote in quotation marks; the renderer adds them.
- Every point is a complete, informative phrase or sentence. No filler and no repeated information across slides.
- Respect the length limits below so text fits without shrinking.
- Every slide needs a "layout" and a non-empty "title" (max 55 characters). An optional "takeaway" (one sentence, max 100 characters) is allowed on every layout except section.

LAYOUTS (use exactly these shapes)
- bullets: {"layout":"bullets","title":"","points":[],"takeaway":""}
  5-6 points, each 12-22 words.
- cards: {"layout":"cards","title":"","cards":[{"heading":"","value":"","description":"","status":""}]}
  2-4 cards. Heading max 4 words. Value max 14 characters (a key term, label or verified figure). Description max 16 words. Status is optional, max 4 words.
- chart: {"layout":"chart","title":"","chart":{"type":"bar","categories":[],"series":[{"name":"","values":[]}],"xAxisTitle":"","yAxisTitle":"","showLegend":true},"takeaway":""}
  Types: bar, line, pie, doughnut, area. Use 3-8 categories. Values must be JSON numbers (never "45%"), with exactly one value per category in every series. Pie and doughnut use one series with non-negative values.
- table: {"layout":"table","title":"","table":{"headers":[],"rows":[[]]}}
  2-5 headers and 3-7 rows. Every row must have exactly as many cells as headers. Cells are non-empty, max 10 words.
- process: {"layout":"process","title":"","steps":[{"title":"","description":""}]}
  3-5 ordered steps. Title max 4 words, with no "Step 1" numbering. Description max 15 words.
- comparison: {"layout":"comparison","title":"","left":{"heading":"","points":[]},"right":{"heading":"","points":[]}}
  3-4 balanced points per side, each max 12 words.
- quote: {"layout":"quote","title":"","quote":"","attribution":"","takeaway":""}
  Quote max 30 words. Use only verified quotes with attribution; otherwise write an original statement with no attribution.
- section: {"layout":"section","title":"","subtitle":""}
  Divider; subtitle optional, one line. Use at most one, and only if the deck has distinct parts.

DECK PLAN
- Follow a teaching arc: overview and fundamentals, key concepts, methods or process, comparison or data, practical applications, challenges, and a final conclusion slide with a takeaway.
- Use at least 5 different layouts and no more than 3 bullets slides. Use a chart only when the topic has real or clearly labeled illustrative numbers; otherwise prefer table, process, comparison or cards.
- Before answering, check that there are exactly ${CONTENT_SLIDE_COUNT} slides, every layout is valid, array lengths match, and the JSON is complete.

USER TOPIC:
${topic}
`;
// --------------------------------------------------
// PPT Agent
// --------------------------------------------------

export const pptAgent = async (state) => {
  try {
    // Check the user's PPT usage limit.
    await checkLimit(state.userId, "ppt");

    const topic = state.prompt?.trim();

    if (!topic) {
      throw new Error("Presentation topic is required.");
    }

    const systemPrompt = buildSystemPrompt(topic);

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Create a professional PowerPoint presentation about: ${topic}`,
      },
    ];

    // Important: declare aiResponse before the retry loop.
    let aiResponse = "";
    let pptContent = null;
    let lastError = null;

    // Generate and validate the presentation.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`Generating PPT: attempt ${attempt}/${MAX_ATTEMPTS}`);

        const retryMessages = [...messages];

        // Ask the model to correct the previous invalid response.
        if (attempt > 1) {
          retryMessages.push({
            role: "assistant",
            content: aiResponse,
          });

          retryMessages.push({
            role: "user",
            content: `
Your previous presentation failed validation.

VALIDATION ERROR:
${lastError?.message || "Invalid presentation structure"}

Generate the complete presentation again from scratch.

MANDATORY REQUIREMENTS:
1. Return one valid JSON object.
2. Include non-empty title and subtitle strings.
3. Include exactly 10 content slides.
4. Every slide must have a valid title and supported layout.
5. Follow every layout's required schema from the system prompt.
6. Do not omit, duplicate, or truncate slides.
7. Do not return Markdown or explanatory text.
8. Ensure the JSON can be parsed and validated.

Return the corrected presentation JSON only.
`,
          });
        }

        const response = await freeLLM.chat.completions.create({
          model: "auto",
          messages: retryMessages,
          temperature: 0.2,
          max_tokens: 8000,
        });

        const currentResponse = extractResponseText(response);

        if (!currentResponse) {
          throw new Error("The model returned an empty response.");
        }

        // Keep the last response available for the next attempt.
        aiResponse = currentResponse;

        // Parse JSON and repair syntax errors when possible.
        const parsedContent = parseModelJson(currentResponse);

        // Validate slide count and every layout's data.
        pptContent = validatePresentation(parsedContent);

        console.log(
          `PPT validation succeeded on attempt ${attempt}.`,
          `Content slides: ${pptContent.slides.length}`,
        );

        break;
      } catch (error) {
        lastError = error;
        pptContent = null;

        console.warn(
          `PPT generation attempt ${attempt} failed:`,
          error.message,
        );
      }
    }

    if (!pptContent) {
      throw new Error(
        `Could not generate a valid presentation after ${MAX_ATTEMPTS} attempts. ${
          lastError?.message || ""
        }`,
      );
    }

    // Generate the PowerPoint buffer.
    const pptBuffer = await generatePpt(pptContent);

    if (!pptBuffer || pptBuffer.length === 0) {
      throw new Error("PowerPoint generation returned an empty file.");
    }

    // Create a safe filename.
    const safeTitle = pptContent.title
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100);

    const fileName = `${safeTitle || "Generated-PPT"}-${Date.now()}.pptx`;

    // Upload the presentation.
    const result = await uploadPpt(pptBuffer, fileName);

    if (!result?.url) {
      throw new Error("The presentation was generated, but uploading failed.");
    }

    // Deduct credits only after generation and upload succeed.
    await deductCredits({
      userId: state.userId,
      agent: "ppt",
    });

    const expiresInMinutes = result.expiresInMinutes;

    console.log("PPT generated and uploaded successfully:", fileName);

    return {
      ...state,
      aiResponse:
        `PPT generated successfully.\n\n` +
        `[${pptContent.title}](${result.url})\n\n` +
        `Contains ${CONTENT_SLIDE_COUNT + 2} content slides, ` +
        `plus the cover and closing slides.\n\n` +
        `Link expires in **${expiresInMinutes ?? "limited"} minutes**.`,
      error: null,
    };
  } catch (error) {
    console.error("PPT Agent Error:", error);

    return {
      ...state,
      aiResponse:
        "Sorry, I couldn't generate your presentation. Please try again.",
      error: error?.message || "Presentation generation failed.",
    };
  }
};
