import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import butlerRoutes from "./routes/butler.routes";
import avatarRoutes from "./routes/avatar.routes";
import authRoutes from "./routes/auth.routes";

const app = express();

// 1. Logging Middleware - run this first to see every request
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[App] Incoming Request: ${req.method} ${req.url}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[App] Response: ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 2. Security Middlewares
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

// Route Debugger - log if we hit this area
app.use("/avatar", (req, res, next) => {
  console.log(`[App] Avatar route reached: ${req.method} ${req.url}`);
  next();
});

// 3. Body Parsers - increased limit for safe AI context transmission
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health Check
app.get("/health", (req, res) => {
  console.log("[App] Health check hit");
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    hasGemini: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString()
  });
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Routes
app.use("/butler", butlerRoutes);
app.use("/avatar", avatarRoutes);
app.use("/auth", authRoutes);

// Detailed API 404 handler
app.use((req, res) => {
  console.warn(`[App] 404 hit: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Not Found",
    message: `API Endpoint ${req.method} ${req.originalUrl} not found`,
    path: req.originalUrl,
    method: req.method
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[Global Error]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred"
  });
});

export default app;
