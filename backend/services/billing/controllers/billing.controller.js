import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";

import { PLANS } from "../config/plans.js";
import razorpay from "../config/razorpay.js";
import Payment from "../models/payment.js";

dotenv.config();

const getInternalHeaders = () => ({
  "x-internal-service-key": process.env.INTERNAL_SERVICE_KEY,
});

export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const selectedPlan = PLANS[plan];

    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    const amountInRupees = Number(selectedPlan.amount);
    const credits = Number(selectedPlan.credits);
    const amountInPaise = Math.round(amountInRupees * 100);

    if (
      !Number.isSafeInteger(amountInPaise) ||
      amountInPaise < 100 ||
      !Number.isSafeInteger(credits) ||
      credits <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan configuration",
      });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `nb-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      notes: {
        userId: String(userId),
        plan: selectedPlan.id,
      },
    });

    await Payment.create({
      userId: String(userId),
      orderId: order.id,
      amount: amountInRupees,
      credits,
      plan: selectedPlan.id,
      currency: order.currency,
      status: "created",
    });

    return res.status(201).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      plan: {
        name: selectedPlan.name,
        id: selectedPlan.id,
        credits,
      },
    });
  } catch (error) {
    console.error("[BILLING] Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create payment order",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification fields",
      });
    }

    if (
      typeof razorpay_signature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature format",
      });
    }

    const payment = await Payment.findOne({
      orderId: razorpay_order_id,
      userId: String(userId),
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    // Verify the signature using the server-side secret.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const receivedBuffer = Buffer.from(razorpay_signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed",
      });
    }

    // Confirm the payment directly with Razorpay.
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      razorpayPayment.status !== "captured" ||
      razorpayPayment.amount !== Math.round(Number(payment.amount) * 100) ||
      razorpayPayment.currency !== payment.currency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured or payment details do not match",
      });
    }

    // Already completed: never grant credits again.
    if (payment.status === "paid") {
      if (payment.paymentId !== razorpay_payment_id) {
        return res.status(409).json({
          success: false,
          message: "This order was completed with another payment",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
      });
    }

    // Atomically claim this order for this specific payment ID.
    // A retry using the same ID is allowed; another ID is rejected.
    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { status: "created", paymentId: null },
          { status: "created", paymentId: { $exists: false } },
          { status: "processing", paymentId: razorpay_payment_id },
        ],
      },
      {
        $set: {
          status: "processing",
          paymentId: razorpay_payment_id,
        },
      },
      {
        new: true,
      },
    );

    if (!claimedPayment) {
      const latestPayment = await Payment.findById(payment._id);

      if (
        latestPayment?.status === "paid" &&
        latestPayment.paymentId === razorpay_payment_id
      ) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Payment is already being processed or was claimed by another payment",
      });
    }

    // Auth uses processedPaymentIds to ensure the payment grants
    // credits exactly once, even if this request is retried.
    const authResponse = await axios.post(
      `${process.env.AUTH_SERVICE}/update-plan`,
      {
        plan: claimedPayment.plan,
        credits: claimedPayment.credits,
        userId: claimedPayment.userId,
        paymentId: razorpay_payment_id,
      },
      {
        headers: getInternalHeaders(),
        timeout: 15000,
      },
    );

    if (!authResponse.data?.success) {
      throw new Error("Auth service did not confirm credit allocation");
    }

    // Only mark the payment paid after Auth confirms success.
    await Payment.updateOne(
      {
        _id: claimedPayment._id,
        status: "processing",
        paymentId: razorpay_payment_id,
      },
      {
        $set: {
          status: "paid",
          creditedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified and credits activated successfully",
    });
  } catch (error) {
    console.error(
      "[BILLING] Payment verification error:",
      error.response?.data || error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Payment verification or plan activation failed",
    });
  }
};
