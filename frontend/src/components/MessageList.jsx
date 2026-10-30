import { useEffect, useLayoutEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setInputMessage } from "../redux/messageSlice";
import {
  ArrowUpRight,
  Code2,
  // LayoutDashboard,
  MessageSquare,
  Presentation,
} from "lucide-react";
import MessageBubble from "./MessageBubble";
import LoadingAnimation from "./loading/MessageBubbleLoading";

function MessageList({ selectedAgent }) {
  const { selectedConversation } = useSelector((state) => state.conversation);

  const { messages = [], isLoading } = useSelector((state) => state.message);

  const dispatch = useDispatch();

  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const previousConversationId = useRef(null);
  const previousMessageCount = useRef(0);

  const thinkingLabels = {
    auto: [
      "Thinking",
      "Analyzing your request",
      "Reasoning",
      "Generating a response",
    ],
    chat: [
      "Understanding your message",
      "Formulating a response",
      "Refining the answer",
    ],
    code: [
      "Analyzing requirements",
      "Designing the solution",
      "Writing code",
      "Reviewing implementation",
    ],
    pdf: [
      "Analyzing document request",
      "Organizing content",
      "Generating the PDF",
      "Finalizing document",
      "This may take a while",
      "Please wait"
    ],
    ppt: [
      "Analyzing presentation topic",
      "Planning slides",
      "Generating presentation",
      "Finalizing slides",
      "This may take a while",
      "Please wait"
    ],
    search: [
      "Understanding search query",
      "Searching relevant sources",
      "Verifying information",
      "Preparing summary",
    ],
    vision: [
      "Understanding your prompt",
      "Preparing the image concept",
      "Crafting visual details",
      "Generating your image",
      "Refining the final result",
    ],
  };

  // Reset message tracking when switching conversations.
  useEffect(() => {
    const conversationId = selectedConversation?._id;

    if (conversationId !== previousConversationId.current) {
      previousConversationId.current = conversationId;
      previousMessageCount.current = 0;
    }
  }, [selectedConversation?._id]);

  // Scroll to the bottom on initial load; smoothly on new messages.
  useLayoutEffect(() => {
    if (!selectedConversation?._id) return;

    if (messages.length === 0) {
      previousMessageCount.current = 0;
      return;
    }

    if (previousMessageCount.current === 0) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }

      previousMessageCount.current = messages.length;
      return;
    }

    if (messages.length > previousMessageCount.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }

    previousMessageCount.current = messages.length;
  }, [messages, selectedConversation?._id]);

  const suggestions = [
    {
      title: "Build a Netflix Clone",
      description: "Create a full-stack streaming app",
      icon: Code2,
    },
    {
      title: "Explain Redis",
      description: "Understand caching and data storage",
      icon: MessageSquare,
    },
    {
      title: "Create a PPT",
      description: "Create a well structured PPT on ML",
      icon: Presentation,
    },
  ];

  const isEmpty = messages.length === 0 || !selectedConversation;

  return (
    <div
      ref={containerRef}
      className="
        relative flex min-h-0 flex-1 flex-col
        overflow-y-auto overscroll-y-contain
        bg-black
        px-3 py-4
        sm:px-5 sm:py-5
        md:px-6 md:py-6
        lg:px-8
        scrollbar-none
        [&::-webkit-scrollbar]:hidden
      "
    >
      {isEmpty ? (
        <div
          className="
          flex min-h-full w-full flex-1 flex-col
          items-center justify-center
          px-1 py-8 text-center
          sm:px-3 sm:py-10
        "
        >
          {/* Heading */}
          <h1
            className="
            text-xl font-semibold tracking-tight text-white
            sm:text-2xl
            md:text-3xl
          "
          >
            How can I help you?
          </h1>

          <p
            className="
            mt-2 max-w-xs text-xs leading-5 text-neutral-500
            sm:mt-3 sm:max-w-md sm:text-sm sm:leading-6
          "
          >
            Welcome to NoBound AI. Explore ideas, write code, solve problems, or
            turn your next big idea into reality.
          </p>

          {/* Responsive suggestion cards */}
          <div
            className="
            mt-6 grid w-full max-w-3xl grid-cols-1 gap-2.5
            sm:mt-8 sm:grid-cols-2 sm:gap-3
            lg:grid-cols-3
          "
          >
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon;

              return (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() => dispatch(setInputMessage(suggestion.title))}
                  className="
                    group relative flex min-w-0 items-start gap-3
                    rounded-xl border border-white/10
                    bg-white/2.5
                    p-3.5 text-left
                    transition-colors duration-200
                    hover:border-white/20 hover:bg-white/6
                    active:scale-[0.99]
                    sm:p-4
                    focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-white/30
                  "
                >
                  {/* Icon */}
                  <div
                    className="
                    flex h-9 w-9 shrink-0 items-center justify-center
                    rounded-lg border border-white/10
                    bg-white/4.5 text-neutral-300
                    transition-colors
                    group-hover:border-white/20
                    group-hover:bg-white/10
                    group-hover:text-white
                    sm:h-10 sm:w-10
                  "
                  >
                    <Icon size={17} strokeWidth={1.6} className="sm:hidden" />
                    <Icon
                      size={18}
                      strokeWidth={1.6}
                      className="hidden sm:block"
                    />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1 pt-0.5 pr-3">
                    <p
                      className="
                      wrap-break-word text-xs font-medium leading-5
                      text-neutral-200 transition-colors
                      group-hover:text-white
                      sm:text-[13px]
                    "
                    >
                      {suggestion.title}
                    </p>

                    <p
                      className="
                      mt-1 wrap-break-word text-[11px] leading-relaxed
                      text-neutral-500
                      sm:text-xs
                    "
                    >
                      {suggestion.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight
                    size={15}
                    strokeWidth={1.6}
                    className="
                      absolute right-3 top-3 shrink-0
                      text-neutral-600
                      transition-all duration-200
                      group-hover:-translate-y-0.5
                      group-hover:translate-x-0.5
                      group-hover:text-white
                    "
                  />
                </button>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p
            className="
            mt-7 max-w-xs text-[10px] leading-5
            tracking-wide text-neutral-600
            sm:mt-10 sm:max-w-none
          "
          >
            NoBound AI can make mistakes. Verify important information.
          </p>
        </div>
      ) : (
        /* Conversation messages */
        <div
          className="
          mt-5
          mx-auto w-full min-w-0 max-w-4xl
          space-y-5 pb-3
          sm:space-y-6 sm:pb-4
          lg:max-w-5xl
          xl:max-w-7xl
        "
        >
          {messages.map((msg, i) => (
            <div key={msg?._id || msg?.id || i} className="min-w-0 max-w-full">
              <MessageBubble
                role={msg?.role}
                content={msg?.content}
                images={msg?.images || []}
                attachment={msg?.attachment}
              />
            </div>
          ))}

          {isLoading && <LoadingAnimation thinkingLabels={thinkingLabels[selectedAgent]} />}

          <div ref={bottomRef} className="h-px w-full" />
        </div>
      )}
    </div>
  );
}

export default MessageList;