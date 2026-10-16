import api from "../../utils/axios";

const updateConversation = async (payload) => {
  try {
    const { data } = await api.put(
      "/api/chat/update-conversation",
      payload
    );

    return data;
  } catch (error) {
    console.error(
      "Failed to update conversation:",
      error.response?.data || error.message
    );

    throw error;
  }
};

export default updateConversation;