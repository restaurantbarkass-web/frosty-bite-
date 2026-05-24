import express from 'express';
import admin from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

router.post('/send-push', async (req, res) => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, body' });
  }

  try {
    console.log(`[Push Notification] Attempting to send push to user "${userId}": "${title}"`);
    
    // 1. Fetch user FCM tokens from Supabase users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('fcm_tokens')
      .eq('firebase_uid', userId)
      .maybeSingle();

    if (userError) {
      console.error('[Push Notification] Error querying user from Supabase:', userError);
      return res.status(500).json({ error: 'Failed to look up user tokens', details: userError });
    }

    if (!userData || !userData.fcm_tokens || userData.fcm_tokens.length === 0) {
      console.log(`[Push Notification] No FCM tokens found for user "${userId}". Skipping.`);
      return res.json({ success: true, message: 'No registered tokens found for user' });
    }

    const tokens: string[] = userData.fcm_tokens.filter((t: any) => typeof t === 'string' && t.trim() !== '');

    if (tokens.length === 0) {
      return res.json({ success: true, message: 'FCM tokens array is empty' });
    }

    console.log(`[Push Notification] Found ${tokens.length} active token(s) for user "${userId}". Sending messages via FCM...`);

    // 2. Build the messages for FCM
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
      try {
        await supabase
          .from('users')
          .update({
            fcm_tokens: tokensToKeep,
            updated_at: new Date().toISOString()
          })
          .eq('firebase_uid', userId);
        console.log(`[Push Notification] Cleaned up unregistered tokens for user "${userId}". Remaining tokens:`, tokensToKeep.length);
      } catch (dbErr) {
        console.error('[Push Notification] Failed to update user tokens after cleaning:', dbErr);
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
