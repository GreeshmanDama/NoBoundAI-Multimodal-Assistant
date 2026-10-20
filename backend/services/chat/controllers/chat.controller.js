import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

export const createConversation = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log("User ID from header:", userId);
    const conversation = await Conversation.create({
      userId: userId,
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("Error occurred while creating conversation:", error);
    res.status(500).json({
      message: "Internal server error (creating conversation error)",
      error,
    });
  }
};

export const updateConversation = async (req, res) => {
  try {
    const { id, title } = req.body;
    const conversation = await Conversation.findByIdAndUpdate(id, {
      title: title,
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error("Error occurred while updating conversation:", error);
    res.status(500).json({
      message: "Internal server error (updating conversation error)",
      error,
    });
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    const conversations = await Conversation.find({
      userId: userId,
    }).sort({ updatedAt: -1 });

    return res.status(201).json(conversations);
  } catch (error) {
    console.error("Error occurred while getting conversation:", error);
    res.status(500).json({
      message: "Internal server error (getting conversation error)",
      error,
    });
  }
};

export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content, images, attachment } = req.body;

    // Save the message
    const message = await Message.create({
      conversationId,
      role,
      content,
      images: images ?? [],
      ...(attachment && { attachment }),
    });

    // Update the parent conversation's timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { updatedAt: new Date() },
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error("Error occurred while saving message:", error);

    return res.status(500).json({
      message: "Internal server error (save message error)",
      error: error.message,
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    }).sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (error) {
    console.error("Error occurred while getting messages:", error);

    return res.status(500).json({
      message: "Internal server error (get messages error)",
      error: error.message,
    });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    console.log("entered delete conversation");
    const { id } = req.params;
    const userId = req.headers["x-user-id"];

    console.log("Delete conversation request:");
    console.log("Conversation ID:", id);
    console.log("User ID from header:", userId);

    const conversation = await Conversation.findById(id);

    console.log(
      "Conversation found by ID:",
      conversation
        ? {
            _id: conversation._id,
            userId: conversation.userId,
            title: conversation.title,
          }
        : null,
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found by ID",
      });
    }

    if (String(conversation.userId) !== String(userId)) {
      return res.status(403).json({
        message: "You do not own this conversation",
      });
    }

    // // Find the conversation and verify ownership
    // const conversation = await Conversation.findOne({
    //   _id: id,
    //   userId,
    // });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    // Delete all messages belonging to this conversation
    await Message.deleteMany({
      conversationId: id,
    });

    // Delete the conversation
    await Conversation.findByIdAndDelete(id);

    console.log("delete sucessFull");

    return res.status(200).json({
      message: "Conversation deleted successfully",
      conversationId: id,
    });
  } catch (error) {
    console.error("Error occurred while deleting conversation:", error);

    return res.status(500).json({
      message: "Internal server error (delete conversation error)",
      error: error.message,
    });
  }
};
