import express from "express";
import connectDB from "./config/db.js";
import chatRouter from "./routes/chat.router.js";
import dotenv from "dotenv";
dotenv.config();

const app = express()
app.use(express.json())

app.use("/", chatRouter)

const PORT = process.env.PORT || 8002
app.listen(PORT, () => {
    console.log(`Chat is running at port: ${PORT}`);
    connectDB();
})