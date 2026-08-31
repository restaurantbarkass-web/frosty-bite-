import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Initialize environment variables first thing before routes are loaded
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import butlerRoutes from "./routes/butler.routes";
import avatarRoutes from "./routes/avatar.routes";
import authRoutes from "./routes/auth.routes";
import configRoutes from "./routes/config.routes";
import notificationRoutes from "./routes/notification.routes";
import validateaddressRoutes from "./routes/validateaddress.routes";
import reviewsRoutes from "./routes/reviews.routes";
import searchRoutes from "./routes/search.routes";
import v2geofencingRoutes from "./routes/v2geofencing.routes";
import paymentRoutes from "./routes/payment.routes";

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
const isProd = process.env.NODE_ENV === "production";

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
        "https://*.firebaseio.com",
        "http://localhost:*",
        "ws://localhost:*"
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
  frameguard: false, // Must be false to support the AI Studio iframe preview environment safely
  hsts: isProd ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
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

app.use(["/butler", "/api/butler"], butlerRoutes);
app.use(["/avatar", "/api/avatar"], avatarRoutes);
app.use(["/auth", "/api/auth"], authRoutes);
app.use(["/config", "/api/config"], configRoutes);
app.use(["/notifications", "/api/notifications"], notificationRoutes);
app.use(["/validate-address", "/api/validate-address"], validateaddressRoutes);
app.use(["/reviews", "/api/reviews"], reviewsRoutes);
app.use(["/search", "/api/search"], searchRoutes);
app.use(["/v2", "/api/v2", "/api/geofencing", "/geofencing"], v2geofencingRoutes);
app.use(["/payment", "/api/payment"], paymentRoutes);

// Direct top-level aliases for cities, pincodes, localities, service-areas, and trending
app.get(["/cities", "/api/cities"], async (req, res) => {
  try {
    const { V2GeofencingService } = await import("./services/v2Geofencing.service");
    const cities = await V2GeofencingService.getCities();
    res.json(cities);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch cities", details: err.message });
  }
});

app.get(["/pincodes", "/api/pincodes"], async (req, res) => {
  try {
    const { V2GeofencingService } = await import("./services/v2Geofencing.service");
    const cityId = req.query.city_id as string | undefined;
    const pincodes = await V2GeofencingService.getPincodes(cityId);
    res.json(pincodes);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pincodes", details: err.message });
  }
});

app.get(["/localities", "/api/localities"], async (req, res) => {
  try {
    const { V2GeofencingService } = await import("./services/v2Geofencing.service");
    const cityId = req.query.city_id as string | undefined;
    const pincodeId = req.query.pincode_id as string | undefined;
    const localities = await V2GeofencingService.getLocalities(cityId, pincodeId);
    res.json(localities);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch localities", details: err.message });
  }
});

app.get(["/service-area", "/api/service-area", "/service-areas", "/api/service-areas"], async (req, res) => {
  try {
    const { V2GeofencingService } = await import("./services/v2Geofencing.service");
    const area = await V2GeofencingService.getServiceArea();
    res.json(area);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch service area", details: err.message });
  }
});

app.post(["/check", "/api/check", "/geofencing/check", "/api/geofencing/check"], async (req, res) => {
  try {
    const { V2GeofencingService } = await import("./services/v2Geofencing.service");
    const { latitude, longitude } = req.body || {};
    const result = await V2GeofencingService.checkServiceability({ latitude, longitude });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(500).json({ serviceable: false, reason: "INTERNAL_ERROR", message: "We currently don't deliver to this area." });
  }
});

