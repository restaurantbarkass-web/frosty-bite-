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
let genAI: any = null;

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

  // AI Generation Endpoint - more robust matching
  app.all("/api/generate-avatar", async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed - use POST" });
    }
    
    console.log("Processing avatar generation request from client...");
    try {
      const { imageUrl, prompt, userId } = req.body;
      
      if (!process.env.HF_TOKEN) {
        console.error("Missing HF_TOKEN");
        return res.status(400).json({ error: "HF_TOKEN not configured" });
      }

      let imageResult;
      let fallbackToGemini = false;

      try {
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
        
        imageResult = `data:image/png;base64,${buffer.toString('base64')}`;
        console.log("HF generation successful");
      } catch (error) {
        console.error("HF Generation failed, falling back to Gemini:", error);
        fallbackToGemini = true;
      }

      if (fallbackToGemini) {
        console.log("Attempting Gemini fallback...");
        
        const result = await getGenAI().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            `Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
             Style: kawaii, pastel colors, thick lines. 
             The character should be holding a piece of bread or coffee.
             Return ONLY the SVG code, no markdown, no explanations. 
             The SVG should be square (viewBox="0 0 512 512").`
          ]
        });

        const svgCode = result.text.replace(/```svg|```|```html/g, "").trim();
        
        if (!svgCode || !svgCode.includes('<svg')) {
          throw new Error("Gemini failed to generate valid SVG");
        }

        imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
        console.log("Gemini fallback successful");
      }

      if (!imageResult) {
        throw new Error("Failed to generate any image result");
      }

      res.json({ image: imageResult });
    } catch (error: any) {
      console.error("Final avatar generation error:", error);
      res.status(500).json({ error: error.message });
    }
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
    // Catch-all route for SPA
    app.get('*', (req, res) => {
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
