import axios from "axios";

export const deductCredits = async ({ userId, agent }) => {
  try {
    const { data } = await axios.post(
      `${process.env.AUTH_SERVICE}/deduct-credits`,
      { userId, agent }
    );

    return data;
  } catch (error) {
    console.error(
      "Error deducting credits:",
      error.response?.status,
      error.response?.data || error.message
    );

    return null;
  }
};