import express from "express";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.router.js";
import dotenv from "dotenv";
dotenv.config();

const app = express()
app.use(express.json())

app.use("/", authRouter)

const PORT = process.env.PORT || 8001
app.listen(PORT, () => {
    console.log(`Auth is running at port: ${PORT}`);
    connectDB();
})