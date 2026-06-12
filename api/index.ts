import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Initialize environment variables first thing in serverless environment
const envPath = path.resolve(process.cwd(), ".env");
const emgPath = path.resolve(process.cwd(), ".env.example");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (process.env.NODE_ENV !== "production" && fs.existsSync(emgPath)) {
  try {
    const exampleConfig = dotenv.parse(fs.readFileSync(emgPath));
    for (const k in exampleConfig) {
      if (k.startsWith("SMTP_") || !process.env[k] || process.env[k] === "") {
        process.env[k] = exampleConfig[k];
      }
    }
  } catch (err) {
    console.warn('[Vercel API] Error parsing .env.example:', err);
  }
}

import app from "../server/app";

export default app;

