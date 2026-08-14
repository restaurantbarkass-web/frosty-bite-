import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CartItem, FoodItem } from '../types';
import { haptic } from '../lib/utils';
import { playPopSound, playClickSound, playErrorShakeSound } from '../utils/soundEffects';
import { CartService } from '../services/CartService';

interface CartStateContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  totalItems: number;
  totalPrice: number;
  subtotal: number;
  appliedCoupon: {
    id: string;
    code: string;
    value: number;
    type: 'percentage' | 'fixed' | 'free_item';
    free_item_id?: string;
    free_item_quantity?: number;
    gift_url?: string;
  } | null;
}

interface CartActionsContextType {
  addToCart: (item: FoodItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  setIsCartOpen: (open: boolean) => void;
  setAppliedCoupon: (coupon: CartStateContextType['appliedCoupon']) => void;
}

const CartStateContext = createContext<CartStateContextType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const cached = localStorage.getItem('fb_cache_cart:cart_items') || localStorage.getItem('frostybite_cart');
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed) ? parsed : parsed.data;
        if (Array.isArray(list)) return list;
      }
    } catch (_) {}
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CartStateContextType['appliedCoupon']>(null);

  // Restore cart from IndexedDB on startup
  useEffect(() => {
    CartService.getCart().then((savedItems) => {
      if (savedItems && savedItems.length > 0) {
        setCart(savedItems);
      }
    }).catch(() => {});
  }, []);

  // Save cart to persistent cache whenever it changes
  useEffect(() => {
    CartService.saveCart(cart).catch(() => {});
  }, [cart]);

  const addToCart = useCallback((item: FoodItem) => {
    playPopSound();
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        if (item.stock_quantity !== undefined && existing.quantity >= item.stock_quantity) {
          haptic.error();
          playErrorShakeSound();
          return prev;
        }
        haptic.success();
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      haptic.success();
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    haptic.medium();
    playClickSound(450);
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    haptic.light();
    if (delta > 0) playPopSound();
    else playClickSound(500);
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.quantity + delta;
            if (delta > 0 && i.stock_quantity !== undefined && newQty > i.stock_quantity) {
              haptic.error();
              playErrorShakeSound();
              return i;
            }
            return { ...i, quantity: Math.max(0, newQty) };
          }
          return i;
        })
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => {
    haptic.medium();
    playClickSound(400);
    setCart([]);
    CartService.clearCart().catch(() => {});
  }, []);

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    if (appliedCoupon.type === 'fixed') {
      return appliedCoupon.value;
    }
    return 0;
  }, [subtotal, appliedCoupon]);

  const totalPrice = Math.max(0, subtotal - discountAmount);

  const stateValue = useMemo(
    () => ({
      cart,
      isCartOpen,
      totalItems,
      totalPrice,
      subtotal,
      appliedCoupon,
    }),
    [cart, isCartOpen, totalItems, totalPrice, subtotal, appliedCoupon]
  );

  const actionsValue = useMemo(
    () => ({
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      setIsCartOpen,
      setAppliedCoupon,
    }),
    [addToCart, removeFromCart, updateQuantity, clearCart, setAppliedCoupon]
  );

  return (
    <CartStateContext.Provider value={stateValue}>
      <CartActionsContext.Provider value={actionsValue}>{children}</CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
};

export const useCart = () => {
  const state = useContext(CartStateContext);
  const actions = useContext(CartActionsContext);
  if (!state || !actions) throw new Error('useCart must be used within a CartProvider');
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
};

export const useCartState = () => {
  const context = useContext(CartStateContext);
  if (!context) throw new Error('useCartState must be used within a CartProvider');
  return context;
};

export const useCartActions = () => {
  const context = useContext(CartActionsContext);
  if (!context) throw new Error('useCartActions must be used within a CartProvider');
  return context;
};
