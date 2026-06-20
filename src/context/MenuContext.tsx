import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('menu_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });

  const fetchMenu = useCallback(async () => {
    // Only manifest a visible loading screen if we have absolutely nothing to render
    if (items.length === 0) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => {
          let ai_desc = item.ai_description || '';
          let est_time = item.estimated_delivery_time !== undefined ? Number(item.estimated_delivery_time) : undefined;
          let est_unit = item.estimated_delivery_time_unit || '';
          let est_string = item.estimated_delivery_time_string || '';
          let avail_date = item.available_date || '';
          let avail_day = item.available_day || '';
          
          if (ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
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
            } catch (e) {
              // Ignore failure
            }
          }
          
          return {
            id: item.id,
            name: item.name,
            price: item.price,
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
            available_day: avail_day
          };
        });

        const newCacheStr = JSON.stringify(mapped);
        const oldCacheStr = localStorage.getItem('menu_cache');
        
        // Prevent layout shift/unwanted thread load by avoiding state updates when data matches
        if (newCacheStr !== oldCacheStr) {
          setItems(mapped);
          localStorage.setItem('menu_cache', newCacheStr);
        }
      } else {
        if (items.length === 0) {
          setItems(MENU_ITEMS);
        }
      }
    } catch (err) {
      console.error('Fetch Menu Error:', err);
      const cached = localStorage.getItem('menu_cache');
      if (cached) {
        setItems(JSON.parse(cached));
      } else if (items.length === 0) {
        setItems(MENU_ITEMS);
      }
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    fetchMenu();

    // Set up real-time subscription for product/inventory changes
    const channel = supabase
      .channel('menu_products_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[Realtime] Product change detected (MenuContext):', payload);
          fetchMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMenu]);

  const categories = React.useMemo(() => {
    return ['All', ...Array.from(new Set(items.map(i => i.category)))].filter(Boolean);
  }, [items]);

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
