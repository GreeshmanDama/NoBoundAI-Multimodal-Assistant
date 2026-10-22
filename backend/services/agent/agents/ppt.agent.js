import freeLLM from "../config/FreeLlm.js";
import generatePpt from "../utils/generatePpt.js";
import { uploadPpt } from "../utils/uploadPpt.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";
import { jsonrepair } from "jsonrepair";

const CONTENT_SLIDE_COUNT = 10;
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
      }.`
    );
  }

  for (const [index, slide] of content.slides.entries()) {
    const slideNumber = index + 1;

    if (
      !isObject(slide) ||
      !isNonEmptyString(slide.title) ||
      !ALLOWED_LAYOUTS.has(slide.layout)
    ) {
      throw new Error(
        `Slide ${slideNumber} has an invalid title or layout.`
      );
    }

    switch (slide.layout) {
      case "bullets": {
        if (
          !isStringArray(slide.points, 3, 5) ||
          !slide.points.every(isNonEmptyString)
        ) {
          throw new Error(
            `Slide ${slideNumber}: bullets layout requires 3–5 non-empty string points.`
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
              (card.status === undefined ||
                typeof card.status === "string")
          )
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid cards data.`
          );
        }
        break;
      }

      case "chart": {
        const chart = slide.chart;

        if (
          !isObject(chart) ||
          !["bar", "line", "pie", "doughnut", "area"].includes(
            chart.type
          ) ||
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
                (value) =>
                  typeof value === "number" &&
                  Number.isFinite(value)
              )
          ) ||
          (["pie", "doughnut"].includes(chart.type) &&
            (chart.series.length !== 1 ||
              chart.series[0].values.some((value) => value < 0)))
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid chart data.`
          );
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
                  (typeof cell === "string" &&
                    cell.trim().length > 0) ||
                  (typeof cell === "number" &&
                    Number.isFinite(cell))
              )
          )
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid table data.`
          );
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
              isNonEmptyString(step.description)
          )
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid process steps.`
          );
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
          throw new Error(
            `Slide ${slideNumber}: invalid comparison data.`
          );
        }
        break;
      }

      case "quote": {
        if (
          !isNonEmptyString(slide.quote) ||
          (slide.attribution !== undefined &&
            typeof slide.attribution !== "string")
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid quote data.`
          );
        }
        break;
      }

      case "section": {
        if (
          slide.subtitle !== undefined &&
          typeof slide.subtitle !== "string"
        ) {
          throw new Error(
            `Slide ${slideNumber}: invalid section subtitle.`
          );
        }
        break;
      }
    }

    if (
      slide.takeaway !== undefined &&
      typeof slide.takeaway !== "string"
    ) {
      throw new Error(
        `Slide ${slideNumber}: takeaway must be a string.`
      );
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

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error(
      "The model response does not contain a complete JSON object."
    );
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn(
      "Invalid PPT JSON. Attempting JSON repair:",
      parseError.message
    );

    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      const position = Number(
        parseError.message.match(/position\s+(\d+)/i)?.[1] ?? 0
      );

      console.error("PPT JSON repair failed:", repairError.message);
      console.error(
        "Response excerpt:",
        cleaned.slice(
          Math.max(0, position - 150),
          position + 150
        )
      );

      throw new Error(
        "The AI returned invalid JSON. Please retry the presentation."
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
      .map((part) =>
        typeof part === "string" ? part : part?.text || ""
      )
      .join("")
      .trim();
  }

  return "";
};

// --------------------------------------------------
// System prompt
// --------------------------------------------------

