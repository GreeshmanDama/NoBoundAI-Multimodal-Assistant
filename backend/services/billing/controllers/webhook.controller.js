
import crypto from "crypto";
import axios from "axios";
import Payment from "../models/payment.js";

// Verify Razorpay webhook signature using the ORIGINAL raw body.
const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || !Buffer.isBuffer(rawBody) || !signature) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest();

  const receivedSignature = Buffer.from(signature, "hex");

  return crypto.timingSafeEqual(expectedSignature, receivedSignature);
};

export const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // 1. Verify the signature before parsing the payload.
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error("[WEBHOOK] Invalid Razorpay signature");

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // 2. Parse the verified raw body.
    const event = JSON.parse(req.body.toString("utf8"));

    console.log("[WEBHOOK] Received event:", event.event);

    // 3. Only captured payments grant credits.
    if (event.event === "payment.failed") {
      console.log("[WEBHOOK] Payment failed. No credits granted.");
      return res.status(200).json({ received: true });
    }

    if (event.event !== "payment.captured") {
      return res.status(200).json({ received: true });
    }

    const razorpayPayment = event.payload?.payment?.entity;

    if (
      !razorpayPayment?.id ||
      !razorpayPayment?.order_id ||
      razorpayPayment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid captured payment payload",
      });
    }

    // 4. Find the corresponding payment order.
    const payment = await Payment.findOne({
      orderId: razorpayPayment.order_id,
    });

    if (!payment) {
      console.error(
        "[WEBHOOK] Payment order not found:",
        razorpayPayment.order_id
      );

      // Return an error so Razorpay can retry delivery.
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    // 5. Verify payment details against our database.
    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (
      payment.amount == null ||
      Number(razorpayPayment.amount) !== expectedAmount ||
      razorpayPayment.currency !== payment.currency
    ) {
      console.error("[WEBHOOK] Payment amount/currency mismatch");

      return res.status(400).json({
        success: false,
        message: "Payment details do not match",
      });
    }

    // 6. Already processed?
    if (payment.status === "paid") {
      return res.status(200).json({
        received: true,
        duplicate: true,
      });
    }

    // 7. Activate the plan through the private Auth service.
    // Auth must implement paymentId-based idempotency.
    const authService = process.env.AUTH_SERVICE?.replace(/\/+$/, "");

    if (!authService || !process.env.INTERNAL_SERVICE_KEY) {
      throw new Error("Auth service configuration is missing");
    }

    await axios.post(
      `${authService}/update-plan`,
      {
        plan: payment.plan,
        credits: payment.credits,
        userId: payment.userId,
        paymentId: razorpayPayment.id,
      },
      {
        headers: {
          "x-internal-service-key": process.env.INTERNAL_SERVICE_KEY,
        },
        timeout: 15000,
      }
    );

    // 8. Mark payment as paid only after Auth confirms success.
    payment.status = "paid";
    payment.paymentId = razorpayPayment.id;
    await payment.save();

    console.log(
      "[WEBHOOK] Payment successfully processed:",
      razorpayPayment.id
    );

    return res.status(200).json({
      received: true,
      success: true,
    });
  } catch (error) {
    console.error(
      "[WEBHOOK] Processing error:",
      error.response?.data || error.message
    );

    // Non-2xx response allows Razorpay to retry.
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
