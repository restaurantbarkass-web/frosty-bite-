import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, FoodItem } from '../types';

interface CartStateContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  totalItems: number;
  totalPrice: number;
  subtotal: number;
}

interface CartActionsContextType {
  addToCart: (item: FoodItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  setIsCartOpen: (open: boolean) => void;
}

const CartStateContext = createContext<CartStateContextType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = React.useCallback((item: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (item.stock_quantity !== undefined && existing.quantity >= item.stock_quantity) {
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = React.useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = React.useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.quantity + delta;
        if (delta > 0 && i.stock_quantity !== undefined && newQty > i.stock_quantity) {
          return i;
        }
        return { ...i, quantity: Math.max(0, newQty) };
      }
      return i;
    }).filter(i => i.quantity > 0));
  }, []);

  const clearCart = React.useCallback(() => {
    setCart([]);
  }, []);

  const totalItems = React.useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const subtotal = React.useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const totalPrice = subtotal;

  const stateValue = React.useMemo(() => ({
    cart,
    isCartOpen,
    totalItems,
    totalPrice,
    subtotal
  }), [cart, isCartOpen, totalItems, totalPrice, subtotal]);

  const actionsValue = React.useMemo(() => ({
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setIsCartOpen
  }), [addToCart, removeFromCart, updateQuantity, clearCart]);

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
