import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

export interface CategoryItemRecord {
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

// High-definition bakery photography seed categories matching Frosty Bite
export const DEFAULT_SEED_CATEGORIES: CategoryItemRecord[] = [
  {
    id: 'cat-cakes',
    name: 'Cakes',
    slug: 'cakes',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
    description: 'Custom handcrafted celebratory tiered cakes and velvety sponges.',
    is_active: true,
    sort_order: 1,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-cheesecakes',
    name: 'Cheesecakes',
    slug: 'cheesecakes',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800',
    description: 'New York style baked cream cheese and blueberry coulis cheesecakes.',
    is_active: true,
    sort_order: 2,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-pastries',
    name: 'Pastries',
    slug: 'pastries',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
    description: 'Flaky French croissants, fruit danishes, and puff pastries.',
    is_active: true,
    sort_order: 3,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-cupcakes',
    name: 'Cupcakes',
    slug: 'cupcakes',
    image: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=800',
    description: 'Freshly piped buttercream cupcakes with gourmet confectionery toppings.',
    is_active: true,
    sort_order: 4,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-brownies',
    name: 'Brownies',
    slug: 'brownies',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800',
    description: 'Rich Belgian chocolate fudge brownies and walnut blondies.',
    is_active: true,
    sort_order: 5,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-cookies',
    name: 'Cookies',
    slug: 'cookies',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800',
    description: 'Oven-fresh chunky chocolate chip cookies and butter shortbreads.',
    is_active: true,
    sort_order: 6,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-desserts',
    name: 'Desserts',
    slug: 'desserts',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800',
    description: 'Italian panna cotta, artisan trifles, and confectionery jars.',
    is_active: true,
    sort_order: 7,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-breads',
    name: 'Breads',
    slug: 'breads',
    image: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&q=80&w=800',
    description: 'Artisan sourdough loaves, brioche buns, and rustic baguettes.',
    is_active: true,
    sort_order: 8,
    product_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

// In-memory runtime cache
let memoryCategories: CategoryItemRecord[] = [...DEFAULT_SEED_CATEGORIES];

const SETTING_ID = 'categories_catalog';

/**
 * Helper to fetch categories from Supabase app_settings
 */
async function loadCategoriesFromStore(): Promise<CategoryItemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', SETTING_ID)
      .maybeSingle();

    if (!error && data && data.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCategories = parsed;
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn('[CategoriesRoute] Failed to load categories from app_settings:', err.message);
  }

  // If not stored yet, initialize with default seed categories
  try {
    await saveCategoriesToStore(DEFAULT_SEED_CATEGORIES);
  } catch (_) {}

  return memoryCategories;
}

/**
 * Helper to persist categories to Supabase app_settings
 */
async function saveCategoriesToStore(categories: CategoryItemRecord[]): Promise<boolean> {
  memoryCategories = categories;
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        id: SETTING_ID,
        value: JSON.stringify(categories),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('[CategoriesRoute] Failed to upsert app_settings categories:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[CategoriesRoute] Exception saving categories:', err.message);
    return false;
  }
}

/**
 * Compute real-time product counts for each category from the `products` table
 */
async function enrichCategoriesWithProductCounts(categories: CategoryItemRecord[]): Promise<CategoryItemRecord[]> {
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, category');

    const productsList = products || [];

    return categories.map((cat) => {
      // Products count matches either category name OR assigned product_ids
      const matchedProducts = productsList.filter((p: any) => {
        const catNameMatch = p.category && (
          p.category.trim().toLowerCase() === cat.name.trim().toLowerCase() ||
          p.category.trim().toLowerCase() === cat.slug.trim().toLowerCase()
        );
        const idMatch = Array.isArray(cat.product_ids) && cat.product_ids.includes(p.id);
        return catNameMatch || idMatch;
      });

      // Synchronize product_ids list
      const matchedIds = Array.from(new Set([
        ...(cat.product_ids || []),
        ...matchedProducts.map((p: any) => String(p.id))
      ]));

      return {
        ...cat,
        product_ids: matchedIds,
        products_count: matchedIds.length,
      };
    });
  } catch (err) {
    return categories.map((c) => ({
      ...c,
      products_count: (c.product_ids || []).length
    }));
  }
}

/**
 * GET /api/categories
 * Return all categories with product counts
 */
