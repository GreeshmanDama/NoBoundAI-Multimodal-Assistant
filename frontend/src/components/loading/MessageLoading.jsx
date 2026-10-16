import { MessageSquare } from "lucide-react";

function MessageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-75">
      <div className="flex flex-col items-center p-8 rounded-2xl">
        
        {/* Animated Glow & Icon */}
        <div className="relative flex items-center justify-center w-16 h-16 mb-6">
          {/* Ambient Glow */}
          <div className="absolute inset-0 rounded-2xl bg-linear-to-tr from-indigo-500/30 to-violet-500/30 blur-xl animate-pulse" />
          
          {/* Subtle Ring Container */}
          <div className="relative flex items-center justify-center w-full h-full rounded-2xl bg-white/3 border border-white/10 shadow-inner">
            <MessageSquare className="w-7 h-7 text-white/90 animate-pulse" />
          </div>
        </div>

        {/* Loading Text & Pulsing Dots */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium tracking-wide text-zinc-200">
            Loading conversation
          </p>

          <div className="flex items-center gap-1.5 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageLoading;