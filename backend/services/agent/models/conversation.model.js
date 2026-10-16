import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    activePdfCollection: {
      type: String,
      default: null,
    },
  },
  {
    strict: false,
    versionKey: false,
  }
);

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model(
    "Conversation",
    conversationSchema,
    "conversations"
  );

export default Conversation;