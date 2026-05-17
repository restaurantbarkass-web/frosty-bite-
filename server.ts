import express, { Request, Response, NextFunction } from "express";
import baseApp from "./server/app";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = baseApp;
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only log API requests in detail to keep logs clean
    if (req.url.startsWith('/api/')) {
      console.log(`[Server] API Request: ${req.method} ${req.url}`);
    }
    next();
  });

  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);

  // Serve static files in production or if dist exists
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production";
  const hasDist = fs.existsSync(distPath);

  // Priority 1: Vite middleware for development (only if NOT in production)
  if (!isProduction) {
    console.log("[Server] Mounting Vite middleware (Dev Mode)...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    // Priority 2: Serve static files in production
    console.log(`[Server] Serving static files from ${distPath} (Production Mode)...`);
    app.use(express.static(distPath));
    
    // API routes are already handled in app.ts, this is the fallback for SPA
    // Use the string '*' which works for catch-all in Express 5 if handled correctly,
    // or use the regex /^(?!\/api).*/ to skip API routes
    app.get(/^(?!\/api).*/, (req, res, next) => {
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
