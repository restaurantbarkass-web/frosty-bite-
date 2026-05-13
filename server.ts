import express from "express";
import path from "path";
import { HfInference } from "@huggingface/inference";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let hf: HfInference | null = null;
let genAI: GoogleGenerativeAI | null = null;

function getHF() {
  if (!hf) {
    if (!process.env.HF_TOKEN) throw new Error("HF_TOKEN missing");
    hf = new HfInference(process.env.HF_TOKEN);
  }
  return hf;
}

function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
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

  // AI Generation Endpoint
  app.post("/api/generate-avatar", async (req, res) => {
    console.log(`${new Date().toISOString()} - Processing avatar generation request: ${req.method} ${req.url}`);
    try {
      const { prompt } = req.body;
      let imageResult = null;

      // 1. Try Hugging Face First
      if (process.env.HF_TOKEN) {
        try {
          console.log("Attempting Hugging Face generation...");
          const hfResult = await getHF().textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: prompt || `Cute foodie chibi avatar, anime style, oversized hoodie, holding bubble tea, pastel colors, cozy cafe vibe`,
          });
          
          if (hfResult) {
            let buffer: Buffer;
            if (typeof (hfResult as any).arrayBuffer === 'function') {
              const ab = await (hfResult as any).arrayBuffer();
              buffer = Buffer.from(ab);
            } else {
              buffer = Buffer.from(hfResult as any);
            }
            imageResult = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log("HF generation successful");
          }
        } catch (hfError) {
          console.error("HF Generation failed:", hfError);
        }
      }

      // 2. Fallback to Gemini if HF failed or not configured
      if (!imageResult && process.env.GEMINI_API_KEY) {
        try {
          console.log("Attempting Gemini fallback...");
          const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(`Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
                 Style: kawaii, pastel colors, thick lines. 
                 The prompt: ${prompt || 'Cute bakery mascot'}
                 Return ONLY the SVG code, no markdown, no explanations. 
                 The SVG should be square (viewBox="0 0 512 512").`);

          const response = await result.response;
          const text = response.text();
          const svgCode = text.replace(/```svg|```|```html|```xml|```/g, "").trim();
          
          if (svgCode && svgCode.includes('<svg')) {
            imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
            console.log("Gemini fallback successful");
          }
        } catch (geminiError: any) {
          console.error("Gemini fallback failed:", geminiError);
        }
      }

      // 3. Final Fallback: DiceBear (Programmatic)
      if (!imageResult) {
        console.log("Using DiceBear final fallback...");
        const seed = prompt || `user-${Date.now()}`;
        // Using adventurern style for "bakery/foodie" vibe
        imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
      }

      res.json({ image: imageResult });
    } catch (error: any) {
      console.error("Final avatar generation error:", error);
      res.status(500).json({ 
        error: "Generation Error", 
        message: "Our AI bakers are busy, but we've prepped a special surprise for you!" 
      });
    }
  });

  // Catch other API methods for the same route to explicitly return 405
  app.all("/api/generate-avatar", (req, res) => {
    console.warn(`${new Date().toISOString()} - 405 Method Not Allowed: ${req.method} ${req.url}`);
    res.status(405).json({ error: "Method Not Allowed - use POST" });
  });

  // Vite middleware or static files
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files and catch-all for SPA
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Explicitly handle SPA fallback in production - must be AFTER static files
    app.get('*', (req, res, next) => {
      // Don't catch API routes or files with extensions
      if (req.url.startsWith('/api/') || req.url.includes('.')) {
        return next();
      }
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
