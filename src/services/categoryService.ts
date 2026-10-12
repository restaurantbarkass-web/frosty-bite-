export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  product_ids: string[];
  products_count?: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_BAKERY_CATEGORIES: Category[] = [
  {
    id: 'cat-cakes',
    name: 'Cakes',
    slug: 'cakes',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
    description: 'Custom tiered cakes, rich bento creations & velvet sponges.',
    is_active: true,
    sort_order: 1,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-cheesecakes',
    name: 'Cheesecake',
    slug: 'cheesecake',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800',
    description: 'New York style baked cheesecakes, blueberry swirl & Lotus Biscoff treats.',
    is_active: true,
    sort_order: 2,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-pastries',
    name: 'Pastries',
    slug: 'pastries',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
    description: 'Flaky French butter croissants, Danish pastries & cream eclairs.',
    is_active: true,
    sort_order: 3,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-cupcakes',
    name: 'Cupcakes',
    slug: 'cupcakes',
    image: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=800',
    description: 'Mini artisanal cupcakes with swirls of whipped velvet frosting.',
    is_active: true,
    sort_order: 4,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-brownies',
    name: 'Brownies',
    slug: 'brownies',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800',
    description: 'Dense Belgian dark chocolate fudge brownies & walnut blondies.',
    is_active: true,
    sort_order: 5,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-cookies',
    name: 'Cookies',
    slug: 'cookies',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800',
    description: 'Freshly baked soft-baked cookies & buttery tea-time biscuits.',
    is_active: true,
    sort_order: 6,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-desserts',
    name: 'Desserts',
    slug: 'desserts',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800',
    description: 'Decadent panna cottas, gourmet dessert bowls & trifles.',
    is_active: true,
    sort_order: 7,
    product_ids: [],
    products_count: 0
  },
  {
    id: 'cat-breads',
    name: 'Breads',
    slug: 'breads',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&q=80&w=800',
    description: 'Golden crusty sourdough loaves, milk bread & brioche buns.',
    is_active: true,
    sort_order: 8,
    product_ids: [],
    products_count: 0
  }
];

const STORAGE_KEY = 'frostybite_cached_categories_v2';
const EVENT_NAME = 'frostybite_categories_updated';

class CategoryService {
  private inMemoryCache: Category[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 15000; // 15 seconds SWR

  constructor() {
    this.hydrateFromLocalStorage();
  }

  private hydrateFromLocalStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.inMemoryCache = parsed;
        }
      }
    } catch (_) {}
  }

  private persistToLocalStorage(categories: Category[]) {
    this.inMemoryCache = categories;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    } catch (_) {}
    // Broadcast event across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: categories }));
    }
  }

  /**
   * Subscribe to real-time category updates across components
   */
  public subscribe(callback: (categories: Category[]) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Category[]>;
      if (customEvent.detail) {
        callback(customEvent.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, handler);
      return () => window.removeEventListener(EVENT_NAME, handler);
    }
    return () => {};
  }

  /**
   * Fetch all categories with SWR caching & offline resilience
   */
  async getCategories(force = false): Promise<Category[]> {
    const now = Date.now();
    if (!force && this.inMemoryCache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.inMemoryCache;
    }

    try {
      const response = await fetch('/api/categories', {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          this.lastFetchTime = now;
          this.persistToLocalStorage(data.categories);
          return data.categories;
        }
      }
    } catch (err) {
      console.warn('[CategoryService] API fetch failed, using cached/fallback categories:', err);
    }

    if (this.inMemoryCache && this.inMemoryCache.length > 0) {
      return this.inMemoryCache;
    }

    this.persistToLocalStorage(DEFAULT_BAKERY_CATEGORIES);
    return DEFAULT_BAKERY_CATEGORIES;
  }

  /**
   * Create a new category
   */
  async createCategory(payload: {
    name: string;
    image: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
    product_ids?: string[];
  }): Promise<Category> {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create category');
    }

    // Refresh and update cache
    await this.getCategories(true);
    return data.category;
  }

  /**
   * Update category
   */
  async updateCategory(id: string, payload: Partial<Category>): Promise<Category> {
    const response = await fetch(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to update category');
    }

    await this.getCategories(true);
    return data.category;
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<boolean> {
    const response = await fetch(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete category');
    }

    await this.getCategories(true);
    return true;
  }
}

export const categoryService = new CategoryService();
