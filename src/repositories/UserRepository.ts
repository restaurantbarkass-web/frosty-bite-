import { BaseRepository } from './BaseRepository';
import { supabase } from '../supabase';
import { CacheKeys, CacheNamespace } from '../core/cache/CacheKeys';

export interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  [key: string]: any;
}

class UserRepositoryImpl extends BaseRepository {
  /**
   * Get user profile scoped to user session via CacheOrchestrator
   */
  async getUserProfile(userId?: string | null): Promise<UserRecord | null> {
    const activeUserId = userId || this.getCurrentUserId();
    if (!activeUserId) return null;

    return this.getUserData<UserRecord>(CacheKeys.USER_PROFILE, activeUserId);
  }

  /**
   * Save / Insert user record in database and sync cache
   */
  async createUserRecord(userData: Record<string, any>): Promise<UserRecord | null> {
    const userId = userData.id || this.getCurrentUserId();
    
    return this.deduplicate(`create_user_${userId || userData.email}`, async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert(userData)
          .select()
          .maybeSingle();

        if (error) {
          console.warn('[UserRepository] Error inserting user record:', error);
          return null;
        }

        if (data && userId) {
          await this.setUserData(CacheKeys.USER_PROFILE, data, userId);
        }

        return data;
      } catch (err) {
        console.error('[UserRepository] Failed creating user record:', err);
        return null;
      }
    });
  }
}

export const UserRepository = new UserRepositoryImpl();
