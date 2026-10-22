import { useState } from "react";
import { motion } from "framer-motion";
import {
  Code2,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Sparkles,
  Globe,
  ShieldCheck,
  Zap,
  Bot,
  Cpu,
  Layers,
  Terminal,
  Lock,
  ArrowRight,
} from "lucide-react";

// Floating Cards items for the animated canvas background
const floatingItems = [
  {
    id: "message",
    className: "top-[2%] left-[22%] sm:left-[24%] w-[230px] sm:w-[250px]",
    icon: Sparkles,
    color: "text-zinc-200",
    bgColor: "bg-white/[0.04] border-white/[0.10]",
    title: "AI Assistant",
    description: "Here is the summary of quantum neural pathways...",
    badge: "Active",
    badgeColor: "bg-white/[0.05] text-zinc-300 border-white/[0.10]",
  },
  {
    id: "pdf",
    className: "top-[20%] left-[50%] sm:left-[70%] w-[220px] sm:w-[240px]",
    icon: FileText,
    color: "text-zinc-200",
    bgColor: "bg-white/[0.04] border-white/[0.10]",
    title: "Research_Paper.pdf",
    description: "PDF · 2.4 MB · 12 Pages",
    badge: "Analyzed",
    badgeColor: "bg-white/[0.05] text-zinc-300 border-white/[0.10]",
  },
  {
    id: "code",
    className: "top-[20%] left-[2%] sm:left-[4%] w-[235px] sm:w-[250px]",
    icon: Code2,
    color: "text-zinc-200",
    bgColor: "bg-white/[0.04] border-white/[0.10]",
    title: "Generated Code",
    description: "const optimize = (nodes) => {",
    badge: "Optimized",
    badgeColor: "bg-white/[0.05] text-zinc-300 border-white/[0.10]",
  },
  {
    id: "image",
    className: "top-[60%] left-[48%] sm:left-[52%] w-[210px] sm:w-[230px]",
    icon: ImageIcon,
    color: "text-zinc-200",
    bgColor: "bg-white/[0.04] border-white/[0.10]",
    title: "Image Generation",
    description: "Cyberpunk neon landscape 8k",
    badge: "Rendered",
    badgeColor: "bg-white/[0.05] text-zinc-300 border-white/[0.10]",
    url: "https://res.cloudinary.com/dbe2ekayd/image/upload/v1791697710/cortexai/generated/jwrnebuhttv20cx6n60z.jpg",
  },
  {
    id: "search",
    className: "top-[72%] left-[20%] sm:left-[22%] w-[225px] sm:w-[240px]",
    icon: Globe,
    color: "text-zinc-200",
    bgColor: "bg-white/[0.04] border-white/[0.10]",
    title: "Deep Search",
    description: "Found 14 relevant sources",
    badge: "Live",
    badgeColor: "bg-white/[0.05] text-zinc-300 border-white/[0.10]",
  },
];

// Custom Google Icon Component
function GoogleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-1.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
      />
    </svg>
  );
}

// Brand Component
function Brand({ compact = false }) {
  return (
    <div className="group flex cursor-pointer items-center gap-3.5">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white via-zinc-300 to-zinc-600 p-[1px] transition-all duration-300 group-hover:scale-105">
        <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#0b0b0b] transition duration-300 group-hover:bg-[#171717]">
          <span className="bg-gradient-to-tr from-white via-zinc-200 to-zinc-400 bg-clip-text text-2xl font-black tracking-tighter text-transparent">
            N
          </span>
        </div>
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-white/50 to-zinc-500/50 opacity-0 blur transition duration-300 group-hover:opacity-30" />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-bold tracking-tight text-white">
            NoBound{" "}
            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              AI
            </span>
          </h1>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-300">
            PRO
          </span>
        </div>
        {!compact && (
          <p className="text-[11px] font-medium text-zinc-400">
            Infinite Workspace
          </p>
        )}
      </div>
    </div>
  );
}

