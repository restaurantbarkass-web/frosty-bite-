import express from "express";
import path from "path";
import { HfInference } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let hf: HfInference | null = null;
let genAI: GoogleGenAI | null = null;

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
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
          const result = await getGenAI().models.generateContent({
            model: "gemini-1.5-flash", // Use stable model
            contents: [{
              role: 'user',
              parts: [{
                text: `Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
                 Style: kawaii, pastel colors, thick lines. 
                 The prompt: ${prompt || 'Cute bakery mascot'}
                 Return ONLY the SVG code, no markdown, no explanations. 
                 The SVG should be square (viewBox="0 0 512 512").`
              }]
            }]
          });

          const svgCode = result.text.replace(/```svg|```|```html/g, "").trim();
          if (svgCode && svgCode.includes('<svg')) {
            imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
            console.log("Gemini fallback successful");
          }
        } catch (geminiError: any) {
          console.error("Gemini fallback failed:", geminiError);
          // Check for quota error
          if (geminiError.message?.includes('429') || geminiError.status === 429) {
            return res.status(429).json({ 
              error: "AI Quota Reached", 
              message: "Our AI bakers are resting! Please try again in a few minutes or create your avatar manually." 
            });
          }
        }
      }

      if (!imageResult) {
        throw new Error("AI services currently busy. Please try manual creation!");
      }

      res.json({ image: imageResult });
    } catch (error: any) {
      console.error("Final avatar generation error:", error);
      res.status(error.status || 500).json({ 
        error: error.name || "Generation Error", 
        message: error.message 
      });
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
