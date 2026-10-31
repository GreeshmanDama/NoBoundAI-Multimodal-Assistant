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

    // Append a streamed chunk to the correct assistant message.
    appendMessageChunk: (state, action) => {
      const { id, text } = action.payload;
      const message = state.messages.find((msg) => msg.id === id);

      if (message) {
        message.content = (message.content || "") + text;
      }
    },

    // Replace content when the server sends the final answer.
    updateMessageContent: (state, action) => {
      const { id, content } = action.payload;
      const message = state.messages.find((msg) => msg.id === id);

      if (message) {
        message.content = content;
      }
    },

    finishStreamingMessage: (state, action) => {
      const message = state.messages.find((msg) => msg.id === action.payload);

      if (message) {
        message.isStreaming = false;
      }
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

    updateMessageImages: (state, action) => {
      const { id, images } = action.payload;
      const message = state.messages.find((msg) => msg.id === id);

      if (message) {
        message.images = images;
      }
    },
  },
});

export const {
  setMessages,
  addMessage,
  appendMessageChunk,
  updateMessageContent,
  finishStreamingMessage,
  clearMessages,
  setInputMessage,
  setIsLoading,
  updateMessageImages
} = messageSlice.actions;

export default messageSlice.reducer;
