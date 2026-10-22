import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import MessageLoading from "./loading/MessageLoading";
import Nav from "./Nav";

import getMessages from "../features/getMessages";
import { clearMessages, setMessages } from "../redux/messageSlice";

function ChatArea({ onOpenSidebar }) {
  const { selectedConversation } = useSelector(
    (state) => state.conversation
  );

  const dispatch = useDispatch();

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState("chat");

  useEffect(() => {
    const conversationId = selectedConversation?._id;

    // No conversation selected
    if (!conversationId) {
      dispatch(clearMessages());
      return;
    }

    // New conversation has no messages to load
    if (selectedConversation?.title === "New Chat") {
      dispatch(clearMessages());
      return;
    }

    let isCurrent = true;

    const loadMessages = async () => {
      setIsLoadingMessages(true);

      try {
        dispatch(clearMessages());

        const data = await getMessages(conversationId);

        if (!isCurrent) return;

        dispatch(setMessages(data || []));
      } catch (error) {
        if (!isCurrent) return;

        console.error("Failed to load messages:", error);
        dispatch(setMessages([]));
      } finally {
        if (isCurrent) {
          setIsLoadingMessages(false);
        }
      }
    };

    loadMessages();

    return () => {
      isCurrent = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?._id, dispatch]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Nav onOpenSidebar={onOpenSidebar} />

      {isLoadingMessages ? <MessageLoading /> : <MessageList selectedAgent={selectedAgent} />}

      <ChatInput selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} />
    </div>
  );
}

export default ChatArea;