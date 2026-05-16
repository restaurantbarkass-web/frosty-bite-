import express from "express";
import app from "./server/app.ts";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function startServer() {
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);

  // Workers must be imported to start
  console.log("[Server] Initializing workers...");
  try {
    await import("./server/workers/avatar.worker");
    console.log("[Server] Workers initialized.");
  } catch (err: any) {
    console.error("[Server] Worker initialization failed:", err.message);
  }

  // Vite middleware or static files
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    });
    app.use(vite.middlewares);

    // Dev SPA Fallback
    app.get("/:path*", async (req, res, next) => {
      // API routes should never fall through to SPA
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      
      const parsedPath = path.parse(req.path);
      if (parsedPath.ext && !['.html', '.php', '.asp'].includes(parsedPath.ext.toLowerCase())) {
        if (['.tsx', '.ts', '.jsx', '.js', '.css'].includes(parsedPath.ext.toLowerCase())) {
           console.warn(`[Dev] Source file reached fallback: ${req.path}. Vite might have skipped it.`);
           return next(); 
        }

        const srcPath = path.join(process.cwd(), req.path);
        if (fs.existsSync(srcPath)) {
          return res.sendFile(srcPath);
        }
        return next();
      }

      try {
        const templatePath = path.resolve(process.cwd(), "index.html");
        if (!fs.existsSync(templatePath)) {
          return res.status(404).send("index.html not found");
        }
        const template = fs.readFileSync(templatePath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        console.error("Vite Transform Error:", e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from dist
    app.use(express.static(distPath, { index: false }));
    
    // SPA Fallback for production
    app.get("/:path*", (req, res) => {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }

      const parsedPath = path.parse(req.path);
      if (parsedPath.ext && !['.html', '.php', '.asp'].includes(parsedPath.ext.toLowerCase())) {
        return res.status(404).end();
      }

      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application shell not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server failure:", err);
});
