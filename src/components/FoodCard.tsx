import React, { useState, memo } from 'react';
import { Star, Plus, Zap, ShoppingCart, Check } from 'lucide-react';
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

interface FoodCardProps {
  item: FoodItem;
}

export const FoodCard: React.FC<FoodCardProps> = memo(({ item }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFlying, setIsFlying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { isOrderingOpen } = useAppConfig();

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
    addToCart(item);
    toast.success('Proceeding to checkout...', {
      duration: 1000,
      icon: '🚀',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)'
      }
    });
    setTimeout(() => {
      navigate('/checkout', { state: { fromBuyNow: true } });
    }, 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -10, scale: 1.02 }}
      className="group relative bg-[#111]/80 backdrop-blur-xl rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-orange-500/30 transition-all duration-500 shadow-2xl cursor-pointer"
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
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-2xl flex items-center space-x-1.5">
          <Star size={14} className="text-orange-500 fill-orange-500" />
          <span className="text-xs font-black text-white">{item.rating}</span>
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

      <div className={cn("p-6 transition-all duration-500", (item.available === false || !isOrderingOpen) && "opacity-40 grayscale-[0.5]")}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-black text-xl leading-tight text-white group-hover:text-orange-500 transition-colors tracking-tight">
            {item.name}
          </h3>
          <div className="flex flex-col items-end">
            <span className="text-orange-500 font-black text-lg italic">₹{item.price}</span>
          </div>
        </div>
        
        <p className="text-gray-500 text-xs font-medium line-clamp-2 mb-6 leading-relaxed">
          {item.description}
        </p>

        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleAddToCart}
            disabled={item.available === false || showSuccess || !isOrderingOpen || (item.stockQuantity !== undefined && item.stockQuantity <= 0)}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative overflow-hidden"
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
            disabled={item.available === false || !isOrderingOpen || (item.stockQuantity !== undefined && item.stockQuantity <= 0)}
            className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isOrderingOpen ? "Orders are currently closed" : "Buy Now"}
          >
            <Zap size={16} fill="currentColor" />
            <span className="text-xs font-black uppercase tracking-[0.15em]">Buy Now</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
