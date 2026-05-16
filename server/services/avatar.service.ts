import { getHF } from "../ai/huggingface";
import { getGenAI, cleanJsonResponse } from "../ai/gemini";

export async function generateAvatarImage(data: { prompt: string; vibe?: string; imageUrl?: string; userId?: string }) {
  const { prompt, vibe, imageUrl, userId } = data;
  let imageResult: string | null = null;

  try {
    const genAIClient = getGenAI();
    
    // 1. Vision Analysis if image provided
    if (imageUrl && imageUrl.startsWith('http')) {
      const fetchRes = await fetch(imageUrl);
      const buffer = await fetchRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

      const response = await genAIClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: `System: Analyze the provided image and generate a creative prompt.\n\nDescribe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output only a refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}.` },
            { inlineData: { data: base64, mimeType } }
          ]
        }
      });

      const refinedPrompt = cleanJsonResponse(response.text || prompt);
      
      if (process.env.HF_TOKEN) {
        const hfClient = getHF();
        const hfResult = await hfClient.textToImage({
          model: "stabilityai/stable-diffusion-xl-base-1.0",
          inputs: refinedPrompt,
          parameters: { negative_prompt: "blurry, low quality", width: 512, height: 512 }
        });
        // @ts-ignore
        const hfBuffer = await hfResult.arrayBuffer();
        imageResult = `data:image/png;base64,${Buffer.from(hfBuffer).toString('base64')}`;
      }
    }

    // 2. Direct HF Fallback
    if (!imageResult && process.env.HF_TOKEN) {
      const hfClient = getHF();
      const result = await hfClient.textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: prompt || "Cute bakery-themed chibi avatar",
        parameters: { negative_prompt: "blurry", width: 512, height: 512 }
      });
      // @ts-ignore
      const buffer = await result.arrayBuffer();
      imageResult = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
    }

    // 3. SVG Fallback
    if (!imageResult && process.env.GEMINI_API_KEY) {
      const response = await genAIClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
      });
      const text = response.text || '';
      const svgCode = text.match(/<svg[\s\S]*<\/svg>/)?.[0] || text.replace(/```svg|```|```html|```/g, "").trim();
      if (svgCode && svgCode.includes('<svg')) {
        imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
      }
    }

    // 4. DiceBear
    if (!imageResult) {
      const seedVal = `${userId || 'anon'}-${Date.now()}`;
      imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
    }

    return imageResult;
  } catch (error) {
    console.error("[AiService] Generation failed:", error);
    throw error;
  }
}
