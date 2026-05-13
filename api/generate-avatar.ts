import { HfInference } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";

let hf: any = null;
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
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY missing");
    genAI = new GoogleGenAI({ apiKey: key });
  }
  return genAI;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, vibe, imageUrl, userId } = req.body;
  console.log(`[Vercel API] AI Avatar Request for User: ${userId}`);

  try {
    if (!process.env.HF_TOKEN && !process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI services not configured" });
    }
    
    let imageResult: string | null = null;
    const ai = getGenAI();

    // 1. Try Gemini Vision if an image is provided
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const fetchRes = await fetch(imageUrl);
        const buffer = await fetchRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

        const visionRes = await ai.models.generateContent({
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

        // Call HF with refined prompt if available
        if (process.env.HF_TOKEN) {
          const hfClient = getHF();
          const hfResult = await hfClient.textToImage({
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
        console.error(`[Vercel AI Error] Vision flow failed:`, visionError);
      }
    }

    // 2. Fallback to HF Text-to-Image Directly
    if (!imageResult && process.env.HF_TOKEN) {
      try {
        const hfClient = getHF();
        const result = await hfClient.textToImage({
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
      } catch (hfError) {
        console.error(`[Vercel AI Error] HF Direct failed:`, hfError);
      }
    }

    // 3. Last fallback: SVG via Gemini
    if (!imageResult && process.env.GEMINI_API_KEY) {
      try {
        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
        });
        
        const text = result.text || '';
        const svgCode = text.match(/<svg[\s\S]*<\/svg>/)?.[0] || text.replace(/```svg|```|```html|```/g, "").trim();
        
        if (svgCode && svgCode.includes('<svg')) {
          imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
        }
      } catch (svgError) {
        console.error(`[Vercel AI Error] SVG fallback failed:`, svgError);
      }
    }

    // 4. Ultimate Fallback: DiceBear
    if (!imageResult) {
      const seedVal = `${userId || 'anon'}-${Date.now()}`;
      imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
    }

    res.status(200).json({ image: imageResult });

  } catch (error: any) {
    console.error("[Vercel Fatal AI Error]:", error);
    res.status(500).json({ error: "Server error during generation", details: error.message });
  }
}
