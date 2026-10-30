import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";

export const login = async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = await getAuth(app).verifyIdToken(token);
    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name,
        email: decoded.email,
        avatar: decoded.picture,
      });
    }

    const sessionId = crypto.randomUUID();

    await redis.set(
      `user-session-${user?._id}`,
      sessionId,
      "EX",
      7 * 24 * 60 * 60,
    );

    await redis.set(
      `session-${sessionId}`,
      JSON.stringify({
        userId: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
        planExpiresAt: user.planExpiresAt,
      }),
      "EX",
      7 * 24 * 60 * 60,
    );

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log("[LOGIN] Session cookie configured");
    console.log("[LOGIN] Request origin:", req.headers.origin);
    console.log(
      "[LOGIN] Forwarded protocol:",
      req.headers["x-forwarded-proto"],
    );

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      message: `Login Error ${error}`,
    });
  }
};

export const logOut = async (req, res) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      const sessionData = await redis.get(`session-${sessionId}`);

      if (sessionData) {
        const { userId } = JSON.parse(sessionData);

        await redis.del(`user-session-${userId}`);
      }

      await redis.del(`session-${sessionId}`);
    }

    res.clearCookie("session", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);

    return res.status(500).json({
      message: "Logout failed",
    });
  }
};

export const updateUserPayment = async (req, res) => {
  try {
    const serviceKey = req.headers["x-internal-service-key"];

    if (
      !process.env.INTERNAL_SERVICE_KEY ||
      serviceKey !== process.env.INTERNAL_SERVICE_KEY
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const { plan, credits, userId, paymentId } = req.body;

    if (!plan || !userId || !paymentId || credits == null) {
      return res.status(400).json({
        success: false,
        message: "plan, userId, credits, and paymentId are required",
      });
    }

    const creditAmount = Number(credits);

    if (
      !Number.isSafeInteger(creditAmount) ||
      creditAmount <= 0 ||
      typeof paymentId !== "string" ||
      paymentId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment or credit details",
      });
    }

    // Atomic operation:
    // A payment ID can only be added and credited once.
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        processedPaymentIds: { $ne: paymentId },
      },
      {
        $addToSet: {
          processedPaymentIds: paymentId,
        },
        $inc: {
          credits: creditAmount,
          totalCredits: creditAmount,
        },
        $set: {
          plan,
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // If no update occurred, determine whether this is a duplicate
    // payment or the user does not exist.
    if (!user) {
      const existingUser = await User.findById(userId);

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (existingUser.processedPaymentIds?.includes(paymentId)) {
        // Duplicate request: payment was already credited.
        // Continue below to refresh Redis in case a previous request
        // updated MongoDB but failed before refreshing the session.
        await refreshUserSession(existingUser);

        return res.status(200).json({
          success: true,
          duplicate: true,
          message: "Payment was already processed",
          user: {
            plan: existingUser.plan,
            credits: existingUser.credits,
            totalCredits: existingUser.totalCredits,
            planExpiresAt: existingUser.planExpiresAt,
          },
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment could not be processed",
      });
    }

    await refreshUserSession(user);

    return res.status(200).json({
      success: true,
      duplicate: false,
      message: "Payment processed and credits added successfully",
      user: {
        plan: user.plan,
        credits: user.credits,
        totalCredits: user.totalCredits,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch (error) {
    console.error("[AUTH] Payment update error:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating user payment",
    });
  }
};

const refreshUserSession = async (user) => {
  const sessionId = await redis.get(`user-session-${user._id}`);

  if (!sessionId) return;

  await redis.set(
    `session-${sessionId}`,
    JSON.stringify({
      userId: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
      credits: user.credits,
      totalCredits: user.totalCredits,
      planExpiresAt: user.planExpiresAt,
    }),
    "EX",
    7 * 24 * 60 * 60,
  );
};

export const deductCredits = async (req, res) => {
  try {
    const { userId, agent } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const COST = {
      chat: 1,
      code: 5,
      pdf: 5,
      ppt: 5,
      search: 4,
      vision: 10,
    };

    const requiredCredits = COST[agent];

    if (!requiredCredits) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        credits: { $gte: requiredCredits },
      },
      {
        $inc: { credits: -requiredCredits },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      const exists = await User.exists({ _id: userId });

      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? "Not enough credits" : "User not found",
      });
    }

    // Synchronize the cached session with the new balance.
    const sessionId = await redis.get(`user-session-${user._id}`);

    if (sessionId) {
      const sessionKey = `session-${sessionId}`;
      const cachedSession = await redis.get(sessionKey);

      if (cachedSession) {
        const session = JSON.parse(cachedSession);

        await redis.set(
          sessionKey,
          JSON.stringify({
            ...session,
            credits: user.credits,
            totalCredits: user.totalCredits,
            plan: user.plan,
            planExpiresAt: user.planExpiresAt,
          }),
          "EX",
          7 * 24 * 60 * 60,
        );
      }
    }

    return res.status(200).json({
      success: true,
      credits: user.credits,
      deducted: requiredCredits,
    });
  } catch (error) {
    console.error("Error deducting credits:", error);

    return res.status(500).json({
      success: false,
      message: "Error deducting user credits",
    });
  }
};
