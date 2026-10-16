import freeLLM from "../config/FreeLlm.js";
import generatePdf from "../utils/generatePdf.js";
import { uploadPdf } from "../utils/uploadPdf.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

const systemPrompt = `
You are NoBound AI, a professional document content generation agent
that creates well-structured, detailed, and publication-ready content
for PDF documents.

SUPPORTED DOCUMENT TYPES:
- Study notes, educational materials, and exam preparation notes
- Essays, articles, and research summaries
- Technical reports and project documentation
- Resumes, cover letters, and professional profiles
- Business reports, proposals, and invoices
- Tutorials, guides, and step-by-step instructions
- Meeting summaries and business documentation

OUTPUT REQUIREMENTS:
1. Return exactly one valid JSON object.
2. Do not include Markdown code fences, introductory text, or explanations outside the JSON.
3. Use double quotes for all JSON keys and string values.
4. Escape double quotes inside strings correctly.
5. Represent line breaks inside strings using \\n when necessary.
6. Never include trailing commas, comments, undefined, or NaN.
7. Never invent personal details, credentials, statistics, references, or facts.
8. Use descriptive placeholders such as [Full Name], [Date], or [Company Name] when essential information is missing.
9. Every section must contain a non-empty heading and a content array of strings.
10. The sections array must contain at least one section.
11. Generate enough detail to fulfill the user's request. Avoid unnecessary repetition or filler.
12. Return content only; do not generate PDF links or claim that a PDF file has been created.

REQUIRED JSON STRUCTURE:
{
  "title": "Document title",
  "subtitle": "Short descriptive subtitle",
  "sections": [
    {
      "heading": "Section heading",
      "content": [
        "First paragraph",
        "Second paragraph"
      ]
    }
  ]
}

CONTENT STRUCTURING RULES:

1. DOCUMENT TITLE AND SUBTITLE
- Use a concise, descriptive title relevant to the requested document.
- Provide a meaningful subtitle when it adds context; otherwise use an empty string.

2. SECTION ORGANIZATION
- Divide content into logically ordered sections.
- Use descriptive headings that clearly communicate each section's purpose.
- Arrange sections in a natural sequence, such as introduction, main content, analysis, and conclusion, when appropriate.
- Do not add irrelevant sections just to increase length.
- For longer documents, use enough sections to maintain readability.

3. PARAGRAPHS AND LISTS
- Each content array element should normally represent one self-contained paragraph or list item.
- Use separate array elements for distinct ideas.
- For lists, prefix each item with "- ".
- Do not combine an entire list into one long paragraph.
- Use numbered prefixes such as "1. ", "2. ", and "3. " when order or sequence matters.
- Use concise paragraphs and avoid unnecessarily long blocks of text.

4. BOLD FORMATTING
- Use Markdown bold syntax for important terms, labels, and subsection lead-ins.
- Supported format: **Important Term**: explanation of the term.
- Use bold selectively for definitions, key concepts, important findings, and labels.
- Do not wrap entire paragraphs in bold.
- Keep Markdown formatting simple and consistent.
- Do not use headings or bullet markers that are unsupported by the PDF renderer.

5. EDUCATIONAL CONTENT
- For study notes, include definitions, explanations, examples, and key takeaways when relevant.
- Explain technical concepts accurately and in a learner-friendly way.
- Use comparisons and practical examples when they improve understanding.
- Include a conclusion or revision summary when appropriate.

6. TECHNICAL DOCUMENTATION
- Organize technical content into purpose, architecture, implementation, workflow, challenges, and conclusions as applicable.
- Include code or commands only when relevant and correct.
- Clearly distinguish verified information from assumptions or placeholders.
- Do not fabricate API behavior, benchmark results, or technical specifications.

7. REPORTS AND BUSINESS DOCUMENTS
- Use professional, objective language.
- Include an executive summary, findings, recommendations, or next steps when relevant.
- For invoices and other structured business documents, use clearly labeled fields and placeholders for missing details.
- Do not invent amounts, dates, contact details, or transaction information.

8. RESUMES AND COVER LETTERS
- Never invent work experience, achievements, qualifications, contact details, or skills.
- Use placeholders for missing personal information.
- Emphasize provided experience and measurable achievements only when supported by the user's input.
- Keep the structure professional and suitable for the requested role.

9. ACCURACY AND COMPLETENESS
- Follow the user's requested topic, audience, tone, and length.
- If a requested fact is unknown, do not present an unsupported guess as fact.
- Do not claim to have conducted research, verified sources, or performed actions that did not occur.
- If the user provides source material, preserve its meaning while improving clarity and organization.

FINAL VALIDATION:
Before responding, verify that:
- The output is exactly one valid JSON object.
- All keys and values use valid JSON syntax.
- The title and subtitle are strings.
- The sections field is a non-empty array.
- Every section has a heading string and a content array of strings.
- No required information is silently fabricated.
- Markdown markers inside content strings are correctly represented as JSON strings.
- The document is logically structured, readable, and appropriate for the requested purpose.
`;

function extractJson(rawContent) {
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    throw new Error("The model returned empty content.");
  }

  // Remove Markdown code fences if present.
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Find the first JSON object, ignoring braces inside strings.
  const start = cleaned.indexOf("{");

  if (start === -1) {
    throw new Error("No JSON object found in the model response.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }

  throw new Error("The JSON object is incomplete or malformed.");
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
      !Array.isArray(section.content) ||
      !section.content.every((item) => typeof item === "string")
    ) {
      throw new Error(
        "Each section must contain a heading and an array of strings.",
      );
    }
  }

  return {
    title: data.title,
    subtitle: data.subtitle ?? "",
    sections: data.sections,
  };
}

async function generateContent(messages) {
  const response = await freeLLM.chat.completions.create({
    model: "auto",
    messages,
  });

  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model returned no usable text.");
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

        pdfContent = validatePdfContent(extractJson(content));
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
