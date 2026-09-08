import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Share2, ShieldCheck, ShoppingCart, Star, Zap, Clock, Flame, Plus, Minus, ArrowLeft, Sparkles, MessageCircle, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCartActions, useCartState } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { FoodItem } from '../types';
import { ProductPageSkeleton } from '../components/ProductPageSkeleton';
import { FoodCard } from '../components/FoodCard';
import { toggleWishlist, checkIfWishlisted } from '../services/wishlistService';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';
import { useAppConfig } from '../hooks/useAppConfig';
import { preloadRoute } from '../utils/preload';
import { ImageZoom } from '../components/ImageZoom';

const getInitialCachedProduct = (productId?: string): FoodItem | null => {
  if (!productId) return null;
  try {
    const cachedMenu = localStorage.getItem('menu_cache') || localStorage.getItem('products_cache');
    if (cachedMenu) {
      const parsed = JSON.parse(cachedMenu);
      const items: FoodItem[] = Array.isArray(parsed) ? parsed : (parsed.data || []);
      const found = items.find(item => item.id === productId);
      if (found) return found;
    }
  } catch (e) {}
  return null;
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCartActions();
  const { totalItems } = useCartState();
  const { user } = useAuth();
  const { isOrderingOpen, isPickupOnly } = useAppConfig();
  
  const purchaseSectionRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  
  const initialCached = React.useMemo(() => getInitialCachedProduct(id), [id]);
  const [product, setProduct] = useState<FoodItem | null>(initialCached);
  const [relatedItems, setRelatedItems] = useState<FoodItem[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(!initialCached);
  const [isLiked, setIsLiked] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'ingredients'>('description');
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  useEffect(() => {
    preloadRoute('/checkout');
  }, []);

  useMetadata({
    title: product ? product.name : 'Delicious Treat',
    description: product ? (product.description || `Order delicious ${product.name} from Frosty Bite! Try our freshly prepared treats.`) : 'Delicious treats, fresh cheesecakes and more from Frosty Bite.',
    keywords: product ? [product.name, product.category || 'Desserts', 'delicious', 'Frosty Bite'] : ['desserts', 'fast food', 'Frosty Bite'],
    ogImage: product?.image || undefined,
    ogTitle: product ? `${product.name} - Order Online` : undefined,
    ogDescription: product ? product.description : undefined,
  }, [product?.id, product?.name, product?.description]);

  useEffect(() => {
    const fetchWishlistStatus = async () => {
      if (id) {
        try {
          const liked = await checkIfWishlisted(user?.uid || null, id);
          setIsLiked(liked);
        } catch (error) {
          console.error("Error checking wishlist status:", error);
        }
      }
    };

    fetchWishlistStatus();
  }, [user?.uid, id]);

  useEffect(() => {
    const target = purchaseSectionRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollFab(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [product?.id]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          setProduct(data);
          
          // Fetch related items in same category
          const { data: related } = await supabase
            .from('products')
            .select('*')
            .eq('category', data.category)
            .neq('id', id)
            .limit(6);
          
          if (related) setRelatedItems(related);
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        // Fallback to cache search
        const fallback = getInitialCachedProduct(id);
        if (fallback) setProduct(fallback);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const handleToggleWishlist = async () => {
    if (!product) return;
    try {
      setIsWishlisting(true);
      const newStatus = await toggleWishlist(user?.uid || null, product);
      setIsLiked(newStatus);
      toast.success(newStatus ? 'Added to your wishlist!' : 'Removed from wishlist', {
        icon: newStatus ? '❤️' : '🗑️',
        style: { borderRadius: '16px', background: '#1c1917', color: '#fff' }
      });
    } catch (error) {
      toast.error('Failed to update wishlist');
    } finally {
      setIsWishlisting(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.available === false || product.stock_quantity <= 0) {
      toast.error('Sorry, this item is currently out of stock.');
      return;
    }
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    toast.success(`Added ${quantity}x ${product.name} to cart!`, {
      icon: '🛒',
      style: { borderRadius: '16px', background: '#1c1917', color: '#fff' }
    });
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.available === false || product.stock_quantity <= 0) {
      toast.error('Sorry, this item is currently out of stock.');
      return;
    }
    setIsBuyingNow(true);
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setTimeout(() => {
      setIsBuyingNow(false);
      navigate('/checkout');
    }, 400);
  };

  if (isLoading || !product) {
    return <ProductPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pb-36">
      
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-6 flex items-center justify-between pointer-events-none">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-800 pointer-events-auto hover:bg-white transition-colors shadow-lg cursor-pointer"
          title="Go back"
        >
          <ArrowLeft size={20} />
        </motion.button>
        
        <div className="flex gap-2 sm:gap-3 pointer-events-auto">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsCartOpen(true)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-800 relative hover:bg-white transition-colors shadow-lg cursor-pointer"
            title="Open cart"
          >
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#E76A54] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-xs">
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
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg pointer-events-auto cursor-pointer"
            title="Share to WhatsApp"
          >
            <MessageCircle size={18} />
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
                style: { borderRadius: '16px', background: '#1c1917', color: '#fff' }
              });
            }}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 flex items-center justify-center text-stone-800 hover:bg-white transition-colors shadow-lg pointer-events-auto cursor-pointer"
            title="Copy Link"
          >
            <Share2 size={17} />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            onClick={handleToggleWishlist}
            disabled={isWishlisting}
            className={cn(
              "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 flex items-center justify-center transition-all shadow-lg active:scale-90 disabled:opacity-50 cursor-pointer",
              isLiked ? 'text-red-500 bg-red-50 border-red-200' : 'text-stone-800 hover:bg-white'
            )}
            title="Wishlist"
          >
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} className={isWishlisting ? 'animate-pulse' : ''} />
          </motion.button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-16">
        {/* Product Image Section */}
        <div className="relative aspect-square md:h-screen lg:sticky lg:top-0 overflow-hidden bg-stone-100 shadow-sm">
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
              className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 backdrop-blur-xs"
            >
              <div className="bg-red-600 text-white font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] px-6 sm:px-10 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2rem] shadow-2xl border-2 border-white/20 -rotate-6 text-base sm:text-xl">
                Out of Stock
              </div>
            </motion.div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] via-transparent to-transparent lg:hidden" />
        </div>

        {/* Product Details Section */}
        <div className="px-4 sm:px-6 py-6 sm:py-12 lg:py-32 space-y-6 sm:space-y-8 max-w-full overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
              <span className="px-3 py-1 bg-[#E76A54]/10 text-[#E76A54] text-[10px] font-black uppercase tracking-wider rounded-full border border-[#E76A54]/20 shadow-2xs">
                {product.category}
              </span>
              {isPickupOnly && (
                <span className="px-3 py-1 bg-amber-500/10 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-500/30 flex items-center gap-1 shadow-2xs">
                  🛍 Pickup Available
                </span>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-xs font-bold shadow-2xs">
                <Star size={13} fill="currentColor" className="text-amber-500" />
                <span>{product.rating} (120+ Reviews)</span>
              </div>
            </div>
            
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display uppercase tracking-tight text-stone-900 mb-3 sm:mb-4 leading-tight break-words">
              {product.name}
            </h1>
            
            <div className="flex items-baseline gap-3 sm:gap-4 mt-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-display text-[#E76A54] italic">₹{product.price}</span>
              <span className="text-stone-400 line-through text-lg sm:text-xl font-semibold">₹{Math.round(product.price * 1.2)}</span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                Inclusive of all taxes
              </span>
            </div>
          </motion.div>

          {/* Quick Features */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-2 sm:gap-4"
          >
            <div className="bg-white p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-2xs flex flex-col items-center text-center gap-1.5 sm:gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-orange-50 text-[#E76A54] flex items-center justify-center">
                <Clock size={18} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest text-stone-700 leading-tight">
                {product.estimated_delivery_time_unit === 'days' 
                  ? `${product.estimated_delivery_time_string || product.estimated_delivery_time || '1-2'} Days` 
                  : `${product.estimated_delivery_time || 30} Min Delivery`}
              </span>
            </div>
            <div className="bg-white p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-2xs flex flex-col items-center text-center gap-1.5 sm:gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Flame size={18} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest text-stone-700 leading-tight">Freshly Baked</span>
            </div>
            <div className="bg-white p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-2xs flex flex-col items-center text-center gap-1.5 sm:gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest text-stone-700 leading-tight">100% Hygienic</span>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-5 sm:space-y-6 bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden"
          >
            <div className="grid grid-cols-3 border-b border-stone-200 w-full">
              {(['description', 'reviews', 'ingredients'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "py-3 px-1 text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative cursor-pointer text-center",
                    activeTab === tab ? 'text-[#E76A54]' : 'text-stone-400 hover:text-stone-700'
                  )}
                >
                  <span className="truncate block">{tab}</span>
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E76A54] rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="text-stone-700 text-sm sm:text-base leading-relaxed min-h-[110px]">
              {activeTab === 'description' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {product.description || `Our ${product.name} is prepared daily with the finest artisan ingredients and traditional baking techniques. Each piece is crafted to provide a moment of pure bliss, ensuring an unforgettable bakery experience right at your home.`}
                </motion.p>
              )}
              {activeTab === 'reviews' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/60">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-stone-900 text-sm">Emily S.</span>
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} fill="currentColor" />)}
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 italic">"The best pastries I've ever tasted! So fresh, rich, and delicious."</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/60">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-stone-900 text-sm">Rahul M.</span>
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} fill="currentColor" />)}
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 italic">"Delivered right on time and packaging was super premium. Will order again!"</p>
                  </div>
                </motion.div>
              )}
              {activeTab === 'ingredients' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-stone-700">
                  Premium Unbleached Flour, Natural Leaven, Organic Cane Sugar, Belgian Chocolate, Real Cultured Butter, Fresh Farm Eggs, and our signature Frosty Bite artisan touch.
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
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-stone-200/80 shadow-xs"
            >
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <span className="text-xs font-black uppercase tracking-widest text-stone-500">Quantity</span>
                <div className="flex items-center bg-stone-100 rounded-2xl border border-stone-200 p-1">
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white text-stone-800 shadow-2xs flex items-center justify-center hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-10 sm:w-12 text-center font-bold text-stone-900 text-sm sm:text-base">{quantity}</span>
                  <button 
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white text-stone-800 shadow-2xs flex items-center justify-center hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleWishlist}
                disabled={isWishlisting}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all duration-300 text-xs font-black uppercase tracking-wider sm:tracking-widest group active:scale-95 disabled:opacity-50 cursor-pointer w-full sm:w-auto justify-center",
                  isLiked 
                    ? "bg-red-50 border-red-200 text-red-600" 
                    : "bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200"
                )}
              >
                <Heart 
                  size={16} 
                  fill={isLiked ? "currentColor" : "none"} 
                  className={cn("transition-transform group-hover:scale-110", isWishlisting && "animate-pulse")} 
                />
                <span>{isLiked ? 'Wishlisted' : 'Add to Wishlist'}</span>
              </button>
            </motion.div>

            {/* In-Line Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.available === false || product.stock_quantity <= 0}
                className="flex-1 py-3.5 sm:py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300 active:scale-95 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed group text-xs font-black uppercase tracking-wider sm:tracking-widest cursor-pointer"
              >
                <ShoppingCart size={17} className="group-hover:scale-110 transition-transform text-[#E76A54]" />
                <span>Add to Cart</span>
              </button>
              
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={product.available === false || product.stock_quantity <= 0 || isBuyingNow}
                className="flex-[1.5] py-3.5 sm:py-4 bg-[#E76A54] hover:bg-[#d55943] text-white rounded-2xl flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300 active:scale-95 shadow-xl shadow-[#E76A54]/25 disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed group relative overflow-hidden text-xs font-black uppercase tracking-wider sm:tracking-widest cursor-pointer"
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
        <section className="max-w-7xl mx-auto px-6 py-24 border-t border-stone-200 mt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-[#E76A54]">
                 <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display uppercase tracking-tighter leading-none text-stone-900">
                  You Might Also Like
                </h2>
                <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px]">
                  More from {product.category} for your cravings
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex space-x-6 overflow-x-auto pb-8 scrollbar-hide -mx-6 px-6 touch-carousel overscroll-x-contain">
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
        className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-6 bg-white/95 backdrop-blur-2xl border-t border-stone-200 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]"
        style={{
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={product.available === false || product.stock_quantity <= 0}
            className="flex-1 py-3.5 sm:py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300 active:scale-95 shadow-md disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ShoppingCart size={17} className="group-hover:scale-110 transition-transform text-[#E76A54]" />
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-[0.15em] whitespace-nowrap">Add to Cart</span>
          </button>
          
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={product.available === false || product.stock_quantity <= 0 || isBuyingNow}
            className="flex-[1.4] sm:flex-[1.5] py-3.5 sm:py-4 bg-[#E76A54] hover:bg-[#d55943] text-white rounded-2xl flex items-center justify-center space-x-2 sm:space-x-3 transition-all duration-300 active:scale-95 shadow-xl shadow-[#E76A54]/25 disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed group relative overflow-hidden cursor-pointer"
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
                    <Zap size={17} fill="currentColor" />
                  </motion.div>
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-[0.15em] italic whitespace-nowrap">Fast tracking...</span>
                </motion.div>
              ) : (
                <motion.div
                  key="default"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center space-x-2 sm:space-x-3"
                >
                  <Zap size={17} fill="currentColor" className="group-hover:scale-125 transition-transform" />
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-[0.15em] whitespace-nowrap">
                    {(product.available === false || product.stock_quantity <= 0) ? 'Unavailable' : 'Buy Now'}
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
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            onClick={() => {
              purchaseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="fixed bottom-28 right-6 z-40 px-5 py-3.5 bg-[#E76A54] text-white font-black uppercase tracking-widest text-xs rounded-full shadow-[0_10px_30px_rgba(231,106,84,0.4)] hover:bg-[#d55943] active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer"
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
