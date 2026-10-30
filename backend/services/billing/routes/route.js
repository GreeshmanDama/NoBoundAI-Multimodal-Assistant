import express from "express";

import {
  createOrder,
  verifyPayment,
} from "../controllers/billing.controller.js";

import { razorpayWebhook } from "../controllers/webhook.controller.js";

const billingRoute = express.Router();

// Razorpay webhook — preserve the original raw request body.
billingRoute.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

// Existing payment APIs.
billingRoute.post("/create", createOrder);
billingRoute.post("/verify", verifyPayment);

export default billingRoute;
