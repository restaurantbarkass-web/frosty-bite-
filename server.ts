import express from "express";
import path from "path";
import fs from "fs";
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
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
    console.log(`[Gemini] Initializing with key: ${key.slice(0, 4)}...${key.slice(-4)}`);
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

async function startServer() {
  // Ultra-precise Request logging for debugging 405/404 issues
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });


  // AI Butler Smart Recommendation Endpoint
  app.post("/api/butler/recommend", async (req, res) => {
    const { query, items } = req.body;
    console.log(`[Butler Rec] Request received. Query: "${query}", Items count: ${items?.length || 0}`);
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: "Invalid query" });
    }

    try {
      const genAIClient = getGenAI();
      const model = genAIClient.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.",
      });

      const prompt = `
        User Search: "${query}"
        Menu: ${JSON.stringify(items)}

        Task: Act as the "Frosty Bite Butler", a premium dessert concierge.
        Analyze the search for:
        - Occasion: (e.g., anniversary, birthday, romantic)
        - Mood: (e.g., celebratory, cozy, luxury)
        - Budget: (Is price mentioned or implied?)
        - Flavor Profile: (Chocolate, fruity, etc.)

        IMPORTANT: If a masterpiece has "is_ai_boosted: true", it should be given slight preference if it matches the general vibe.

        Respond ONLY with a JSON object:
        {
          "bestMatchId": "id-of-item",
          "reason": "Dramatic, punchy reason (max 8 words)",
          "intent": "e.g., Anniversary Celebration",
          "alternatives": ["id1", "id2"],
          "isEmotionalMatch": true/false,
          "occasionDetected": "string",
          "moodDetected": "string",
          "budgetDetected": "string or null",
          "recommendationType": "one of: occasion, flavor, budget, trending, standard",
          "butlerResponse": "A premium, sophisticated greeting and recommendation (2 sentences). Use words like 'exquisite', 'divine', 'perfectly suited'."
        }
      `;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
      
      const output = result.response.text();
      console.log(`[Butler Rec] AI generated response successfully`);
      
      try {
        // Robust JSON extraction
        let jsonStr = output;
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        } else {
          jsonStr = output.replace(/```json|```/g, '').trim();
        }
        
        res.json(JSON.parse(jsonStr));
      } catch (parseError) {
        console.error("[Butler Rec Error] JSON Parse failed. Original output:", output);
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error: any) {
      console.error("[Butler Rec Error]:", error);
      res.status(500).json({ error: "Butler service error", details: error.message });
    }
  });

  // AI Butler Suggestions Endpoint
  app.post("/api/butler/suggestions", async (req, res) => {
    const { searchTerm, items } = req.body;
    console.log(`[Butler Suggestions] Term: "${searchTerm}"`);

    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json({ error: "Invalid search term" });
    }

    try {
      const genAIClient = getGenAI();
      const model = genAIClient.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        Search Term: "${searchTerm}"
        Menu Reference: ${JSON.stringify(items)}

        As a bakery AI concierge, predict the user's intent and provide 5 smart search suggestions.
        Suggestions should be natural, high-intent phrases like "Best velvet cake for anniversary" or "Sweet pastries for evening coffee".
        Respond ONLY with a list of suggestions separated by newlines.
      `;

      const result = await model.generateContent(prompt);
      const output = result.response.text();
      const suggestions = output.split('\n').filter(s => s.trim().length > 0).slice(0, 5);
      
      res.json({ suggestions });
    } catch (error: any) {
      console.error("[Butler Suggestions Error]:", error);
      res.status(500).json({ error: "Suggestions error", details: error.message });
    }
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV, 
      hasHf: !!process.env.HF_TOKEN, 
      hasGemini: !!process.env.GEMINI_API_KEY 
    });
  });

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
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api/")) return next();
      
      const parsedPath = path.parse(req.path);
      if (parsedPath.ext && !parsedPath.ext.startsWith('.html')) return next();

      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        console.error("Vite Transform Error:", e);
        next(e);
      }
    });
  }

  // AI Generation Endpoint
  app.post("/api/generate-avatar", async (req, res) => {
    const { prompt, vibe, imageUrl, userId } = req.body;
    console.log(`[AI Avatar Request] User: ${userId}, Path: ${req.path}, Method: ${req.method}`);

    try {
      if (!process.env.HF_TOKEN && !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "AI services not configured" });
      }
      
      let imageResult: string | null = null;
      const genAIClient = getGenAI();
      const model = genAIClient.getGenerativeModel({ model: "gemini-1.5-flash" });

      // 1. Try Gemini Vision if an image is provided
      if (imageUrl && imageUrl.startsWith('http')) {
        console.log(`[Gemini] Attempting vision analysis on: ${imageUrl}`);
        try {
          const fetchRes = await fetch(imageUrl);
          const buffer = await fetchRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

          const visionRes = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [
                { text: `Describe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output only a refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}.` },
                {
                  inlineData: {
                    data: base64,
                    mimeType: mimeType
                  }
                }
              ]
            }]
          });

          const refinedPrompt = visionRes.response.text() || prompt;
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

            // @ts-ignore
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
          
          // @ts-ignore
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
          const result = await model.generateContent(`Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`);
          
          const text = result.response.text() || '';
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

    } catch (error: any) {
      console.error("[Fatal AI Error]:", error);
      res.status(500).json({ error: "Server error during generation", details: error.message });
    }
  });

  // Comprehensive 404/405 handler for API
  app.all("/api/*all", (req, res) => {
    const fullPath = req.originalUrl.split('?')[0];
    if (req.method !== "POST" && (fullPath === "/api/generate-avatar" || fullPath === "/api/generate-avatar/")) {
      return res.status(405).json({ error: "Method Not Allowed - use POST" });
    }
    res.status(404).json({ error: `API Endpoint ${fullPath} not found` });
  });
  
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files from dist
    app.use(express.static(distPath, { index: false }));
    
    // SPA Fallback for production
    app.get("*", (req, res) => {
      // API routes should not fall through to index.html
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }

      // Check for file extensions (prevent index.html for missing assets)
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
