import { TavilySearch } from "@langchain/tavily";

export const searchtool = new TavilySearch({
  maxResults: 5,
  topic: "general",
  includeImages: true,
});