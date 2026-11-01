import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import protect from "./middleware/auth.middleware.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import { ProxyWithHeader } from "./utils/ProxyWithHeader.js";
import { StreamProxy } from "./utils/streamProxy.js";
dotenv.config();

const app = express();

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://4x632ts6-5173.inc1.devtunnels.ms",
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());

app.use((req, res, next) => {
  console.log("Gateway incoming request:", req.method, req.originalUrl);
  next();
});

app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  ProxyWithHeader(process.env.BILLING_SERVICE, {
    parseReqBody: false,
  }),
);

app.use(express.json({ limit: "25mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use(
  "/api/auth",
  (req, res, next) => {
    if (req.path === "/update-plan") {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    next();
  },
  proxy(process.env.AUTH_SERVICE),
);

app.use("/api/chat", protect, ProxyWithHeader(process.env.CHAT_SERVICE));

app.use("/api/agent", protect, StreamProxy(process.env.AGENT_SERVICE));

app.use("/api/billing", protect, ProxyWithHeader(process.env.BILLING_SERVICE));

app.get("/api/me", protect, getCurrentUser);

app.get("/", (req, res) => {
  res.json({
    message: "Gateway is running",
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Gateway is running on port ${PORT}`);
});
