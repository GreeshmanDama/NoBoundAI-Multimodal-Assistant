import freeLLM from "../config/FreeLlm.js";
import generatePpt from "../utils/generatePpt.js";
import { uploadPpt } from "../utils/uploadPpt.js";
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

export const pptAgent = async (state) => {
  try {
    await checkLimit(state.userId, "ppt");

    const topic = state.prompt?.trim();

    if (!topic) {
      throw new Error("Presentation topic is required.");
    }

    const systemPrompt = `
You are NoBound AI, a professional presentation designer.

Your task is to generate presentation content based on the user's topic.

Return ONLY valid JSON. Do not include Markdown, explanations, or code fences.

Use exactly this JSON structure:

{
  "title": "Presentation title",
  "subtitle": "Short descriptive subtitle",
  "slides": [
    {
      "title": "Slide title",
      "points": [
        "First concise bullet point",
        "Second concise bullet point",
        "Third concise bullet point",
        "Fourth concise bullet point"
      ]
    }
  ]
}

Rules:
- Generate exactly 6 content slides.
- Every slide must contain a title.
- Each slide must contain 4 to 5 concise bullet points.
- Keep the content informative, relevant, and well-organized.
- Use accurate information and avoid unsupported claims.
- Organize slides in a logical sequence.
- Do not add a separate title slide; the title and subtitle belong in the root JSON fields.
- Do not include Markdown formatting.
- Escape special characters correctly to produce valid JSON.
- Return a JSON object only.

Presentation topic: ${topic}
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

    console.log("LLM MESSAGES:", messages);

    const response = await freeLLM.chat.completions.create({
      model: "auto",
      messages,
    });

    const rawContent = response.choices?.[0]?.message?.content;

    const aiResponse = Array.isArray(rawContent)
      ? rawContent
          .map((part) => (typeof part === "string" ? part : part.text || ""))
          .join("")
      : rawContent;

    if (!aiResponse) {
      throw new Error("The model returned an empty response.");
    }

    // Remove optional Markdown code fences if the model adds them.
    const cleanedResponse = aiResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    // Validate the JSON before returning it.
    const pptContent = JSON.parse(cleanedResponse);

    if (
      !pptContent.title ||
      !pptContent.subtitle ||
      !Array.isArray(pptContent.slides) ||
      pptContent.slides.length !== 6
    ) {
      throw new Error("The model returned an invalid presentation structure.");
    }

    for (const slide of pptContent.slides) {
      if (
        !slide.title ||
        !Array.isArray(slide.points) ||
        slide.points.length < 4 ||
        slide.points.length > 5
      ) {
        throw new Error("A slide has an invalid title or bullet-point count.");
      }
    }

    console.log("PPT content generated successfully.");

    const pptBuffer = await generatePpt(pptContent);

    // Use the presentation title and the correct extension.
    const fileName = `${pptContent.title || "Generated-PPT"}-${Date.now()}.pptx`;

    const result = await uploadPpt(pptBuffer, fileName);

    const downloadUrl = result.url;
    const expiresInMinutes = result.expiresInMinutes;

    await deductCredits({
      userId: state.userId,
      agent: "ppt",
    });

    return {
      ...state,
      aiResponse: `PPT generated successfully.\n\n[${pptContent?.title || "Generated PPT"}](${downloadUrl})\n\nLink Expires in **${expiresInMinutes} mins**`,
      error: null,
    };
  } catch (error) {
    console.error("PPT Agent Error:", error);

    return {
      ...state,
      aiResponse:
        error?.data?.message ||
        "Sorry, I couldn't process your presentation request.",
    };
  }
};
