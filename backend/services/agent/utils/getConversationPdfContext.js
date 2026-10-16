import Conversation from "../models/conversation.model.js";

export const getConversationPdfContext = async (
  conversationId
) => {
  if (!conversationId) return null;

  const conversation = await Conversation.findById(conversationId)
    .select("activePdfCollection")
    .lean();

  if (!conversation?.activePdfCollection) return null;

  return {
    collectionName: conversation?.activePdfCollection,
  };
};