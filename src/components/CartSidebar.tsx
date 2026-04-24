import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { LottiePlayer } from './LottiePlayer';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190]"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-[200] flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <ShoppingBag className="text-primary" />
                <h2 className="text-xl font-bold">Your Cart</h2>
                <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                  {totalItems} items
                </span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-48 h-48">
                    <LottiePlayer 
                      url="https://lottie.host/2e0e5672-136b-4e11-857c-87d25e4c636f/7Z8Tf9u7H5.json"
                      className="w-full h-full"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase mb-2">Cart is Empty</h3>
                    <p className="text-muted text-sm px-8">Your cart is currently crying for some delicious artisan treats!</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex space-x-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover border border-border"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm">{item.name}</h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-muted hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-primary font-bold text-sm">₹{item.price * item.quantity}</span>
                        <div className="flex items-center space-x-3 bg-secondary rounded-lg px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-muted hover:text-white transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-muted hover:text-white transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-border bg-secondary/30 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Subtotal</span>
                  <span className="font-bold">₹{totalPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Delivery Fee</span>
                  <span className="text-green-500 font-bold">FREE</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">₹{totalPrice}</span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/checkout');
                  }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  Checkout
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
