import mongoose from "mongoose";

const CONNECTION_STRING = process.env.CONNECTION_STRING;

const connectDB = async () => {
  if (!CONNECTION_STRING)
    throw new Error("Database connection failed. Check the connection string");
  await mongoose.connect(CONNECTION_STRING);
  console.log("Database connected");
};

export default connectDB;
