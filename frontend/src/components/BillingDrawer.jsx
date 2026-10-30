import { Crown, Check, X, Sparkles, Zap, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSelector, useDispatch } from "react-redux";
import { createOrder } from "../features/createOrder";
import { verifyPayment } from "../features/verifyPayment";
import getCurrentUser from "../features/getCurrentUser";
import { setUserData } from "../redux/userSlice";
import { useState } from "react";

const plans = [
  {
    name: "Starter",
    price: 199,
    credits: 500,
    description: "For everyday AI assistance",
    features: [
      "500 AI credits",
      "AI chat and code assistance",
      "AI image generation",
    ],
  },
  {
    name: "Pro",
    price: 399,
    credits: 1000,
    description: "For serious builders and creators",
    features: [
      "1,000 AI credits",
      "Everything in Starter",
      "More room for AI workflows",
    ],
    popular: true,
  },
];

function BillingDrawer({ open, onClose }) {
  const { userData } = useSelector((state) => state.user);

  const [processingPlan, setProcessingPlan] = useState(null);

  const isPaying = processingPlan !== null;

  const [paymentError, setPaymentError] = useState("");

  const dispatch = useDispatch();

  console.log(userData);

  const currentPlan = userData?.plan || "Free";
  const credits = Math.max(0, Number(userData?.credits) || 0);
  const totalCredits = Math.max(1, Number(userData?.totalCredits) || 100);
  const usage = Math.min(100, (credits / totalCredits) * 100);

  const handleUpgrade = async (activePlan) => {
    if (isPaying) return;

    setProcessingPlan(activePlan.name);
    setPaymentError("");

    try {
      const loaded = await loadRazorpay();

      if (!loaded) {
        throw new Error("Unable to load Razorpay Checkout");
      }

      const plan = activePlan.name.toLowerCase();
      const data = await createOrder(plan);

      if (!data?.success || !data?.order?.id) {
        throw new Error(data?.message || "Unable to create payment order");
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "NoBound AI",
        description: `${data.plan.name} Plan`,
        order_id: data.order.id,

        handler: async (response) => {
          try {
            const result = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (!result?.success) {
              throw new Error(result?.message || "Payment verification failed");
            }

            const updatedUser = await getCurrentUser();

            dispatch(setUserData(updatedUser));
            onClose();
          } catch (error) {
            console.error("Payment verification error:", error);

            setPaymentError(
              error.response?.data?.message ||
                error.message ||
                "Payment verification failed. Contact support if money was deducted.",
            );
          } finally {
            setProcessingPlan(null);
          }
        },

        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          },
          escape: true,
          confirm_close: true,
        },

        theme: {
          color: "#FFFFFF",
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response.error);

        setPaymentError(
          response.error?.description || "Payment failed. Please try again.",
        );

        setProcessingPlan(null);
      });

      razorpay.open();
    } catch (error) {
      console.error("Checkout error:", error);

      setPaymentError(
        error.response?.data?.message ||
          error.message ||
          "Unable to initiate payment",
      );

      setProcessingPlan(null);
    }
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              type: "tween",
              duration: 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-title"
            className="
              fixed inset-y-0 left-0 z-50
              flex h-dvh w-full max-w-md flex-col
              overflow-y-auto overscroll-contain
              border-r border-white/10
              bg-[#090909] text-white
              shadow-2xl shadow-black/50
              scrollbar-none
            "
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#090909]/95 px-5 py-5 backdrop-blur-xl sm:px-7">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles size={14} className="text-neutral-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
                    NoBound AI
                  </span>
                </div>

                <h2
                  id="billing-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  Billing & Plans
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close billing drawer"
                className="
                  rounded-xl border border-white/10
                  bg-white/3 p-2.5 text-neutral-400
                  transition-all duration-200
                  hover:border-white/20 hover:bg-white/10
                  hover:text-white
                "
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-7 px-5 py-6 sm:px-7">
              {/* Current Plan */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-400">
                    Your subscription
                  </p>

                  <span className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[10px] font-medium text-neutral-300">
                    CURRENT PLAN
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-linear-to-br from-white/9 to-white/1.5 p-5">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/4 blur-3xl" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-neutral-400">Currently on</p>

                      <h3 className="mt-1 text-2xl font-semibold tracking-tight">
                        {currentPlan}
                      </h3>

                      <p className="mt-2 text-xs text-neutral-500">
                        Your AI workspace, your way.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/6 p-3">
                      <Crown size={22} strokeWidth={1.6} />
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="relative mt-7 border-t border-white/8 pt-5">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-neutral-400">
                          Available credits
                        </p>

                        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                          {credits.toLocaleString("en-IN")}
                          <span className="ml-1 text-sm font-normal text-neutral-500">
                            / {totalCredits.toLocaleString("en-IN")}
                          </span>
                        </p>
                      </div>

                      <span className="pb-1 text-xs text-neutral-400">
                        {Math.round(usage)}% remaining
                      </span>
                    </div>

                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                      role="progressbar"
                      aria-label="Remaining AI credits"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(usage)}
                    >
                      <motion.div
                        initial={false}
                        animate={{ scaleX: usage / 100 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{ transformOrigin: "right center" }}
                        className="h-full w-full rounded-full bg-white"
                      />
                    </div>

                    <p className="mt-2.5 text-[11px] text-neutral-500">
                      Credits available for your AI tools and workflows.
                    </p>
                  </div>
                </div>
              </section>

              {paymentError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
                >
                  {paymentError}
                </div>
              )}

              {/* Plans */}
              <section>
                <div className="mb-4">
                  <h3 className="text-base font-semibold tracking-tight">
                    Choose your plan
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    More credits. More possibilities. No unnecessary complexity.
                  </p>
                </div>

                <div className="space-y-3">
                  {plans.map((plan, index) => {
                    const isCurrent =
                      currentPlan.toLowerCase() === plan.name.toLowerCase();

                    return (
                      <motion.div
                        key={plan.name}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.08,
                        }}
                        className={`
                          relative overflow-hidden rounded-2xl
                          border p-4 transition-colors duration-200
                          ${
                            plan.popular
                              ? "border-white/25 bg-white/5.5"
                              : "border-white/10 bg-white/2 hover:border-white/20"
                          }
                        `}
                      >
                        {plan.popular && (
                          <div className="absolute right-0 top-0 rounded-bl-xl bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-black">
                            Recommended
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/6">
                                {plan.popular ? (
                                  <Zap size={15} />
                                ) : (
                                  <Sparkles size={15} />
                                )}
                              </div>

                              <h4 className="text-sm font-semibold">
                                {plan.name}
                              </h4>
                            </div>

                            <p className="mt-3 text-xs text-neutral-500">
                              {plan.description}
                            </p>
                          </div>

                          <div className="shrink-0 pt-2 text-right">
                            <div className="flex items-baseline justify-end gap-0.5">
                              <span className="text-sm text-neutral-400">
                                ₹
                              </span>
                              <span className="text-2xl font-semibold tracking-tight">
                                {plan.price}
                              </span>
                            </div>

                            <p className="mt-0.5 text-[10px] text-neutral-500">
                              per month
                            </p>
                          </div>
                        </div>

                        <div className="my-4 border-t border-white/8" />

                        <div className="mb-4 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.07]">
                            <Zap size={13} />
                          </div>

                          <div>
                            <span className="text-sm font-medium">
                              {plan.credits.toLocaleString("en-IN")} credits
                            </span>
                            <span className="ml-1.5 text-[10px] text-neutral-500">
                              / month
                            </span>
                          </div>
                        </div>

                        <ul className="mb-5 space-y-2.5">
                          {plan.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-center gap-2.5 text-xs text-neutral-400"
                            >
                              <Check
                                size={14}
                                className="shrink-0 text-neutral-200"
                              />
                              {feature}
                            </li>
                          ))}
                        </ul>

                        <button
                          type="button"
                          disabled={isCurrent || isPaying}
                          onClick={() => handleUpgrade(plan)}
                          className={`
                            flex w-full items-center justify-center gap-2
                            rounded-xl px-4 py-3 text-xs font-semibold
                            transition-all duration-200
                            ${
                              isCurrent || isPaying
                                ? "cursor-not-allowed border border-white/10 bg-white/4 text-neutral-500"
                                : plan.popular
                                  ? "bg-white text-black hover:bg-neutral-200"
                                  : "border border-white/15 bg-white/4 text-white hover:bg-white/9"
                            }
                          `}
                        >
                          {processingPlan === plan.name
                            ? "Processing..."
                            : isCurrent
                              ? "Current Plan"
                              : `Upgrade to ${plan.name}`}

                          {!isCurrent && !isPaying && (
                            <ArrowUpRight size={14} />
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>

              {/* Footer note */}
              <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                <p className="text-xs font-medium text-neutral-300">
                  Need a different plan?
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-neutral-500">
                  Choose the plan that fits your workflow. Payment and
                  subscription management can be connected here.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 px-5 py-4 sm:px-7">
              <p className="text-center text-[10px] tracking-wide text-neutral-600">
                NOBOUND AI · BUILT FOR WHAT'S NEXT
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default BillingDrawer;
