import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import morgan from "morgan";
import storyRoutes from "./routes/story.routes";
import paymentRoutes from "./routes/paymentRoutes";
import authRoutes from "./routes/authRoutes";
import healthRoutes from "./routes/healthRoutes";
import { errorHandler } from "./middleware/error.middleware";


const app = express();
const PORT = process.env.PORT || 8085;

// Middleware
app.use(cors());
app.use(morgan("dev")); // Add HTTP request logging
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/health", healthRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/auth", authRoutes);

// Error handling
app.use(errorHandler);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI as string;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });
