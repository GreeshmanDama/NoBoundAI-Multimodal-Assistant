import {
  Code2,
  FileText,
  Globe,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Mic,
  Paperclip,
  Presentation,
  Send,
  X,
  // Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import sendMessage from "../features/sendMessage";
import { createConversation } from "../features/createConversation";
import updateConversation from "../features/updateConversation";
import {
  addMessage,
  setInputMessage,
  setIsLoading,
} from "../redux/messageSlice";
import {
  addConversation,
  setCovTitle,
  setSelectedConversation,
} from "../redux/conversationSlice";

function ChatInput({ selectedAgent, setSelectedAgent }) {
  const [value, setValue] = useState("");
  const [waitResponse, setWaitResponse] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const dispatch = useDispatch();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );
  const { inputMessage } = useSelector((state) => state.message);

  const agents = [
    // { id: "auto", icon: Zap, label: "Auto" },
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "code", icon: Code2, label: "Code" },
    { id: "pdf", icon: FileText, label: "PDF" },
    { id: "ppt", icon: Presentation, label: "PPT" },
    { id: "search", icon: Globe, label: "Search" },
    { id: "vision", icon: ImageIcon, label: "Image" },
  ];

  const canSend =
    (value.trim().length > 0 || Boolean(selectedFile)) && !waitResponse;

  // Keep the local input in sync with suggestions and other Redux updates.
  useEffect(() => {
    const setVal = () => {
      setValue(inputMessage ?? "");
    };
    setVal();
  }, [inputMessage]);

  // Automatically resize the textarea, up to 240px.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxHeight = 240;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  const createConv = async () => {
    try {
      const existingChat = conversations?.find(
        (conversation) => conversation.title === "New Chat",
      );

      if (existingChat) {
        dispatch(setSelectedConversation(existingChat));
        return existingChat;
      }

      const data = await createConversation();
      if (!data?._id) {
        throw new Error("Conversation creation failed.");
      }

      dispatch(addConversation(data));
      dispatch(setSelectedConversation(data));
      return data;
    } catch (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
  };

  const handleSendMessage = async () => {
    const prompt = value.trim();
    if ((!prompt && !selectedFile) || waitResponse) return;

    setWaitResponse(true);

    try {
      let conversation = selectedConversation;

      if (!conversation?._id) {
        conversation = await createConv();
        if (!conversation?._id) {
          throw new Error("Could not create conversation.");
        }
      }

      const conversationId = conversation._id;
      const isFirstMessage = conversation.title === "New Chat";

      // Clear the composer immediately and add the user's message optimistically.
      const attachment = selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type === "application/pdf" ? "pdf" : "image",
            size: selectedFile.size,
          }
        : undefined;

      // Clear the composer immediately.
      setValue("");
      dispatch(setInputMessage(""));
      dispatch(setIsLoading(true));

      removeSelectedFile();

      // Add the user message with attachment metadata.
      dispatch(
        addMessage({
          role: "user",
          content: prompt,
          attachment,
        }),
      );

      if (isFirstMessage && prompt) {
        const title = prompt.slice(0, 40);
        const updatedConversation = await updateConversation({
          id: conversationId,
          title,
        });

        if (!updatedConversation?._id) {
          throw new Error("Conversation title update failed.");
        }

        dispatch(setCovTitle({ conversationId, title }));
        conversation = { ...conversation, ...updatedConversation, title };
      }

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("conversationId", conversationId);
      formData.append("agent", selectedAgent.toLowerCase());

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const data = await sendMessage(formData);

      dispatch(
        addMessage({
          role: "assistant",
          content: data?.answer ?? "No response received.",
          images: data?.images ?? [],
        }),
      );

      dispatch(setIsLoading(false));

      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
      dispatch(
        addMessage({
          role: "assistant",
          content:
            error?.response?.data?.message ||
            error?.message ||
            "Sorry, something went wrong while sending your message.",
        }),
      );
    } finally {
      setWaitResponse(false);
    }
  };

  // Enter sends; Shift + Enter creates a new line.
  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing
    ) {
      event.preventDefault();
      if (!waitResponse) handleSendMessage();
    }
  };

  // Paste code/text while preserving relative indentation.
  const handlePaste = (event) => {
    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string") return;

    event.preventDefault();

    const normalizedText = pastedText
      .replace(/\r\n?/g, "\n")
      .replace(/^\n+|\n+$/g, "");

    const lines = normalizedText.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const minIndent = nonEmptyLines.length
      ? Math.min(
          ...nonEmptyLines.map((line) => line.match(/^[ \t]*/)[0].length),
        )
      : 0;

    const cleanedText = lines
      .map((line) => (line.trim() ? line.slice(minIndent) : ""))
      .join("\n");

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + cleanedText + value.slice(end);

    setValue(newValue);
    dispatch(setInputMessage(newValue));

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const cursorPosition = start + cleanedText.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="w-full bg-black px-3 pb-4 pt-3 sm:px-5">
      <div className="mx-auto w-full">
        {/* Agent selector */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/6 bg-white/2.5 p-1 scrollbar-none">
            {agents.map((agent) => {
              const Icon = agent.icon;
              const isSelected = selectedAgent === agent.id;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgent(agent.id)}
                  disabled={waitResponse}
                  title={`${agent.label} agent`}
                  aria-pressed={isSelected}
                  className={`group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <Icon size={14} strokeWidth={isSelected ? 2.2 : 1.7} />
                  <span>{agent.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-2 flex max-w-50 items-center gap-2 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs text-neutral-300">
            <Paperclip size={14} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
            <span className="shrink-0 text-neutral-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </span>
            <button
              type="button"
              onClick={removeSelectedFile}
              disabled={waitResponse}
              title="Remove file"
              aria-label="Remove selected file"
              className="rounded-md p-1 text-neutral-500 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main input container */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_12px_45px_rgba(0,0,0,0.28)] transition-all duration-200 hover:border-white/15 focus-within:border-white/24 focus-within:shadow-[0_12px_45px_rgba(0,0,0,0.4)]">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              const newValue = event.target.value;
              setValue(newValue);
              dispatch(setInputMessage(newValue));
            }}
            onPaste={handlePaste}
            rows={1}
            disabled={waitResponse}
            onKeyDown={handleKeyDown}
            placeholder="Message NoBound AI..."
            aria-label="Message NoBound AI"
            className="block w-full resize-none bg-transparent px-4 pb-3 pt-4 text-sm leading-6 text-white outline-none placeholder:text-neutral-600 scrollbar-none sm:px-5"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between gap-3 px-3 pb-3 sm:px-4">
            <div className="flex min-w-0 items-center">
              <input
                type="file"
                accept=".pdf,image/*"
                hidden
                ref={fileRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                title="Attach PDF or image"
                aria-label="Attach PDF or image"
                disabled={waitResponse}
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Paperclip size={17} strokeWidth={1.7} />
              </button>

              {/* Voice input button is a visual placeholder; speech recognition is not wired up. */}
              <button
                type="button"
                title="Voice input (not configured)"
                aria-label="Voice input (not configured)"
                disabled
                className="flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-lg text-neutral-700"
              >
                <Mic size={17} strokeWidth={1.7} />
              </button>

              <div className="mx-2 h-4 w-px shrink-0 bg-white/10" />
              <span className="hidden truncate text-[11px] text-neutral-600 sm:inline">
                {selectedAgent === "auto"
                  ? "Auto mode"
                  : `${agents.find((agent) => agent.id === selectedAgent)?.label} mode`}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-[10px] tabular-nums text-neutral-600 sm:inline">
                {value.length > 0
                  ? `${value.length} characters`
                  : "Shift + Enter for new line"}
              </span>

              <button
                type="button"
                disabled={!canSend}
                onClick={handleSendMessage}
                title={waitResponse ? "Generating response" : "Send message"}
                aria-label={
                  waitResponse ? "Generating response" : "Send message"
                }
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111] ${
                  canSend
                    ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.08)] hover:scale-[1.04] hover:bg-neutral-200 active:scale-95"
                    : "cursor-not-allowed border border-white/6 bg-white/4 text-neutral-600"
                }`}
              >
                {waitResponse ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Send size={16} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 px-2">
          <span className="text-[10px] text-neutral-600">
            <span className="font-medium text-neutral-400">NoBound AI</span> can
            make mistakes. Verify important information.
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;