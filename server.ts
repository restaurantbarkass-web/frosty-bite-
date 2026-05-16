import express from "express";
import app from "./server/app";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Mounting Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[Server] FATAL STARTUP ERROR:", err);
});
