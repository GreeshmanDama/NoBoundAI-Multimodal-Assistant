import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import dotenv from "dotenv";
dotenv.config();

const groq = new ChatGroq({
    model: "openai/gpt-oss-120b",
})


const gemini = new ChatGoogleGenerativeAI({
    model: "gemini-3.8-flash",
})

console.log(
  "GROQ KEY:",
  process.env.GROQ_API_KEY
    ? "Loaded"
    : "Missing"
);

console.log(
  "GOOGLE KEY:",
  process.env.GOOGLE_API_KEY
    ? "Loaded"
    : "Missing"
);

export const getModel = async (agent) => {
    switch (agent) {
        case "chat":
            return groq;
        
        case "search":
            return groq;
        
        case "code":
            return gemini;
    
        default:
            return groq;
    }
}