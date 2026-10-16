import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload;
    },

    clearUser: (state) => {
      state.userData = null;
    },

    updateCredits: (state, action) => {
      if (state.user) {
        state.user.credits = action.payload;
      }
    },
  },
});

export const { setUserData, clearUser, updateCredits } = userSlice.actions;
export default userSlice.reducer;
