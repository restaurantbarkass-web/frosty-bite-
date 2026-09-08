import { supabase } from '../supabase';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';

export class BannerService {
  static async getBanners(onUpdate?: (banners: any[]) => void): Promise<any[]> {
    const { data } = await CacheManager.staleWhileRevalidate<any[]>(
      CacheKeys.BANNERS,
      async () => {
        const { data, error } = await supabase
          .from('banners')
          .select('*')
          .order('priority', { ascending: false });

        if (error) throw error;
        return data || [];
      },
      CacheNamespace.STORE,
      {
        onUpdate: (freshBanners) => {
          if (onUpdate) onUpdate(freshBanners);
        },
      }
    );

    return data || [];
  }
}
