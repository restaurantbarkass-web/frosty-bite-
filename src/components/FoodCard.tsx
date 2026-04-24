import React, { useState, memo } from 'react';
import { Star, Plus, Zap, ShoppingCart, Check } from 'lucide-react';
import { FoodItem } from '../types';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '../context/ThemeContext';
import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';

interface FoodCardProps {
  item: FoodItem;
}

export const FoodCard: React.FC<FoodCardProps> = memo(({ item }) => {
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [isFlying, setIsFlying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddToCart = () => {
    setIsFlying(true);
    setShowSuccess(true);
    addToCart(item);
    setTimeout(() => {
      setIsFlying(false);
      setShowSuccess(false);
    }, 1500);
  };

  const handleBuyNow = () => {
    addToCart(item);
    navigate('/checkout');
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-xl">Sold Out</span>
          </div>
        )}
      </div>

      <div className="p-6">
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
            disabled={item.available === false || showSuccess || (item.stockQuantity !== undefined && item.stockQuantity <= 0)}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative overflow-hidden"
            title="Add to Cart"
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
            disabled={item.available === false || (item.stockQuantity !== undefined && item.stockQuantity <= 0)}
            className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap size={16} fill="currentColor" />
            <span className="text-xs font-black uppercase tracking-[0.15em]">Buy Now</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
