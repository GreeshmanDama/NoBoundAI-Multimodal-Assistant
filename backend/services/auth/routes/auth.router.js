import express from "express";
import { deductCredits, login, logOut, updateUserPayment } from "../controllers/auth.controller.js";

const authRouter = express.Router()

authRouter.post("/login", login)
authRouter.post("/logout", logOut)
authRouter.post("/update-plan", updateUserPayment)
authRouter.post("/deduct-credits", deductCredits)

export default authRouter;
