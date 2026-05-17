import express from "express";
import cors from "cors";
import butlerRoutes from "./routes/butler.routes";
import avatarRoutes from "./routes/avatar.routes";

const app = express();

// 1. Logging Middleware - run this first to see every request
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[Incoming] ${req.method} ${req.url}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.url.startsWith('/api/')) {
      console.log(`[Response] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 2. Security Middlewares
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

// 3. Body Parsers - increased limit for safe AI context transmission
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health Check
app.get("/api/health", (req, res) => {
  console.log("[App] Health check hit");
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    hasGemini: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString()
  });
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

// Routes
app.use("/api/butler", butlerRoutes);
app.use("/api/avatar", avatarRoutes);

// Comprehensive 404/405 handler for API
app.use("/api", (req, res) => {
  console.warn(`[App] 404 hit for API route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Not Found",
    message: `API Endpoint ${req.originalUrl} not found`,
    path: req.originalUrl,
    method: req.method
  });
});

export default app;
