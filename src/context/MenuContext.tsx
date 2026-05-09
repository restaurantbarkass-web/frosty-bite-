import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';
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

  const fetchMenu = async () => {
    setLoading(true);
    try {
      // 1. Try Firestore First
      try {
        const menuDocs = await safeFirestore.getCollection<any>(
          collection(db, 'menu'),
          'menu_list',
          'menu'
        );
        if (menuDocs && menuDocs.length > 0) {
          const mapped = menuDocs.map((item: any) => ({
            ...item,
            id: item.id || item.uid || Math.random().toString(36).substr(2, 9),
            category: item.category || 'General',
            available: item.available ?? true,
            stock_quantity: item.stock_quantity ?? 0,
          }));
          setItems(mapped as FoodItem[]);
          localStorage.setItem('menu_cache', JSON.stringify(mapped));
          setLoading(false);
          return;
        }
      } catch (fErr) {
        console.warn('Firestore menu fail:', fErr);
      }

      // 2. Try Supabase
      const { data, error } = await supabase.from('products').select('*');
      
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
        if (error) console.error('Supabase fetch error:', error);
        if (!items || items.length === 0) setItems(MENU_ITEMS);
      }
    } catch (err) {
      console.error('All menu sources failed:', err);
      if (!items || items.length === 0) setItems(MENU_ITEMS);
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
