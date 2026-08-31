import dotenv from "dotenv";
import fs from "fs";
import path from "path";

console.log("[Vercel] api/index.ts loading...");

// Initialize environment variables in serverless environment
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (e: any) {
  console.warn("[Vercel] Error loading .env:", e?.message);
}

import app from "../server/app";

console.log("[Vercel] api/index.ts loaded successfully");

export default function handler(req: any, res: any) {
  return app(req, res);
}

