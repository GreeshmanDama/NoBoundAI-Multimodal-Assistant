import { StateGraph } from "@langchain/langgraph";
import { agentState } from "./state.js";
import { routerAgent } from "./router.agent.js";
import { chatAgent } from "../agents/chat.agent.js";
import { searchAgent } from "../agents/search.agent.js";
import { pdfAgent } from "../agents/pdf.agent.js";
import { pptAgent } from "../agents/ppt.agent.js";
import { visionAgent } from "../agents/vision.agent.js";
import { codeAgent } from "../agents/code.agent.js";
import { pdfRagAgent } from "../agents/pdfRag.agent.js";
import { imageAnalyzerAgent } from "../agents/imageAnalyzer.agent.js";

const workflow = new StateGraph(agentState)

workflow.addNode("router", routerAgent)
workflow.addNode("chat", chatAgent)
workflow.addNode("search", searchAgent)
workflow.addNode("pdf", pdfAgent)
workflow.addNode("ppt", pptAgent)
workflow.addNode("vision", visionAgent)
workflow.addNode("code", codeAgent)
workflow.addNode("pdfRag", pdfRagAgent)
workflow.addNode("imageAnalyzer", imageAnalyzerAgent)

workflow.addEdge("__start__", "router")
workflow.addConditionalEdges("router", (state) => {
    switch (state.agent) {
        case "chat":
            return "chat"

        case "search":
            return "search"

        case "pdf":
            return "pdf"

        case "ppt":
            return "ppt"

        case "vision":
            return "vision"
        
        case "code":
            return "code"

        case "pdfRag":
            return "pdfRag"

        case "imageAnalyzer":
            return "imageAnalyzer"
    
        default:
            return "chat";
    }
}, {
    chat: "chat",
    search: "search",
    pdf: "pdf",
    ppt: "ppt",
    vision: "vision",
    code: "code",
    pdfRag: "pdfRag",
    imageAnalyzer: "imageAnalyzer",
})

workflow.addEdge("search", "chat")
workflow.addEdge("chat", "__end__")
workflow.addEdge("vision", "__end__")
workflow.addEdge("pdf", "__end__")
workflow.addEdge("ppt", "__end__")
workflow.addEdge("code", "__end__")
workflow.addEdge("pdfRag", "__end__")
workflow.addEdge("imageAnalyzer", "__end__")

export const graph = workflow.compile()