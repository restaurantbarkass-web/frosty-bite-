import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { HfInference } from "@huggingface/inference";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const hf = new HfInference(process.env.HF_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hfConfigured: !!process.env.HF_TOKEN,
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

// AI Generation Endpoint
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const { imageUrl, prompt, userId } = req.body;

    if (!process.env.HF_TOKEN) {
      throw new Error("HF_TOKEN is not configured");
    }

    let imageResult;
    let fallbackToGemini = false;

    try {
      // Generate Chibi Avatar with Hugging Face
      console.log("Generating image with prompt:", prompt);
      const result = await hf.textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: prompt || `Cute foodie chibi avatar, anime style, oversized hoodie, holding bubble tea, pastel colors, cozy cafe vibe`,
      });
      
      if (!result) {
        throw new Error("Hugging Face returned no result");
      }

      // Handle both Blob (browser/modern node) and Buffer (legacy node)
      let buffer: Buffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        const ab = await (result as any).arrayBuffer();
        buffer = Buffer.from(ab);
      } else {
        buffer = Buffer.from(result as any);
      }
      
      imageResult = `data:image/png;base64,${buffer.toString('base64')}`;
      console.log("Successfully generated image from HF");
    } catch (error) {
      console.error("HF Generation failed, falling back to Gemini:", error);
      fallbackToGemini = true;
    }

    if (fallbackToGemini) {
      console.log("Using Gemini fallback...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent([
        `Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
         Style: kawaii, pastel colors, thick lines. 
         The character should be holding a piece of bread or coffee.
         Return ONLY the SVG code, no markdown, no explanations. 
         The SVG should be square (viewBox="0 0 512 512").`
      ]);

      const response = await result.response;
      const svgCode = response.text().replace(/```svg|```|```html/g, "").trim();
      
      if (!svgCode || !svgCode.includes('<svg')) {
        throw new Error("Gemini failed to generate valid SVG");
      }

      imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
      console.log("Successfully generated image from Gemini");
    }

    if (!imageResult) {
      throw new Error("Failed to generate any image result");
    }

    res.json({ image: imageResult });
  } catch (error: any) {
    console.error("Avatar generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
