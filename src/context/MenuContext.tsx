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
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          category: item.category || 'General',
          available: item.available ?? true,
          stock_quantity: item.stock_quantity ?? 0,
          description: item.description ?? '',
          rating: item.rating ?? 5,
          tags: item.tags ?? []
        }));
        setItems(mapped);
        localStorage.setItem('menu_cache', JSON.stringify(mapped));
      } else {
        setItems(MENU_ITEMS);
      }
    } catch (err) {
      console.error('Fetch Menu Error:', err);
      // Fallback to cache if exists
      const cached = localStorage.getItem('menu_cache');
      if (cached) {
        setItems(JSON.parse(cached));
      } else {
        setItems(MENU_ITEMS);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category)))].filter(Boolean);

  return (
    <MenuContext.Provider value={{ items, loading, categories, refreshMenu: fetchMenu }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) throw new Error('useMenu must be used within a MenuProvider');
  return context;
};
