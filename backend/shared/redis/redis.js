import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is missing");
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,

  retryStrategy(times) {
    const delay = Math.min(times * 500, 5000);

    console.warn(`[REDIS] Reconnecting in ${delay}ms (attempt ${times})`);

    return delay;
  },
});

redis.on("connect", () => {
  console.log("[REDIS] TCP connection established");
});

redis.on("ready", () => {
  console.log("[REDIS] Client ready to accept commands");
});

redis.on("reconnecting", (delay) => {
  console.warn(`[REDIS] Reconnecting after ${delay}ms`);
});

redis.on("close", () => {
  console.warn("[REDIS] Connection closed");
});

redis.on("end", () => {
  console.error("[REDIS] Connection ended; automatic reconnection stopped");
});

redis.on("error", (err) => {
  console.error("[REDIS] Connection error:", err.message);
});

export default redis;