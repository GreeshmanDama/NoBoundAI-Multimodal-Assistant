import redis from "../../shared/redis/redis.js";
import dotenv from "dotenv";

dotenv.config();

const protect = async (req, res, next) => {
  try {
    console.log("[AUTH] Started:", req.method, req.originalUrl);

    const sessionId = req.cookies?.session;

    console.log("[AUTH] Session cookie exists:", Boolean(sessionId));

    if (!sessionId) {
      console.log("[AUTH] Missing session cookie");

      return res.status(401).json({
        message: "Unauthorized: session cookie missing",
      });
    }

    console.log("[AUTH] Looking up session in Redis");

    const sessionData = await redis.get(`session-${sessionId}`);

    console.log("[AUTH] Redis lookup completed:", Boolean(sessionData));

    if (!sessionData) {
      console.log("[AUTH] Session not found in Redis");

      return res.status(401).json({
        message: "Unauthorized: session expired or invalid",
      });
    }

    req.user = JSON.parse(sessionData);

    console.log("[AUTH] User authenticated:", req.user.userId);
    console.log("[AUTH] Before next():", req.method);

    return next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error);

    return res.status(500).json({
      message: "Internal server error during authentication",
    });
  }
};

export default protect;