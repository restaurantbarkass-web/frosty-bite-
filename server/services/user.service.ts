import { supabase } from '../lib/supabase';

export class UserService {
  static async syncUser(params: {
    uid?: string; // firebase_uid
    firebaseUid?: string; // fallback/direct
    supabaseUid?: string; // supabase_uid
    email: string;
    displayName?: string;
    photoURL?: string;
    name?: string;
    avatar_url?: string;
  }) {
    const rawEmail = params.email;
    if (!rawEmail) {
      throw new Error('[UserService] Email is required to resolve identity.');
    }
    const email = rawEmail.trim().toLowerCase();
    const firebaseUid = params.uid || params.firebaseUid || null;
    const supabaseUid = params.supabaseUid || null;
    
    console.log(`[UserService] Resolving identity for ${email} with firebaseUid: ${firebaseUid}, supabaseUid: ${supabaseUid}`);
    
    try {
      // 1. Try email match first
      const { data: user, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      const name = params.displayName || params.name || email.split('@')[0];
      const avatarUrl = params.photoURL || params.avatar_url || null;

      // 2. If not found → create
      if (!user) {
        console.log(`[UserService] No existing identity found for ${email}. Creating a new master record...`);
        const methods: string[] = [];
        if (firebaseUid) methods.push('firebase');
        if (supabaseUid) methods.push('otp');

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email,
            name,
            full_name: name,
            avatar_url: avatarUrl,
            avatar: avatarUrl,
            firebase_uid: firebaseUid,
            supabase_uid: supabaseUid,
            auth_methods: methods,
            last_login: new Date().toISOString(),
            last_login_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('[UserService] Insert Error:', insertError);
          throw insertError;
        }

        return newUser;
      }

      console.log(`[UserService] Match found in master database for ${email}. Merging profiles...`);

      // 3. Merge identities
      const updates: any = {
        last_login: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      if (name && (!user.name || user.name === user.email.split('@')[0])) {
        updates.name = name;
        updates.full_name = name;
      }
      if (avatarUrl && !user.avatar_url) {
        updates.avatar_url = avatarUrl;
        updates.avatar = avatarUrl;
      }

      const existingMethods = user.auth_methods || [];
      const updatedMethods = [...existingMethods];

      if (firebaseUid && user.firebase_uid !== firebaseUid) {
        updates.firebase_uid = firebaseUid;
        if (!updatedMethods.includes('firebase')) {
          updatedMethods.push('firebase');
        }
      }

      if (supabaseUid && user.supabase_uid !== supabaseUid) {
        updates.supabase_uid = supabaseUid;
        if (!updatedMethods.includes('otp')) {
          updatedMethods.push('otp');
        }
      }

      // Ensure that we at least populate auth_methods if empty
      if (updatedMethods.length === 0) {
        if (firebaseUid) updatedMethods.push('firebase');
        if (supabaseUid || user.supabase_uid) updatedMethods.push('otp');
      }

      // Check if auth_methods actually changed or needs initialization
      if (JSON.stringify(existingMethods.sort()) !== JSON.stringify(updatedMethods.sort())) {
        updates.auth_methods = updatedMethods;
      }

      // Perform updates if any changes are resolved
      if (Object.keys(updates).length > 2) { // more than just last_login and last_login_at
        console.log(`[UserService] Applying clean identity resolution merges for ${email}:`, updates);
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('email', email)
          .select()
          .single();

        if (updateError) {
          console.error('[UserService] Update Error during identity resolution:', updateError);
          throw updateError;
        }

        return updatedUser;
      }

      console.log(`[UserService] Master profile is already fully synced & merged for ${email}.`);
      return user;
    } catch (error) {
      console.error('[UserService] Unified Identity Resolution failed miserably:', error);
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

  static async getUserBySupabaseUid(uid: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_uid', uid)
      .single();
    
    if (error) return null;
    return data;
  }
}
