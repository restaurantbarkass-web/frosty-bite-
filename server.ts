import express from "express";
import path from "path";
import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let hf: HfInference | null = null;

function getHF() {
  if (!hf) {
    if (!process.env.HF_TOKEN) throw new Error("HF_TOKEN missing");
    hf = new HfInference(process.env.HF_TOKEN);
  }
  return hf;
}

async function startServer() {
  // Improved Request logging
  app.use((req, res, next) => {
    const isApi = req.url.startsWith("/api/");
    const isImportant = !req.url.includes("/src/") && !req.url.includes("/node_modules/") && !req.url.includes("@vite");
    
    if (isApi || isImportant) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // AI Generation Endpoint - use post directly
  app.post("/api/generate-avatar", async (req, res) => {
    console.log(`${new Date().toISOString()} - Processing avatar generation request: ${req.method} ${req.url}`);
    try {
      const { prompt } = req.body;
      
      if (!process.env.HF_TOKEN) {
        console.error("Missing HF_TOKEN");
        return res.status(400).json({ error: "HF_TOKEN not configured" });
      }

      console.log("Attempting Hugging Face generation...");
      const result = await getHF().textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: prompt || `Cute foodie chibi avatar, anime style, oversized hoodie, holding bubble tea, pastel colors, cozy cafe vibe`,
      });
      
      if (!result) throw new Error("Hugging Face returned no result");

      let buffer: Buffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        const ab = await (result as any).arrayBuffer();
        buffer = Buffer.from(ab);
      } else {
        buffer = Buffer.from(result as any);
      }
      
      const imageResult = `data:image/png;base64,${buffer.toString('base64')}`;
      console.log("HF generation successful");
      res.json({ image: imageResult });
    } catch (error: any) {
      console.error("Final avatar generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Catch other API methods for the same route to explicitly return 405
  app.all("/api/generate-avatar", (req, res) => {
    console.warn(`${new Date().toISOString()} - 405 Method Not Allowed: ${req.method} ${req.url}`);
    res.status(405).json({ error: "Method Not Allowed - use POST" });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Catch-all route for SPA (Express 5 uses *all)
    app.get('*all', (req, res) => {
      console.log(`Catch-all hit for: ${req.url}, serving index.html`);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server failure:", err);
});
