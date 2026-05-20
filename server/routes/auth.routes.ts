import express from 'express';
import { getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';
import { UserService } from '../services/user.service';
import { EmailService } from '../services/email.service';

const router = express.Router();

// Synchronize Firebase user with Supabase (used after Social Login or App Start)
router.post('/sync', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Auth token required' });

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Check if new user for welcome email (we check if they exist in Supabase users table)
    const existingUser = await UserService.getUserByFirebaseUid(decodedToken.uid);
    
    const user = await UserService.syncUser({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    });

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[AuthRoutes] Sync error:', error);
    res.status(401).json({ error: 'Invalid token or sync failed' });
  }
});

export default router;
