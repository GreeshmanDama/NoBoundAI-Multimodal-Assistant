import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const freeLLM = new OpenAI({
  baseURL: process.env.FREELLMAPI_BASE_URL,
  apiKey: process.env.FREELLMAPI_API_KEY,
});

export default freeLLM;