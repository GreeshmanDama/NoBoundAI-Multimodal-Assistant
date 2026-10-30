import { MessageSquare } from "lucide-react";

function MessageLoading() {
  return (
    <div className="flex min-h-75 flex-1 items-center justify-center bg-black">
      <div className="flex flex-col items-center px-8 py-10">
        {/* Premium animated icon */}
        <div className="relative mb-7 flex h-20 w-20 items-center justify-center">
          {/* Monochrome ambient glow */}
          <div className="absolute inset-1 rounded-3xl bg-white/[0.08] blur-2xl animate-pulse" />

          {/* Rotating outline */}
          <div className="absolute inset-0 rounded-[24px] border border-white/[0.08]" />

          <div className="absolute inset-0 animate-spin rounded-[24px] border border-transparent border-t-white/80 border-r-white/20" />

          {/* Glass icon container */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.12] bg-gradient-to-br from-white/[0.09] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.3)]">
            <MessageSquare
              className="h-7 w-7 text-white/90"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Loading status */}
        <div className="flex flex-col items-center text-center">
          <h3 className="text-sm font-medium tracking-wide text-white/90">
            Loading conversation
          </h3>

          <p className="mt-2 text-xs tracking-wide text-zinc-500">
            Preparing your workspace
          </p>

          {/* Animated monochrome progress indicator */}
          <div className="mt-6 flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-white animate-bounce"
                style={{
                  animationDelay: `${dot * 150}ms`,
                  animationDuration: "900ms",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageLoading;