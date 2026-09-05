import React, { useState, useEffect, memo } from 'react';
import { Star, Plus, Minus, Zap, ShoppingCart, Check, Heart, Share2, Sparkles } from 'lucide-react';
import { FoodItem } from '../types';
import { useCartActions, useCartState } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { useAppConfig } from '../hooks/useAppConfig';
import { toggleWishlist, checkIfWishlisted } from '../services/wishlistService';

import { ImageZoom } from './ImageZoom';
import { preloadRoute } from '../utils/preload';

interface FoodCardProps {
  item: FoodItem;
  variant?: 'default' | 'compact';
  isAiRecommended?: boolean;
  onClick?: () => void;
  showBuyNow?: boolean;
}

export const FoodCard: React.FC<FoodCardProps> = memo(({ 
  item, 
  variant = 'default', 
  isAiRecommended = false,
  onClick,
  showBuyNow = false
}) => {
  const { cart } = useCartState();
  const { addToCart, updateQuantity, setIsCartOpen } = useCartActions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFlying, setIsFlying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { isOrderingOpen, isPickupOnly } = useAppConfig();
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);

  const cartItem = cart.find((c) => c.id === item.id);
  const inCartQuantity = cartItem ? cartItem.quantity : 0;

  useEffect(() => {
    const fetchWishlistStatus = async () => {
      if (user && item.id) {
        try {
          const liked = await checkIfWishlisted(user.uid, item.id);
          setIsLiked(liked);
        } catch (error) {
          // Fail silently for status check
        }
      }
    };
    fetchWishlistStatus();
  }, [user?.uid, item.id]);

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please login to add to wishlist');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (isWishlisting) return;

    setIsWishlisting(true);
    try {
      const added = await toggleWishlist(user.uid, item);
      setIsLiked(added);
      
      if (added) {
        toast.success('Saved to wishlist!', {
          icon: '❤️',
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      } else {
        toast('Removed from wishlist', {
          icon: '🗑️',
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      }
    } catch (error: any) {
      console.error('Wishlist toggle error:', error);
      toast.error(error.message || 'Failed to update wishlist');
    } finally {
      setIsWishlisting(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOrderingOpen) {
      toast.error('Orders are currently closed', {
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
      return;
    }

    if (item.available === false || (item.stock_quantity !== undefined && item.stock_quantity <= 0)) {
      toast.error('Item is currently out of stock');
      return;
    }

    // Fire the flying cart event with precise coordinates
    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl ? targetEl.getBoundingClientRect() : null;
    const startX = e.clientX && e.clientX > 0 ? e.clientX : (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const startY = e.clientY && e.clientY > 0 ? e.clientY : (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    window.dispatchEvent(new CustomEvent('add-to-cart-fly', {
      detail: {
        startX,
        startY,
        image: item.image
      }
    }));

    setIsFlying(true);
    setShowSuccess(true);
    addToCart(item);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    toast.success(`${item.name} added to cart!`, { id: `cart-${item.id}`, duration: 2000 });
    setTimeout(() => {
      setIsFlying(false);
      setShowSuccess(false);
    }, 1200);
  };

  const [isBuyingNow, setIsBuyingNow] = useState(false);

  const handleBuyNow = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isOrderingOpen) {
      toast.error('Orders are currently closed', {
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
      return;
    }
    
    setIsBuyingNow(true);
    addToCart(item);
    
    toast.success('Instant Checkout!', {
      duration: 1500,
      icon: '⚡',
      style: {
        borderRadius: '16px',
        background: '#E76A54',
        color: '#fff',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }
    });

    setTimeout(() => {
      navigate('/checkout', { state: { fromBuyNow: true } });
    }, 400);
  };

  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={isFlying ? {
          scale: [1, 0.96, 1.03, 1],
          rotate: [0, -1.2, 1.2, 0],
        } : { opacity: 1, y: 0, scale: 1 }}
        whileHover={!isTouchDevice ? { 
          y: -6, 
          scale: 1.02,
        } : undefined}
        transition={isFlying ? {
          duration: 0.5,
          ease: "easeInOut"
        } : { 
          type: "spring", 
          stiffness: 300, 
          damping: 24 
        }}
        className={cn(
          "group relative bg-white overflow-hidden border border-stone-200/90 hover:border-orange-300/80 transition-all duration-300 shadow-xs hover:shadow-md cursor-pointer card-contain",
          variant === 'compact' ? "rounded-2xl" : "rounded-3xl"
        )}
        onMouseEnter={() => {
          preloadRoute(`/product/${item.id}`);
        }}
        onTouchStart={() => {
          preloadRoute(`/product/${item.id}`);
        }}
        onClick={() => {
          navigate(`/product/${item.id}`);
          onClick?.();
        }}
      >
        {/* Flying Animation Element skipped */}
        
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          <ImageZoom
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            triggerClassName="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5 z-10">
            <div className="bg-white/95 backdrop-blur-sm border border-stone-200/90 px-2.5 py-1 rounded-xl flex items-center space-x-1 shadow-xs">
              <Star size={13} className="text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-stone-800">{item.rating}</span>
            </div>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleWishlist}
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-white/95 backdrop-blur-sm border border-stone-200/90 shadow-xs cursor-pointer",
                isLiked ? "text-red-500 fill-red-500" : "text-stone-600 hover:text-red-500"
              )}
              aria-label="Wishlist"
            >
              <Heart size={15} fill={isLiked ? "currentColor" : "none"} className={isWishlisting ? 'animate-pulse' : ''} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/product/${item.id}`;
                navigator.clipboard.writeText(url);
                toast.success('Product link copied!', {
                   style: {
                    borderRadius: '16px',
                    background: '#1c1917',
                    color: '#fff',
                  }
                });
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/95 backdrop-blur-sm border border-stone-200/90 text-stone-600 hover:text-orange-600 transition-all shadow-xs cursor-pointer"
              title="Copy Link"
              aria-label="Share"
            >
              <Share2 size={14} />
            </motion.button>
          </div>

          <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5 z-10">
            <span className="bg-orange-500 text-white text-[9px] font-extrabold px-3 py-1 rounded-lg uppercase tracking-wider shadow-xs">
              Freshly Baked
            </span>
            {isPickupOnly && (
              <span className="bg-amber-400 text-amber-950 text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs flex items-center gap-1">
                🛍 Pickup Available
              </span>
            )}
            {isAiRecommended && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-stone-900/90 text-amber-300 border border-amber-400/40 text-[8px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs flex items-center gap-1"
              >
                <Sparkles size={10} className="animate-pulse text-amber-300" />
                AI Pick
              </motion.div>
            )}
          </div>

        {(item.available === false || item.stock_quantity <= 0) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-stone-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-20"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-md mb-2"
            >
              Sold Out
            </motion.div>
            <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider max-w-[140px]">
              Available in next batch
            </p>
          </motion.div>
        )}
      </div>

      <div className={cn(
        "transition-all duration-300", 
        !isOrderingOpen && "opacity-60",
        variant === 'compact' ? "p-3.5" : "p-5"
      )}>
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <h3 className={cn(
            "font-extrabold leading-snug text-stone-900 group-hover:text-orange-600 transition-colors tracking-tight uppercase",
            variant === 'compact' ? "text-xs line-clamp-1" : "text-base sm:text-lg line-clamp-1"
          )}>
            {item.name}
          </h3>
          <div className="flex flex-col items-end shrink-0">
            <span className={cn(
              "text-orange-600 font-black",
              variant === 'compact' ? "text-xs" : "text-lg sm:text-xl"
            )}>₹{item.price}</span>
          </div>
        </div>
        
        {variant !== 'compact' && (
          <p className="text-stone-500 text-xs font-medium line-clamp-2 mb-3 leading-relaxed">
            {item.description}
          </p>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1.5 text-orange-700 text-[10px] font-bold uppercase tracking-wider bg-orange-50/90 py-1 px-2.5 rounded-lg w-fit border border-orange-200/80">
            <Zap size={11} className="fill-orange-500 text-orange-500" />
            <span>
              Delivers in {item.estimated_delivery_time_unit === 'days' 
                ? `${item.estimated_delivery_time_string || item.estimated_delivery_time || '1-2'} Days` 
                : `${item.estimated_delivery_time || 30} Mins`}
            </span>
          </div>
        </div>

        <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
          {inCartQuantity > 0 ? (
            <div className={cn(
              "flex-1 flex items-center justify-between bg-stone-100 rounded-xl sm:rounded-2xl border border-stone-200/90 shadow-2xs",
              variant === 'compact' ? "p-0.5" : "p-1"
            )}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(item.id, -1);
                }}
                className={cn(
                  "flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer",
                  variant === 'compact' ? "w-6 h-6" : "w-7 h-7 sm:w-8 sm:h-8"
                )}
                aria-label="Decrease quantity"
              >
                <Minus size={variant === 'compact' ? 12 : 14} strokeWidth={2.5} />
              </motion.button>
              <span className={cn(
                "font-black text-stone-900 px-1 text-center min-w-[16px]",
                variant === 'compact' ? "text-[11px]" : "text-xs sm:text-sm"
              )}>
                {inCartQuantity}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(item.id, 1);
                }}
                className={cn(
                  "flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer",
                  variant === 'compact' ? "w-6 h-6" : "w-7 h-7 sm:w-8 sm:h-8"
                )}
                aria-label="Increase quantity"
              >
                <Plus size={variant === 'compact' ? 12 : 14} strokeWidth={2.5} />
              </motion.button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handleAddToCart}
              disabled={item.available === false || showSuccess || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0)}
              className={cn(
                "flex-1 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl sm:rounded-2xl flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 border border-[#E76A54]/20 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative overflow-hidden font-bold cursor-pointer shadow-xs",
                variant === 'compact' ? "py-2 text-xs" : "py-2.5 sm:py-3 text-xs"
              )}
              title={!isOrderingOpen ? "Orders are currently closed" : "Add to Cart"}
            >
              <AnimatePresence mode="wait">
                {showSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-emerald-600 text-white"
                  >
                    <Check className="text-white" size={16} strokeWidth={3} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="plus"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-1 text-white"
                  >
                    <Plus size={15} className="group-hover/btn:rotate-90 transition-transform duration-300 text-white" strokeWidth={2.5} />
                    <span className="text-xs font-bold uppercase tracking-wider">ADD</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {showBuyNow && (
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 addToCart(item);
                 onClick?.();
                 setIsCartOpen(true);
               }}
               className={cn(
                 "flex-1 bg-stone-900 hover:bg-black text-white rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 shadow-xs font-bold cursor-pointer",
                 variant === 'compact' ? "py-2 px-3 text-xs" : "py-2.5 sm:py-3 px-4 text-xs"
               )}
            >
               <span className="text-xs font-bold uppercase tracking-wider">Buy Now</span>
            </button>
          )}
          
          {!showBuyNow && (
            <button
              onClick={handleBuyNow}
              disabled={item.available === false || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0) || isBuyingNow}
              className={cn(
                "flex-1 bg-stone-900 hover:bg-stone-800 text-white rounded-xl sm:rounded-2xl flex items-center justify-center space-x-1.5 transition-all duration-200 active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden font-bold cursor-pointer",
                variant === 'compact' ? "py-2 text-xs" : "py-2.5 sm:py-3 text-xs"
              )}
              title={!isOrderingOpen ? "Orders are currently closed" : "Quick Checkout"}
            >
              <AnimatePresence mode="wait">
                {isBuyingNow ? (
                  <motion.div
                    key="buying"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-1.5"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap size={13} fill="currentColor" />
                    </motion.div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Fast...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-1"
                  >
                    <Zap size={13} fill="currentColor" className="group-hover:scale-110 transition-transform text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Quick Buy</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
