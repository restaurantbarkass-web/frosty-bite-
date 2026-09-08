import { ProductsRepository } from '../repositories';
import { FoodItem } from '../types';

export class ProductService {
  /**
   * Get all products with Stale-While-Revalidate pattern via ProductsRepository
   */
  static async getProducts(onUpdate?: (items: FoodItem[]) => void): Promise<FoodItem[]> {
    return ProductsRepository.getProducts(onUpdate);
  }

  /**
   * Get single product from cache first via ProductsRepository
   */
  static async getProductById(id: string): Promise<FoodItem | null> {
    return ProductsRepository.getProductById(id);
  }
}
