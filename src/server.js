import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/connectDB.js";

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`),
    );

    const shutdown = async () => {
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
