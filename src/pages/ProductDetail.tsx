import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Share2, ShieldCheck, ShoppingCart, Star, Zap, Clock, Flame, Plus, Minus, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { FoodItem } from '../types';
import { Button } from '../components/Button';
import { LoadingScreen } from '../components/LoadingScreen';
import { FoodCard } from '../components/FoodCard';
import { safeFirestore } from '../services/firestoreService';
import { toggleWishlist, checkIfWishlisted } from '../services/wishlistService';
import toast from 'react-hot-toast';
import { useAppConfig } from '../hooks/useAppConfig';

import { CartSidebar } from '../components/CartSidebar';

import { ImageZoom } from '../components/ImageZoom';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, totalItems } = useCart();
  const { user } = useAuth();
  const { isOrderingOpen } = useAppConfig();
  
  const [product, setProduct] = useState<FoodItem | null>(null);
  const [relatedItems, setRelatedItems] = useState<FoodItem[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'ingredients'>('description');
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const fetchWishlistStatus = async () => {
      if (user && id) {
        try {
          const liked = await checkIfWishlisted(user.uid, id);
          setIsLiked(liked);
        } catch (error) {
          console.error("Error checking wishlist status:", error);
        }
      }
    };

    fetchWishlistStatus();
  }, [user, id]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        let currentProduct: FoodItem | null = null;
        
        // 1. Try to fetch product from Supabase
        const res = await fetch(`https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?id=eq.${id}`, {
          headers: {
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM"
          }
        });

        if (res.ok) {
          const items = await res.json();
          if (items && items.length > 0) {
            const item = items[0];
            currentProduct = {
              id: item.id,
              name: item.name,
              price: item.price,
              image: item.image,
              category: item.category || 'General',
              available: item.available !== undefined ? item.available : true,
              stock_quantity: item.stock_quantity || 0,
              description: item.description || ''
            };
          }
        }

        // 2. Fallback to cache if Supabase fail or not found
        if (!currentProduct) {
          const cachedMenu = localStorage.getItem('menu_cache');
          if (cachedMenu) {
            try {
              const parsed = JSON.parse(cachedMenu);
              const menuItems = (parsed.data || parsed) as FoodItem[];
              const found = menuItems.find(item => item.id === id);
              if (found) {
                currentProduct = found;
              }
            } catch (e) {}
          }
        }

        if (!currentProduct) {
          setProduct(null);
        } else {
          setProduct(currentProduct);
          
          // Fetch related items from Supabase
          try {
            const relRes = await fetch(`https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?category=eq.${currentProduct.category}&limit=10`, {
              headers: {
                "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM"
              }
            });

            if (relRes.ok) {
              const relItems = await relRes.json();
              const mappedRel = relItems
                .filter((item: any) => item.id !== id)
                .map((item: any) => ({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  image: item.image,
                  category: item.category || 'General',
                  available: item.available !== undefined ? item.available : true,
                  stock_quantity: item.stock_quantity || 0,
                  description: item.description || ''
                }))
                .slice(0, 4);
              setRelatedItems(mappedRel);
            }
          } catch (relError) {
            console.error("Supabase error for related items:", relError);
          }
        }
      } catch (error) {
        console.error("Error in fetchProduct:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo(0, 0);
  }, [id]);

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
      navigate('/login', { state: { from: `/product/${id}` } });
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
    if (product) {
      for (let i = 0; i < quantity; i++) {
        addToCart(product);
      }
      toast.success(`${quantity} ${product.name} added to cart`, {
        icon: '🛒',
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
    }
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
      navigate('/login', { state: { from: `/product/${id}` } });
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
    if (product) {
      // Add based on selected quantity
      for (let i = 0; i < quantity; i++) {
        addToCart(product);
      }
      
      // Small timeout for visual feedback before navigating
      toast.success('Going to checkout...', {
        duration: 800,
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });
      
      setTimeout(() => {
        navigate('/checkout', { state: { fromBuyNow: true } });
      }, 500);
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to add items to wishlist');
      navigate('/login');
      return;
    }

    if (!product || isWishlisting) return;

    setIsWishlisting(true);
    try {
      const added = await toggleWishlist(user.uid, product);
      setIsLiked(added);
      if (added) {
        toast.success('Added to wishlist!', {
          icon: '❤️',
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      } else {
        toast.success('Removed from wishlist', {
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      }
    } catch (error: any) {
      let isQuota = false;
      try {
        const errData = JSON.parse(error.message);
        if (errData.error === "DATABASE_QUOTA_EXCEEDED") isQuota = true;
      } catch (e) {
        if (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit exceeded')) {
          isQuota = true;
        }
      }

      if (isQuota) {
        toast.error('Database limit reached! Your wishlist will sync later.', {
          duration: 4000,
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      } else {
        toast.error('Failed to update wishlist');
      }
    } finally {
      setIsWishlisting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white p-6">
        <h2 className="text-2xl font-black mb-4">Product Not Found</h2>
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex items-center justify-between pointer-events-none">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="w-12 h-12 rounded-2xl glass-dark flex items-center justify-center text-white pointer-events-auto hover:bg-white/10 transition-colors shadow-2xl"
        >
          <ArrowLeft size={24} />
        </motion.button>
        
        <div className="flex gap-3 pointer-events-auto">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsCartOpen(true)}
            className="w-12 h-12 rounded-2xl glass-dark flex items-center justify-center text-white relative hover:bg-white/10 transition-colors shadow-2xl"
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#050505]">
                {totalItems}
              </span>
            )}
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={handleToggleWishlist}
            disabled={isWishlisting}
            className={`w-12 h-12 rounded-2xl glass-dark flex items-center justify-center transition-all shadow-2xl active:scale-90 disabled:opacity-50 ${isLiked ? 'text-red-500' : 'text-white hover:bg-white/10'}`}
          >
            <Heart size={22} fill={isLiked ? "currentColor" : "none"} className={isWishlisting ? 'animate-pulse' : ''} />
          </motion.button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-16">
        {/* Product Image Section */}
        <div className="relative aspect-square md:h-screen lg:sticky lg:top-0 overflow-hidden">
          <ImageZoom
            src={product.image}
            alt={product.name}
            className={cn("w-full h-full object-cover", product.available === false && "grayscale")}
            triggerClassName="w-full h-full"
          />
          {product.available === false && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div className="bg-red-500 text-white font-black uppercase tracking-[0.5em] px-12 py-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.4)] border-2 border-white/20 -rotate-6 text-xl">
                Out of Stock
              </div>
            </motion.div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent lg:hidden" />
        </div>

        {/* Product Details Section */}
        <div className="px-6 py-12 lg:py-32 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
                {product.category}
              </span>
              <div className="flex items-center gap-1.5 text-orange-500">
                <Star size={14} fill="currentColor" />
                <span className="text-xs font-black">{product.rating} (120+ Reviews)</span>
              </div>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-display uppercase tracking-tighter mb-4 leading-none">
              {product.name}
            </h1>
            
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-display text-primary italic">₹{product.price}</span>
              <span className="text-zinc-500 line-through text-xl">₹{Math.round(product.price * 1.2)}</span>
            </div>
          </motion.div>

          {/* Quick Features */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-4"
          >
            <div className="glass-dark p-4 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-2">
              <Clock size={20} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">25-30 Min</span>
            </div>
            <div className="glass-dark p-4 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-2">
              <Flame size={20} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Freshly Baked</span>
            </div>
            <div className="glass-dark p-4 rounded-3xl border border-white/5 flex flex-col items-center text-center gap-2">
              <ShieldCheck size={20} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hygiene+</span>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <div className="flex border-b border-white/5">
              {(['description', 'reviews', 'ingredients'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="text-zinc-400 text-sm leading-relaxed min-h-[100px]">
              {activeTab === 'description' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {product.description} Our {product.name} is prepared with the finest ingredients and artisan baking techniques. Each piece is crafted to provide a moment of pure bliss, ensuring a premium experience right at your home.
                </motion.p>
              )}
              {activeTab === 'reviews' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 glass-dark rounded-2xl border border-white/5">
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-white">Emily S.</span>
                      <div className="flex text-orange-500"><Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /></div>
                    </div>
                    <p className="text-xs italic">"The best pastries I've ever had! So fresh and delicious."</p>
                  </div>
                </motion.div>
              )}
              {activeTab === 'ingredients' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  Premium Flour, Natural Leaven, Organic Sugar, Belgian Chocolate, Real Butter, and our secret Frosty Bite magic.
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* Quantity Selector & Wishlist */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
          >
            <div className="flex items-center gap-6">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Quantity</span>
              <div className="flex items-center bg-white/5 rounded-2xl border border-white/10 p-1">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <Minus size={18} />
                </button>
                <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <button
              onClick={handleToggleWishlist}
              disabled={isWishlisting}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all duration-300 text-xs font-black uppercase tracking-widest group active:scale-95 disabled:opacity-50",
                isLiked 
                  ? "bg-red-500/10 border-red-500/20 text-red-500" 
                  : "bg-white/5 border-white/10 text-white hover:bg-white/10"
              )}
            >
              <Heart 
                size={16} 
                fill={isLiked ? "currentColor" : "none"} 
                className={cn("transition-transform group-hover:scale-110", isWishlisting && "animate-pulse")} 
              />
              {isLiked ? 'Wishlisted' : 'Add to Wishlist'}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-4xl lg:text-6xl font-display uppercase tracking-tighter mb-4">
              You Might Also Like
            </h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
              Similar items in {product.category}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {relatedItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Bottom Action Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-6 pb-8 glass-dark border-t border-white/10 backdrop-blur-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={handleAddToCart}
            disabled={product.available === false}
            className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 border border-white/10 group shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em] hidden sm:inline">Add to Cart</span>
            <span className="text-xs font-black uppercase tracking-[0.2em] sm:hidden">Add</span>
          </button>
          
          <button
            onClick={handleBuyNow}
            disabled={product.available === false}
            className="flex-[1.8] py-5 bg-primary hover:bg-accent text-white rounded-[2rem] flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/30 disabled:bg-zinc-800 disabled:shadow-none disabled:cursor-not-allowed"
          >
            <Zap size={20} fill="currentColor" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">
              {product.available === false ? 'Currently Unavailable' : 'Buy Now'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProductDetail;
