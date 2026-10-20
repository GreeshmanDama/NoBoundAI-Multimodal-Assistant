import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is missing");
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

<<<<<<< HEAD
redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

export default redis;
=======
export default redis;

// import Redis from "ioredis";

// const redisUrl = process.env.REDIS_URL;

// if (!redisUrl) {
//   throw new Error("REDIS_URL environment variable is missing");
// }

// const redis = new Redis(redisUrl, {
//   maxRetriesPerRequest: 3,
//   retryStrategy(times) {
//     return Math.min(times * 500, 5000);
//   },
// });

// redis.on("connect", () => {
//   console.log("Connected to Redis");
// });

// redis.on("error", (err) => {
//   console.error("Redis connection error:", err.message);
// });

// export default redis;
>>>>>>> 8a712fe (added file box in message bubble)
