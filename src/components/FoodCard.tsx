import React, { useState, useEffect, memo } from 'react';
import { Star, Plus, Zap, ShoppingCart, Check, Heart } from 'lucide-react';
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

interface FoodCardProps {
  item: FoodItem;
  variant?: 'default' | 'compact';
}

export const FoodCard: React.FC<FoodCardProps> = memo(({ item, variant = 'default' }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFlying, setIsFlying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { isOrderingOpen } = useAppConfig();
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
  }, [user, item.id]);

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

  const handleAddToCart = () => {
    if (!user) {
      toast.error('Please login to add items to cart', {
        icon: '🔐',
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
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
    if (!user) {
      toast.error('Please login to buy treats', {
        icon: '🔐',
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -10, scale: 1.02 }}
      className={cn(
        "group relative bg-[#111]/80 backdrop-blur-xl overflow-hidden border border-white/5 hover:border-orange-500/30 transition-all duration-500 shadow-2xl cursor-pointer",
        variant === 'compact' ? "rounded-3xl" : "rounded-[2.5rem]"
      )}
      onClick={() => navigate(`/product/${item.id}`)}
    >
      {/* Flying Animation Element */}
      <AnimatePresence>
        {isFlying && (
          <motion.div
            initial={{ scale: 1, x: 0, y: 0, opacity: 1 }}
            animate={{ 
              scale: 0.2, 
              x: window.innerWidth > 768 ? 400 : 0, 
              y: -500, 
              opacity: 0 
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed z-[100] pointer-events-none"
          >
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <ShoppingCart className="text-white" size={32} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative aspect-[4/3] overflow-hidden">
        <ImageZoom
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          triggerClassName="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-2xl flex items-center space-x-1.5">
            <Star size={14} className="text-orange-500 fill-orange-500" />
            <span className="text-xs font-black text-white">{item.rating}</span>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleWishlist}
            className={cn(
              "w-9 h-9 rounded-2xl flex items-center justify-center transition-all bg-black/60 backdrop-blur-md border border-white/10",
              isLiked ? "text-red-500" : "text-white hover:text-red-400"
            )}
          >
            <Heart size={16} fill={isLiked ? "currentColor" : "none"} className={isWishlisting ? 'animate-pulse' : ''} />
          </motion.button>
        </div>

        {item.available === false && (
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
        <div className="flex justify-between items-start mb-3">
          <h3 className={cn(
            "font-black leading-tight text-white group-hover:text-orange-500 transition-colors tracking-tight uppercase italic",
            variant === 'compact' ? "text-sm text-primary" : "text-xl"
          )}>
            {item.name}
          </h3>
          <div className="flex flex-col items-end">
            <span className={cn(
              "text-orange-500 font-black italic",
              variant === 'compact' ? "text-sm" : "text-lg"
            )}>₹{item.price}</span>
          </div>
        </div>
        
        {variant !== 'compact' && (
          <p className="text-gray-500 text-xs font-medium line-clamp-2 mb-6 leading-relaxed">
            {item.description}
          </p>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleAddToCart}
            disabled={item.available === false || showSuccess || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0)}
            className={cn(
              "flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative overflow-hidden",
              variant === 'compact' ? "py-2.5" : "py-4 rounded-2xl"
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
          
          <button
            onClick={handleBuyNow}
            disabled={item.available === false || !isOrderingOpen || (item.stock_quantity !== undefined && item.stock_quantity <= 0) || isBuyingNow}
            className={cn(
              "flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden",
              variant === 'compact' ? "py-2.5" : "py-4 rounded-2xl"
            )}
            title={!isOrderingOpen ? "Orders are currently closed" : "Buy Now"}
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
                  <span className="text-xs font-black uppercase tracking-[0.15em]">Buy Now</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
