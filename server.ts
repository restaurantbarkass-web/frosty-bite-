import express from "express";
import path from "path";
import fs from "fs";
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
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
    console.log(`Initializing Gemini with key: ${key.slice(0, 4)}...${key.slice(-4)}`);
    genAI = new GoogleGenAI({ apiKey: key });
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
      const { prompt, vibe, imageUrl } = req.body;
      let imageResult = null;

      console.log(`Generation started for vibe: ${vibe || 'none'}, prompt: ${prompt || 'default'}, hasImage: ${!!imageUrl}`);

      // 1. Try Gemini Vision if Image is provided (Multimodal is better for "inspired by selfie")
      if (imageUrl && process.env.GEMINI_API_KEY) {
        try {
          console.log("Attempting Gemini Vision generation...");
          
          const imgRes = await fetch(imageUrl);
          const arrayBuffer = await imgRes.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
          
          const promptText = `Create a cute bakery-themed chibi avatar inspired by this person.
                 Anime-inspired, Kawaii style.
                 Big expressive eyes, soft pastel colors.
                 Holding a cupcake, croissant, or coffee mug.
                 Cozy bakery vibe with a cute hoodie.
                 Minimalist SVG with thick clean lines.
                 Return ONLY the valid SVG code. No markdown, no explanations. 
                 The SVG must be square (viewBox="0 0 512 512").`;

          const result = await getGenAI().models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { 
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: promptText }
              ] 
            }
          });
          const text = result.text;
          const svgCode = text?.replace(/```svg|```|```html|```xml|```/g, "").trim();
          
          if (svgCode && svgCode.includes('<svg')) {
            imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
            console.log("Gemini Vision/Text successful");
          }
        } catch (geminiError: any) {
          console.error("Gemini Vision/Text failed:", geminiError.message || geminiError);
        }
      }

      // 2. Fallback to Hugging Face if image is NOT provided or Gemini failed
      if (!imageResult && process.env.HF_TOKEN && process.env.HF_TOKEN.length > 5) {
        try {
          console.log("Attempting Hugging Face generation...");
          const hfResult = await getHF().textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: prompt || `Cute foodie chibi avatar, anime style, holding bakery item, pastel colors, cozy vibe`,
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
      if (!imageResult && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
        try {
          console.log("Attempting Gemini fallback...");
          const genPrompt = `Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
                 Style: kawaii, pastel colors, thick lines. 
                 Context: ${prompt || 'Cute bakery mascot'}
                 Return ONLY the SVG code, no markdown, no explanations. 
                 The SVG should be square (viewBox="0 0 512 512").`;
          
          const result = await getGenAI().models.generateContent({
            model: "gemini-3-flash-preview",
            contents: genPrompt
          });
          const text = result.text;
          const svgCode = text?.replace(/```svg|```|```html|```xml|```/g, "").trim();
          
          if (svgCode && svgCode.includes('<svg')) {
            imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
            console.log("Gemini fallback successful");
          } else {
             console.warn("Gemini returned invalid SVG, text length:", text?.length);
          }
        } catch (geminiError: any) {
          console.error("Gemini fallback failed:", geminiError.message || geminiError);
        }
      }

      // 3. Final Fallback: DiceBear (Programmatic)
      if (!imageResult) {
        console.log("Using DiceBear final fallback...");
        // Use a shorter seed for better DiceBear predictability
        const seedBase = vibe || prompt || 'default';
        const seed = `${seedBase}-${Date.now()}`.slice(0, 32); 
        // Using adventurer style for "bakery/foodie" vibe
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
    
    if (fs.existsSync(distPath)) {
      console.log(`[Production] Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
    } else {
      console.error(`[Production] CRITICAL: dist directory NOT found at ${distPath}`);
    }
    
    // Explicitly handle SPA fallback in production - must be AFTER static files
    // Express 5 strictly requires *all for catch-all behavior in some environments
    app.get('*all', (req, res) => {
      // Direct file check to avoid infinite loops if a 404'd asset is requested
      if (req.url.includes('.') && !req.url.endsWith('.html')) {
        return res.status(404).end();
      }
      
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application shell not found. Please wait for build to complete.");
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
