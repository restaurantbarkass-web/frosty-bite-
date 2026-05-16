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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

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
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!key) {
      console.error("[Gemini] CRITICAL: No API key found in environment");
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    console.log(`[Gemini] Initializing with identified key (starts with: ${key.substring(0, 4)}...)`);
    genAI = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

async function startServer() {
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);
  console.log(`[Server] HF_TOKEN present: ${!!process.env.HF_TOKEN}`);
  console.log(`[Server] GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`[Server] GOOGLE_API_KEY present: ${!!process.env.GOOGLE_API_KEY}`);

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
      let genAIClient;
      try {
        genAIClient = getGenAI();
      } catch (keyError) {
        console.warn("[Butler Rec] API Key missing, providing premium fallback.");
        return res.json({
          bestMatchId: null,
          reason: "Seeking our finest?",
          intent: "Generic Inquiry",
          alternatives: [],
          isEmotionalMatch: false,
          occasionDetected: "Special Moment",
          moodDetected: "Refined",
          recommendationType: "standard",
          butlerResponse: "My refined palate is currently being tuned. Please explore our curated menu below."
        });
      }

      const modelName = "gemini-3-flash-preview";
      console.log(`[Butler Rec] Calling Gemini (${modelName})... Query: ${query}`);
      
      const prompt = `
        User Search Query: "${query}"
        Available Menu Items (IDs are strings): ${items && items.length > 0 ? JSON.stringify(items) : "No direct menu provided."}

        Task: Act as the "Frosty Bite Butler", a premium dessert concierge.
        Analyze the search for intent, occasion, and emotional fit.

        Respond with valid JSON:
        {
          "bestMatchId": "string-id-or-null",
          "reason": "Dramatic phrase (max 8 words)",
          "intent": "Occasion detected",
          "alternatives": ["id1", "id2"],
          "isEmotionalMatch": true,
          "occasionDetected": "e.g. Birthday",
          "moodDetected": "e.g. Celebratory",
          "recommendationType": "one of: occasion, flavor, budget, trending, standard",
          "butlerResponse": "1-2 sophisticated sentences."
        }
      `;

      let response;
      try {
        response = await genAIClient.models.generateContent({
          model: modelName,
          contents: [{ 
            role: 'user', 
            parts: [{ text: `System: You are the Frosty Bite Butler. You provide luxury recommendations for premium cakes and pastries. You focus on emotions and matching the perfect treat to the user's specific life moments.\n\n${prompt}` }] 
          }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.1, 
          }
        });
      } catch (genError: any) {
        console.warn(`[Butler Rec] Primary model failed, trying fallback...`, genError.message);
        response = await genAIClient.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ 
            role: 'user', 
            parts: [{ text: prompt + "\nRespond with valid JSON." }] 
          }],
          config: {
            temperature: 0.2,
          }
        });
      }
      
      const output = response.text || '';
      console.log(`[Butler Rec] Success. Response Length: ${output.length}`);

      try {
        const data = JSON.parse(output);
        // Ensure all fields exist
        const sanitized = {
          bestMatchId: data.bestMatchId || null,
          reason: data.reason || "A choice of absolute distinction.",
          intent: data.intent || "Luxury Exploration",
          alternatives: data.alternatives || [],
          isEmotionalMatch: !!data.isEmotionalMatch,
          occasionDetected: data.occasionDetected || "Special Moment",
          moodDetected: data.moodDetected || "Refined",
          recommendationType: data.recommendationType || "standard",
          butlerResponse: data.butlerResponse || "I have curated our finest selections based on your unique preferences."
        };
        res.json(sanitized);
      } catch (parseError) {
        console.error("[Butler Rec] JSON Parse failed. Raw output:", output);
        // Fallback response with the same shape
        res.json({
          bestMatchId: null,
          reason: "Seeking something truly special?",
          intent: "Generic Inquiry",
          alternatives: [],
          isEmotionalMatch: false,
          occasionDetected: "Unknown",
          moodDetected: "Curious",
          recommendationType: "standard",
          butlerResponse: "My apologies, I am refining my palate. Please tell me more about what you desire."
        });
      }
    } catch (error: any) {
      console.error("[Butler Rec Fatal Error]:", error);
      res.status(500).json({ error: "Butler service unavailable", details: error.message });
    }
  });

  // AI Butler Suggestions Endpoint
  app.post("/api/butler/suggestions", async (req, res) => {
    const { searchTerm, items } = req.body;
    console.log(`[Butler Suggestions] Term: "${searchTerm}"`);

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({ error: "Invalid search term" });
    }

    try {
      let genAIClient;
      try {
        genAIClient = getGenAI();
      } catch (e) {
        console.warn("[Butler Suggestions] Key missing, using static fallback.");
        return res.json({ suggestions: ["Chocolate Truffle Cake", "Bento Cakes for Birthday", "Fresh Sourdough Bread"] });
      }

      const prompt = `
        Search Term: "${searchTerm}"
        Available Menu Context: ${items && items.length > 0 ? JSON.stringify(items.slice(0, 20)) : "Bakery and cakes"}
        Predict 5 natural, high-intent search phrases for this premium bakery.
        Respond ONLY with a JSON object: { "suggestions": ["phrase1", "phrase2", ...] }
      `;

      const response = await genAIClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `System: You are the Frosty Bite Butler suggestions engine.\n\n${prompt}` }] }],
        config: { 
          responseMimeType: "application/json" 
        }
      });
      
      const output = response.text || '';
      try {
        const data = JSON.parse(output);
        res.json(data);
      } catch (e) {
        // Fallback for suggestions
        res.json({ suggestions: ["Chocolate Truffle Cake", "Bento Cakes for Birthday", "Fresh Sourdough Bread"] });
      }
    } catch (error: any) {
      console.error("[Butler Suggestions Error]:", error);
      res.json({ suggestions: ["Red Velvet", "Pastries", "Cakes"] }); // Graceful fallback
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
    app.get("*all", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api/")) return next();
      
      const parsedPath = path.parse(req.path);
      // In dev mode, if Vite didn't handle a file with extension, we should be careful
      if (parsedPath.ext && !parsedPath.ext.startsWith('.html')) {
        // DO NOT serve source files as-is. They must be transformed by Vite.
        if (['.tsx', '.ts', '.jsx', '.js', '.css'].includes(parsedPath.ext.toLowerCase())) {
           return next(); 
        }

        const srcPath = path.join(process.cwd(), req.path);
        if (fs.existsSync(srcPath)) {
          console.log(`[Dev] Serving static asset as-is: ${req.path}`);
          return res.sendFile(srcPath);
        }
        console.warn(`[Dev] Missing asset requested or Vite skip: ${req.path}`);
        return next();
      }

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
      const modelName = "gemini-1.5-flash";

      // 1. Try Gemini Vision if an image is provided
      if (imageUrl && imageUrl.startsWith('http')) {
        console.log(`[Gemini] Attempting vision analysis on: ${imageUrl}`);
        try {
          const fetchRes = await fetch(imageUrl);
          const buffer = await fetchRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

          const response = await genAIClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
              role: 'user',
              parts: [
                { text: `System: Analyze the provided image and generate a creative prompt.\n\nDescribe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output only a refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}.` },
                {
                  inlineData: {
                    data: base64,
                    mimeType: mimeType
                  }
                }
              ]
            }]
          });

          const refinedPrompt = response.text || prompt;
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
          const response = await genAIClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
          });
          
          const text = response.text || '';
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
    app.get("*all", (req, res) => {
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
