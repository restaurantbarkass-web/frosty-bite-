import { Request, Response, NextFunction } from "express";
import { getAdminAuth } from "../lib/firebase-admin";

// Middleware to verify Firebase ID tokens securely
export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await getAdminAuth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("[Auth Middleware] Token verification failed:", err);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};
