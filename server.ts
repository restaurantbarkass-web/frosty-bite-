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
    // In Express, req.path is the best way to check for routing
    const isApi = req.path.startsWith("/api/");
    const isImportant = !req.path.includes("/src/") && !req.path.includes("/node_modules/") && !req.path.includes("@vite");
    
    if (isApi || isImportant) {
      console.log(`${new Date().toISOString()} - [${req.method}] ${req.path}`);
    }
    next();
  });


  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // AI Generation Endpoint
  app.post("/api/generate-avatar", async (req, res) => {
    const { prompt, vibe, imageUrl, userId } = req.body;
    console.log(`[AI Avatar Request] User: ${userId}, Prompt: ${prompt ? prompt.substring(0, 50) : 'none'}, Vibe: ${vibe}`);

    try {
      let imageResult: string | null = null;
      const genAI = getGenAI();

      // 1. Try Gemini Vision if an image is provided
      if (imageUrl && imageUrl.startsWith('http')) {
        console.log(`[Gemini] Attempting vision analysis on: ${imageUrl}`);
        try {
          const fetchRes = await fetch(imageUrl);
          const buffer = await fetchRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

          const visionRes = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                { text: `Describe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output only a refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}.` },
                {
                  inlineData: {
                    data: base64,
                    mimeType: mimeType
                  }
                }
              ]
            }
          });

          const refinedPrompt = visionRes.text || prompt;
          console.log(`[Gemini] Refined Prompt: ${refinedPrompt?.substring(0, 50)}...`);

          // Call HF with refined prompt if available
          if (process.env.HF_TOKEN && process.env.HF_TOKEN.length > 5) {
            const hf = getHF();
            console.log(`[HF] Calling Stable Diffusion with refined prompt`);
            const hfResult = await hf.textToImage({
              model: "stabilityai/stable-diffusion-xl-base-1.0",
              inputs: refinedPrompt || "Cute bakery chibi avatar",
              parameters: {
                negative_prompt: "blurry, low quality, distorted, photo, realistic",
                width: 512,
                height: 512,
              }
            });

            const hfBuffer = await hfResult.arrayBuffer();
            imageResult = `data:image/png;base64,${Buffer.from(hfBuffer).toString('base64')}`;
          }
        } catch (visionError) {
          console.error(`[AI Error] Gemini Vision/HF flow failed:`, visionError);
        }
      }

      // 2. Fallback to HF Text-to-Image Directly
      if (!imageResult && process.env.HF_TOKEN && process.env.HF_TOKEN.length > 5) {
        console.log(`[HF] Attempting direct text-to-image fallback`);
        try {
          const hf = getHF();
          const result = await hf.textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: prompt || "Cute bakery-themed chibi avatar, anime style, high quality",
            parameters: {
              negative_prompt: "photorealistic, real person, blurry",
              width: 512,
              height: 512,
            }
          });
          
          const buffer = await result.arrayBuffer();
          imageResult = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
          console.log(`[HF] Direct generation successful`);
        } catch (hfError) {
          console.error(`[AI Error] HF Direct failed:`, hfError);
        }
      }

      // 3. Last fallback: SVG via Gemini
      if (!imageResult && process.env.GEMINI_API_KEY) {
        console.log(`[Gemini] All image generators failed. Falling back to SVG.`);
        try {
          const result = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
          });
          
          const text = result.text || '';
          const svgCode = text.match(/<svg[\s\S]*<\/svg>/)?.[0] || text.replace(/```svg|```|```html|```/g, "").trim();
          
          if (svgCode && svgCode.includes('<svg')) {
            imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
            console.log(`[Gemini] SVG fallback successful`);
          }
        } catch (svgError) {
          console.error(`[AI Error] SVG fallback failed:`, svgError);
        }
      }

      // 4. Ultimate Fallback: DiceBear
      if (!imageResult) {
        console.log(`[Fallback] Using DiceBear as ultimate fallback`);
        const seedVal = `${userId || 'anon'}-${Date.now()}`;
        imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
      }

      res.json({ image: imageResult });

    } catch (error) {
      console.error("[Fatal AI Error]:", error);
      res.status(500).json({ error: "Server error during generation" });
    }
  });

  app.all("/api/generate-avatar", (req, res) => {
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
    app.get('*', (req, res) => {
      // If it's an API route that reached here, it's a 404
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: `API endpoint ${req.path} not found` });
      }

      // Direct file check to avoid infinite loops if a 404'd asset is requested
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        return res.status(404).end();
      }
      
      const indexPath = path.resolve(distPath, 'index.html');
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
