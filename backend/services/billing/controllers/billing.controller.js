import { PLANS } from "../config/plans.js";
import razorpay from "../config/razorpay.js";
import Payment from "../models/payment.js";
import axios from "axios";
import crypto from "crypto";

export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.headers["x-user-id"];

    const selectedPlan = PLANS[plan];

    if (!selectedPlan) {
      return res.status(404).json({ messahe: "plan not found" });
    }

    const order = await razorpay.orders.create({
      amount: selectedPlan.amount * 100,
      currency: "INR",
      receipt: `receipt-${Date.now()}`,
    });

    await Payment.create({
      userId,
      orderId: order.id,
      amount: selectedPlan.amount,
      credits: selectedPlan.credits,
      plan: selectedPlan.id,
      currency: order.currency,
      status: "created",
    });

    return res.status(200).json({ order, plan: selectedPlan });
  } catch (error) {
    console.log("error in billing controller: ", error);
    return res.status(500).json({
      message: `Billing error payment fails: ${error}`,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment Verification Failed" });
    }

    const payment = await Payment.findOne({ orderId: razorpay_order_id });

    if (!payment) {
      return res.status(400).json({ message: "Payment Not Found" });
    }

    payment.status = "paid";
    payment.paymentId = razorpay_payment_id;

    await payment.save();

    console.log("payment: ",payment);

    await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
      plan: payment.plan,
      credits: payment.credits,
      userId: payment.userId,
    });

    return res.status(200).json({ message: "Payment verified successfully" });
  } catch (error) {
    console.error(
      "Verify payment error:",
      error.response?.data || error.message,
    );

    console.error("Auth service status:", error.response?.status);
    console.error("Auth service URL:", error.config?.url);

    return res.status(500).json({
      message: "Payment verification or plan activation failed",
      error: error.response?.data || error.message,
    });
  }
};
