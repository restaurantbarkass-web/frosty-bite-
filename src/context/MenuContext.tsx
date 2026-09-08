import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FoodItem } from '../types';
import { MENU_ITEMS } from '../constants';
import { ProductService } from '../services/ProductService';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';

interface MenuContextType {
  items: FoodItem[];
  loading: boolean;
  categories: string[];
  refreshMenu: () => Promise<void>;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<FoodItem[]>(() => {
    try {
      const cached = localStorage.getItem('menu_cache') || localStorage.getItem('fb_cache_store:products');
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : parsed.data;
        if (list && list.length > 0) return list;
      }
      return MENU_ITEMS;
    } catch {
      return MENU_ITEMS;
    }
  });

  const [loading, setLoading] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshMenu = useCallback(async () => {
    try {
      const freshItems = await ProductService.getProducts((updatedItems) => {
        setItems(updatedItems);
      });
      if (freshItems && freshItems.length > 0) {
        setItems(freshItems);
      }
    } catch (err) {
      console.warn('[MenuContext] Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Fetch products with Stale-While-Revalidate
    refreshMenu();

    // 2. Subscribe to CacheManager real-time updates
    const unsubscribe = CacheManager.subscribe(
      CacheKeys.PRODUCTS,
      CacheNamespace.STORE,
      (updatedItems) => {
        if (Array.isArray(updatedItems) && updatedItems.length > 0) {
          setItems(updatedItems);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [refreshMenu]);

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(items.map((i) => i.category)))].filter(Boolean);
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      loading,
      categories,
      refreshMenu,
    }),
    [items, loading, categories, refreshMenu]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) throw new Error('useMenu must be used within a MenuProvider');
  return context;
};
