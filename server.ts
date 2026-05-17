import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
// Call dotenv.config() as early as possible
dotenv.config();

import baseApp from "./server/app";
import path from "path";
import fs from "fs";

const PORT = 3000;

async function startServer() {
  const app = baseApp;
  
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
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "server.cjs"));
  const hasDist = fs.existsSync(distPath);

  console.log(`[Server] Mode: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`[Server] Dist folder exists: ${hasDist}`);

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
      app.use(express.static(distPath));
    }
  } else {
    // Priority 2: Serve static files in production
    console.log(`[Server] Serving static files from ${distPath} (Production Mode)...`);
    app.use(express.static(distPath));
    
    // API routes are already handled in app.ts. This is the fallback for SPA routing.
    app.get('*all', (req, res, next) => {
      // Don't intercept API requests here, let them fall through to the 404 handler if they didn't match
      if (req.path.startsWith('/api')) {
        return next();
      }

      // If it looks like a file request but wasn't caught by express.static, it might be a missing asset or a 404
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        console.warn(`[Server] Static asset not found: ${req.url}`);
        return res.status(404).send("Not Found");
      }

      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.warn(`[Server] Fallback triggered but index.html not found at ${indexPath}`);
        next();
      }
    });
  }

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

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

startServer().catch(err => {
  console.error("[Server] ❌ FATAL STARTUP ERROR:", err);
  process.exit(1);
});
