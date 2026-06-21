import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Initialize environment variables first thing before routes are loaded
const envPath = path.resolve(process.cwd(), ".env");
const emgPath = path.resolve(process.cwd(), ".env.example");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (process.env.NODE_ENV !== "production" && fs.existsSync(emgPath)) {
  try {
    const exampleConfig = dotenv.parse(fs.readFileSync(emgPath));
    for (const k in exampleConfig) {
      if (k.startsWith("SMTP_") || !process.env[k] || process.env[k] === "") {
        process.env[k] = exampleConfig[k];
      }
    }
  } catch (err) {
    console.warn('[App] Error parsing .env.example:', err);
  }
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import butlerRoutes from "./routes/butler.routes";
import avatarRoutes from "./routes/avatar.routes";
import authRoutes from "./routes/auth.routes";
import configRoutes from "./routes/config.routes";
import notificationRoutes from "./routes/notification.routes";
import servicezonesRoutes from "./routes/servicezones.routes";
import servicepincodesRoutes from "./routes/servicepincodes.routes";
import validateaddressRoutes from "./routes/validateaddress.routes";
import deliveryareasRoutes from "./routes/deliveryareas.routes";
import reviewsRoutes from "./routes/reviews.routes";
import searchRoutes from "./routes/search.routes";

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

// Normalize req.url path if it starts with '/api' for Vercel Serverless environment compatibility.
// If Vercel delegates routing directly to the functions folder, this unprefixes the path so Express routes match correctly.
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// 2. Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: [
        "'self'",
        "https:",
        "wss:",
        "http:",
        "ws:",
        "https://*.googleapis.com",
        "https://*.firebaseio.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: [
        "'self'",
        "https://*.google.com",
        "https://*.web.app",
        "https://*.run.app",
        "https://*.aistudio.google",
        "https://*.cloud.google",
        "https://*.cloud",
        "https://*.run"
      ]
    }
  },
  frameguard: false, // Kept false to support the AI Studio iframe preview environment safely
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(cors((req: any, callback: any) => {
  const origin = req.header('Origin');
  const host = req.header('Host');
  
  let isAllowed = false;
  if (!origin) {
    isAllowed = true;
  } else {
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
      isAllowed = true;
    } else {
      const allowedOrigins = [
        "capacitor://localhost",
        "ionic://localhost"
      ];

      try {
        const url = new URL(origin);
        isAllowed = allowedOrigins.includes(origin) ||
                          url.hostname === "localhost" ||
                          (host ? url.host === host : false) ||
                          url.hostname.endsWith(".run.app") ||
                          url.hostname.endsWith(".supabase.co") ||
                          url.hostname.endsWith("firebaseapp.com") ||
                          url.hostname.endsWith(".vercel.app") ||
                          url.hostname.endsWith(".netlify.app") ||
                          url.hostname.endsWith(".pages.dev") ||
                          url.hostname.endsWith(".github.io") ||
                          origin.startsWith('https://');
      } catch (_) {
        isAllowed = false;
      }
    }
  }

  callback(null, {
    origin: isAllowed,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  });
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
app.get("/migration-script", (req, res) => {
  try {
    const migrationPath = path.resolve(process.cwd(), "supabase_migration.sql");
    if (fs.existsSync(migrationPath)) {
      const sqlText = fs.readFileSync(migrationPath, "utf-8");
      res.json({ sql: sqlText });
    } else {
      res.status(404).json({ error: "Migration script not found on server." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/butler", butlerRoutes);
app.use("/avatar", avatarRoutes);
app.use("/auth", authRoutes);
app.use("/config", configRoutes);
app.use("/notifications", notificationRoutes);
app.use("/service-zones", servicezonesRoutes);
app.use("/service-pincodes", servicepincodesRoutes);
app.use("/validate-address", validateaddressRoutes);
app.use("/delivery-areas", deliveryareasRoutes);
app.use("/reviews", reviewsRoutes);
app.use("/search", searchRoutes);

// Safe mask for keys
const maskKey = (key: any) => {
  if (!key || typeof key !== "string") return "not-set";
  if (key.length <= 12) return "set-but-too-short";
  return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
};

// Diagnostic endpoint
app.get("/debug-address", async (req, res) => {
  const report: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || "not-set",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? "set" : "not-set",
      SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "not-set",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "not-set",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? "set" : "not-set",
    },
    variablesMasked: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "using-fallback",
      SUPABASE_SERVICE_ROLE_KEY: maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
      VITE_SUPABASE_ANON_KEY: maskKey(process.env.VITE_SUPABASE_ANON_KEY),
    },
    supabaseReachability: {
      status: "untested",
      error: null,
      dataSample: null,
    }
  };

  try {
    const { supabase } = await import("./lib/supabase");
    const { data, error } = await supabase.from("service_zones").select("*").limit(2);
    if (error) {
      report.supabaseReachability.status = "failed";
      report.supabaseReachability.error = error;
    } else {
      report.supabaseReachability.status = "connected";
      report.supabaseReachability.dataSample = data;
    }
  } catch (err: any) {
    report.supabaseReachability.status = "exception";
    report.supabaseReachability.error = {
      message: err.message,
      stack: err.stack,
    };
  }

  res.json(report);
});

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
