import express from "express";
import { createOrder, verifyPayment } from "../controllers/billing.controller.js";

const billingRoute = express.Router();

billingRoute.post("/create", createOrder);
billingRoute.post("/verify", verifyPayment);

export default billingRoute;