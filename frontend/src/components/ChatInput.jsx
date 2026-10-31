import {
  Code2,
  FileText,
  Globe,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquare,
  Mic,
  MicOff,
  AudioLines,
  Paperclip,
  Presentation,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

// import sendMessage from "../features/sendMessage";
import { createConversation } from "../features/createConversation";
import updateConversation from "../features/updateConversation";

import {
  addMessage,
  appendMessageChunk,
  finishStreamingMessage,
  updateMessageContent,
  setIsLoading,
  setInputMessage,
  updateMessageImages,
} from "../redux/messageSlice";

import { sendMessageStream } from "../features/sendMessageStream";

import {
  addConversation,
  setCovTitle,
  setSelectedConversation,
} from "../redux/conversationSlice";

// Append `addition` to `base` with a single space between them.
const joinText = (base, addition) => {
  const add = addition.trim();
  if (!add) return base;
  const start = base.trimEnd();
  return start ? `${start} ${add}` : add;
};

function ChatInput({ selectedAgent, setSelectedAgent }) {
  const [value, setValue] = useState("");
  const [waitResponse, setWaitResponse] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const recognitionRef = useRef(null);
  // What is currently shown in the textarea (committed text + live words).
  const valueRef = useRef("");
  // Only the finished text. Live (interim) words are never stored here, which is what prevents duplicates.
  const committedRef = useRef("");
  // How many final results of this session were already added to committedRef.
  const finalCountRef = useRef(0);

  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const dispatch = useDispatch();

  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation,
  );
  const { inputMessage } = useSelector((state) => state.message);

  const agents = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "code", icon: Code2, label: "Code" },
    { id: "pdf", icon: FileText, label: "PDF" },
    { id: "ppt", icon: Presentation, label: "PPT" },
    { id: "search", icon: Globe, label: "Search" },
    { id: "vision", icon: ImageIcon, label: "Image" },
  ];

  const canSend =
    (value.trim().length > 0 || Boolean(selectedFile)) &&
    !waitResponse &&
    !isListening;

  // Sync state with Redux input updates (suggestions, typing, paste, end of dictation).
  useEffect(() => {
    const callsetvalue = () => {
      setValue(inputMessage ?? "");
      committedRef.current = inputMessage ?? "";
    };
    callsetvalue();
  }, [inputMessage]);

  // Keep ref updated to read state inside speech callbacks
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxHeight = 240;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Voice input isn't supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      const old = recognitionRef.current;
      recognitionRef.current = null;
      old.abort();
    }

    setSpeechError("");

    // Everything already in the box is the starting point; new words are added after it.
    committedRef.current = valueRef.current;
    finalCountRef.current = 0;

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;

      const { results } = event;
      let finalChunk = "";
      let interim = "";

      // 1) Take only the final results we have not committed yet (never twice).
      let i = finalCountRef.current;
      while (i < results.length && results[i].isFinal) {
        finalChunk += results[i][0].transcript;
        i++;
      }
      finalCountRef.current = i;

      // 2) Everything after that is still being recognised (live words).
      for (let j = i; j < results.length; j++) {
        interim += results[j][0].transcript;
      }

      if (finalChunk.trim()) {
        committedRef.current = joinText(committedRef.current, finalChunk);
      }

      // Show committed text + live words immediately. Live words are replaced
      // on every event, so they can never pile up.
      const display = joinText(committedRef.current, interim);

      if (display !== valueRef.current) {
        valueRef.current = display;
        setValue(display);
      }
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;

      const errors = {
        "not-allowed": "Microphone access blocked.",
        "no-speech": "No speech detected.",
        "audio-capture": "No microphone found.",
        network: "Voice service network error.",
      };

      if (event.error !== "aborted") {
        setSpeechError(
          errors[event.error] + " (Use Different Browser)" ||
            "Speech recognition error, (Use Different Browser).",
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setIsListening(false);

      // Sync Redux once when dictation ends, not on every word.
      dispatch(setInputMessage(valueRef.current));
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      recognitionRef.current = null;
      setSpeechError("Could not start microphone.");
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = () => {
    recognitionRef.current?.stop();
  };

  // Used when the user starts typing/pasting while the mic is on.
  // Live words are already in the box, so the session is dropped to avoid adding them twice.
  const abortSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    recognition.abort();
    setIsListening(false);
  };

  const closeSpeechError = () => {
    setSpeechError("");
  };

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
    };
  }, []);

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
      if (!data?._id) throw new Error("Conversation creation failed.");

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

    let assistantMessageId = null;

    try {
      let conversation = selectedConversation;

      setValue("");
      dispatch(setInputMessage(""));

      if (!conversation?._id) {
        conversation = await createConv();

        if (!conversation?._id) {
          throw new Error("Could not create conversation.");
        }
      }

      const conversationId = conversation._id;
      const isFirstMessage = conversation.title === "New Chat";

      const attachment = selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type === "application/pdf" ? "pdf" : "image",
            size: selectedFile.size,
          }
        : undefined;

      // Add the user's message immediately.
      dispatch(
        addMessage({
          id: crypto.randomUUID(),
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

        conversation = {
          ...conversation,
          ...updatedConversation,
          title,
        };
      }

      // Create one assistant message that will receive all chunks.
      assistantMessageId = crypto.randomUUID();

      dispatch(
        addMessage({
          id: assistantMessageId,
          role: "assistant",
          content: "",
          images: [],
          isStreaming: true,
        }),
      );

      dispatch(setIsLoading(true));

      const formData = new FormData();

      formData.append("prompt", prompt);
      formData.append("conversationId", conversationId);
      formData.append("agent", selectedAgent.toLowerCase());

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      // Remove the selected attachment after adding it to FormData.
      removeSelectedFile();

      await sendMessageStream(formData, {
        // Append every generated chunk to the same message.
        onChunk: (chunk) => {
          dispatch(
            appendMessageChunk({
              id: assistantMessageId,
              text: chunk,
            }),
          );

          // Hide the initial loading animation once text arrives.
          dispatch(setIsLoading(false));
        },

        // Final answer and generated images.
        onDone: (data) => {
          if (typeof data.answer === "string") {
            dispatch(
              updateMessageContent({
                id: assistantMessageId,
                content: data.answer,
              }),
            );
          }

          dispatch(
            updateMessageImages({
              id: assistantMessageId,
              images: data.images || [],
            }),
          );

          dispatch(finishStreamingMessage(assistantMessageId));
          dispatch(setIsLoading(false));
        },
      });

      setSelectedFile(null);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      const errorMessage =
        error?.message ||
        "Sorry, something went wrong while sending your message.";

      if (assistantMessageId) {
        dispatch(
          updateMessageContent({
            id: assistantMessageId,
            content: errorMessage,
          }),
        );

        dispatch(finishStreamingMessage(assistantMessageId));
      } else {
        dispatch(
          addMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: errorMessage,
          }),
        );
      }
    } finally {
      dispatch(setIsLoading(false));
      setWaitResponse(false);
    }
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing
    ) {
      event.preventDefault();

      if (isListening) {
        stopSpeechRecognition();
        return;
      }

      if (!waitResponse) handleSendMessage();
    }
  };

  const handlePaste = (event) => {
    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string") return;

    event.preventDefault();
    abortSpeechRecognition();

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
    <div className="w-full bg-black px-3 pb-4 pt-2 sm:px-5">
      <div className="mx-auto w-full">
        {/* Agent Selector Toolbar */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-neutral-900/60 p-1 backdrop-blur-md scrollbar-none">
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
                  className={`group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={13} strokeWidth={isSelected ? 2.2 : 1.8} />
                  <span>{agent.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="mb-2.5 flex max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur-md">
            <Paperclip size={13} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
            <span className="shrink-0 text-[10px] text-neutral-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </span>
            <button
              type="button"
              onClick={removeSelectedFile}
              disabled={waitResponse}
              title="Remove file"
              aria-label="Remove selected file"
              className="rounded-md p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Speech Error Banner */}
        {speechError && (
          <div
            role="status"
            className="mb-2.5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-950/30 px-3 py-1.5 text-xs text-red-300"
          >
            <MicOff size={13} className="shrink-0 text-red-400" />
            <p className="min-w-0 flex-1 truncate">{speechError}</p>
            <button
              type="button"
              onClick={closeSpeechError}
              aria-label="Dismiss voice input message"
              className="rounded-md p-0.5 hover:bg-white/10"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Composer Main Container */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/50 shadow-2xl transition-all duration-200 hover:border-white/20 focus-within:border-white/30">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              const newValue = event.target.value;
              abortSpeechRecognition();
              setValue(newValue);
              dispatch(setInputMessage(newValue));
            }}
            onPaste={handlePaste}
            rows={1}
            disabled={waitResponse}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening ? "Listening... speak now" : "Message NoBound AI..."
            }
            aria-label="Message NoBound AI"
            className="block w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-sm leading-6 text-white outline-none placeholder:text-neutral-500 scrollbar-none sm:px-5"
          />

          {/* Bottom Control Bar */}
          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1 sm:px-4">
            <div className="flex items-center gap-1">
              <input
                type="file"
                accept=".pdf,image/*"
                hidden
                ref={fileRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                title="Attach file"
                aria-label="Attach PDF or image"
                disabled={waitResponse}
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Paperclip size={16} strokeWidth={1.8} />
              </button>

              {/* Speech Button */}
              <button
                type="button"
                title={isListening ? "Stop listening" : "Start voice input"}
                aria-label={
                  isListening ? "Stop listening" : "Start voice input"
                }
                aria-pressed={isListening}
                disabled={waitResponse}
                onClick={() => {
                  if (isListening) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition();
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isListening
                    ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                    : "text-neutral-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {isListening ? (
                  <AudioLines
                    size={17}
                    className="animate-pulse text-red-400"
                  />
                ) : (
                  <Mic size={16} strokeWidth={1.8} />
                )}
              </button>

              <div className="mx-1.5 h-3.5 w-px bg-white/10" />
              <span className="hidden text-[11px] text-neutral-500 sm:inline">
                {agents.find((a) => a.id === selectedAgent)?.label} Mode
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-[10px] tabular-nums text-neutral-500 sm:inline">
                {value.length > 0
                  ? `${value.length} chars`
                  : "Shift + Enter for line break"}
              </span>

              <button
                type="button"
                disabled={!canSend}
                onClick={handleSendMessage}
                title={waitResponse ? "Generating response" : "Send message"}
                aria-label={
                  waitResponse ? "Generating response" : "Send message"
                }
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                  canSend
                    ? "bg-white text-black hover:scale-105 active:scale-95"
                    : "cursor-not-allowed bg-white/5 text-neutral-600"
                }`}
              >
                {waitResponse ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Send size={15} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-2 text-center text-[10px] text-neutral-500">
          <span className="font-medium text-neutral-400">NoBound AI</span> can
          make mistakes. Verify important details.
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
