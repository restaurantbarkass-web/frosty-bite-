import { messaging, db, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import toast from 'react-hot-toast';

export const requestForToken = async () => {
  if (!messaging) return null;
  
  try {
    const currentToken = await getToken(messaging, {
      // You should provide a VAPID key here if you have one.
      // vapidKey: 'YOUR_VAPID_KEY'
    });
    
    if (currentToken) {
      console.log('Current token for client: ', currentToken);
      
      // Save token to user document
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(currentToken)
        });
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
