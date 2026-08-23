import React, { useState, useEffect, memo } from 'react';
import { Star, Plus, Zap, ShoppingCart, Check, Heart, Share2, Sparkles } from 'lucide-react';
import { FoodItem } from '../types';
import { useCart } from '../context/CartContext';
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
  const { addToCart, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFlying, setIsFlying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { isOrderingOpen, isPickupOnly } = useAppConfig();
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);

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
    setTimeout(() => {
      setIsFlying(false);
      setShowSuccess(false);
    }, 1500);
  };

  const [isBuyingNow, setIsBuyingNow] = useState(false);

  const handleBuyNow = () => {
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
        background: '#f97316',
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
          borderColor: ["rgba(255,255,255,0.05)", "rgba(249,115,22,0.8)", "rgba(255,255,255,0.05)"]
        } : { opacity: 1, y: 0, scale: 1 }}
        whileHover={!isTouchDevice ? { 
          y: -8, 
          scale: 1.025,
          boxShadow: "0 25px 50px -12px rgba(249,115,22,0.25)",
          borderColor: "rgba(249,115,22,0.35)"
        } : undefined}
        transition={{ 
          type: "spring", 
          stiffness: 350, 
          damping: 22 
        }}
        className={cn(
          "group relative bg-white/5 overflow-hidden border border-white/5 transition-all shadow-xl cursor-pointer",
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
        
        <div className="relative aspect-[4/3] overflow-hidden">
          <ImageZoom
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            triggerClassName="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="absolute top-5 right-5 flex flex-col gap-2">
            <div className="bg-background/60 backdrop-blur-md border border-border px-3 py-1.5 rounded-2xl flex items-center space-x-1.5 shadow-lg">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-xs font-black text-foreground">{item.rating}</span>
            </div>
            
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleWishlist}
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all bg-background/60 backdrop-blur-md border border-border shadow-lg",
                isLiked ? "text-red-500" : "text-foreground/70 hover:text-red-400"
              )}
            >
              <Heart size={18} fill={isLiked ? "currentColor" : "none"} className={isWishlisting ? 'animate-pulse' : ''} />
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
                    background: '#18181b',
                    color: '#fff',
                  }
                });
              }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-background/60 backdrop-blur-md border border-border text-foreground/70 hover:text-primary transition-all shadow-lg"
              title="Copy Link"
            >
              <Share2 size={16} />
            </motion.button>
          </div>

          <div className="absolute top-5 left-5 flex flex-col gap-2">
            <span className="bg-primary/90 backdrop-blur-md text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg">
              Freshly Baked
            </span>
            {isPickupOnly && (
              <span className="bg-amber-500/95 backdrop-blur-md text-black text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-lg flex items-center gap-1">
                🛍 Pickup Available
              </span>
            )}
            {isAiRecommended && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-black/80 backdrop-blur-md border border-primary/50 text-primary text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.3)] flex items-center gap-1.5"
              >
                <Sparkles size={10} className="animate-pulse" />
                AI Recommended
              </motion.div>
            )}
          </div>

        {(item.available === false || item.stock_quantity <= 0) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px] flex flex-col items-center justify-center p-6 text-center z-20"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.3em] px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)] border-2 border-white/20 mb-4"
            >
              Sold Out
            </motion.div>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest max-w-[120px]">
              Join the waitlist for the next batch
            </p>
          </motion.div>
        )}
      </div>

      <div className={cn(
        "transition-all duration-500", 
        !isOrderingOpen && "opacity-60",
        variant === 'compact' ? "p-4" : "p-6"
      )}>
        <div className="flex justify-between items-start mb-2">
          <h3 className={cn(
            "font-black leading-tight text-white group-hover:text-primary transition-colors tracking-tight uppercase",
            variant === 'compact' ? "text-xs" : "text-lg"
          )}>
            {item.name}
          </h3>
          <div className="flex flex-col items-end">
            <span className={cn(
              "text-primary font-black",
              variant === 'compact' ? "text-xs" : "text-xl"
            )}>₹{item.price}</span>
          </div>
        </div>
        
        {variant !== 'compact' && (
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider line-clamp-2 mb-4">
            {item.description}
          </p>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1 text-orange-500/85 text-[9px] font-black uppercase tracking-wider bg-[#f97316]/5 py-1.5 px-2.5 rounded-xl w-fit border border-[#f97316]/10">
            <Zap size={9} className="fill-[#f97316] text-[#f97316]" />
            <span>
              Delivers in {item.estimated_delivery_time_unit === 'days' 
                ? `${item.estimated_delivery_time_string || item.estimated_delivery_time || '1-2'} Days` 
                : `${item.estimated_delivery_time || 30} Mins`}
            </span>
          </div>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleAddToCart}
            disabled={item.available === false || showSuccess || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0)}
            className={cn(
              "flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative overflow-hidden",
              variant === 'compact' ? "py-2" : "py-3"
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
                  className="absolute inset-0 flex items-center justify-center bg-emerald-500"
                >
                  <FrostyAnimation 
                    url={LOTTIE_ANIMATIONS.CAKE}
                    loop={false}
                    className="w-12 h-12"
                    fallback={
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check className="text-white" size={24} strokeWidth={3} />
                      </motion.div>
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="plus"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center space-x-2"
                >
                  <Plus size={18} className="group-hover/btn:rotate-90 transition-transform duration-300" />
                  <span className="text-xs font-black uppercase tracking-widest">Add</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {showBuyNow && (
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 addToCart(item);
                 onClick?.();
                 setIsCartOpen(true);
               }}
               className={cn(
                 "flex-1 bg-primary text-white rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 shadow-lg shadow-primary/20",
                 variant === 'compact' ? "py-2 px-4" : "py-3 px-6"
               )}
            >
               <span className="text-xs font-black uppercase tracking-widest">Buy Now</span>
            </button>
          )}
          
          {!showBuyNow && (
            <button
              onClick={handleBuyNow}
              disabled={item.available === false || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0) || isBuyingNow}
              className={cn(
                "flex-[2.5] bg-primary hover:opacity-90 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden",
                variant === 'compact' ? "py-2.5" : "py-4"
              )}
              title={!isOrderingOpen ? "Orders are currently closed" : "Quick Checkout"}
            >
              <AnimatePresence mode="wait">
                {isBuyingNow ? (
                  <motion.div
                    key="buying"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap size={16} fill="currentColor" />
                    </motion.div>
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Fast tracking...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2"
                  >
                    <Zap size={16} fill="currentColor" className="group-hover:scale-125 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-[0.15em]">Quick Buy</span>
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
