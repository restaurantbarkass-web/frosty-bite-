import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiLimiter } from "./middleware/rateLimit";
import butlerRoutes from "./routes/butler.routes";
import avatarRoutes from "./routes/avatar.routes";

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: [
    "https://ais-dev-krfjonjkmvmohb4isfawvp-706739706976.asia-southeast1.run.app",
    "https://ais-pre-krfjonjkmvmohb4isfawvp-706739706976.asia-southeast1.run.app",
    "http://localhost:3000",
    "http://localhost:5173"
  ],
  credentials: true
}));

// Rate Limiting
app.use(apiLimiter);

// Body Parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Request Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    hasHf: !!process.env.HF_TOKEN,
    hasGemini: !!process.env.GEMINI_API_KEY
  });
});

// Routes
app.use("/api/butler", butlerRoutes);
app.use("/api/avatar", avatarRoutes);

// Comprehensive 404/405 handler for API
app.all("/api/:path*", (req, res) => {
  res.status(404).json({ error: `API Endpoint ${req.originalUrl} not found` });
});

export default app;
