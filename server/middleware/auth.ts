import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";

export const ADMIN_EMAILS = [
  'restaurantbarkass@gmail.com',
  'admin@frostybite.app',
  'owner@frostybite.app',
  'barkasfrostybite@gmail.com'
];

/**
 * Middleware to verify user authentication token cryptographically via Supabase Auth.
 * Rejects invalid, forged, or expired tokens immediately.
 */
export const verifyAuthToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "No authorization token provided" });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: "Unauthorized", message: "Missing or empty bearer token" });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired authorization token" });
    }

    (req as any).user = {
      id: user.id,
      uid: user.id,
      email: user.email?.toLowerCase(),
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    };
    next();
  } catch (err: any) {
    console.error("[Auth Middleware] Token verification error:", err?.message || err);
    return res.status(401).json({ error: "Unauthorized", message: "Failed to authenticate token" });
  }
};

/**
 * Legacy compatibility alias for verifyAuthToken
 */
export const verifyFirebaseToken = verifyAuthToken;

/**
 * Middleware to enforce Admin role requirement.
 * Strictly verifies identity cryptographically and checks for admin privileges.
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Authentication required for admin access" });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid bearer token" });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || !user.email) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired authentication token" });
    }

    const normEmail = user.email.trim().toLowerCase();
    let isAuthorized = ADMIN_EMAILS.includes(normEmail);

    if (!isAuthorized) {
      // Check role in database users table
      try {
        const { data: userRecord } = await supabase
          .from('users')
          .select('role')
          .eq('email', normEmail)
          .maybeSingle();

        if (userRecord && userRecord.role === 'admin') {
          isAuthorized = true;
        }
      } catch (dbErr) {
        console.warn('[Admin Middleware] Error checking admin role in DB:', dbErr);
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden", message: "Administrative privileges required" });
    }

    (req as any).user = {
      id: user.id,
      uid: user.id,
      email: normEmail,
      role: 'admin'
    };

    next();
  } catch (err: any) {
    console.error("[Admin Middleware] Admin verification error:", err?.message || err);
    return res.status(401).json({ error: "Unauthorized", message: "Authentication verification failed" });
  }
};
