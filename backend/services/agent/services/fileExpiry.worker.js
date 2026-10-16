
import cloudinary from "../config/cloudinary.js";
import FileExpiry from "../models/fileExpiry.js";

const POLL_INTERVAL_MS = 15_000;
const STALE_LOCK_MS = 2 * 60_000;
const MAX_ATTEMPTS = 10;

let running = false;

async function deleteExpiredFile(job) {
  try {
    const result = await cloudinary.uploader.destroy(job.publicId, {
      resource_type: job.resourceType,
      type: job.deliveryType,
      invalidate: true,
    });

    // Treat an already-absent asset as successfully deleted.
    if (!["ok", "not found"].includes(result?.result)) {
      throw new Error(
        `Unexpected Cloudinary deletion result: ${result?.result}`
      );
    }

    await FileExpiry.deleteOne({
      _id: job._id,
      status: "processing",
    });

    console.log("Expired file deleted:", {
      publicId: job.publicId,
      resourceType: job.resourceType,
    });
  } catch (error) {
    // The claimed job's attempts value is the previous attempt count.
    const attempts = (job.attempts || 0) + 1;
    const permanentlyFailed = attempts >= MAX_ATTEMPTS;

    // Exponential retry delay, capped at 1 hour.
    const delayMs = Math.min(
      60_000 * 2 ** Math.min(attempts - 1, 6),
      60 * 60_000
    );

    await FileExpiry.updateOne(
      { _id: job._id, status: "processing" },
      {
        $set: {
          status: permanentlyFailed ? "failed" : "pending",
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lastError: error.message,
        },
      }
    );

    console.error("File deletion failed:", {
      publicId: job.publicId,
      resourceType: job.resourceType,
      attempts,
      permanentlyFailed,
      error: error.message,
    });
  }
}

async function processExpiredFiles() {
  if (running || !FileExpiry.db.readyState) return;

  running = true;

  try {
    // Recover jobs abandoned by a crashed or restarted worker.
    await FileExpiry.updateMany(
      {
        status: "processing",
        lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) },
      },
      {
        $set: {
          status: "pending",
          lockedAt: null,
          nextAttemptAt: new Date(),
        },
      }
    );

    while (true) {
      // Atomically claim one eligible job.
      const job = await FileExpiry.findOneAndUpdate(
        {
          status: "pending",
          expiresAt: { $lte: new Date() },
          nextAttemptAt: { $lte: new Date() },
        },
        {
          $set: {
            status: "processing",
            lockedAt: new Date(),
          },
        },
        {
          sort: { expiresAt: 1 },
          returnDocument: "after",
        }
      ).lean();

      if (!job) break;

      await deleteExpiredFile(job);
    }
  } catch (error) {
    console.error("File expiry worker error:", error);
  } finally {
    running = false;
  }
}

export function startFileExpiryWorker() {
  // Run once immediately, then poll periodically.
  void processExpiredFiles();

  const timer = setInterval(
    () => void processExpiredFiles(),
    POLL_INTERVAL_MS
  );

  timer.unref();

  return () => clearInterval(timer);
}
