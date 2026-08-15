import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Initialize environment variables in serverless environment
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import app from "../server/app";

export default app;
