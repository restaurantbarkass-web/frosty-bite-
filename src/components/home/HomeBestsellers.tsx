import React, { useState, useMemo } from 'react';
import { ChevronRight, Heart, Plus, Minus, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useCartActions, useCartState } from '../../context/CartContext';
import { useMenu } from '../../context/MenuContext';
import { FoodItem } from '../../types';
import toast from 'react-hot-toast';

interface FallbackBestseller {
  id: string;
  name: string;
  rating: number;
  reviewsCount: number;
  price: number;
  image: string;
  category: string;
  description: string;
}

const FALLBACK_BESTSELLERS: FallbackBestseller[] = [
  {
    id: 'bestseller-1',
    name: 'Chocolate Truffle Cake',
    rating: 4.8,
    reviewsCount: 256,
    price: 699,
    image: '/images/stitch/bestseller-truffle.png',
    category: 'Cakes',
    description: 'Rich dark Belgian chocolate ganache layered between moist chocolate sponge.',
  },
  {
    id: 'bestseller-2',
    name: 'Red Velvet Cake',
    rating: 4.7,
    reviewsCount: 189,
    price: 699,
    image: '/images/stitch/bestseller-redvelvet.png',
    category: 'Cakes',
    description: 'Classic crimson velvety sponge crowned with smooth cream cheese frosting.',
  },
  {
    id: 'bestseller-3',
    name: 'Blueberry Cheesecake',
    rating: 4.8,
    reviewsCount: 153,
    price: 749,
    image: '/images/stitch/bestseller-cheesecake.png',
    category: 'Desserts',
    description: 'Silky baked cheesecake topped with wild blueberry compote on graham crust.',
  },
  {
    id: 'bestseller-4',
    name: 'Lotus Biscoff Cake',
    rating: 4.9,
    reviewsCount: 217,
    price: 749,
    image: '/images/stitch/bestseller-biscoff.png',
    category: 'Cakes',
    description: 'Caramelized speculoos spiced sponge infused with Lotus Biscoff cream drizzle.',
  },
];

interface HomeBestsellersProps {
  onViewAll?: () => void;
  items?: FoodItem[];
}

export const HomeBestsellers: React.FC<HomeBestsellersProps> = ({ onViewAll, items: propItems }) => {
  const { items: contextItems, loading } = useMenu();
  const { cart } = useCartState();
  const { addToCart, updateQuantity } = useCartActions();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const allItems = propItems || contextItems || [];

  // Compute bestsellers from real backend products
  const bestsellers = useMemo<FoodItem[]>(() => {
    if (!allItems || allItems.length === 0) return [];

    // Filter available items
    const available = allItems.filter((i) => i.available !== false);
    const pool = available.length > 0 ? available : allItems;

    // 1. Explicitly marked bestsellers or recommended
    const explicit = pool.filter(
      (item) =>
        item.is_recommended === true ||
        item.is_ai_boosted === true ||
        (item.tags && item.tags.some((t) => /bestseller|popular|favorite|trending/i.test(t)))
    );

    if (explicit.length >= 4) {
      return explicit.slice(0, 10);
    }

    // 2. Supplement with highest rated or popular items from backend
    const remaining = pool
      .filter((i) => !explicit.some((e) => e.id === i.id))
      .sort((a, b) => (Number(b.rating) || 5) - (Number(a.rating) || 5));

    return [...explicit, ...remaining].slice(0, 10);
  }, [allItems]);

  // Display items: backend bestsellers if present, otherwise fallback
  const displayItems = bestsellers.length > 0 ? bestsellers : (loading ? [] : FALLBACK_BESTSELLERS as unknown as FoodItem[]);

  const toggleFavorite = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = !prev[id];
      toast.success(updated ? `Saved ${name} to favorites!` : `Removed from favorites`, {
        id: `fav-${id}`,
        duration: 1500,
      });
      return { ...prev, [id]: updated };
    });
  };

  const handleAdd = (item: FoodItem) => {
    addToCart(item);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
    toast.success(`${item.name} added to cart!`, { id: `cart-${item.id}`, duration: 2000 });
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      const el = document.getElementById('menu-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
            Bestsellers
          </h3>
          <span className="hidden sm:inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
            🔥 Customer Favorites
          </span>
        </div>
        <button
          type="button"
          onClick={handleViewAll}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 cursor-pointer transition-colors"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>

      {/* Product Grid Carousel */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6 snap-x overscroll-x-contain">
        {displayItems.map((product) => {
          const isFav = !!favorites[product.id];
          const cartItem = cart.find((c) => c.id === product.id);
          const inCartQuantity = cartItem ? cartItem.quantity : 0;
          const ratingVal = Number(product.rating || 5);

          return (
            <div
              key={product.id}
              className="snap-start shrink-0 w-[148px] sm:w-[164px] bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-2.5 flex flex-col justify-between hover:shadow-md transition-shadow group"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-neutral-100 mb-2">
                <img
                  src={product.image || '/images/stitch/hero-cake.png'}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/stitch/hero-cake.png';
                  }}
                />
                
                {/* Bestseller Badge */}
                <span className="absolute top-1.5 left-1.5 bg-[#E76A54] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs uppercase tracking-wider">
                  Bestseller
                </span>

                {/* Favorite Button */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(product.id, product.name, e)}
                  aria-label={`Favorite ${product.name}`}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shadow-xs"
                >
                  <Heart
                    className={`w-3.5 h-3.5 stroke-[2] ${
                      isFav ? 'fill-red-500 text-red-500' : 'text-neutral-500'
                    }`}
                  />
                </button>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-neutral-900 truncate" title={product.name}>
                  {product.name}
                </h5>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-neutral-500">
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    <Star size={10} className="fill-amber-400 text-amber-500" />
                    {ratingVal.toFixed(1)}
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="truncate max-w-[80px] text-neutral-500 font-medium">
                    {product.category || 'Bakery'}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1">
                  <span className="text-xs sm:text-sm font-bold text-neutral-900">
                    ₹{product.price}
                  </span>

                  {inCartQuantity > 0 ? (
                    <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, -1)}
                        className="w-5 h-5 flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={11} strokeWidth={2.5} />
                      </button>
                      <span className="text-xs font-bold text-stone-900 px-1.5 min-w-[16px] text-center">
                        {inCartQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, 1)}
                        className="w-5 h-5 flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleAdd(product)}
                      className="bg-[#E76A54] hover:bg-[#d65943] text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer select-none shadow-2xs"
                    >
                      + ADD
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

