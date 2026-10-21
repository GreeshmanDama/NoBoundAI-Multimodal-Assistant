import freeLLM from "../config/FreeLlm.js";
import generatePdf from "../utils/generatePdf.js";
import { uploadPdf } from "../utils/uploadPdf.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";
import { jsonrepair } from "jsonrepair";

const systemPrompt = `
You are NoBound AI, a professional document author and information designer.

Create detailed, accurate, well-structured, publication-ready documents.
Use the requested topic, audience, purpose, and level of detail to determine
the document structure and which visual elements will genuinely help.

SUPPORTED DOCUMENT TYPES
- Study notes, tutorials, educational guides, exam preparation
- Technical reports, software documentation, architecture guides
- Business reports, proposals, plans, market analysis
- Research summaries, essays, professional documents
- Meeting summaries, comparison guides, project reports

OUTPUT RULES
1. Return exactly one valid JSON object. No Markdown fences or commentary.
2. Never fabricate facts, statistics, sources, credentials, or references.
3. Use placeholders when essential personal or business details are missing.
4. Generate substantive explanations, examples, comparisons, and practical
   recommendations where appropriate. Avoid repetition and filler.
5. Every section must have a non-empty heading and a content array of strings.
6. Use **bold** selectively for important terms.
7. Prefix bullet items with "- " and ordered steps with "1. ", "2. ", etc.
8. Add visuals only when they improve understanding.
9. Charts must use data supplied in the request or otherwise reliably available
   in the provided context. Never invent data to make a chart look impressive.
10. If illustrative values are explicitly requested, label them as illustrative.
11. Do not create fake references. Only include sources actually provided or
    available in the supplied context.
12. Usually use 1–4 relevant visual elements for a substantial report, not
    every available visual type.
13. Keep tables concise and readable.

REQUIRED JSON STRUCTURE
{
  "title": "Descriptive document title",
  "subtitle": "Short descriptive subtitle",
  "date": "",
  "tableOfContents": false,
  "sections": [
    {
      "heading": "Section heading",
      "content": [
        "Detailed explanatory paragraph.",
        "- Important point",
        "1. First step"
      ],
      "visuals": []
    }
  ],
  "references": []
}

SUPPORTED VISUAL TYPES

A. KPI CARDS
{
  "type": "kpi",
  "title": "Key metrics",
  "items": [
    {
      "label": "Metric name",
      "value": "Metric value",
      "note": "Optional context"
    }
  ]
}
Use 2–4 items. Values must be grounded in the available information.

B. BAR CHART
{
  "type": "bar",
  "title": "Category comparison",
  "labels": ["Category A", "Category B", "Category C"],
  "values": [12, 18, 24],
  "valuePrefix": "",
  "valueSuffix": "%"
}
Use matching labels and numeric values. Suitable for category comparisons.

C. LINE CHART
{
  "type": "line",
  "title": "Trend over time",
  "labels": ["January", "February", "March"],
  "values": [12, 16, 20],
  "valuePrefix": "",
  "valueSuffix": ""
}
Use only when ordered or time-series data is available.

D. DONUT CHART
{
  "type": "donut",
  "title": "Distribution",
  "labels": ["Category A", "Category B"],
  "values": [60, 40]
}
Use for meaningful parts of a whole. Values must be non-negative.

E. COMPARISON TABLE
{
  "type": "table",
  "title": "Feature comparison",
  "columns": ["Feature", "Option A", "Option B"],
  "rows": [
    ["Cost", "Low", "Medium"],
    ["Complexity", "Low", "High"]
  ]
}
Keep every row consistent with the column count.

F. PROCESS DIAGRAM
{
  "type": "process",
  "title": "Workflow",
  "items": [
    {
      "title": "Input",
      "description": "Collect required information"
    },
    {
      "title": "Processing",
      "description": "Transform and validate information"
    },
    {
      "title": "Output",
      "description": "Deliver the final result"
    }
  ]
}
Use 2–6 steps in the correct order.

G. CALLOUT
{
  "type": "callout",
  "title": "Key takeaway",
  "text": "A concise and useful insight."
}

CONTENT GUIDANCE

For business reports:
Include an executive summary, objectives, analysis, findings,
recommendations, risks, and next steps where relevant.

For study guides:
Include learning objectives, definitions, detailed explanations,
examples, comparisons, common mistakes, and revision notes.

For technical reports:
Cover requirements, architecture, components, workflows,
implementation, trade-offs, testing, security, and limitations.

For comparisons:
Explain evaluation criteria, differences, advantages, disadvantages,
use cases, and recommendations. Use a table when useful.

For tutorials:
Explain prerequisites, step-by-step implementation, examples,
expected results, troubleshooting, and best practices.

For research and data reports:
Clearly distinguish verified information, assumptions, and limitations.
Use appropriate charts only when supported by actual data.

GENERATION EFFICIENCY
1. Use 5-7 sections. Keep every section to 3-5 content items, each at most 3 sentences.
2. Use at most 1 visual per section, and only when the data supports it.
3. Skip the table of contents unless there are 6 or more sections.
4. Keep the JSON compact with no extra whitespace or commentary.
5. Always finish the JSON. If space is limited, write fewer and shorter
   sections, but always include a closing section and close all brackets.
6. The "date" field must be an empty string.

FINAL VALIDATION
Return one valid JSON object matching the schema.
Include at least one section with a non-empty heading and content array.
Every visual must use a supported type and valid structure.
Do not include comments or trailing commas.
`;

