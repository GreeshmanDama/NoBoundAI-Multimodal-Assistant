import api from "../../utils/axios";

export const createOrder = async (plan) => {
  const { data } = await api.post("/api/billing/create", { plan });
  return data;
};