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
      // 0. Proactively heal/resolve collisions to prevent fatal "duplicate key value violates unique constraint" errors
      if (firebaseUid) {
        const { data: collidingFirebaseUser } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .maybeSingle();
        
        if (collidingFirebaseUser && collidingFirebaseUser.email !== email) {
          console.warn(`[UserService] Unifying Identity: Detaching duplicate firebase_uid "${firebaseUid}" from registered email "${collidingFirebaseUser.email}" to resolve merge conflicts.`);
          await supabase
            .from('users')
            .update({ firebase_uid: null })
            .eq('id', collidingFirebaseUser.id);
        }
      }

      if (supabaseUid) {
        const { data: collidingSupabaseUser } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_uid', supabaseUid)
          .maybeSingle();
        
        if (collidingSupabaseUser && collidingSupabaseUser.email !== email) {
          console.warn(`[UserService] Unifying Identity: Detaching duplicate supabase_uid "${supabaseUid}" from registered email "${collidingSupabaseUser.email}" to resolve merge conflicts.`);
          await supabase
            .from('users')
            .update({ supabase_uid: null })
            .eq('id', collidingSupabaseUser.id);
        }
      }

      // 1. Try email match first
      const { data: userByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      let user = userByEmail;

      // 2. Try firebase_uid match if not matched by email
      if (!user && firebaseUid) {
        const { data: userByFb } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', firebaseUid)
          .maybeSingle();
        if (userByFb) {
          console.log(`[UserService] Identity resolved cross-match via firebase_uid: ${firebaseUid} for ${email}`);
          user = userByFb;
        }
      }

      // 3. Try supabase_uid match if not matched yet
      if (!user && supabaseUid) {
        const { data: userBySb } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_uid', supabaseUid)
          .maybeSingle();
        if (userBySb) {
          console.log(`[UserService] Identity resolved cross-match via supabase_uid: ${supabaseUid} for ${email}`);
          user = userBySb;
        }
      }

      const name = params.displayName || params.name || email.split('@')[0];
      const avatarUrl = params.photoURL || params.avatar_url || null;

      // 4. If not found → create
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
          console.warn('[UserService] Insert failed, checking if user was created concurrently:', insertError.message || insertError);
          const { data: concurrentUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (concurrentUser) {
            console.log('[UserService] Concurrent user detected via email. Proceeding to merge update phase.');
            user = concurrentUser;
          } else {
            let foundByUid = null;
            if (firebaseUid) {
              const { data: checkFb } = await supabase.from('users').select('*').eq('firebase_uid', firebaseUid).maybeSingle();
              foundByUid = checkFb;
            }
            if (!foundByUid && supabaseUid) {
              const { data: checkSb } = await supabase.from('users').select('*').eq('supabase_uid', supabaseUid).maybeSingle();
              foundByUid = checkSb;
            }

            if (foundByUid) {
              console.log('[UserService] Concurrent user detected via UID. Proceeding to merge update phase.');
              user = foundByUid;
            } else {
              console.error('[UserService] Insert Error remains unresolved:', insertError);
              throw insertError;
            }
          }
        } else {
          return newUser;
        }
      }

      console.log(`[UserService] Match found in master database for ${email}. Merging profiles...`);

      // 5. Merge identities
      const updates: any = {
        last_login: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      if (user.email !== email) {
        updates.email = email;
      }

      if (name && (!user.name || user.name === user.email.split('@')[0] || user.name === '')) {
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

      // Perform updates if any changes or logins are resolved (always updates last_login/last_login_at)
      if (Object.keys(updates).length >= 2) {
        console.log(`[UserService] Applying clean identity resolution merges for ${email}:`, updates);
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id)
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