function extractJson(rawContent) {
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    throw new Error("The model returned empty content.");
  }

  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const start = cleaned.indexOf("{");

  if (start === -1) {
    throw new Error("No JSON object found in the model response.");
  }

  const stack = [];
  let inString = false;
  let escaped = false;
  let lastCompleteSection = -1; // index just after the last finished section

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      stack.push(char);
    } else if (char === "}" || char === "]") {
      stack.pop();

      // Complete JSON object.
      if (stack.length === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }

      // A full section object just closed: root { -> sections [ -> section {
      if (char === "}" && stack.length === 2) {
        lastCompleteSection = i + 1;
      }
    }
  }

  // Truncated output: keep every complete section and close the JSON.
  if (lastCompleteSection > -1) {
    const partialRepaired = cleaned.slice(start, lastCompleteSection) + "]}";

    try {
      const repaired = jsonrepair(partialRepaired);
      const parsed = JSON.parse(repaired);

      console.warn(
        `Recovered truncated JSON with ${parsed.sections?.length ?? 0} complete sections.`,
      );
      return parsed;
    } catch (error) {
      // fall through to the error below
      console.log("error in extract json: ", error);
    }
  }

  throw new Error("The JSON object is incomplete or malformed.");
}

const ALLOWED_VISUAL_TYPES = new Set([
  "kpi",
  "bar",
  "line",
  "donut",
  "pie",
  "table",
  "callout",
  "process",
  "timeline",
]);

const VISUAL_TYPE_ALIASES = {
  bar_chart: "bar",
  line_chart: "line",
  donut_chart: "donut",
  pie_chart: "pie",
  kpi_cards: "kpi",
  comparison_table: "table",
  process_diagram: "process",
  workflow: "process",
  timeline_diagram: "timeline",
  key_takeaway: "callout",
};

function normalizeVisualTypes(data) {
  if (!Array.isArray(data.sections)) return data;

  for (const section of data.sections) {
    if (!Array.isArray(section.visuals)) {
      section.visuals = [];
      continue;
    }

    section.visuals = section.visuals.flatMap((visual) => {
      if (!visual || typeof visual !== "object") {
        return [];
      }

      const rawType =
        typeof visual.type === "string" ? visual.type.trim().toLowerCase() : "";

      const normalizedType = rawType.replace(/[\s-]+/g, "_");
      const type = VISUAL_TYPE_ALIASES[normalizedType] ?? normalizedType;

      if (!ALLOWED_VISUAL_TYPES.has(type)) {
        console.warn(
          `Skipping unsupported PDF visual: ${rawType || "missing type"}`,
        );
        return [];
      }

      return [{ ...visual, type }];
    });
  }

  return data;
}

