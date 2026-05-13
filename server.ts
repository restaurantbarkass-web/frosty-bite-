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
      // Step 7: Generate Chibi Avatar with Hugging Face
      const result = await hf.textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: prompt || `Cute foodie chibi avatar, anime style, oversized hoodie, holding bubble tea, pastel colors, cozy cafe vibe`,
      }) as unknown as Blob;
      
      const buffer = await result.arrayBuffer();
      imageResult = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
    } catch (error) {
      console.error("HF Generation failed, falling back to Gemini:", error);
      fallbackToGemini = true;
    }

    if (fallbackToGemini) {
      // Step 8: Fallback to Gemini - Generate a high-quality SVG Chibi
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent([
        `Generate a high-quality, cute, minimalist SVG chibi avatar for a foodie user. 
         Style: kawaii, pastel colors, thick lines. 
         The character should be holding a piece of bread or coffee.
         Return ONLY the SVG code, no markdown, no explanations. 
         The SVG should be square (viewBox="0 0 512 512").`
      ]);

      const svgCode = result.response.text().replace(/```svg|```/g, "").trim();
      imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
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
