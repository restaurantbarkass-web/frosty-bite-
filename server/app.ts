import express from "express";
import cors from "cors";

const app = express();

// Security Middlewares
app.use(cors({
  origin: "*",
  credentials: true
}));

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
    hasGemini: !!process.env.GEMINI_API_KEY
  });
});

// Comprehensive 404/405 handler for API
app.all("/api/(.*)", (req, res) => {
  res.status(404).json({ error: `API Endpoint ${req.originalUrl} not found` });
});

export default app;
