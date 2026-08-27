import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { useCartState, useCartActions } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { useAppConfig } from '../hooks/useAppConfig';
import { supabase } from '../supabase';
import { OptimizedImage } from './ui/OptimizedImage';

interface CartItemRowProps {
  item: any;
  updateQuantity: (id: string, amount: number) => void;
  removeFromCart: (id: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = React.memo(({ item, updateQuantity, removeFromCart }) => {
  return (
    <motion.div
      layout
      key={item.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex space-x-3 sm:space-x-4 bg-white/5 p-3 rounded-2xl border border-white/5"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
        <OptimizedImage
          src={item.image}
          alt={item.name}
          containerClassName="w-full h-full"
        />
      </div>
      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
        <div className="flex justify-between items-start">
          <h4 className="font-black text-[11px] sm:text-sm uppercase tracking-tight italic truncate pr-2">{item.name}</h4>
          <button
            onClick={() => removeFromCart(item.id)}
            className="text-zinc-600 hover:text-red-500 transition-colors p-1 shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-primary font-black italic text-xs sm:text-sm">₹{item.price * item.quantity}</span>
          <div className="flex items-center space-x-3 bg-secondary/50 rounded-xl px-2 py-1 border border-white/5">
            <motion.button
              whileHover={{ scale: 1.25, x: -1.5 }}
              whileTap={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              onClick={() => updateQuantity(item.id, -1)}
              className="text-zinc-400 hover:text-primary transition-colors p-1"
            >
              <Minus size={12} className="stroke-[3px]" />
            </motion.button>
            <span className="overflow-hidden flex items-center justify-center w-5">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={item.quantity}
                  initial={{ scale: 0.6, y: -8, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.6, y: 8, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                  className="text-[10px] font-black text-center text-white block shrink-0"
                >
                  {item.quantity}
                </motion.span>
              </AnimatePresence>
            </span>
            <motion.button
              whileHover={{ scale: 1.25, rotate: 90, x: 1.5 }}
              whileTap={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              onClick={() => updateQuantity(item.id, 1)}
              className="text-zinc-400 hover:text-primary transition-colors p-1"
            >
              <Plus size={12} className="stroke-[3px]" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

CartItemRow.displayName = 'CartItemRow';

export const CartSidebar: React.FC = () => {
  const { cart, totalPrice, subtotal, totalItems, appliedCoupon, isCartOpen: isOpen } = useCartState();
  const { updateQuantity, removeFromCart, setIsCartOpen } = useCartActions();
  const navigate = useNavigate();
  const { isOrderingOpen, isPickupOnly } = useAppConfig();

  const [suggestions, setSuggestions] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .limit(10);
        
        if (!error && data) {
          // Filter out items already in cart and randomize
          const cartIds = cart.map(item => item.id);
          const filtered = data
            .filter(item => !cartIds.includes(item.id) && item.available !== false)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
          setSuggestions(filtered);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };

    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen, cart.length]);

  const onClose = () => setIsCartOpen(false);

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

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen h-[100dvh] w-full max-w-md bg-background border-l border-border z-[200] flex flex-col shadow-2xl"
          >
            <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <ShoppingBag className="text-primary" size={20} />
                <h2 className="text-lg sm:text-xl font-bold">Your Cart</h2>
                <span className="bg-primary/10 text-primary text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
                  {totalItems} items
                </span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide overscroll-contain pb-32">
              {!isOrderingOpen && (
                <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500">
                  <AlertTriangle className="shrink-0" size={18} />
                  <p className="text-[10px] sm:text-xs font-bold leading-tight uppercase tracking-widest">Orders are currently closed. Checkout is disabled.</p>
                </div>
              )}
              
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-10">
                  <div className="w-48 h-48 sm:w-56 sm:h-56">
                    <FrostyAnimation 
                      url={LOTTIE_ANIMATIONS.CAKE}
                      className="w-full h-full"
                      fallback={
                        <motion.div
                          animate={{ 
                            rotate: [0, -5, 5, -5, 0],
                            scale: [1, 1.05, 1]
                          }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                          className="w-full h-full flex items-center justify-center p-8 opacity-20"
                        >
                          <ShoppingBag className="text-primary w-full h-full" strokeWidth={1} />
                        </motion.div>
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-black italic tracking-tighter uppercase">Your box is empty!</h3>
                    <p className="text-muted text-[10px] sm:text-xs px-8 uppercase tracking-widest leading-relaxed">Don't let these treats get cold. <br/>Add some sweetness to your day!</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <>
                  {/* Cake Animation Decoration */}
                  <motion.div 
                    key={cart.length}
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="flex justify-center mb-2"
                  >
                    <div className="w-24 h-24 opacity-60">
                      <FrostyAnimation 
                        url={LOTTIE_ANIMATIONS.CAKE}
                        className="w-full h-full"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center p-4">
                            <ShoppingBag className="text-primary/20 w-16 h-16" strokeWidth={1} />
                          </div>
                        }
                      />
                    </div>
                  </motion.div>
                  
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <CartItemRow
                          key={item.id}
                          item={item}
                          updateQuantity={updateQuantity}
                          removeFromCart={removeFromCart}
                        />
                      ))}
                    </div>

                    {/* Suggestions Section */}
                    {suggestions.length > 0 && (
                      <div className="pt-8 space-y-4">
                        <div className="flex items-center gap-2 px-1">
                          <Sparkles size={16} className="text-primary animate-pulse" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">You Might Also Like</h3>
                        </div>
                        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide -mx-2 px-2">
                          {suggestions.map((item) => (
                            <motion.button
                              key={item.id}
                              whileHover={{ y: -4 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                // Close cart and navigate to product
                                setIsCartOpen(false);
                                navigate(`/product/${item.id}`);
                              }}
                              className="w-40 shrink-0 bg-white/5 rounded-2xl border border-white/5 p-2 text-left group"
                            >
                              <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                                <OptimizedImage
                                  src={item.image}
                                  alt={item.name}
                                  containerClassName="w-full h-full"
                                  className="transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-2 right-2 p-1.5 bg-primary rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-10">
                                  <Plus size={14} strokeWidth={3} />
                                </div>
                              </div>
                              <h4 className="text-[10px] font-black uppercase tracking-tight italic truncate text-zinc-300 mb-1">{item.name}</h4>
                              <p className="text-xs font-black text-primary italic">₹{item.price}</p>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 sm:p-6 border-t border-border bg-background/95 backdrop-blur-md space-y-4 sticky bottom-0 z-20 pb-[calc(16px+env(safe-area-inset-bottom))]">
                <div className="space-y-2">
                  {isPickupOnly && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-amber-400 text-xs font-bold mb-2">
                      <span className="flex items-center gap-1.5">
                        🛍 Order Type:
                      </span>
                      <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                        In-Store Pickup
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      <span>Discount ({appliedCoupon.code})</span>
                      <span>-₹{subtotal - totalPrice}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <span>Delivery Fee</span>
                    <span className="text-emerald-500">{isPickupOnly ? 'FREE (Pickup)' : 'FREE'}</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-white">Grand Total</span>
                    <span className="text-xl font-black text-primary italic">₹{totalPrice}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isOrderingOpen) return;
                    onClose();
                    navigate('/checkout');
                  }}
                  disabled={!isOrderingOpen}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 disabled:bg-zinc-800 disabled:shadow-none disabled:cursor-not-allowed group relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isOrderingOpen ? (
                      <>
                        <Check size={18} />
                        Confirm & Checkout
                      </>
                    ) : (
                      'Orders Closed'
                    )}
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