app.get(["/trending", "/api/trending"], async (req, res) => {
  const limitCount = parseInt(req.query.limit as string, 10) || 6;
  const defaultTrending = [
    'Anniversary Cakes',
    'Chocolate Truffle',
    'Coffee Pastries',
    'Custom Gifts',
    'Cupcakes',
    'Fresh Fruit Cake'
  ];
  try {
    const { supabase } = await import("./lib/supabase");
    const { data, error } = await supabase
      .from('search_analytics')
      .select('query')
      .order('count', { ascending: false })
      .limit(limitCount);

    if (error || !data || data.length === 0) {
      return res.json(defaultTrending.slice(0, limitCount));
    }

    const queries = data.map((d: any) => d.query).filter(Boolean);
    if (queries.length < limitCount) {
      const combined = Array.from(new Set([...queries, ...defaultTrending]));
      return res.json(combined.slice(0, limitCount));
    }

    return res.json(queries.slice(0, limitCount));
  } catch {
    return res.json(defaultTrending.slice(0, limitCount));
  }
});

// Legacy Service Zones & Delivery Areas aliases
app.get(["/service-zones", "/api/service-zones"], async (req, res) => {
  try {
    const { supabase } = await import("./lib/supabase");
    const { data, error } = await supabase.from('service_zones').select('*');
    if (error) {
      // Fallback from V2 cities if legacy table does not exist
      const { V2GeofencingService } = await import("./services/v2Geofencing.service");
      const cities = await V2GeofencingService.getCities();
      return res.json(cities.map(c => ({ id: c.id, city_name: c.name, latitude: 20.2961, longitude: 85.8245, radius_meters: 15000, is_active: c.is_active })));
    }
    res.json(data || []);
  } catch (err: any) {
    res.json([]);
  }
});

app.get(["/service-pincodes", "/api/service-pincodes"], async (req, res) => {
  try {
    const { supabase } = await import("./lib/supabase");
    const { data, error } = await supabase.from('service_pincodes').select('*');
    if (error) {
      const { V2GeofencingService } = await import("./services/v2Geofencing.service");
      const pins = await V2GeofencingService.getPincodes();
      return res.json(pins.map(p => ({ id: p.id, pincode: p.pincode, active: p.is_active })));
    }
    res.json(data || []);
  } catch (err: any) {
    res.json([]);
  }
});

app.get(["/delivery-areas", "/api/delivery-areas"], async (req, res) => {
  try {
    const { supabase } = await import("./lib/supabase");
    const { data, error } = await supabase.from('delivery_areas').select('*');
    if (error) {
      const { V2GeofencingService } = await import("./services/v2Geofencing.service");
      const locs = await V2GeofencingService.getLocalities();
      return res.json(locs.map(l => ({ id: l.id, area_name: l.name, pincode: '', is_deliverable: l.is_active })));
    }
    res.json(data || []);
  } catch (err: any) {
    res.json([]);
  }
});

// Real-time order status endpoints
app.get("/orders/:orderId/status", async (req: Request, res: Response) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId parameter" });
  }

  try {
    const { supabase } = await import("./lib/supabase");
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error(`[App] Error fetching status for order ${orderId}:`, error);
      return res.status(500).json({ error: "Supabase database error", details: error.message });
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      orderId: order.id,
      status: order.status || "pending",
      payment_status: order.payment_status || "pending",
      estimated_delivery_time: order.estimated_delivery_time || null,
      estimated_arrival: order.estimated_arrival || null,
      updated_at: order.updated_at,
      order: order
    });
  } catch (err: any) {
    console.error(`[App] Unexpected error fetching status for order ${orderId}:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

app.get("/order-status/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId parameter" });
  }

  try {
    const { supabase } = await import("./lib/supabase");
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      console.error(`[App] Error fetching status for order ${orderId}:`, error);
      return res.status(500).json({ error: "Supabase database error", details: error.message });
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      orderId: order.id,
      status: order.status || "pending",
      payment_status: order.payment_status || "pending",
      estimated_delivery_time: order.estimated_delivery_time || null,
      estimated_arrival: order.estimated_arrival || null,
      updated_at: order.updated_at,
      order: order
    });
  } catch (err: any) {
    console.error(`[App] Unexpected error fetching status for order ${orderId}:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

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
    const { data, error } = await supabase.from("cities").select("*").limit(2);
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
