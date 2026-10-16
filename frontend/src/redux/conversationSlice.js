import { createSlice } from "@reduxjs/toolkit";

const conversationSlice = createSlice({
  name: "conversation",

  initialState: {
    conversations: [],
    selectedConversation: null,
  },

  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },

    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
    },

    setSelectedConversation: (state, action) => {
      state.selectedConversation = action.payload;
    },

    // Update an existing conversation everywhere in Redux
    updateConversation: (state, action) => {
      const updatedConversation = action.payload;

      // Update selected conversation
      if (state.selectedConversation?._id === updatedConversation?._id) {
        state.selectedConversation = updatedConversation;
      }

      // Update conversation in sidebar/list
      const index = state.conversations.findIndex(
        (conversation) => conversation._id === updatedConversation?._id,
      );

      if (index !== -1) {
        state.conversations[index] = updatedConversation;
      }
    },

    setCovTitle: (state,action) => {
      const {title, conversationId} = action.payload
      state.conversations = state.conversations.map((conv) => (
        conv._id == conversationId ? (
          {...conv, title}
        ) : conv
      ))

      if(state.selectedConversation?._id == conversationId){
        state.selectedConversation = {...state.selectedConversation,title}
      }
    },

    clearConversations: (state) => {
      state.conversations = [];
      state.selectedConversation = null;
    },
  },
});

export const {
  setConversations,
  addConversation,
  setSelectedConversation,
  updateConversation,
  setCovTitle,
  clearConversations,
} = conversationSlice.actions;

export default conversationSlice.reducer;
