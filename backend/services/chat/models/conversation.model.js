import mongoose from "mongoose";

const conversationSchema = mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Chat",
    },
    userId: {
      type: String,
    },
    activePdfCollection: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
