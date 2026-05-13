export default function handler(req: any, res: any) {
  res.status(200).json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    runtime: "Vercel Serverless",
    hasHf: !!process.env.HF_TOKEN,
    hasGemini: !!process.env.GEMINI_API_KEY
  });
}
