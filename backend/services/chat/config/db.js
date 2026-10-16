import mongoose from "mongoose";

const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI)
        console.log("DB connected");
    }catch (error) {
        console.log("DB connection error (chat)", error);
    }
}

export default connectDB;