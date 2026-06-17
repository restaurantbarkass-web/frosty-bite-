import express from 'express';
import admin, { getAdminDb } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.post('/send-push', async (req, res) => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, body' });
  }

  try {
    console.log(`[Push Notification] Attempting to send push to user "${userId}": "${title}"`);
    
    let tokens: string[] = [];

    // 1. Fetch user FCM tokens from Firestore (highly reliable, primary store)
    try {
      const dbInstance = getAdminDb();
      const userDoc = await dbInstance.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const docData = userDoc.data();
        if (docData && Array.isArray(docData.fcm_tokens)) {
          tokens = docData.fcm_tokens.filter((t: any) => typeof t === 'string' && t.trim() !== '');
          console.log(`[Push Notification] Found ${tokens.length} token(s) in Firestore for "${userId}"`);
        }
      }
    } catch (fsError: any) {
      console.warn('[Push Notification] Error querying user from Firestore (non-fatal):', fsError.message);
    }

    // 2. Fetch user FCM tokens from Supabase users table (as a fallback/merge, handling errors safely)
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('fcm_tokens')
        .eq('firebase_uid', userId)
        .maybeSingle();

      if (userError) {
        console.warn('[Push Notification] Supabase query returned warning (column may be missing):', userError.message);
      } else if (userData && Array.isArray(userData.fcm_tokens)) {
        const extraTokens = userData.fcm_tokens.filter(
          (t: any) => typeof t === 'string' && t.trim() !== '' && !tokens.includes(t)
        );
        tokens = [...tokens, ...extraTokens];
        console.log(`[Push Notification] Merged ${extraTokens.length} additional token(s) from Supabase for "${userId}"`);
      }
    } catch (sbError: any) {
      console.warn('[Push Notification] Error querying user from Supabase (non-fatal):', sbError.message);
    }

    if (tokens.length === 0) {
      console.log(`[Push Notification] No FCM tokens found for user "${userId}". Skipping.`);
      return res.json({ success: true, message: 'No registered tokens found for user' });
    }

    console.log(`[Push Notification] Found ${tokens.length} active token(s) for user "${userId}". Sending messages via FCM...`);
    
    // 3. Build the messages for FCM
    const messages = tokens.map(token => ({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          click_action: data?.link || '/'
        }
      }
    }));

    // 3. Send each message
    const results = await Promise.allSettled(
      messages.map(msg => admin.messaging().send(msg))
    );

    const successfulSends = results.filter(r => r.status === 'fulfilled').length;
    const failedSends = results.filter(r => r.status === 'rejected').length;

    console.log(`[Push Notification] Push summary for user "${userId}": ${successfulSends} sent successfully, ${failedSends} failed.`);

    // Prune invalid or unregistered tokens
    let tokensToKeep = [...tokens];
    let tokensModified = false;

    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        const error = res.reason;
        console.warn(`[Push Notification] Error sending to token index ${idx}:`, error?.message || error);
        
        const errCode = error?.code || '';
        const errMsg = error?.message || '';
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token' ||
          errMsg.includes('registration-token-not-registered') ||
          errMsg.includes('not-registered')
        ) {
          const badToken = tokens[idx];
          tokensToKeep = tokensToKeep.filter(t => t !== badToken);
          tokensModified = true;
          console.log('[Push Notification] Removed expired/invalid token:', badToken);
        }
      }
    });

    if (tokensModified) {
      // 1. Clean up in Firestore
      try {
        const dbInstance = getAdminDb();
        await dbInstance.collection('users').doc(userId).set({
          fcm_tokens: tokensToKeep
        }, { merge: true });
        console.log(`[Push Notification] Cleaned up unregistered tokens in Firestore for user "${userId}". Current: ${tokensToKeep.length}`);
      } catch (fsPruneErr: any) {
        console.error('[Push Notification] Failed to update Firestore user tokens after pruning:', fsPruneErr.message);
      }

      // 2. Clean up in Supabase (as standard fallback, catch errors silently)
      try {
        await supabase
          .from('users')
          .update({
            fcm_tokens: tokensToKeep,
            updated_at: new Date().toISOString()
          })
          .eq('firebase_uid', userId);
        console.log(`[Push Notification] Cleaned up unregistered tokens in Supabase for user "${userId}". Remaining tokens:`, tokensToKeep.length);
      } catch (dbErr) {
        console.warn('[Push Notification] Failed to update Supabase tokens after pruning (non-fatal):', dbErr);
      }
    }

    return res.json({
      success: true,
      sentCount: successfulSends,
      failedCount: failedSends
    });

  } catch (error: any) {
    console.error('[Push Notification] System error sending push:', error);
    return res.status(500).json({ error: 'Internal server error while sending push', message: error.message });
  }
});

export default router;
