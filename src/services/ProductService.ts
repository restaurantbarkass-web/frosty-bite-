import { supabase } from '../supabase';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';
import { FoodItem } from '../types';
import { MENU_ITEMS } from '../constants';

export class ProductService {
  /**
   * Get all products with Stale-While-Revalidate pattern
   */
  static async getProducts(onUpdate?: (items: FoodItem[]) => void): Promise<FoodItem[]> {
    const { data } = await CacheManager.staleWhileRevalidate<FoodItem[]>(
      CacheKeys.PRODUCTS,
      async () => {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return MENU_ITEMS;

        return data.map((item: any) => this.mapProductRecord(item));
      },
      CacheNamespace.STORE,
      {
        onUpdate: (freshItems) => {
          if (onUpdate) onUpdate(freshItems);
        },
      }
    );

    return data || MENU_ITEMS;
  }

  /**
   * Get single product from cache first
   */
  static async getProductById(id: string): Promise<FoodItem | null> {
    const products = await this.getProducts();
    const found = products.find((p) => p.id === id);
    if (found) return found;

    try {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return this.mapProductRecord(data);
    } catch {
      return null;
    }
  }

  private static mapProductRecord(item: any): FoodItem {
    let ai_desc = item.ai_description || '';
    let est_time = item.estimated_delivery_time !== undefined ? Number(item.estimated_delivery_time) : undefined;
    let est_unit = item.estimated_delivery_time_unit || '';
    let est_string = item.estimated_delivery_time_string || '';
    let avail_date = item.available_date || '';
    let avail_day = item.available_day || '';

    if (typeof ai_desc === 'string' && ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
      try {
        const parsed = JSON.parse(ai_desc);
        ai_desc = parsed.ai_description || '';
        if (est_time === undefined && parsed.estimated_delivery_time !== undefined) {
          est_time = Number(parsed.estimated_delivery_time);
        }
        if (!est_unit && parsed.estimated_delivery_time_unit !== undefined) {
          est_unit = parsed.estimated_delivery_time_unit;
        }
        if (!est_string && parsed.estimated_delivery_time_string !== undefined) {
          est_string = parsed.estimated_delivery_time_string;
        }
        if (!avail_date && parsed.available_date !== undefined) {
          avail_date = parsed.available_date;
        }
        if (!avail_day && parsed.available_day !== undefined) {
          avail_day = parsed.available_day;
        }
      } catch (_) {}
    }

    return {
      id: item.id,
      name: item.name,
      price: Number(item.price),
      image: item.image,
      category: item.category || 'General',
      available: item.available ?? true,
      stock_quantity: item.stock_quantity ?? 0,
      description: item.description ?? '',
      rating: item.rating ?? 5,
      tags: item.tags ?? [],
      estimated_delivery_time: est_time || 30,
      estimated_delivery_time_unit: (est_unit || 'mins') as 'mins' | 'days',
      estimated_delivery_time_string: est_string,
      available_date: avail_date,
      available_day: avail_day,
    };
  }
}