router.get('/', async (req, res) => {
  try {
    const rawCategories = await loadCategoriesFromStore();
    const enriched = await enrichCategoriesWithProductCounts(rawCategories);
    res.json({
      success: true,
      categories: enriched.sort((a, b) => a.sort_order - b.sort_order)
    });
  } catch (err: any) {
    console.error('[CategoriesRoute] GET error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
});

/**
 * POST /api/categories
 * Create a new category and assign products to it
 */
router.post('/', async (req, res) => {
  try {
    const { name, image, description, is_active, sort_order, product_ids } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const assignedProductIds: string[] = Array.isArray(product_ids) ? product_ids : [];

    const categories = await loadCategoriesFromStore();

    // Check duplicate name
    if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      return res.status(400).json({ error: `A category named "${trimmedName}" already exists.` });
    }

    const newCategory: CategoryItemRecord = {
      id,
      name: trimmedName,
      slug,
      image: image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
      description: description?.trim() || '',
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      sort_order: typeof sort_order === 'number' ? sort_order : categories.length + 1,
      product_ids: assignedProductIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedCategories = [...categories, newCategory];
    await saveCategoriesToStore(updatedCategories);

    // If products were assigned, update their category in the products table
    if (assignedProductIds.length > 0) {
      try {
        await supabase
          .from('products')
          .update({ category: trimmedName })
          .in('id', assignedProductIds);
      } catch (prodErr: any) {
        console.warn('[CategoriesRoute] Failed to update products category field:', prodErr.message);
      }
    }

    const enriched = await enrichCategoriesWithProductCounts([newCategory]);

    res.status(201).json({
      success: true,
      message: `Category "${trimmedName}" created successfully!`,
      category: enriched[0]
    });
  } catch (err: any) {
    console.error('[CategoriesRoute] POST error:', err);
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

/**
 * PUT /api/categories/:id
 * Update category details and product assignments
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image, description, is_active, sort_order, product_ids } = req.body;

    const categories = await loadCategoriesFromStore();
    const existingIndex = categories.findIndex(c => c.id === id);

    if (existingIndex === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const existing = categories[existingIndex];
    const updatedName = name && typeof name === 'string' ? name.trim() : existing.name;
    const updatedSlug = updatedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newProductIds: string[] = Array.isArray(product_ids) ? product_ids : existing.product_ids;

    const updatedCategory: CategoryItemRecord = {
      ...existing,
      name: updatedName,
      slug: updatedSlug,
      image: image !== undefined ? image : existing.image,
      description: description !== undefined ? description : existing.description,
      is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
      sort_order: typeof sort_order === 'number' ? sort_order : existing.sort_order,
      product_ids: newProductIds,
      updated_at: new Date().toISOString()
    };

    categories[existingIndex] = updatedCategory;
    await saveCategoriesToStore(categories);

    // Sync products table
    try {
      // 1. Assign selected products to this category
      if (newProductIds.length > 0) {
        await supabase
          .from('products')
          .update({ category: updatedName })
          .in('id', newProductIds);
      }

      // 2. If name changed, also update all existing products that had the old name
      if (updatedName !== existing.name) {
        await supabase
          .from('products')
          .update({ category: updatedName })
          .eq('category', existing.name);
      }
    } catch (prodErr: any) {
      console.warn('[CategoriesRoute] Error syncing product categories:', prodErr.message);
    }

    const enriched = await enrichCategoriesWithProductCounts([updatedCategory]);

    res.json({
      success: true,
      message: `Category "${updatedName}" updated successfully!`,
      category: enriched[0]
    });
  } catch (err: any) {
    console.error('[CategoriesRoute] PUT error:', err);
    res.status(500).json({ error: err.message || 'Failed to update category' });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const categories = await loadCategoriesFromStore();
    const existing = categories.find(c => c.id === id);

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const filtered = categories.filter(c => c.id !== id);
    await saveCategoriesToStore(filtered);

    // Reset products in this category to 'General'
    try {
      await supabase
        .from('products')
        .update({ category: 'General' })
        .eq('category', existing.name);
    } catch (_) {}

    res.json({
      success: true,
      message: `Category "${existing.name}" deleted successfully.`
    });
  } catch (err: any) {
    console.error('[CategoriesRoute] DELETE error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete category' });
  }
});

export default router;
