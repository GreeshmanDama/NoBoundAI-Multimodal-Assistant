import { MessageSquare, Sparkles, Menu } from "lucide-react";
import { useSelector } from "react-redux";

function Nav({ onOpenSidebar }) {
  const { selectedConversation } = useSelector((state) => state.conversation);

  const { messages = [] } = useSelector((state) => state.message);

  return (
    <header
      className="
      sticky top-0 z-40 flex h-16 shrink-0
      items-center justify-between
      border-b border-white/10
      bg-black/95 px-3 backdrop-blur-xl
      sm:px-6
    "
    >
      {/* Left — Mobile menu + Conversation information */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {/* Mobile sidebar button */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
          className="
            flex h-9 w-9 shrink-0 items-center justify-center
            rounded-lg border border-white/10
            text-neutral-300 transition-colors
            hover:bg-white/10 hover:text-white
            active:scale-95
            md:hidden
          "
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>

        {/* Conversation icon */}
        <div
          className="
          flex h-9 w-9 shrink-0 items-center justify-center
          rounded-xl border border-white/15
          bg-white/6 text-white
        "
        >
          <MessageSquare size={17} strokeWidth={1.7} />
        </div>

        {/* Title and assistant status */}
        <div className="flex min-w-0 flex-col justify-center">
          <h1
            className="
            max-w-32.5 truncate text-[13px]
            font-semibold tracking-tight text-white
            sm:max-w-xs sm:text-sm
          "
          >
            {selectedConversation?.title || "New Chat"}
          </h1>

          <div className="mt-1 flex items-center gap-1.5">
            <Sparkles
              size={11}
              strokeWidth={1.8}
              className="shrink-0 text-neutral-400"
            />

            <span className="text-[10px] font-medium tracking-wide text-neutral-400">
              NoBound AI
            </span>

            <span className="mx-0.5 h-0.5 w-0.5 rounded-full bg-neutral-600" />

            <span className="hidden text-[10px] text-neutral-500 xs:inline">
              Assistant
            </span>
          </div>
        </div>
      </div>

      {/* Right — Message count */}
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <span className="hidden text-[11px] font-medium text-neutral-500 sm:inline">
          Messages
        </span>

        <div
          className="
          flex h-8 min-w-9 items-center justify-center
          rounded-lg border border-white/10
          bg-white/4 px-2.5
        "
        >
          <span className="text-xs font-semibold tabular-nums text-neutral-200">
            {messages.length}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Nav;
