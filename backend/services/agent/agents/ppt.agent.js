import freeLLM from "../config/FreeLlm.js";
import generatePpt from "../utils/generatePpt.js";
import { uploadPpt } from "../utils/uploadPpt.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";
import { jsonrepair } from "jsonrepair";

const CONTENT_SLIDE_COUNT = 10;

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

const validatePresentation = (content) => {
  if (
    !content ||
    typeof content !== "object" ||
    !isNonEmptyString(content.title) ||
    !isNonEmptyString(content.subtitle) ||
    !Array.isArray(content.slides) ||
    content.slides.length !== CONTENT_SLIDE_COUNT
  ) {
    throw new Error(
      `Invalid presentation structure. Expected a title, subtitle, and ${CONTENT_SLIDE_COUNT} content slides.`,
    );
  }

  for (const [index, slide] of content.slides.entries()) {
    const slideNumber = index + 1;

    if (
      !slide ||
      typeof slide !== "object" ||
      !isNonEmptyString(slide.title) ||
      !ALLOWED_LAYOUTS.has(slide.layout)
    ) {
      throw new Error(`Slide ${slideNumber} has an invalid title or layout.`);
    }

    switch (slide.layout) {
      case "bullets": {
        if (!isStringArray(slide.points, 3, 5)) {
          throw new Error(
            `Slide ${slideNumber}: bullets layout requires 3–5 string points.`,
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
              card &&
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
          !chart ||
          !["bar", "line", "pie", "doughnut", "area"].includes(chart.type) ||
          !isStringArray(chart.categories, 2) ||
          !Array.isArray(chart.series) ||
          chart.series.length === 0 ||
          !chart.series.every(
            (series) =>
              series &&
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
          !table ||
          !isStringArray(table.headers, 1, 6) ||
          !Array.isArray(table.rows) ||
          table.rows.length < 1 ||
          table.rows.length > 10 ||
          !table.rows.every(
            (row) =>
              Array.isArray(row) &&
              row.length === table.headers.length &&
              row.every(
                (cell) => typeof cell === "string" || typeof cell === "number",
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
              step &&
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
          side &&
          isNonEmptyString(side.heading) &&
          isStringArray(side.points, 2, 5);

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

const parseModelJson = (rawResponse) => {
  if (typeof rawResponse !== "string" || !rawResponse.trim()) {
    throw new Error("The model returned an empty response.");
  }

  // Remove optional Markdown fences.
  let cleaned = rawResponse
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Handle any extra text before or after the JSON object.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("The model response does not contain a JSON object.");
  }

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn(
      "PPT response contains invalid JSON. Attempting repair:",
      parseError.message,
    );

    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      // Log a useful excerpt without printing the entire response.
      const errorPosition = Number(
        parseError.message.match(/position\s+(\d+)/i)?.[1] ?? 0,
      );

      console.error("JSON repair failed:", repairError.message);
      console.error(
        "Response excerpt:",
        cleaned.slice(Math.max(0, errorPosition - 200), errorPosition + 200),
      );

      throw new Error(
        "The AI returned invalid presentation JSON. Please try again.",
      );
    }
  }
};

export const pptAgent = async (state) => {
  try {
    await checkLimit(state.userId, "ppt");

    const topic = state.prompt?.trim();

    if (!topic) {
      throw new Error("Presentation topic is required.");
    }

    const systemPrompt = `
You are NoBound AI, an expert PowerPoint presentation designer
and information architect.

Create a polished, professional presentation based on the user's topic.

OUTPUT FORMAT:
Return ONLY one valid JSON object. Do not include Markdown,
code fences, comments, or explanations outside the JSON.

Use this top-level structure:
{
  "title": "Presentation title",
  "subtitle": "Descriptive subtitle",
  "slides": []
}

SLIDE COUNT:
Return exactly ${CONTENT_SLIDE_COUNT} content slides.
The PowerPoint renderer automatically creates a cover slide and
a closing slide, resulting in ${CONTENT_SLIDE_COUNT + 2} slides total.
Do not create additional cover or closing slides in the JSON.

SUPPORTED LAYOUTS:

1. bullets
{
  "layout": "bullets",
  "title": "Slide title",
  "points": ["Point 1", "Point 2", "Point 3"],
  "takeaway": "Optional key insight"
}
Use 3–5 concise points.

2. cards
{
  "layout": "cards",
  "title": "Slide title",
  "cards": [
    {
      "heading": "Metric or concept",
      "value": "Value",
      "description": "Short explanation",
      "status": "Optional status"
    },
    {
      "heading": "Another concept",
      "value": "Value",
      "description": "Short explanation"
    }
  ]
}
Use 2–4 cards for KPIs, benefits, features, or key facts.

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
Supported chart types: bar, line, pie, doughnut, area.
Each values array must contain exactly one numeric value per category.
Use pie and doughnut charts with exactly one series and no negative values.
Only use charts when quantitative data makes sense.

4. table
{
  "layout": "table",
  "title": "Table title",
  "table": {
    "headers": ["Column 1", "Column 2", "Column 3"],
    "rows": [
      ["Value 1", "Value 2", "Value 3"],
      ["Value 4", "Value 5", "Value 6"]
    ]
  }
}
Use 1–6 columns and 1–10 rows.
Every row must have the same number of cells as the headers.
Cell values must be strings or numbers.

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
Use 3–6 steps for workflows, roadmaps, or lifecycle stages.

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
Each side requires 2–5 points.

7. quote
{
  "layout": "quote",
  "title": "Key message",
  "quote": "A memorable statement",
  "attribution": "Optional verified attribution",
  "takeaway": "Optional takeaway"
}
Never invent a quotation or attribution. If no verified quotation is
available, use an original key message without an attribution.

8. section
{
  "layout": "section",
  "title": "Section title",
  "subtitle": "Optional subtitle"
}
Use sparingly for meaningful section dividers.

CONTENT AND DESIGN RULES:
- Select layouts based on the subject and the information being presented.
- Vary the layouts; do not create repetitive bullet-only slides.
- Include useful charts, tables, cards, comparisons, and processes when
  appropriate to the topic.
- Do not fabricate real-world statistics, sources, or quotations.
- If reliable figures are unavailable, use clearly labeled illustrative
  data and say so in the slide title, takeaway, or accompanying text.
- Ensure every chart has meaningful categories, series names, and values.
- Use concise, professional wording.
- Do not add fields that are not defined by the chosen layout.
- Every JSON key and string must use double quotes.
- Do not include trailing commas.
- Ensure the final output is syntactically valid JSON.

User topic:
${topic}
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Create a presentation about: ${topic}`,
      },
    ];

    const response = await freeLLM.chat.completions.create({
      model: "auto",
      messages,
      temperature: 0.3,
      max_tokens: 8000,
    });

    const rawContent = response.choices?.[0]?.message?.content;

    const aiResponse = Array.isArray(rawContent)
      ? rawContent
          .map((part) => (typeof part === "string" ? part : part?.text || ""))
          .join("")
      : rawContent;

    if (!aiResponse) {
      throw new Error("The model returned an empty response.");
    }

    // Parse and repair malformed JSON when possible.
    const parsedContent = parseModelJson(aiResponse);

    // Validate each slide according to its layout.
    const pptContent = validatePresentation(parsedContent);

    console.log(
      `PPT content generated successfully: ${pptContent.slides.length} content slides.`,
    );

    // Generate the PowerPoint using the existing renderer.
    const pptBuffer = await generatePpt(pptContent);

    // Remove characters that are invalid in Windows filenames.
    const safeTitle = pptContent.title
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100);

    const fileName = `${safeTitle || "Generated-PPT"}-${Date.now()}.pptx`;

    const result = await uploadPpt(pptBuffer, fileName);

    if (!result?.url) {
      throw new Error("The presentation was generated but upload failed.");
    }

    // Deduct credits only after successful generation and upload.
    await deductCredits({
      userId: state.userId,
      agent: "ppt",
    });

    const expiresInMinutes = result.expiresInMinutes;

    return {
      ...state,
      aiResponse:
        `PPT generated successfully.\n\n` +
        `[${pptContent.title}](${result.url})\n\n` +
        `Link expires in **${expiresInMinutes ?? "limited"} minutes**.`,
      error: null,
    };
  } catch (error) {
    console.error("PPT Agent Error:", error);

    return {
      ...state,
      aiResponse: "Sorry, I couldn't process your presentation request.",
      error: error?.message || "Presentation generation failed.",
    };
  }
};
