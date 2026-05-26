import { getHF } from "../ai/huggingface";
import { getGenAI, cleanJsonResponse } from "../ai/gemini";

export async function generateAvatarImage(data: { prompt: string; vibe?: string; imageUrl?: string; userId?: string }) {
  const { prompt, vibe, imageUrl, userId } = data;
  let imageResult: string | null = null;

  try {
    const genAIClient = getGenAI();
    let targetModel = "gemini-flash-latest"; 
    
    // 1. Vision Analysis if image provided
    if (imageUrl && imageUrl.startsWith('http')) {
      try {
        const fetchRes = await fetch(imageUrl);
        const buffer = await fetchRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';

        let response: any;
        try {
          response = await genAIClient.models.generateContent({
            model: "gemini-flash-latest",
            contents: {
              parts: [
                { text: `System: Analyze the provided image and generate a creative prompt for a high-quality image generator.\n\nDescribe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output ONLY the refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}. No prefixes, no conversational filler, just the prompt string.` },
                { inlineData: { data: base64, mimeType } }
              ]
            }
          });
        } catch (error: any) {
          const errorStr = error instanceof Error 
            ? error.message 
            : (error && typeof error === 'object' ? JSON.stringify(error) : String(error));

          const isTransientOrQuota = 
            errorStr.includes('503') || 
            errorStr.includes('UNAVAILABLE') || 
            errorStr.includes('demand') ||
            errorStr.includes('429') || 
            errorStr.includes('RESOURCE_EXHAUSTED') || 
            errorStr.includes('quota') ||
            errorStr.includes('Quota exceeded');

          if (isTransientOrQuota) {
            console.warn(`[AvatarService] Vision analysis primary model (gemini-flash-latest) returned transient/quota status: ${errorStr}. Falling back to gemini-3.5-flash...`);
            response = await genAIClient.models.generateContent({
              model: "gemini-3.5-flash",
              contents: {
                parts: [
                  { text: `System: Analyze the provided image and generate a creative prompt for a high-quality image generator.\n\nDescribe this person's facial features and style to help generate a ${prompt || 'cute bakery-themed chibi avatar'}. Output ONLY the refined generation prompt based on their face and the requested vibe: ${vibe || 'kawaii'}. No prefixes, no conversational filler, just the prompt string.` },
                  { inlineData: { data: base64, mimeType } }
                ]
              }
            });
          } else {
            throw error;
          }
        }

        if (!response.text) {
          console.warn("[AvatarService] Gemini vision returned empty text, using baseline prompt");
        }

        let refinedPrompt = cleanJsonResponse(response.text || prompt || "Cute bakery-themed chibi avatar");
        // Extra cleanup to ensure no "Prompt:" or similar prefixes
        refinedPrompt = refinedPrompt.replace(/^(Prompt|Output|Refined Prompt|Image Prompt):/i, "").trim();
        
        if (process.env.HF_TOKEN) {
          const hfClient = getHF();
          if (hfClient) {
            console.log("[AvatarService] Generating image via HF XL...");
            const hfResult = await hfClient.textToImage({
              model: "stabilityai/stable-diffusion-xl-base-1.0",
              inputs: refinedPrompt,
              parameters: { negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy", width: 512, height: 512 }
            });
            // @ts-ignore
            const hfBuffer = await hfResult.arrayBuffer();
            imageResult = `data:image/png;base64,${Buffer.from(hfBuffer).toString('base64')}`;
            console.log("[AvatarService] HF XL Generation successful");
          }
        }
      } catch (visionError) {
        console.warn("[AvatarService] Vision analysis or HF XL failed:", visionError);
      }
    }

    // 2. Direct HF Fallback (if no vision or vision/XL failed)
    if (!imageResult && process.env.HF_TOKEN) {
      try {
        const hfClient = getHF();
        if (hfClient) {
          console.log("[AvatarService] Trying fallback HF SD 1.5...");
          const result = await hfClient.textToImage({
            model: "runwayml/stable-diffusion-v1-5",
            inputs: prompt || "Cute bakery-themed chibi avatar, kawaii aesthetic, soft lighting, profile picture",
            parameters: { negative_prompt: "blurry, simple, low res", width: 512, height: 512 }
          });
          // @ts-ignore
          const buffer = await result.arrayBuffer();
          imageResult = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
          console.log("[AvatarService] HF Fallback successful");
        }
      } catch (hfError) {
        console.warn("[AvatarService] HF direct generation failed:", hfError);
      }
    }

    // 3. SVG Fallback
    if (!imageResult) {
      try {
        let response: any;
        try {
          response = await genAIClient.models.generateContent({
            model: "gemini-flash-latest",
            contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
          });
        } catch (error: any) {
          const errorStr = error instanceof Error 
            ? error.message 
            : (error && typeof error === 'object' ? JSON.stringify(error) : String(error));

          const isTransientOrQuota = 
            errorStr.includes('503') || 
            errorStr.includes('UNAVAILABLE') || 
            errorStr.includes('demand') ||
            errorStr.includes('429') || 
            errorStr.includes('RESOURCE_EXHAUSTED') || 
            errorStr.includes('quota') ||
            errorStr.includes('Quota exceeded');

          if (isTransientOrQuota) {
            console.warn(`[AvatarService] SVG generation primary model (gemini-flash-latest) returned transient/quota status: ${errorStr}. Falling back to gemini-3.5-flash...`);
            response = await genAIClient.models.generateContent({
              model: "gemini-3.5-flash",
              contents: `Generate a cute SVG code for a bakery-themed chibi avatar. Vibe: ${vibe}. Prompt: ${prompt}. Only respond with code.`
            });
          } else {
            throw error;
          }
        }
        const text = response.text || '';
        const svgCode = text.match(/<svg[\s\S]*<\/svg>/)?.[0] || text.replace(/```svg|```|```html|```/g, "").trim();
        if (svgCode && svgCode.includes('<svg')) {
          imageResult = `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`;
        }
      } catch (geminiError: any) {
        console.warn("[AvatarService] SVG generation failed:", geminiError.message);
      }
    }

    // 4. DiceBear
    if (!imageResult) {
      console.log("[AvatarService] Using DiceBear fallback");
      const seedVal = `${userId || 'anon'}-${Date.now()}`;
      imageResult = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
    }

    return imageResult;
  } catch (error) {
    console.error("[AiService] Generation fatal error:", error);
    // Even if everything fails, return the DiceBear fallback instead of throwing 500
    const seedVal = `${userId || 'anon'}-${Date.now()}`;
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seedVal}`;
  }
}
