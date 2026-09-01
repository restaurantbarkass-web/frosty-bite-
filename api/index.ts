console.log("[Vercel] api/index.ts loading...");

import appModule from "../dist/app.cjs";

const app = (appModule as any).default || appModule;

console.log("[Vercel] api/index.ts loaded successfully");

export default function handler(req: any, res: any) {
  return app(req, res);
}

