import { createSlice } from "@reduxjs/toolkit";

const messageSlice = createSlice({
  name: "message",
  initialState: {
    messages: [],
    inputMessage: "",
    isLoading: false,
  },
  reducers: {
    setMessages: (state, action) => {
      state.messages = action.payload;
    },

    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },

    clearMessages: (state) => {
      state.messages = [];
    },

    setInputMessage: (state, action) => {
      state.inputMessage = action.payload;
    },

    setIsLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setMessages, addMessage, clearMessages, setInputMessage, setIsLoading } =
  messageSlice.actions;
export default messageSlice.reducer;