function validatePdfContent(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The response must be a JSON object.");
  }

  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error("Missing document title.");
  }

  if (data.subtitle !== undefined && typeof data.subtitle !== "string") {
    throw new Error("Subtitle must be a string.");
  }

  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    throw new Error("The document must contain at least one section.");
  }

  for (const section of data.sections) {
    if (
      !section ||
      typeof section.heading !== "string" ||
      !section.heading.trim() ||
      !Array.isArray(section.content) ||
      section.content.length === 0 ||
      !section.content.every((item) => typeof item === "string")
    ) {
      throw new Error("A section has an invalid heading or content.");
    }
  }

  if (
    data.references !== undefined &&
    (!Array.isArray(data.references) ||
      !data.references.every((item) => typeof item === "string"))
  ) {
    throw new Error("References must be an array of strings.");
  }

  // IMPORTANT: actually invoke normalization.
  normalizeVisualTypes(data);

  return {
    title: data.title.trim(),
    subtitle: data.subtitle ?? "",
    date: data.date ?? "",
    tableOfContents: data.tableOfContents ?? false,
    sections: data.sections,
    references: data.references ?? [],
  };
}

async function generateContent(messages) {
  const response = await freeLLM.chat.completions.create({
    model: "auto",
    messages,
    temperature: 0.3,
    max_tokens: 8000,
  });

  const choice = response.choices?.[0];
  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model returned no usable text.");
  }

  if (choice?.finish_reason === "length") {
    console.warn("PDF model output hit its token limit; will try to recover.");
  }

  return content;
}

export const pdfAgent = async (state) => {
  try {
    await checkLimit(state.userId, "pdf");

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: state.prompt,
      },
    ];

    let pdfContent;
    let lastError;

    // Try generation at most twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await generateContent(messages);

        if (attempt === 0) {
          // Log only while debugging.
          console.log("PDF model response:", content);
        }

        const parsedContent = extractJson(content);
        const normalizedContent = normalizeVisualTypes(parsedContent);

        pdfContent = validatePdfContent(normalizedContent);
        break;
      } catch (error) {
        lastError = error;

        console.error(
          `PDF generation attempt ${attempt + 1} failed:`,
          error.message,
        );

        if (attempt === 0) {
          messages.push({
            role: "user",
            content: `
Your previous response could not be parsed or did not match
the required JSON structure.

Error: ${error.message}

Regenerate the complete document for this original request:
${state.prompt}

Return ONLY one complete, valid JSON object matching the
required schema. Do not return the previous malformed JSON,
Markdown fences, or explanations.
`,
          });
        }
      }
    }

    if (!pdfContent) {
      return {
        ...state,
        pdfContent: null,
        aiResponse: "I couldn't generate a valid PDF structure.",
        error: lastError?.message ?? "PDF generation failed.",
      };
    }

    const pdfBuffer = await generatePdf(pdfContent);
    const fileName = `${pdfContent?.title}-${Date.now()}.pdf`;
    const result = await uploadPdf(pdfBuffer, fileName);

    const downloadUrl = result.url;
    const expiresInMinutes = result.expiresInMinutes;

    await deductCredits({
      userId: state.userId,
      agent: "pdf",
    });

    return {
      ...state,
      aiResponse: `PDF generated successfully.\n\n[${pdfContent?.title || "Generated PDF"}](${downloadUrl})\n\nLink Expires in **${expiresInMinutes} mins**`,
      pdfTitle: pdfContent?.title,
      pdfUrl: result?.url,
      error: null,
    };
  } catch (error) {
    console.error("PDF Agent Error:", error);

    return {
      ...state,
      aiResponse: error?.data?.message || "Sorry, I couldn't generate the PDF.",
    };
  }
};
