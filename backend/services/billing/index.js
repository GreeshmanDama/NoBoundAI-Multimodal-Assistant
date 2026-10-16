import express from "express";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
import billingRoute from "./routes/route.js";
dotenv.config();

const app = express()
app.use(express.json())

app.use("/", billingRoute)

app.use("/", (req, res) => {
    res.json({
        message: "Billing is ready."
    })
})

const PORT = process.env.PORT || 8004
app.listen(PORT, () => {
    console.log(`Billing is running at port: ${PORT}`);
    connectDB();
})