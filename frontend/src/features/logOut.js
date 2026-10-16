import api from "../../utils/axios";

const logOut = async () => {
  try {
    const res = await api.post("/api/auth/logout");
    return res;
  } catch (error) {
    console.log("error in logout: ", error);
  }
};

export default logOut;
