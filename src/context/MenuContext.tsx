import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { FoodItem } from '../types';
import { MENU_ITEMS } from '../constants';

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
      const cached = localStorage.getItem('menu_cache');
      return cached ? JSON.parse(cached) : MENU_ITEMS;
    } catch {
      return MENU_ITEMS;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchMenu = React.useCallback(async () => {
    setLoading(true);
    try {
      // Prioritize Supabase for Menu Items
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          image: item.image,
          category: item.category || 'General',
          available: item.available ?? true,
          stock_quantity: item.stock_quantity ?? 100,
          description: item.description ?? '',
          rating: Number(item.rating ?? 5),
          tags: item.tags ?? []
        }));
        setItems(mapped);
        localStorage.setItem('menu_cache', JSON.stringify(mapped));
      } else {
        if (error) {
          console.warn('Supabase fetch error, falling back to cache:', error);
        }
        // Fallback to cache if database returns no data or error
        const cached = localStorage.getItem('menu_cache');
        if (cached) {
          setItems(JSON.parse(cached));
        } else {
          setItems(MENU_ITEMS);
        }
      }
    } catch (err) {
      console.error('Menu fetching failed:', err);
      // Final fallback to hardcoded items
      // Using functional update for setItems to avoid dependency on 'items' state
      setItems(prevItems => {
        if (!prevItems || prevItems.length === 0) {
          const cached = localStorage.getItem('menu_cache');
          return cached ? JSON.parse(cached) : MENU_ITEMS;
        }
        return prevItems;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, []);

  const categories = React.useMemo(() => 
    ['All', ...Array.from(new Set(items.map(i => i.category)))].filter(Boolean) as string[],
    [items]
  );

  const value = React.useMemo(() => ({ 
    items, 
    loading, 
    categories, 
    refreshMenu: fetchMenu 
  }), [items, loading, categories, fetchMenu]);

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) throw new Error('useMenu must be used within a MenuProvider');
  return context;
};
