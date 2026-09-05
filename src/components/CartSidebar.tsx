import React, { useState, useEffect } from 'react';
import { 
  X, 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  ArrowRight, 
  Store, 
  Truck, 
  ShieldCheck,
  Tag
} from 'lucide-react';
import { useCartState, useCartActions } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { useAppConfig } from '../hooks/useAppConfig';
import { supabase } from '../supabase';
import { OptimizedImage } from './ui/OptimizedImage';
import toast from 'react-hot-toast';

interface CartItemRowProps {
  item: any;
  updateQuantity: (id: string, amount: number) => void;
  removeFromCart: (id: string) => void;
  onNavigate: (id: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = React.memo(({ 
  item, 
  updateQuantity, 
  removeFromCart,
  onNavigate 
}) => {
  return (
    <motion.div
      layout
      key={item.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="flex items-center gap-3 sm:gap-4 bg-white p-3 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-300 transition-all group"
    >
      {/* Product Thumbnail */}
      <div 
        onClick={() => onNavigate(item.id)}
        className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden border border-stone-200/80 shrink-0 bg-stone-100 cursor-pointer relative group-hover:opacity-95"
      >
        <OptimizedImage
          src={item.image}
          alt={item.name}
          containerClassName="w-full h-full"
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Item Info */}
      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div 
            onClick={() => onNavigate(item.id)}
            className="cursor-pointer min-w-0"
          >
            <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate group-hover:text-[#E76A54] transition-colors">
              {item.name}
            </h4>
            <p className="text-[11px] text-stone-500 font-medium">
              ₹{item.price} each
            </p>
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={() => {
              removeFromCart(item.id);
              toast.success(`${item.name} removed`, { duration: 1500 });
            }}
            className="text-stone-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 shrink-0 cursor-pointer"
            aria-label="Remove item"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Price & Quantity Stepper */}
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-100">
          <span className="text-[#E76A54] font-black text-sm sm:text-base">
            ₹{item.price * item.quantity}
          </span>

          {/* Stepper Controls */}
          <div className="flex items-center gap-1.5 bg-stone-50 rounded-xl p-1 border border-stone-200/90 shadow-2xs">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => updateQuantity(item.id, -1)}
              className="w-6 h-6 flex items-center justify-center text-stone-700 hover:bg-stone-200 hover:text-stone-900 rounded-lg transition-colors cursor-pointer bg-white border border-stone-200/60 shadow-2xs"
              aria-label="Decrease quantity"
            >
              <Minus size={12} strokeWidth={2.5} />
            </motion.button>
            <span className="flex items-center justify-center min-w-[22px] font-black text-xs text-stone-900 select-none">
              {item.quantity}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => updateQuantity(item.id, 1)}
              className="w-6 h-6 flex items-center justify-center text-stone-700 hover:bg-stone-200 hover:text-stone-900 rounded-lg transition-colors cursor-pointer bg-white border border-stone-200/60 shadow-2xs"
              aria-label="Increase quantity"
            >
              <Plus size={12} strokeWidth={2.5} />
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
  const { updateQuantity, removeFromCart, setIsCartOpen, addToCart } = useCartActions();
  const navigate = useNavigate();
  const { isOrderingOpen, isPickupOnly } = useAppConfig();

  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Fetch Recommended Bakery Treats
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .limit(12);
        
        if (!error && data) {
          const cartIds = cart.map(item => item.id);
          const filtered = data
            .filter(item => !cartIds.includes(item.id) && item.available !== false)
            .sort(() => 0.5 - Math.random())
            .slice(0, 4);
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

  const handleProductNavigate = (id: string) => {
    setIsCartOpen(false);
    navigate(`/product/${id}`);
  };

  const handleQuickAdd = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    addToCart(item);
    toast.success(`Added ${item.name} to cart!`, { duration: 1500 });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Container */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute right-0 top-0 bottom-0 h-full w-full max-w-md bg-[#FAF8F5] text-stone-900 border-l border-stone-200 flex flex-col shadow-2xl overflow-hidden"
          >
            {/* 1. Header (Crisp White with High Contrast) */}
            <header className="shrink-0 bg-white border-b border-stone-200 px-4 sm:px-5 py-4 flex items-center justify-between shadow-2xs z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFF2EE] text-[#E76A54] flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-serif text-stone-900 leading-tight">
                    Your Bakery Cart
                  </h2>
                  <p className="text-xs text-stone-500 font-medium">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'} in your box
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer border border-stone-200/80"
                aria-label="Close cart"
              >
                <X size={18} strokeWidth={2.2} />
              </motion.button>
            </header>

            {/* 2. Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 overscroll-contain">
              
              {/* Alert if Orders Closed */}
              {!isOrderingOpen && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800">
                  <AlertTriangle className="shrink-0 text-red-600" size={18} />
                  <p className="text-xs font-semibold leading-tight">
                    Orders are currently closed for the day. Checkout is temporarily disabled.
                  </p>
                </div>
              )}

              {/* Order Mode Badge */}
              {isPickupOnly && (
                <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex items-center justify-between text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-amber-700" />
                    <span className="text-xs font-bold">In-Store Bakery Pickup Active</span>
                  </div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    Pickup Only
                  </span>
                </div>
              )}

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <div className="w-40 h-40">
                    <FrostyAnimation 
                      url={LOTTIE_ANIMATIONS.EMPTY_CART}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <h3 className="text-lg font-serif font-bold text-stone-900">Your box is empty</h3>
                    <p className="text-stone-500 text-xs leading-relaxed">
                      Treat yourself to fresh cakes, cookies, and delicious pastries today!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/categories');
                    }}
                    className="px-6 py-3 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-xs transition-all cursor-pointer hover:shadow-md"
                  >
                    Explore Bakery Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Selected Treats
                    </span>
                    <span className="text-xs text-stone-500 font-medium">
                      Total: ₹{totalPrice}
                    </span>
                  </div>

                  {cart.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      updateQuantity={updateQuantity}
                      removeFromCart={removeFromCart}
                      onNavigate={handleProductNavigate}
                    />
                  ))}
                </div>
              )}

              {/* 3. Suggestions Section: "You Might Also Like" */}
              {suggestions.length > 0 && cart.length > 0 && (
                <div className="pt-4 border-t border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#E76A54]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        You Might Also Like
                      </h3>
                    </div>
                    <span className="text-[11px] text-stone-500">Fresh recommendations</span>
                  </div>

                  <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-1 px-1">
                    {suggestions.map((item) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ y: -2 }}
                        onClick={() => handleProductNavigate(item.id)}
                        className="w-36 shrink-0 bg-white rounded-2xl border border-stone-200/90 p-2.5 text-left group transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-stone-100">
                            <OptimizedImage
                              src={item.image}
                              alt={item.name}
                              containerClassName="w-full h-full"
                              className="transition-transform duration-500 group-hover:scale-105"
                            />
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.85 }}
                              onClick={(e) => handleQuickAdd(e, item)}
                              className="absolute bottom-1.5 right-1.5 p-1.5 bg-[#E76A54] hover:bg-[#d65943] rounded-lg text-white shadow-xs cursor-pointer"
                              title="Add to cart"
                            >
                              <Plus size={13} strokeWidth={3} />
                            </motion.button>
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 truncate mb-0.5">
                            {item.name}
                          </h4>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-black text-[#E76A54]">
                            ₹{item.price}
                          </span>
                          <span className="text-[10px] text-stone-400 font-medium">
                            Add +
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Bottom Order Summary & Checkout CTA (High Contrast White Container) */}
            {cart.length > 0 && (
              <footer className="shrink-0 bg-white border-t border-stone-200 px-4 sm:px-5 py-4 space-y-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20">
                
                {/* Price Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-stone-600 font-medium">
                    <span>Subtotal</span>
                    <span className="text-stone-900 font-bold">₹{subtotal}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between items-center text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/80">
                      <span className="flex items-center gap-1">
                        <Tag size={12} /> Coupon ({appliedCoupon.code})
                      </span>
                      <span>-₹{subtotal - totalPrice}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-stone-600 font-medium">
                    <span className="flex items-center gap-1">
                      {isPickupOnly ? <Store size={13} /> : <Truck size={13} />}
                      {isPickupOnly ? 'Pickup at Bakery' : 'Delivery Fee'}
                    </span>
                    <span className="text-emerald-600 font-bold uppercase tracking-wider">
                      FREE
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">
                        Total Amount
                      </span>
                      <span className="text-[10px] text-stone-400">
                        (Inclusive of all taxes)
                      </span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-[#E76A54]">
                      ₹{totalPrice}
                    </span>
                  </div>
                </div>

                {/* Checkout Button */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!isOrderingOpen) return;
                    onClose();
                    navigate('/checkout');
                  }}
                  disabled={!isOrderingOpen}
                  className="w-full py-4 bg-[#E76A54] hover:bg-[#d65943] active:bg-[#c44f3b] text-white rounded-2xl font-bold uppercase tracking-wider text-xs sm:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isOrderingOpen ? (
                    <>
                      <span>Proceed to Checkout</span>
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </>
                  ) : (
                    <span>Orders Closed</span>
                  )}
                </motion.button>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
