import {
  Check,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Presentation,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

/* =========================================================
   CONFIG
========================================================= */

const MAX_MESSAGE_HEIGHT = 192;

/* =========================================================
   CODE BLOCK
========================================================= */

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);

  const code = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  return (
    <div
      className="
        group
        relative
        my-4
        overflow-hidden
        rounded-xl
        border border-white/10
        bg-[#0d1117]
        shadow-[0_8px_30px_rgba(0,0,0,0.25)]
      "
    >
      {/* ================= CODE HEADER ================= */}

      <div
        className="
          flex
          items-center
          justify-between
          border-b border-white/10
          bg-white/3
          px-4
          py-2
        "
      >
        {/* Language */}

        <div className="flex items-center gap-2">
          <span
            className="
              h-2
              w-2
              rounded-full
              bg-indigo-400
              shadow-[0_0_8px_rgba(129,140,248,0.7)]
            "
          />

          <span
            className="
              text-[10px]
              font-semibold
              uppercase
              tracking-widest
              text-zinc-500
            "
          >
            {language || "code"}
          </span>
        </div>

        {/* Copy */}

        <button
          type="button"
          onClick={handleCopy}
          className="
            flex
            items-center
            gap-1.5
            rounded-lg
            border border-white/10
            bg-white/4
            px-2.5
            py-1.5
            text-[11px]
            font-medium
            text-zinc-400
            transition-all
            duration-200
            hover:border-white/15
            hover:bg-white/8
            hover:text-white
            active:scale-95
          "
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />

              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />

              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* ================= CODE ================= */}

      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.65",
            minWidth: "100%",
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
          showLineNumbers={false}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/* =========================================================
   MESSAGE BUBBLE
========================================================= */

function MessageBubble({ role, content, images = [] }) {
  const isUser = role === "user";

  const [lightBox, setLightBox] = useState(null);

  /* =======================================================
     SHOW MORE STATE
  ======================================================= */

  const [showMore, setShowMore] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const messageContentRef = useRef(null);

  /* =======================================================
     CHECK MESSAGE HEIGHT
  ======================================================= */

  useEffect(() => {
    const sho = () => {
      if (!isUser) {
        setHasOverflow(false);
        return;
      }
    };

    sho();

    const checkOverflow = () => {
      const element = messageContentRef.current;

      if (!element) return;

      setHasOverflow(element.scrollHeight > MAX_MESSAGE_HEIGHT + 1);
    };

    // Wait until Markdown has rendered.
    const frame = requestAnimationFrame(checkOverflow);

    window.addEventListener("resize", checkOverflow);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [content, images, isUser]);

  /* =======================================================
     RESET SHOW MORE WHEN CONTENT CHANGES
  ======================================================= */

  useEffect(() => {
    const ssm = () => {
      setShowMore(false);
    };
    ssm();
  }, [content]);

  /* =======================================================
     LIGHTBOX ESCAPE HANDLER
  ======================================================= */

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightBox(null);
      }
    };

    if (lightBox) {
      document.addEventListener("keydown", handleKeyDown);

      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = "";
    };
  }, [lightBox]);

  return (
    <>
      {/* ===================================================
          MESSAGE
      =================================================== */}

      <div
        className={`flex w-full px-4 py-2 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`
            relative
            rounded-2xl
            px-4
            py-3
            text-[14px]
            leading-6
            transition-colors
            duration-200
          
            ${
              isUser
                ? `
                  rounded-br-md
                  bg-white
                  text-black
                  lg:max-w-[40%]
                  max-w-[65%]
                  shadow-[0_4px_18px_rgba(255,255,255,0.04)]
                `
                : `
                  rounded-bl-md
                  lg:max-w-[90%]
                  max-w-full
                  text-neutral-200
                  shadow-[0_8px_30px_rgba(0,0,0,0.20)]
                  backdrop-blur-xl
                `
            }
         `}
        >
          {/* =================================================
              IMAGES
          ================================================= */}

          {images.length > 0 && (
            <div className="mt-1 mb-3 flex flex-wrap gap-3">
              {images.map((img, i) => {
                const messageContent = String(content ?? "").toLowerCase();

                const isAiGenerated = messageContent.includes(
                  "image generated successfully",
                );

                return (
                  <div
                    key={i}
                    className={`group relative ${
                      isAiGenerated
                        ? "rounded-2xl bg-linear-to-br from-violet-500 via-fuchsia-500 to-indigo-500 p-[1.5px] shadow-lg shadow-violet-500/20"
                        : "rounded-xl border border-white/10 bg-black/20"
                    }`}
                  >
                    <div
                      className={`relative overflow-hidden ${
                        isAiGenerated ? "rounded-[14px] bg-black" : "rounded-xl"
                      }`}
                    >
                      <img
                        src={img}
                        alt={
                          isAiGenerated
                            ? `AI-generated image ${i + 1}`
                            : `Attachment ${i + 1}`
                        }
                        loading="lazy"
                        onClick={() => setLightBox(img)}
                        onError={(e) => e.currentTarget.remove()}
                        className={`cursor-zoom-in object-cover transition-all duration-500 group-hover:scale-105 ${
                          isAiGenerated
                            ? "w-100 opacity-95 group-hover:opacity-100"
                            : "lg:w-42 lg:h-30 w-20 h-15 rounded-xl group-hover:opacity-90"
                        }`}
                      />

                      {/* AI Generated Badge */}
                      {isAiGenerated && (
                        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white shadow-md backdrop-blur-xl">
                          <span className="text-violet-300">✦</span>
                          AI GENERATED
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                          isAiGenerated
                            ? "bg-linear-to-t from-violet-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100"
                            : "bg-black/0 group-hover:bg-black/20"
                        }`}
                      >
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 ${
                            isAiGenerated
                              ? "scale-90 border border-white/20 bg-white/15 shadow-lg"
                              : "scale-75 bg-black/50"
                          }`}
                        >
                          <span className="mr-1">⌕</span>
                          View Image
                        </span>
                      </div>

                      {/* Premium AI Accent */}
                      {isAiGenerated && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-violet-500/20 to-transparent opacity-70" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =================================================
              MARKDOWN CONTENT
          ================================================= */}

          <div className="relative">
            {/* ===============================================
                COLLAPSIBLE CONTENT
            =============================================== */}

            <div
              ref={messageContentRef}
              className={`
                transition-[max-height]
                duration-300
                ease-in-out
                ${isUser && hasOverflow && !showMore ? "overflow-hidden" : ""}
              `}
              style={
                isUser && hasOverflow && !showMore
                  ? {
                      maxHeight: `${MAX_MESSAGE_HEIGHT}px`,
                    }
                  : undefined
              }
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  /* ========================================
                     TEXT
                  ======================================== */

                  strong: ({ children }) => (
                    <strong
                      className={`font-semibold ${
                        isUser ? "text-black" : "text-white"
                      }`}
                    >
                      {children}
                    </strong>
                  ),

                  em: ({ children }) => (
                    <em className="italic text-zinc-300">{children}</em>
                  ),

                  del: ({ children }) => (
                    <del className="text-zinc-500">{children}</del>
                  ),

                  /* ========================================
                     HEADINGS
                  ======================================== */

                  h1: ({ children }) => (
                    <h1
                      className="
                        mt-6
                        mb-3
                        text-2xl
                        font-bold
                        text-white
                      "
                    >
                      {children}
                    </h1>
                  ),

                  h2: ({ children }) => (
                    <h2
                      className="
                        mt-5
                        mb-3
                        text-xl
                        font-semibold
                        text-white
                      "
                    >
                      {children}
                    </h2>
                  ),

                  h3: ({ children }) => (
                    <h3
                      className="
                        mt-4
                        mb-2
                        text-lg
                        font-semibold
                        text-white
                      "
                    >
                      {children}
                    </h3>
                  ),

                  h4: ({ children }) => (
                    <h4
                      className="
                        mt-3
                        mb-2
                        text-base
                        font-semibold
                        text-white
                      "
                    >
                      {children}
                    </h4>
                  ),

                  /* ========================================
                     PARAGRAPH
                  ======================================== */

                  p: ({ children }) => (
                    <p
                      className={`mb-3 whitespace-pre-wrap wrap-break-word ${
                        isUser ? "text-black" : "text-neutral-200"
                      }`}
                    >
                      {children}
                    </p>
                  ),

                  /* ========================================
                     LISTS
                  ======================================== */

                  ul: ({ children }) => (
                    <ul
                      className="
                        my-3
                        list-disc
                        space-y-1.5
                        pl-6
                      "
                    >
                      {children}
                    </ul>
                  ),

                  ol: ({ children }) => (
                    <ol
                      className="
                        my-3
                        list-decimal
                        space-y-1.5
                        pl-6
                      "
                    >
                      {children}
                    </ol>
                  ),

                  li: ({ children }) => (
                    <li className="pl-1 text-zinc-200">{children}</li>
                  ),

                  /* ========================================
                     LINKS
                  ======================================== */

                  a: ({ href, children }) => {
                    const isPdf = /\.pdf(?:$|[?#])/i.test(href || "");
                    const isPpt = /\.(?:pptx?|ppt)(?:$|[?#])/i.test(href || "");

                    if (isPdf || isPpt) {
                      const urlParams = new URLSearchParams(
                        href?.split("?")[1] || "",
                      );

                      const urlTitle = urlParams.get("title");
                      const rawChildren = String(children).trim();
                      const isChildrenUrl = /^https?:\/\//i.test(rawChildren);

                      const title =
                        urlTitle ||
                        (!isChildrenUrl && rawChildren
                          ? rawChildren
                          : isPdf
                            ? "Generated PDF"
                            : "Generated Presentation");

                      const Icon = isPdf ? FileText : Presentation;
                      const label = isPdf
                        ? "PDF document"
                        : "PowerPoint presentation";
                      const downloadLabel = isPdf
                        ? "Download PDF"
                        : "Download PPT";

                      return (
                        <span className="my-3 flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                          <span className="flex items-center gap-3">
                            <Icon
                              className={`h-6 w-6 shrink-0 ${
                                isPdf ? "text-red-400" : "text-orange-400"
                              }`}
                            />

                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-white">
                                {title}
                              </span>

                              <span className="block text-sm text-zinc-400">
                                {label}
                              </span>
                            </span>
                          </span>

                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-400"
                          >
                            <Download className="h-4 w-4" />
                            {downloadLabel}
                          </a>
                        </span>
                      );
                    }

                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-300 underline underline-offset-2 transition-colors hover:text-indigo-200"
                      >
                        {children}
                      </a>
                    );
                  },

                  /* ========================================
                     BLOCKQUOTE
                  ======================================== */

                  blockquote: ({ children }) => (
                    <blockquote
                      className="
                        my-4
                        rounded-r-lg
                        border-l-2
                        border-indigo-400/60
                        bg-white/2
                        py-1
                        pl-4
                        italic
                        text-zinc-400
                      "
                    >
                      {children}
                    </blockquote>
                  ),

                  /* ========================================
                     INLINE CODE + CODE BLOCK
                  ======================================== */

                  code: ({ children, className }) => {
                    const match = /language-(\w+)/.exec(className || "");

                    /* --------------------------------------
                       INLINE CODE
                    -------------------------------------- */

                    if (!match) {
                      return (
                        <code
                          className="
                            rounded-md
                            border border-white/10
                            bg-white/8
                            px-1.5
                            py-0.5
                            font-mono
                            text-[13px]
                            text-indigo-300
                          "
                        >
                          {children}
                        </code>
                      );
                    }

                    /* --------------------------------------
                       CODE BLOCK
                    -------------------------------------- */

                    return (
                      <CodeBlock language={match[1]}>{children}</CodeBlock>
                    );
                  },

                  /* ========================================
                     PRE

                     CodeBlock already contains its own
                     container.
                  ======================================== */

                  pre: ({ children }) => <>{children}</>,

                  /* ========================================
                     HORIZONTAL RULE
                  ======================================== */

                  hr: () => (
                    <hr
                      className="
                        my-5
                        border-white/10
                      "
                    />
                  ),

                  /* ========================================
                     TABLE
                  ======================================== */

                  table: ({ children }) => (
                    <div
                      className="
                        my-5
                        w-full
                        overflow-x-auto
                        rounded-xl
                        border border-white/10
                      "
                    >
                      <table
                        className="
                          w-full
                          min-w-125
                          border-collapse
                          text-sm
                        "
                      >
                        {children}
                      </table>
                    </div>
                  ),

                  thead: ({ children }) => (
                    <thead className="bg-white/6">{children}</thead>
                  ),

                  tbody: ({ children }) => (
                    <tbody
                      className="
                        divide-y
                        divide-white/10
                      "
                    >
                      {children}
                    </tbody>
                  ),

                  tr: ({ children }) => (
                    <tr
                      className="
                        transition-colors
                        hover:bg-white/3
                      "
                    >
                      {children}
                    </tr>
                  ),

                  th: ({ children }) => (
                    <th
                      className="
                        whitespace-nowrap
                        border-b
                        border-white/10
                        px-4
                        py-3
                        text-left
                        font-semibold
                        text-white
                      "
                    >
                      {children}
                    </th>
                  ),

                  td: ({ children }) => (
                    <td
                      className="
                        align-top
                        border
                        border-white/5
                        px-4
                        py-3
                        text-zinc-300
                      "
                    >
                      {children}
                    </td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {/* =================================================
                MORE BUTTON
            ================================================= */}

            {isUser && hasOverflow && !showMore && (
              <div
                className="
                    absolute
                    bottom-0
                    left-0
                    right-0
                    flex
                    justify-center
                    pt-14
                  "
              >
                {/* Fade */}

                <div
                  className="
                      pointer-events-none
                      absolute
                      inset-x-0
                      bottom-0
                      h-24
                    "
                />

                {/* More button */}

                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  className="
                      relative
                      z-10
                      flex
                      items-center
                      gap-1.5
                      rounded-full
                      border
                      border-white/20
                      bg-black/20
                      px-3
                      py-1.5
                      text-[11px]
                      font-semibold
                      text-white
                      shadow-lg
                      backdrop-blur-md
                      transition-all
                      duration-200
                      hover:border-white/30
                      hover:bg-black/30
                      hover:shadow-xl
                      active:scale-95
                    "
                >
                  More
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
          </div>

          {/* =================================================
              SHOW LESS
          ================================================= */}

          {isUser && hasOverflow && showMore && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="
                      relative
                      z-10
                      flex
                      items-center
                      gap-1.5
                      rounded-full
                      border
                      border-white/20
                      bg-black/20
                      px-3
                      py-1.5
                      text-[11px]
                      font-semibold
                      text-white
                      shadow-lg
                      backdrop-blur-md
                      transition-all
                      duration-200
                      hover:border-white/30
                      hover:bg-black/30
                      hover:shadow-xl
                      active:scale-95
                 "
              >
                Show less
                <ChevronUp size={14} />
              </button>
            </div>
          )}

          {/* =================================================
              AI LABEL
          ================================================= */}

          {!isUser && (
            <div
              className="
                mt-2
                flex
                items-center
                gap-1.5
                text-[10px]
                font-medium
                uppercase
                tracking-wider
                text-zinc-500
              "
            >
              <span
                className="
                  h-1.5
                  w-1.5
                  rounded-full
                  bg-emerald-400
                  shadow-[0_0_8px_rgba(52,211,153,0.6)]
                "
              />
              CortexAI
            </div>
          )}
        </div>
      </div>

      {/* ===================================================
          IMAGE LIGHTBOX
      =================================================== */}

      {lightBox && (
        <div
          className="
            fixed
            inset-0
            z-9999
            flex
            items-center
            justify-center
            bg-black/80
            p-4
            backdrop-blur-xl
            sm:p-8
          "
          onClick={() => setLightBox(null)}
        >
          {/* Background glow */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-1/2
              h-125
              w-125
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              bg-indigo-500/10
              blur-[120px]
            "
          />

          {/* =================================================
              CLOSE BUTTON
          ================================================= */}

          <button
            type="button"
            onClick={() => setLightBox(null)}
            aria-label="Close image"
            className="
              absolute
              right-4
              top-4
              z-20
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              border
              border-white/10
              bg-white/10
              text-white
              shadow-lg
              backdrop-blur-xl
              transition-all
              duration-200
              hover:scale-105
              hover:bg-white/20
              active:scale-95
              sm:right-6
              sm:top-6
            "
          >
            <X size={20} />
          </button>

          {/* =================================================
              IMAGE
          ================================================= */}

          <div
            onClick={(e) => e.stopPropagation()}
            className="
              relative
              max-h-[90vh]
              max-w-[95vw]
              rounded-2xl
              border
              border-white/10
              bg-zinc-950/40
              p-1
              shadow-[0_25px_80px_rgba(0,0,0,0.6)]
              sm:max-w-[90vw]
            "
          >
            {/* Top shine */}

            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-0
                z-10
                h-px
                bg-linear-to-r
                from-transparent
                via-white/30
                to-transparent
              "
            />

            <img
              src={lightBox}
              alt="Expanded"
              className="
                block
                max-h-[88vh]
                max-w-[94vw]
                rounded-xl
                object-contain
                sm:max-w-[88vw]
              "
            />
          </div>

          {/* =================================================
              CLOSE HINT
          ================================================= */}

          <div
            className="
              absolute
              bottom-5
              left-1/2
              -translate-x-1/2
              rounded-full
              border
              border-white/10
              bg-white/5
              px-4
              py-2
              text-[11px]
              font-medium
              tracking-wide
              text-zinc-400
              backdrop-blur-xl
            "
          >
            Click outside or press Esc to close
          </div>
        </div>
      )}
    </>
  );
}

export default MessageBubble;
