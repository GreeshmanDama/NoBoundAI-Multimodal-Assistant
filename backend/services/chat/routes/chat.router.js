import express from "express";
import { createConversation, saveMessage, getConversations, getMessages, updateConversation, deleteConversation } from "../controllers/chat.controller.js";

const chatRouter = express.Router();

chatRouter.post("/create-conversation", createConversation);
chatRouter.put("/update-conversation", updateConversation);
chatRouter.get("/get-conversations", getConversations);
chatRouter.post("/save-message", saveMessage);
chatRouter.get("/get-messages/:conversationId", getMessages);
chatRouter.delete("/delete-conversation/:id", deleteConversation);

export default chatRouter;
