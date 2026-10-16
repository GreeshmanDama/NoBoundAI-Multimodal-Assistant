import express from "express";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import agentRouter from "./routes/agent.router.js";
import { startFileExpiryWorker } from "./services/fileExpiry.worker.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.json({ limit: "25mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use("/", (err,req,res,next) => {
  console.log(err)

  if(err.status){
    return res.status(err.status).json(err.data)
  }

  return res.status(500).json({message:`agent error ${err}`})
})

app.use("/", agentRouter);

const PORT = process.env.PORT || 8003;

async function startServer() {
  try {
    await connectDB();

    startFileExpiryWorker();

    app.listen(PORT, () => {
      console.log(`Agent is running at port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start agent:", error);
    process.exit(1);
  }
}

startServer();