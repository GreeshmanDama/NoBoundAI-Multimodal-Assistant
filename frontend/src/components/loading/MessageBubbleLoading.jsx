import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

const LoadingAnimation = ({ thinkingLabels = ["Thinking"] }) => {
  const [labelIndex, setLabelIndex] = useState(0);

  useEffect(() => {
    const setLabIndex = () => {
      setLabelIndex(0);
    }
    setLabIndex();

    if (thinkingLabels.length <= 1) return;

    const interval = setInterval(() => {
      setLabelIndex((prev) => (prev + 1) % thinkingLabels.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [thinkingLabels]);

  const currentLabel = thinkingLabels[labelIndex] || "Thinking";

  return (
    <div className="ml-7 flex max-w-[72%] items-start gap-3 py-3">
      <div className="flex min-h-9 flex-col justify-center pt-0.5">
        <div className="flex items-center gap-2">
          {/* Subtle pulsing indicator */}
          <motion.span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white"
            animate={{
              opacity: [0.35, 1, 0.35],
              scale: [0.85, 1.15, 0.85],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <AnimatePresence mode="wait">
            <motion.span
              key={currentLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative text-xs font-medium tracking-wide"
            >
              {/* Left-to-right shimmer */}
              <motion.span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, #737373 0%, #a3a3a3 35%, #ffffff 50%, #a3a3a3 65%, #737373 100%)",
                  backgroundSize: "250% 100%",
                }}
                animate={{
                  backgroundPosition: ["100% 50%", "-150% 50%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {currentLabel}
              </motion.span>
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default LoadingAnimation;