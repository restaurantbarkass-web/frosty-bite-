import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import fs from "fs";

// Load .env if it exists
if (fs.existsSync(".env")) {
  console.log("[Server] Loading .env configuration...");
  dotenv.config({ path: ".env" });
}

// Load .env.example to make sure any SMTP credentials or custom overrides are loaded
if (fs.existsSync(".env.example")) {
  console.log("[Server] Loading .env.example configuration and applying overrides...");
  const exampleConfig = dotenv.parse(fs.readFileSync(".env.example"));
  for (const k in exampleConfig) {
    // Prefer SMTP variables or any non-empty variable from .env.example if the process.env version is empty or missing
    if (k.startsWith("SMTP_") || !process.env[k] || process.env[k] === "") {
      process.env[k] = exampleConfig[k];
    }
  }
}

import baseApp from "./server/app";
import path from "path";

const PORT = 3000;

async function startServer() {
  const app = express();
  
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);
  console.log(`[Server] Gemini API Key present: ${!!process.env.GEMINI_API_KEY}`);
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Log basic info for all requests
    if (req.url.startsWith('/api/')) {
      console.log(`[Server] API: ${req.method} ${req.url}`);
    }
    next();
  });

  // Serve static files in production or if dist exists
  const distPath = path.join(process.cwd(), "dist");
  // Only enter production mode if NODE_ENV is set to production
  const isProduction = process.env.NODE_ENV === "production";
  const hasDist = fs.existsSync(distPath);

  console.log(`[Server] Mode: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`[Server] Dist folder exists: ${hasDist}`);

  // Mounting baseApp which contains all /api routes
  // It's important to mount this BEFORE Vite or static middlewares
  app.use("/api", baseApp);

  // Priority 1: Vite middleware for development (only if NOT in production)
  if (!isProduction) {
    console.log("[Server] Mounting Vite middleware (Dev Mode)...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd(),
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("[Server] Failed to load Vite middleware, falling back to static:", err);
      if (hasDist) {
        app.use(express.static(distPath));
      }
    }
  } else if (hasDist) {
    // Priority 2: Serve static files in production
    console.log(`[Server] Serving static files from ${distPath} (Production Mode)...`);
    app.use(express.static(distPath));
    
    // Explicit SPA fallback for non-API routes
    app.get('*all', (req, res, next) => {
      // Don't intercept API requests, asset folder, or files with extensions
      if (
        req.url.startsWith('/api') || 
        req.path.startsWith('/assets/') || 
        (path.extname(req.path) && !req.path.endsWith('.html'))
      ) {
        return next();
      }

      // Serve index.html for SPA routing
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  // Final 404 handler for anything that fell through (including failed API calls)
  app.use((req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ 
        error: "Not Found", 
        message: `API Endpoint ${req.method} ${req.originalUrl} not found` 
      });
    }
    res.status(404).send("Not Found");
  });

  // Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server] Unhandled Express Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] ✅ Production server is listening on 0.0.0.0:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });
}

process.on('unhandledRejection', (reason: any, promise) => {
  const errMessage = `[Server] Unhandled Rejection at: ${promise} reason: ${reason instanceof Error ? reason.stack || reason.message : reason}\n`;
  console.error(errMessage);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'server-crash.log'), errMessage);
  } catch (e) {}
});

process.on('uncaughtException', (err) => {
  const errMessage = `[Server] Uncaught Exception: ${err.stack || err.message || err}\n`;
  console.error(errMessage);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'server-crash.log'), errMessage);
  } catch (e) {}
  process.exit(1);
});

startServer().catch(err => {
  console.error("[Server] ❌ FATAL STARTUP ERROR:", err);
  process.exit(1);
});