// Floating Card Component
function FloatingCard({ item, index }) {
  const Icon = item.icon;

  return (
    <motion.div
      className={`absolute z-10 rounded-2xl border border-white/[0.10] bg-[#111111]/90 p-3.5 shadow-2xl backdrop-blur-xl ${item.className}`}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{
        opacity: 1,
        y: [0, -12, 0],
        scale: 1,
      }}
      transition={{
        opacity: { duration: 0.7, delay: 0.2 + index * 0.12 },
        scale: { duration: 0.7, delay: 0.2 + index * 0.12 },
        y: {
          duration: 4.5 + index * 0.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.35,
        },
      }}
      whileHover={{ scale: 1.05, zIndex: 20 }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${item.bgColor}`}
        >
          <Icon size={18} className={item.color} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-xs font-semibold text-zinc-200">
              {item.title}
            </p>
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${item.badgeColor}`}
            >
              {item.badge}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-zinc-400">
            {item.description}
          </p>
        </div>
      </div>

      {item.id === "pdf" && (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.08] pt-2.5">
          <div className="flex items-center justify-between text-[9px] text-zinc-400">
            <span>Parsing semantic tree</span>
            <span className="font-mono text-zinc-200">100%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-white"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </div>
        </div>
      )}

      {item.id === "code" && (
        <div className="mt-2.5 rounded-lg border border-white/[0.08] bg-black/60 p-2 font-mono text-[10px]">
          <div className="mb-1 flex items-center gap-1 text-[9px] text-zinc-500">
            <Terminal size={10} /> algorithm.ts
          </div>
          <p className="text-zinc-200">{"return data.filter(v =>"}</p>
          <p className="pl-3 text-zinc-300">{"v.score > 0.95"}</p>
          <p className="text-zinc-400">{"});"}</p>
        </div>
      )}

      {item.id === "search" && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-300" />
          </span>
          <span>Searching academic repositories...</span>
        </div>
      )}

      {item.id === "image" && (
        <div className="group relative mt-2.5 flex h-25 items-center justify-center overflow-hidden rounded-xl border border-white/[0.10] bg-gradient-to-br from-zinc-800/60 via-zinc-900 to-black">
          <div className="absolute inset-0 bg-linear-to-tr from-white/8 via-zinc-400/8 to-transparent" />
          <img className="mt-10" src={item.url} alt="Image" />
        </div>
      )}
    </motion.div>
  );
}

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e?.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await onLogin();
    } catch (err) {
      console.error("Google sign-in failed:", err);

      if (err?.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err?.code === "auth/popup-blocked") {
        setError(
          "Your browser blocked the sign-in popup. Allow popups and try again.",
        );
      } else {
        setError(err?.message || "Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#070707] font-sans antialiased text-zinc-100 selection:bg-white selection:text-black">
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl">
          {/* Subtle Background Glow */}
          <div className="absolute h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          {/* Spinner & Logo Container */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            {/* Outer Glowing Ring */}
            <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-white border-r-white/40 shadow-[0_0_15px_rgba(255,255,255,0.15)]" />

            {/* Inner Static Ring */}
            <div className="absolute inset-1 rounded-full border border-white/10" />
          </div>

          {/* Text Section */}
          <div className="relative z-10 mt-8 text-center">
            <h2 className="text-xl font-medium tracking-tight text-white">
              Signing you in
            </h2>
            <p className="mt-1.5 text-xs font-light tracking-wide text-zinc-400">
              Preparing your NoBound AI workspace...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-400/50 text-xs font-bold">
            !
          </span>

          <p className="flex-1 leading-5">{error}</p>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="text-red-300/70 transition hover:text-red-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Background ambient lighting and gradients */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Monochrome ambient lighting */}
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-white/[0.06] blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-zinc-400/[0.05] blur-[160px]" />
        <div className="absolute -bottom-32 left-1/3 h-[450px] w-[500px] rounded-full bg-white/[0.04] blur-[150px]" />

        {/* Dynamic Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Subtle Horizontal Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "100% 64px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col justify-between px-4 py-6 sm:px-8 lg:px-12">
        {/* Header Navigation */}
        <header className="flex items-center justify-between gap-4 py-2">
          <Brand />

          <div className="hidden items-center gap-6 rounded-full border border-white/[0.10] bg-[#111111]/60 px-5 py-2 text-xs text-zinc-400 backdrop-blur-md md:flex">
            <span className="flex cursor-pointer items-center gap-1.5 transition hover:text-white">
              <Bot size={14} className="text-zinc-200" /> Assistant
            </span>
            <span className="text-zinc-700">|</span>
            <span className="flex cursor-pointer items-center gap-1.5 transition hover:text-white">
              <Cpu size={14} className="text-zinc-300" /> Models
            </span>
            <span className="text-zinc-700">|</span>
            <span className="flex cursor-pointer items-center gap-1.5 transition hover:text-white">
              <Layers size={14} className="text-zinc-300" /> Artifacts
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-200" />
              </span>
              All Systems Operational
            </div>
          </div>
        </header>

        {/* Main Split Layout */}
        <main className="grid flex-1 grid-cols-1 items-center gap-12 py-8 lg:grid-cols-12 lg:gap-12 lg:py-12">
          {/* Left Column: Hero & Interactive Visual Stage */}
          <section className="flex flex-col justify-center lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-300 shadow-inner backdrop-blur-md">
                <Sparkles size={14} className="animate-pulse text-zinc-200" />
                <span>Next Generation AI Workspace v2.4</span>
              </div>

              <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Unbound Thinking. <br />
                <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                  Boundless Intelligence.
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Your unified environment for conversational AI, document
                research, code generation, and visual creation. Built for teams
                and creators.
              </p>
            </motion.div>

            {/* Interactive Floating Stage (Desktop & Tablet) */}
            <div className="relative mt-10 hidden h-85 w-full max-w-2xl rounded-3xl border border-white/[0.10] bg-white/[0.015] p-4 backdrop-blur-md sm:block">
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.035] to-transparent" />

              {/* Background ambient canvas elements */}
              <div className="absolute left-[10%] top-[20%] h-48 w-48 rounded-full border border-white/[0.08] animate-spin-slow" />

              {/* Floating Cards Array */}
              {floatingItems.map((item, index) => (
                <FloatingCard key={item.id} item={item} index={index} />
              ))}
            </div>

            {/* Core Capabilities Badges */}
            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                { label: "Multi-modal RAG", icon: ShieldCheck },
                { label: "Ultra Low Latency", icon: Zap },
                { label: "End-to-End Encryption", icon: Lock },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2 text-xs font-medium text-zinc-300 backdrop-blur-md"
                  >
                    <Icon size={14} className="text-zinc-200" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right Column: Sleek Auth Card */}
          <section className="flex justify-center lg:col-span-5 lg:justify-end">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.10] bg-[#101010]/95 p-7 shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-9"
            >
              {/* Subtle top accent */}
              <div className="pointer-events-none absolute left-[15%] right-[15%] top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

              {/* Header */}
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.04]">
                  <Sparkles size={25} className="text-zinc-200" />
                </div>

                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Welcome to NoBound AI
                </h2>

                <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">
                  Your ideas, tools, and AI assistants — all in one place.
                </p>
              </div>

              {/* Google Sign-in */}
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all duration-200 hover:bg-zinc-200 hover:shadow-lg hover:shadow-white/[0.05] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                <GoogleIcon className="h-5 w-5" />

                <span>
                  {loading ? "Signing you in..." : "Continue with Google"}
                </span>

                {!loading && (
                  <ArrowRight
                    size={16}
                    className="text-zinc-500 transition-transform group-hover:translate-x-1"
                  />
                )}
              </button>

              <p className="mt-4 text-center text-xs text-zinc-500">
                Secure sign-in. No password required.
              </p>

              {/* Capabilities */}
              <div className="my-7 border-t border-white/[0.08] pt-6">
                <p className="mb-5 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Everything in one workspace
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: MessageSquare, label: "Chat" },
                    { icon: Search, label: "Research" },
                    { icon: FileText, label: "Documents" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.015] px-2 py-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
                    >
                      <Icon
                        size={19}
                        strokeWidth={1.6}
                        className="text-zinc-200"
                      />
                      <span className="text-[11px] text-zinc-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <p className="text-center text-[11px] leading-5 text-zinc-500">
                Built for curious minds and ambitious ideas.
              </p>
            </motion.div>
          </section>
        </main>

        {/* Global Footer
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.08] pt-5 text-xs text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-300" />
            <span>
              © {new Date().getFullYear()} NoBound AI Inc. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <a href="#docs" className="transition hover:text-white">
              Documentation
            </a>
            <a href="#api" className="transition hover:text-white">
              API Reference
            </a>
            <a href="#status" className="transition hover:text-white">
              System Status
            </a>
            <a href="#contact" className="transition hover:text-white">
              Enterprise
            </a>
          </div>
        </footer> */}
      </div>
    </div>
  );
}
