import { messaging, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '../supabase';

export const requestForToken = async () => {
  if (!messaging) return null;
  
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: 'H-nMK36Y6wNVZIQpFGNKpYYt0cmqcEZ-tqbeIT9djHU'
    });
    
    if (currentToken) {
      console.log('Current token for client: ', currentToken);
      
      // Save token to user document in Supabase
      if (auth.currentUser) {
        try {
          const { data: user } = await supabase
            .from('users')
            .select('fcm_tokens')
            .eq('firebase_uid', auth.currentUser.uid)
            .single();

          const tokens = user?.fcm_tokens || [];
          if (!tokens.includes(currentToken)) {
            await supabase
              .from('users')
              .update({
                fcm_tokens: [...tokens, currentToken],
                updated_at: new Date().toISOString()
              })
              .eq('firebase_uid', auth.currentUser.uid);
          }
        } catch (err) {
          console.error('Failed to sync FCM token to Supabase:', err);
        }
      }
      
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return resolve(null);
    onMessage(messaging, (payload) => {
      console.log("Payload received: ", payload);
      resolve(payload);
    });
  });
