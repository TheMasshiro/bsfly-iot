import mongoose from "mongoose";

// Connect to the MongoDB database
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
};

export default connectDB;
