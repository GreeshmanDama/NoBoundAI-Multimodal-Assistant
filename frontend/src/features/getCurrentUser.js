import api from "../../utils/axios";

const getCurrentUser = async () => {
  try {
    const { data } = await api.get("/api/me");
    return data;
  } catch (error) {
    console.error(
      "Failed to restore session:",
      error.response?.status || error.message
    );

    return null;
  }
};

export default getCurrentUser;