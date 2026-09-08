import { createRequire } from "module";

const require = createRequire(import.meta.url);

let cachedApp: any = null;

function getApp() {
  if (!cachedApp) {
    let appModule: any;
    try {
      // 1. Load pre-bundled CommonJS application built during build phase
      appModule = require("../dist/app.cjs");
    } catch (err: any) {
      console.warn("[Vercel] Note: dist/app.cjs not found, attempting direct load:", err?.message || err);
      try {
        appModule = require("../server/app");
      } catch (err2: any) {
        console.error("[Vercel] Failed to load server app:", err2);
        throw err;
      }
    }
    cachedApp = appModule.default || appModule;
  }
  return cachedApp;
}

export default function handler(req: any, res: any) {
  const rawUrl = req.url || "/";
  const urlPath = rawUrl.split("?")[0];
  const matchedPath = (req.headers && req.headers["x-matched-path"]) ? String(req.headers["x-matched-path"]).split("?")[0] : "";

  // Dedicated lightweight health endpoint - no database, no auth, no heavy dependencies
  if (
    urlPath === "/ping" || 
    urlPath === "/api/ping" || 
    urlPath === "/api/index.ts/ping" ||
    matchedPath === "/ping" ||
    matchedPath === "/api/ping"
  ) {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      ok: true,
      service: "frosty-bite",
      status: "healthy"
    });
  }

  // Route to full application for all other requests
  const app = getApp();
  return app(req, res);
}