const buildSystemPrompt = (topic) => `
You are NoBound AI, an expert PowerPoint presentation designer
and information architect.

Create a polished, professional, informative presentation about
the user's requested topic.

OUTPUT FORMAT:
Return ONLY one valid JSON object.
Do not include Markdown, code fences, comments, or explanations.

REQUIRED TOP-LEVEL STRUCTURE:
{
  "title": "Presentation title",
  "subtitle": "Descriptive subtitle",
  "slides": []
}

SLIDE COUNT:
Return exactly ${CONTENT_SLIDE_COUNT} content slides.
The renderer automatically adds a cover slide and closing slide,
resulting in ${CONTENT_SLIDE_COUNT + 2} slides total.
Do not add separate cover or closing slides to the slides array.

CRITICAL COMPLETENESS RULES:
- Generate exactly 10 content slide objects.
- Include non-empty title and subtitle strings.
- Every content slide must have a non-empty title.
- Every slide must use one of the supported layouts below.
- Complete all 10 slides in the same JSON object.
- Do not truncate or return a partial presentation.
- Use concise, professional, factually accurate content.
- Do not add fields that are not specified for a layout.
- Use valid JSON with double-quoted keys and string values.
- Do not include trailing commas.
- Never fabricate statistics, sources, or quotations.

SUPPORTED LAYOUTS:

1. bullets
{
  "layout": "bullets",
  "title": "Slide title",
  "points": ["Point 1", "Point 2", "Point 3"],
  "takeaway": "Optional key insight"
}
Requirements: 3–5 non-empty string points.

2. cards
{
  "layout": "cards",
  "title": "Slide title",
  "cards": [
    {
      "heading": "Concept",
      "value": "Value",
      "description": "Explanation",
      "status": "Optional status"
    },
    {
      "heading": "Another concept",
      "value": "Value",
      "description": "Explanation"
    }
  ]
}
Requirements: 2–4 cards. Every card requires heading, value,
and description. Status is optional.

3. chart
{
  "layout": "chart",
  "title": "Chart title",
  "chart": {
    "type": "bar",
    "categories": ["Category A", "Category B", "Category C"],
    "series": [
      {
        "name": "Series name",
        "values": [10, 20, 30]
      }
    ],
    "xAxisTitle": "Optional X axis title",
    "yAxisTitle": "Optional Y axis title",
    "showLegend": true
  },
  "takeaway": "Explain the main insight"
}
Supported types: bar, line, pie, doughnut, area.
Categories must contain at least 2 strings.
Each series must have a name and a numeric values array
with exactly one value per category.
Pie and doughnut charts require exactly one series and
non-negative values.
Use charts only when they make sense for the topic.
Clearly label illustrative data. Never present invented
numbers as real-world measurements.

4. table
{
  "layout": "table",
  "title": "Table title",
  "table": {
    "headers": ["Column 1", "Column 2"],
    "rows": [
      ["Value 1", "Value 2"],
      ["Value 3", "Value 4"]
    ]
  }
}
Requirements: 1–6 headers, 1–10 rows.
Each row must contain the same number of cells as headers.
Cells must be non-empty strings or finite numbers.

5. process
{
  "layout": "process",
  "title": "Process title",
  "steps": [
    {
      "title": "Step 1",
      "description": "Step description"
    },
    {
      "title": "Step 2",
      "description": "Step description"
    },
    {
      "title": "Step 3",
      "description": "Step description"
    }
  ]
}
Requirements: 3–6 steps, each with a title and description.

6. comparison
{
  "layout": "comparison",
  "title": "Comparison title",
  "left": {
    "heading": "Option A",
    "points": ["Point 1", "Point 2"]
  },
  "right": {
    "heading": "Option B",
    "points": ["Point 1", "Point 2"]
  }
}
Requirements: Each side needs a heading and 2–5 points.

7. quote
{
  "layout": "quote",
  "title": "Key message",
  "quote": "A memorable statement",
  "attribution": "Optional verified attribution",
  "takeaway": "Optional takeaway"
}
Never invent a quotation or attribution.
If no verified quotation is available, use an original statement
without an attribution.

8. section
{
  "layout": "section",
  "title": "Section title",
  "subtitle": "Optional subtitle"
}
Use sparingly for meaningful section dividers.

CONTENT RULES:
- Vary slide layouts appropriately.
- Prefer educational structure: fundamentals, concepts,
  methods, practical applications, challenges, and conclusions.
- Avoid repeating the same information across slides.
- Use accurate explanations and relevant examples.
- Do not invent sources or statistics.
- Include useful charts, tables, comparisons, and processes
  when appropriate.
- Before responding, verify that all 10 slides are present
  and conform to their respective schemas.

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
        console.log(
          `Generating PPT: attempt ${attempt}/${MAX_ATTEMPTS}`
        );

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
          `Content slides: ${pptContent.slides.length}`
        );

        break;
      } catch (error) {
        lastError = error;
        pptContent = null;

        console.warn(
          `PPT generation attempt ${attempt} failed:`,
          error.message
        );
      }
    }

    if (!pptContent) {
      throw new Error(
        `Could not generate a valid presentation after ${MAX_ATTEMPTS} attempts. ${
          lastError?.message || ""
        }`
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

    const fileName = `${
      safeTitle || "Generated-PPT"
    }-${Date.now()}.pptx`;

    // Upload the presentation.
    const result = await uploadPpt(pptBuffer, fileName);

    if (!result?.url) {
      throw new Error(
        "The presentation was generated, but uploading failed."
      );
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
        `Contains ${pptContent.slides.length} content slides, ` +
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