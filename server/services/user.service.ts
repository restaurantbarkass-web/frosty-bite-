import { supabase } from '../lib/supabase';

export class UserService {
  static async syncUser(firebaseUser: { uid: string; email: string; displayName?: string; photoURL?: string }) {
    console.log(`[UserService] Syncing user ${firebaseUser.email} (UID: ${firebaseUser.uid}) with Supabase...`);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          firebase_uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          avatar_url: firebaseUser.photoURL,
          last_login: new Date().toISOString()
        }, { onConflict: 'firebase_uid' })
        .select()
        .single();

      if (error) {
        console.error('[UserService] Sync Error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[UserService] Fatal sync error:', error);
      throw error;
    }
  }

  static async getUserByFirebaseUid(uid: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('firebase_uid', uid)
      .single();
    
    if (error) return null;
    return data;
  }
}
