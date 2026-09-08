import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  Clock, 
  Copy, 
  Check, 
  Tag, 
  ShoppingBag, 
  ArrowLeft, 
  Plus, 
  Minus, 
  AlertCircle, 
  ChevronRight, 
  Flame, 
  Percent, 
  Gift, 
  CheckCircle2, 
  Search,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CampaignService } from '../services/CampaignService';
import { PromotionalCampaign, FoodItem } from '../types';
import { useCart, useCartActions } from '../context/CartContext';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { playPopSound, playClickSound } from '../utils/soundEffects';
import { haptic } from '../lib/utils';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export const CampaignPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<PromotionalCampaign | null>(null);
  const [products, setProducts] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Cart Context
  const { cart, appliedCoupon, totalPrice, totalItems, discountAmount } = useCart();
  const { addToCart, updateQuantity, removeFromCart, setAppliedCoupon, setIsCartOpen } = useCartActions();

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isEnded: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: false });

  // Load campaign & products
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await CampaignService.getCampaignById(id);
        if (!isMounted) return;
        if (!data) {
          setError('Promotional campaign not found or has been concluded.');
        } else {
          setCampaign(data.campaign);
          setProducts(data.products || []);

          // Auto apply coupon if configured and not applied yet
          if (data.campaign.coupon?.auto_apply && data.campaign.coupon.code) {
            const coupon = data.campaign.coupon;
            if (!appliedCoupon || appliedCoupon.code !== coupon.code) {
              setAppliedCoupon({
                id: `camp-${data.campaign.id}`,
                code: coupon.code,
                value: coupon.value,
                type: coupon.type,
                campaign_id: data.campaign.id,
                eligible_product_ids: data.campaign.product_ids,
                campaign_title: data.campaign.title,
                free_item_id: coupon.free_item_id,
                free_item_quantity: coupon.free_item_quantity,
                gift_url: coupon.gift_url
              });
              toast.success(`🎉 Offer "${coupon.code}" auto-applied for this campaign!`, { duration: 4000 });
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Failed to load campaign details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [id]);

  // Countdown timer effect
  useEffect(() => {
    if (!campaign?.end_at) return;

    const calculateTime = () => {
      const difference = new Date(campaign.end_at).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [campaign?.end_at]);

  // Handle Apply / Copy coupon
  const handleApplyCampaignCoupon = useCallback(() => {
    if (!campaign?.coupon) return;
    const coupon = campaign.coupon;
    playPopSound();
    haptic.medium();

    setAppliedCoupon({
      id: `camp-${campaign.id}`,
      code: coupon.code,
      value: coupon.value,
      type: coupon.type,
      campaign_id: campaign.id,
      eligible_product_ids: campaign.product_ids,
      campaign_title: campaign.title,
      free_item_id: coupon.free_item_id,
      free_item_quantity: coupon.free_item_quantity,
      gift_url: coupon.gift_url
    });

    try {
      navigator.clipboard.writeText(coupon.code);
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    } catch (_) {}

    try {
      confetti({
        particleCount: 120,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#E76A54', '#F59E0B', '#10B981']
      });
    } catch (_) {}

    toast.success(`🎉 Coupon "${coupon.code}" copied & applied to your cart!`, { duration: 3500 });
  }, [campaign, setAppliedCoupon]);

  // Categories extracted from products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Calculate discounted price for a product
  const getDiscountedPrice = (price: number) => {
    if (!campaign?.coupon) return price;
    if (campaign.coupon.type === 'percentage') {
      const discount = (price * campaign.coupon.value) / 100;
      return Math.max(0, Math.round(price - discount));
    }
    if (campaign.coupon.type === 'fixed') {
      return Math.max(0, price - campaign.coupon.value);
    }
    return price;
  };

  // Mixed cart calculations
  const campaignCartItems = useMemo(() => {
    if (!campaign) return [];
    const eligibleSet = new Set(campaign.product_ids);
    return cart.filter(item => eligibleSet.has(item.id));
  }, [cart, campaign]);

  const campaignCartItemsCount = useMemo(() => {
    return campaignCartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [campaignCartItems]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 border-4 border-[#E76A54] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-stone-600 font-bold text-sm tracking-wide">Loading exclusive promotion treats...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-3xl border border-stone-200 text-center space-y-5 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-stone-900">Campaign Not Available</h2>
        <p className="text-stone-600 text-sm leading-relaxed">
          {error || "This promotional campaign may have expired or is currently not active."}
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-[#E76A54] text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#d65943] transition-all cursor-pointer"
          >
            Explore Fresh Treats
          </button>
          <button
            onClick={() => navigate('/categories')}
            className="px-6 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-200 transition-all cursor-pointer"
          >
            Browse Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-32">
      {/* Top Navigation Bar */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-stone-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-colors p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#E76A54] bg-[#E76A54]/10 px-2.5 py-1 rounded-full border border-[#E76A54]/20">
              Campaign Offer
            </span>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-stone-700 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <ShoppingBag size={18} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E76A54] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* Hero Visual Card */}
        <div className="relative rounded-3xl overflow-hidden bg-stone-900 border border-stone-800 shadow-lg text-white">
          <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full overflow-hidden">
            <OptimizedImage
              src={campaign.banner_image}
              alt={campaign.title}
              containerClassName="w-full h-full"
              className="w-full h-full object-cover brightness-[0.75]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

            {/* Badges Over Banner */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap gap-2 z-10">
              {campaign.is_flash_deal && (
                <span className="px-3 py-1 bg-amber-500 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md">
                  <Flame size={14} className="fill-stone-950" /> Flash Deal
                </span>
              )}
              {campaign.coupon && (
                <span className="px-3 py-1 bg-[#E76A54] text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md">
                  <Percent size={14} /> 
                  {campaign.coupon.type === 'percentage' 
                    ? `${campaign.coupon.value}% OFF` 
                    : campaign.coupon.type === 'fixed'
                      ? `₹${campaign.coupon.value} OFF`
                      : 'Free Gift Item'}
                </span>
              )}
            </div>

            {/* Text details over banner */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 space-y-2 z-10">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-md">
                {campaign.title}
              </h1>
              {campaign.description && (
                <p className="text-xs sm:text-base text-stone-200 font-medium max-w-2xl leading-relaxed drop-shadow-xs line-clamp-2 sm:line-clamp-none">
                  {campaign.description}
                </p>
              )}
            </div>
          </div>

          {/* Countdown & Expiry Bar */}
          {!timeLeft.isEnded && (
            <div className="bg-stone-950/90 border-t border-stone-800/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                <Clock size={15} className="text-[#E76A54]" />
                <span>Offer Concludes In:</span>
              </div>
              <div className="flex items-center gap-2 font-mono font-black text-xs sm:text-sm text-stone-100">
                <div className="bg-stone-800/80 px-2 py-1 rounded-lg border border-stone-700">
                  {String(timeLeft.days).padStart(2, '0')}d
                </div>
                <span>:</span>
                <div className="bg-stone-800/80 px-2 py-1 rounded-lg border border-stone-700">
                  {String(timeLeft.hours).padStart(2, '0')}h
                </div>
                <span>:</span>
                <div className="bg-stone-800/80 px-2 py-1 rounded-lg border border-stone-700">
                  {String(timeLeft.minutes).padStart(2, '0')}m
                </div>
                <span>:</span>
                <div className="bg-stone-800/80 px-2 py-1 rounded-lg border border-stone-700 text-[#E76A54]">
                  {String(timeLeft.seconds).padStart(2, '0')}s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Campaign Coupon Box */}
        {campaign.coupon && (
          <div className="bg-gradient-to-r from-amber-500/10 via-[#E76A54]/10 to-amber-500/10 border-2 border-dashed border-[#E76A54]/40 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#E76A54]" />
                <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                  Campaign Exclusive Coupon
                </span>
                {appliedCoupon?.code === campaign.coupon.code && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase">
                    Active in Cart
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-stone-800">
                {campaign.coupon.type === 'percentage' 
                  ? `Get ${campaign.coupon.value}% OFF on all products listed below` 
                  : campaign.coupon.type === 'fixed'
                    ? `Save Flat ₹${campaign.coupon.value} on all products listed below`
                    : 'Unlock complimentary free gift item with your order'}
                {campaign.coupon.min_order ? ` (Min. campaign items: ₹${campaign.coupon.min_order})` : ''}.
              </p>
              <p className="text-[11px] text-stone-500">
                * Note: Mixed cart supported. This discount applies strictly to the eligible campaign items in your cart.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial bg-white border border-[#E76A54]/30 rounded-xl px-4 py-2 text-center shadow-2xs">
                <span className="font-mono font-black text-sm sm:text-base text-stone-900 tracking-wider">
                  {campaign.coupon.code}
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyCampaignCoupon}
                className="px-4 py-2.5 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95"
              >
                {hasCopiedCode ? <Check size={15} /> : <Copy size={15} />}
                {appliedCoupon?.code === campaign.coupon.code ? 'Applied' : 'Apply & Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Mixed Cart Notice if customer already has other items */}
        {cart.length > 0 && (
          <div className="bg-stone-100/90 border border-stone-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-stone-700">
              <ShoppingBag size={15} className="text-[#E76A54]" />
              <span className="font-medium">
                Your cart currently contains <strong>{totalItems} items</strong> ({campaignCartItemsCount} from this campaign).
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="text-[#E76A54] hover:underline font-bold text-xs cursor-pointer"
            >
              Review Cart & Offers →
            </button>
          </div>
        )}

        {/* Section Header & Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                <span>Featured Campaign Treats</span>
                <span className="text-xs bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-bold">
                  {products.length} Items
                </span>
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Exclusive selection curated for this special promotional event
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search campaign treats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold placeholder:text-stone-400 focus:outline-none focus:border-[#E76A54] transition-all"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          {categories.length > 1 && (
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#E76A54] text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((cat) => {
                const count = products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#E76A54] text-white shadow-xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaign Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-8 space-y-3">
            <p className="text-stone-500 font-bold text-sm">No treats found matching your filter.</p>
            <button
              onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
              className="text-xs font-bold text-[#E76A54] underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
              const discountedPrice = getDiscountedPrice(product.price);
              const hasDiscount = discountedPrice < product.price;
              const cartItem = cart.find(i => i.id === product.id);
              const quantityInCart = cartItem ? cartItem.quantity : 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Thumbnail & Badges */}
                  <div className="relative aspect-square overflow-hidden bg-stone-100">
                    <OptimizedImage
                      src={product.image}
                      alt={product.name}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Campaign Offer Ribbon */}
                    {hasDiscount && (
                      <div className="absolute top-2.5 left-2.5 bg-[#E76A54] text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
                        <Tag size={10} /> Offer Item
                      </div>
                    )}

                    {product.is_bestseller && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-500 text-stone-950 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs">
                        Bestseller
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-sm font-bold text-stone-900 group-hover:text-[#E76A54] transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                      </div>
                      {product.description && (
                        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed font-normal">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing & Add Stepper */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div className="flex flex-col">
                        {hasDiscount ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black text-[#E76A54]">
                                ₹{discountedPrice}
                              </span>
                              <span className="text-[11px] text-stone-400 line-through font-semibold">
                                ₹{product.original_price || product.price}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-tight">
                              With coupon
                            </span>
                          </>
                        ) : product.original_price && product.original_price > product.price ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black text-[#E76A54]">
                                ₹{product.price}
                              </span>
                              <span className="text-[11px] text-stone-400 line-through font-semibold">
                                ₹{product.original_price}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-tight">
                              Special Event Price
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-black text-stone-900">
                            ₹{product.price}
                          </span>
                        )}
                      </div>

                      {/* Add Button or Quantity Stepper */}
                      {quantityInCart === 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            addToCart(product);
                            playPopSound();
                            haptic.light();
                            toast.success(`Added ${product.name} to cart!`, { duration: 1500 });
                          }}
                          className="px-3.5 py-1.5 bg-[#E76A54] hover:bg-[#d65943] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={13} strokeWidth={3} /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (quantityInCart === 1) {
                                removeFromCart(product.id);
                              } else {
                                updateQuantity(product.id, -1);
                              }
                              playClickSound();
                              haptic.light();
                            }}
                            className="p-1 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-5 text-center font-bold text-xs text-stone-900">
                            {quantityInCart}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateQuantity(product.id, 1);
                              playPopSound();
                              haptic.light();
                            }}
                            className="p-1 text-[#E76A54] hover:text-[#d65943] rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back to Bakery Menu Link */}
        <div className="pt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600 hover:text-[#E76A54] transition-colors p-2"
          >
            ← Back to Full Bakery Store
          </Link>
        </div>
      </div>

      {/* Floating Sticky Bottom Cart Action */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-stone-900 text-white rounded-2xl p-3.5 shadow-2xl border border-stone-800 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E76A54] flex items-center justify-center font-black text-xs">
                {totalItems}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-stone-300">
                  ₹{totalPrice}
                  {discountAmount > 0 && (
                    <span className="ml-1 text-[10px] text-emerald-400 font-semibold">
                      (Saved ₹{discountAmount})
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">
                  {campaignCartItemsCount > 0 ? `${campaignCartItemsCount} offer items` : 'Ready to checkout'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 py-2 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              View Cart <ChevronRight size={14} />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CampaignPage;
