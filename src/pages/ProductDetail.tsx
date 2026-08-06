import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Share2, ShieldCheck, ShoppingCart, Star, Zap, Clock, Flame, Plus, Minus, ArrowLeft, Sparkles, MessageCircle, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { FoodItem } from '../types';
import { Button } from '../components/Button';
import { LoadingScreen } from '../components/LoadingScreen';
import { FoodCard } from '../components/FoodCard';
import { toggleWishlist, checkIfWishlisted } from '../services/wishlistService';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';
import { useAppConfig } from '../hooks/useAppConfig';

import { CartSidebar } from '../components/CartSidebar';

import { ImageZoom } from '../components/ImageZoom';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, totalItems, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const { isOrderingOpen, isPickupOnly } = useAppConfig();
  
  const purchaseSectionRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  
  const [product, setProduct] = useState<FoodItem | null>(null);
  const [relatedItems, setRelatedItems] = useState<FoodItem[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'ingredients'>('description');

  useMetadata({
    title: product ? product.name : 'Delicious Treat',
    description: product ? (product.description || `Order delicious ${product.name} from Frosty Bite! Try our freshly prepared treats.`) : 'Delicious treats, fresh cheesecakes and more from Frosty Bite.',
    keywords: product ? [product.name, product.category || 'Desserts', 'delicious', 'Frosty Bite'] : ['desserts', 'fast food', 'Frosty Bite'],
    ogImage: product?.image || undefined,
    ogTitle: product ? `${product.name} - Order Online` : undefined,
    ogDescription: product ? product.description : undefined,
  }, [product]);

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
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (purchaseSectionRef.current) {
            const rect = purchaseSectionRef.current.getBoundingClientRect();
            // If purchase element top is details-column height or below/above visible viewport, show the FAB
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
            setShowScrollFab(!isVisible);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const timeoutId = setTimeout(handleScroll, 500);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [product]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        let currentProduct: FoodItem | null = null;
        
        // 1. Try to fetch product from Supabase
        const { data: items, error: supabaseError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id);

        if (!supabaseError && items && items.length > 0) {
          const item = items[0];
          let ai_desc = item.ai_description || '';
          let est_time = item.estimated_delivery_time !== undefined ? Number(item.estimated_delivery_time) : undefined;
          let est_unit = item.estimated_delivery_time_unit || '';
          let est_string = item.estimated_delivery_time_string || '';
          
          if (ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
            try {
              const parsed = JSON.parse(ai_desc);
              ai_desc = parsed.ai_description || '';
              if (est_time === undefined && parsed.estimated_delivery_time !== undefined) {
                est_time = Number(parsed.estimated_delivery_time);
              }
              if (!est_unit && parsed.estimated_delivery_time_unit !== undefined) {
                est_unit = parsed.estimated_delivery_time_unit;
              }
              if (!est_string && parsed.estimated_delivery_time_string !== undefined) {
                est_string = parsed.estimated_delivery_time_string;
              }
            } catch (e) {
              // Ignore failure
            }
          }

          currentProduct = {
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            category: item.category || 'General',
            available: item.available !== undefined ? item.available : true,
            stock_quantity: item.stock_quantity || 0,
            description: item.description || '',
            rating: item.rating || 5,
            estimated_delivery_time: est_time || 30,
            estimated_delivery_time_unit: (est_unit || 'mins') as 'mins' | 'days',
            estimated_delivery_time_string: est_string
          };
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
            const { data: relItems, error: relError } = await supabase
              .from('products')
              .select('*')
              .eq('category', currentProduct.category)
              .limit(10);

            if (!relError && relItems) {
              const mappedRel = relItems
                .filter((item: any) => item.id !== id)
                .map((item: any) => {
                  let ai_desc = item.ai_description || '';
                  let est_time = item.estimated_delivery_time !== undefined ? Number(item.estimated_delivery_time) : undefined;
                  let est_unit = item.estimated_delivery_time_unit || '';
                  let est_string = item.estimated_delivery_time_string || '';
                  
                  if (ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
                    try {
                      const parsed = JSON.parse(ai_desc);
                      ai_desc = parsed.ai_description || '';
                      if (est_time === undefined && parsed.estimated_delivery_time !== undefined) {
                        est_time = Number(parsed.estimated_delivery_time);
                      }
                      if (!est_unit && parsed.estimated_delivery_time_unit !== undefined) {
                        est_unit = parsed.estimated_delivery_time_unit;
                      }
                      if (!est_string && parsed.estimated_delivery_time_string !== undefined) {
                        est_string = parsed.estimated_delivery_time_string;
                      }
                    } catch (e) {
                      // Ignore failure
                    }
                  }

                  return {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image: item.image,
                    category: item.category || 'General',
                    available: item.available !== undefined ? item.available : true,
                    stock_quantity: item.stock_quantity || 0,
                    description: item.description || '',
                    rating: item.rating || 5,
                    estimated_delivery_time: est_time || 30,
                    estimated_delivery_time_unit: (est_unit || 'mins') as 'mins' | 'days',
                    estimated_delivery_time_string: est_string
                  };
                })
                .slice(0, 8);
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

    if (id) {
      const channel = supabase
        .channel(`product_detail_${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products', filter: `id=eq.${id}` },
          () => {
            console.log(`[Realtime] Product detail change detected for ${id}`);
            fetchProduct();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id]);

  useEffect(() => {
    if (!isLoading) {
      const scrollTimer = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
        if ((window as any).lenis) {
          (window as any).lenis.scrollTo(0, { immediate: true });
        }
      }, 60);
      return () => clearTimeout(scrollTimer);
    }
  }, [isLoading]);

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
      setIsBuyingNow(true);
      // Add based on selected quantity
      for (let i = 0; i < quantity; i++) {
        addToCart(product);
      }
      
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
    <div className="min-h-screen bg-background text-foreground pb-32">
      
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex items-center justify-between pointer-events-none">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="w-12 h-12 rounded-2xl glass-dark flex items-center justify-center text-foreground pointer-events-auto hover:bg-white/10 transition-colors shadow-2xl"
        >
          <ArrowLeft size={24} />
        </motion.button>
        
        <div className="flex gap-3 pointer-events-auto">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsCartOpen(true)}
            className="w-12 h-12 rounded-2xl glass-dark flex items-center justify-center text-foreground relative hover:bg-white/10 transition-colors shadow-2xl"
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-background">
                {totalItems}
              </span>
            )}
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => {
              const url = window.location.href;
              const text = `Check out this delicious ${product.name} from Frosty Bite! 🍰\n\n${url}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/30 transition-colors shadow-2xl pointer-events-auto border border-emerald-500/20"
            title="Share to WhatsApp"
          >
            <MessageCircle size={20} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => {
              const url = window.location.href;
              navigator.clipboard.writeText(url);
              toast.success('Link copied to clipboard!', {
                icon: '🔗',
                style: {
                  borderRadius: '16px',
                  background: '#18181b',
                  color: '#fff',
                }
              });
            }}
            className="w-12 h-12 rounded-2xl glass-dark flex items-center justify-center text-foreground hover:bg-white/10 transition-colors shadow-2xl pointer-events-auto"
            title="Copy Link"
          >
            <Share2 size={20} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            onClick={handleToggleWishlist}
            disabled={isWishlisting}
            className={`w-12 h-12 rounded-2xl glass-dark flex items-center justify-center transition-all shadow-2xl active:scale-90 disabled:opacity-50 ${isLiked ? 'text-red-500' : 'text-foreground hover:bg-white/10'}`}
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
          {(product.available === false || product.stock_quantity <= 0) && (
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
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent lg:hidden" />
        </div>

        {/* Product Details Section */}
        <div className="px-6 py-12 lg:py-32 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
                {product.category}
              </span>
              {isPickupOnly && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/30 flex items-center gap-1">
                  🛍 Pickup Available
                </span>
              )}
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
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {product.estimated_delivery_time_unit === 'days' 
                  ? `${product.estimated_delivery_time_string || product.estimated_delivery_time || '1-2'} Days` 
                  : `${product.estimated_delivery_time || 30} Min`}
              </span>
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
          <div ref={purchaseSectionRef} className="scroll-mt-32 space-y-6">
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
                  "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all duration-300 text-xs font-black uppercase tracking-widest group active:scale-95 disabled:opacity-50 w-full sm:w-auto justify-center",
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

            {/* In-Line Action Buttons to prevent mandatory scrolling */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={handleAddToCart}
                disabled={product.available === false || product.stock_quantity <= 0}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 border border-white/10 group shadow-xl disabled:opacity-30 disabled:cursor-not-allowed text-xs font-black uppercase tracking-widest"
              >
                <ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
                <span>Add to Cart</span>
              </button>
              
              <button
                onClick={handleBuyNow}
                disabled={product.available === false || product.stock_quantity <= 0 || isBuyingNow}
                className="flex-[1.5] py-4 bg-primary hover:bg-accent text-white rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/30 disabled:bg-zinc-800 disabled:shadow-none disabled:cursor-not-allowed group relative overflow-hidden text-xs font-black uppercase tracking-widest"
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
                        <Zap size={18} fill="currentColor" />
                      </motion.div>
                      <span className="italic">Fast tracking...</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="default"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center space-x-3"
                    >
                      <Zap size={18} fill="currentColor" className="group-hover:scale-125 transition-transform" />
                      <span>
                        {(product.available === false || product.stock_quantity <= 0) ? 'Currently Unavailable' : 'Buy Now'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          </div>
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
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                 <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl lg:text-6xl font-display uppercase tracking-tighter leading-none italic">
                  You Might Also Like
                </h2>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
                  More from {product.category} for your cravings
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex space-x-6 overflow-x-auto pb-8 scrollbar-hide -mx-6 px-6">
            {relatedItems.map((item) => (
              <div key={item.id} className="w-72 shrink-0">
                <FoodCard item={item} />
              </div>
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
            disabled={product.available === false || product.stock_quantity <= 0}
            className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 border border-white/10 group shadow-xl disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em] hidden sm:inline">Add to Cart</span>
            <span className="text-xs font-black uppercase tracking-[0.2em] sm:hidden">Add</span>
          </button>
          
          <button
            onClick={handleBuyNow}
            disabled={product.available === false || product.stock_quantity <= 0 || isBuyingNow}
            className="flex-[1.8] py-5 bg-primary hover:bg-accent text-white rounded-[2rem] flex items-center justify-center space-x-3 transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/30 disabled:bg-zinc-800 disabled:shadow-none disabled:cursor-not-allowed group relative overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {isBuyingNow ? (
                <motion.div
                  key="buying"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-3"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Zap size={20} fill="currentColor" />
                  </motion.div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] italic">Fast tracking...</span>
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center space-x-3"
                >
                  <Zap size={20} fill="currentColor" className="group-hover:scale-125 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">
                    {(product.available === false || product.stock_quantity <= 0) ? 'Currently Unavailable' : 'Buy Now'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.div>

      {/* Floating Action Button for scrolling to purchase section */}
      <AnimatePresence>
        {showScrollFab && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            onClick={() => {
              purchaseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="fixed bottom-32 right-6 z-50 px-6 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-full shadow-[0_10px_30px_rgba(249,115,22,0.4)] hover:bg-accent active:scale-95 transition-all flex items-center gap-2 border border-white/20"
          >
            <Sparkles size={14} className="animate-pulse" />
            Order Options
            <ChevronDown size={14} className="animate-bounce" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetail;
