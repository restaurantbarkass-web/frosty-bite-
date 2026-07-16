import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, FoodItem } from '../types';
import { haptic } from '../lib/utils';

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CartStateContextType['appliedCoupon']>(null);

  useEffect(() => {
    // Load claimed coupon from localStorage if it exists
    try {
      const claimedCode = localStorage.getItem('claimed_coupon_code');
      if (claimedCode) {
          // We might need to fetch the coupon data from supabase here to validate it
          // But for now, let's just keep the setAppliedCoupon action available
      }
    } catch (e) {
      console.warn('Failed to read claimed_coupon_code from localStorage:', e);
    }
  }, []);

  const addToCart = React.useCallback((item: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (item.stock_quantity !== undefined && existing.quantity >= item.stock_quantity) {
          haptic.error();
          return prev;
        }
        haptic.success();
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      haptic.success();
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = React.useCallback((id: string) => {
    haptic.medium();
    setCart(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = React.useCallback((id: string, delta: number) => {
    haptic.light();
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.quantity + delta;
        if (delta > 0 && i.stock_quantity !== undefined && newQty > i.stock_quantity) {
          haptic.error();
          return i;
        }
        return { ...i, quantity: Math.max(0, newQty) };
      }
      return i;
    }).filter(i => i.quantity > 0));
  }, []);

  const clearCart = React.useCallback(() => {
    haptic.medium();
    setCart([]);
  }, []);

  const totalItems = React.useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = React.useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  
  const discountAmount = React.useMemo(() => {
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

  const stateValue = React.useMemo(() => ({
    cart,
    isCartOpen,
    totalItems,
    totalPrice,
    subtotal,
    appliedCoupon
  }), [cart, isCartOpen, totalItems, totalPrice, subtotal, appliedCoupon]);

  const actionsValue = React.useMemo(() => ({
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setIsCartOpen,
    setAppliedCoupon
  }), [addToCart, removeFromCart, updateQuantity, clearCart, setAppliedCoupon]);

  return (
    <CartStateContext.Provider value={stateValue}>
      <CartActionsContext.Provider value={actionsValue}>
        {children}
      </CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
};

export const useCart = () => {
  const state = useContext(CartStateContext);
  const actions = useContext(CartActionsContext);
  if (!state || !actions) throw new Error('useCart must be used within a CartProvider');
  return { ...state, ...actions };
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
