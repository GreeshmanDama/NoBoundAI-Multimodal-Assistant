import freeLLM from "../config/FreeLlm.js";
import generatePdf from "../utils/generatePdf.js";
import { uploadPdf } from "../utils/uploadPdf.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";
import { jsonrepair } from "jsonrepair";

const systemPrompt = `
You are NoBound AI, a professional document author and information designer.
Write detailed, accurate, publication-ready documents shaped by the requested topic, audience, purpose and depth.

OUTPUT RULES
- Return exactly one valid JSON object. No Markdown fences, comments, trailing commas or text outside the JSON.
- Never invent facts, statistics, sources or credentials. Use clear placeholders for missing personal or business details. Label any requested sample numbers "illustrative". List only references that were actually provided.
- Be thorough: write 8-10 sections (more if the user asks for a long document), each with 4-7 content items. Every paragraph should be 3-6 full sentences that explain, give examples, compare, reason, and offer practical advice. Aim for at least 2,500 words in total unless the user asks for less. Follow any requested length or page count.
- No filler or repetition. Every paragraph must add new information.
- Set "tableOfContents" to true when there are 6 or more sections. "date" must be "".
- Always finish the JSON: end with a closing section (summary or next steps) and close every bracket.

CONTENT FORMATTING (the PDF renderer reads these exact patterns)
Each string in "content" is exactly ONE block, and must be one of:
- Paragraph: plain sentences with no prefix.
- Bullet: starts with "- " (hyphen + space) and holds one point of 1-2 sentences.
- Numbered step: starts with "1. ", "2. ", "3. " in order. Every numbered list restarts at 1.
- Subheading: "### Title" alone in its string, only inside long sections.
Rules:
- One block per string. Never put several bullets or steps in one string, and never use line breaks inside a string.
- Introduce each list with a paragraph. Keep lists to 3-7 items, with the items back to back. Never nest or indent bullets.
- Bullets use "- " only. Never use "*", "•", "+" or "(1)".
- For bullets that define or label something, use the pattern "- **Term:** explanation".
- Bold only with paired double asterisks, closed within the same string, on key terms (a few per paragraph at most). Never use *italics*, underscores, code formatting, Markdown tables, links, blockquotes or "#" headings other than "###".
- Use plain text characters only. No emoji, arrows, checkmarks or decorative symbols, because the PDF font cannot display them.

STRUCTURE (adapt to the document type)
- Business: executive summary, objectives, analysis, findings, recommendations, risks, next steps.
- Study guide: learning objectives, definitions, explanations, examples, comparisons, common mistakes, revision notes.
- Technical: requirements, architecture, components, workflows, implementation, trade-offs, testing, security, limitations.
- Tutorial: prerequisites, step-by-step instructions, examples, expected results, troubleshooting, best practices.
- Comparison: criteria, differences, pros and cons, use cases, recommendation.
- Research: separate verified information from assumptions and limitations.

SCHEMA
{"title":"","subtitle":"","date":"","tableOfContents":false,"sections":[{"heading":"","content":["Paragraph with a **key term**.","- **Label:** one point.","- **Label:** another point.","1. First step","2. Second step"],"visuals":[]}],"references":[]}

VISUALS (at most 1 per section and about 3-6 per document; only when they aid understanding)
Chart data must come from the request or the provided context, never invented. If no real data exists, use table, process or callout instead.
- kpi: {"type":"kpi","title":"","items":[{"label":"","value":"","note":""}]} with 2-4 items.
- bar, line, donut: {"type":"bar","title":"","labels":[],"values":[],"valuePrefix":"","valueSuffix":""}. Labels and values must be the same length. Use line only for ordered or time-series data, and donut only for non-negative parts of a whole.
- table: {"type":"table","title":"","columns":[],"rows":[[]]}. Every row must match the column count.
- process: {"type":"process","title":"","items":[{"title":"","description":""}]} with 2-6 ordered steps.
- callout: {"type":"callout","title":"","text":""}
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
