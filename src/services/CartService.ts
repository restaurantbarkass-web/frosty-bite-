import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';
import { CartItem } from '../types';

export class CartService {
  static async getCart(): Promise<CartItem[]> {
    const cached = await CacheManager.get<CartItem[]>(CacheKeys.CART_ITEMS, CacheNamespace.CART);
    return cached || [];
  }

  static async saveCart(items: CartItem[]): Promise<void> {
    await CacheManager.set(CacheKeys.CART_ITEMS, items, CacheNamespace.CART);
  }

  static async clearCart(): Promise<void> {
    await CacheManager.remove(CacheKeys.CART_ITEMS, CacheNamespace.CART);
  }
}
