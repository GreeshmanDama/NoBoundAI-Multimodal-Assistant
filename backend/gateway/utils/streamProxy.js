// utils/StreamProxy.js
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

export const StreamProxy = (serviceUrl) =>
  createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    proxyTimeout: 0, // don't cut long streams
    timeout: 0,
    on: {
      proxyReq: (proxyReq, req) => {
        console.log("Proxying request:", req.method, req.originalUrl);
        console.log("Target service:", serviceUrl);

        if (req.user) {
          proxyReq.setHeader("x-user-id", req.user.userId);
        }

        // Re-send bodies already parsed by express.json()/urlencoded().
        fixRequestBody(proxyReq, req);
      },
      proxyRes: (proxyRes) => {
        proxyRes.headers["cache-control"] = "no-cache, no-transform";
        proxyRes.headers["x-accel-buffering"] = "no";
      },
    },
  });