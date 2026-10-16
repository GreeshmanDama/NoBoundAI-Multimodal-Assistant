import axios from "axios";

export const deleteConversation = async (id) => {
  try {
    console.log("called delete conversation")
    const { data } = await axios.delete(
      `/api/chat/delete-conversation/${id}`
    );

    return data;
  } catch (error) {
    console.error(
      "Error deleting conversation:",
      error.response?.data || error.message
    );

    throw error; // Important: propagate the error
  }
};