import admin from "firebase-admin";
import { Request, Response, NextFunction } from "express";

// Initialize Firebase Admin lazily to avoid crash if env is missing
let isInitialized = false;

function initFirebaseAdmin() {
  if (isInitialized) return;
  
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsed)
      });
      isInitialized = true;
    } catch (e) {
      console.error("[Auth Middleware] Failed to parse FIREBASE_SERVICE_ACCOUNT. Falling back to default.");
    }
  }

  if (!isInitialized) {
    try {
      admin.initializeApp();
      isInitialized = true;
    } catch (e) {
      console.warn("[Auth Middleware] Firebase Admin could not be initialized. verifyFirebaseToken will fail.");
    }
  }
}

export async function verifyFirebaseToken(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  initFirebaseAdmin();
  
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized: No token provided"
      });
    }

    if (!isInitialized) {
      console.error("[Auth] Firebase Admin not initialized. Cannot verify token.");
      return res.status(500).json({ error: "Auth service misconfigured" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid token"
    });
  }
}
