import React, { useState, useEffect, useMemo } from 'react';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, Zap, Ticket, ArrowRight, Sparkles, Copy, Check, 
  Clock, Tag, Percent, ShoppingBag, Flame, Star, ShieldCheck, 
  ChevronRight, Cake, Coffee, Heart, CheckCircle2, Search, Loader2
} from 'lucide-react';
import { supabase } from '../supabase';
import { Coupon, Banner } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { BannerCarousel } from '../components/BannerCarousel';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Offers', icon: Tag },
  { id: 'first_order', label: 'First Order', icon: Sparkles },
  { id: 'cakes', label: 'Cakes & Desserts', icon: Cake },
  { id: 'combos', label: 'Combos & Coffee', icon: Coffee },
];

export const OffersPage: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useMetadata({
    title: 'Bakery Deals, Coupons & Special Offers',
    description: 'Save big with active promo codes, dessert combo discounts, and free delivery vouchers at Frosty Bite.',
    keywords: ['coupons', 'bakery discounts', 'cake promo codes', 'Frosty Bite offers', 'Cuttack deals']
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bannersPromise = supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false });

        const couponsPromise = supabase
          .from('coupons')
          .select('*')
          .eq('status', 'active')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });

        const [bannersRes, couponsRes] = await Promise.all([
          bannersPromise,
          couponsPromise
        ]);

        if (bannersRes.data) {
          setBanners(bannersRes.data);
        }
        if (couponsRes.data) {
          setCoupons(couponsRes.data);
        }
      } catch (error) {
        console.warn('Error fetching offers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    localStorage.setItem('claimed_coupon', code);
    
    toast.success(`Code "${code}" copied & saved! 🎉`, {
      style: {
        borderRadius: '16px',
        background: '#1C1816',
        color: '#FAF8F5',
        fontWeight: 'bold',
        fontSize: '13px',
      },
      icon: '🏷️'
    });

    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const handleApplyAndOrder = (code: string) => {
    localStorage.setItem('claimed_coupon', code);
    toast.success(`Coupon ${code} claimed! Directing to menu... 🍰`);
    navigate('/categories');
  };

  // Format backend coupons into displayable offer cards
  const formattedOffers = useMemo(() => {
    return coupons.map(coupon => {
      let title = '';
      let description = '';
      let tag = 'Active Voucher';
      let category = 'all';

      if (coupon.type === 'percentage') {
        title = `${coupon.value}% OFF on Your Order`;
        description = `Save ${coupon.value}% across our freshly baked menu. Minimum order ₹${coupon.min_order || 0}.`;
      } else if (coupon.type === 'fixed') {
        title = `₹${coupon.value} OFF on Bakery Treats`;
        description = `Enjoy flat ₹${coupon.value} discount on orders above ₹${coupon.min_order || 0}.`;
      } else {
        title = `Free Special Gift Item`;
        description = `Claim complimentary artisan item on orders above ₹${coupon.min_order || 0}.`;
        tag = 'Free Item';
      }

      if (coupon.is_first_order_only) {
        tag = 'First Order';
        category = 'first_order';
      } else if (coupon.code.toLowerCase().includes('cake') || coupon.code.toLowerCase().includes('tart')) {
        category = 'cakes';
      } else if (coupon.code.toLowerCase().includes('combo') || coupon.code.toLowerCase().includes('coffee') || coupon.code.toLowerCase().includes('brew')) {
        category = 'combos';
      }

      return {
        id: coupon.id,
        code: coupon.code,
        title,
        description,
        discount_type: coupon.type,
        discount_value: coupon.value,
        min_order_value: coupon.min_order || 0,
        category,
        expires_in: coupon.expiry_date ? `Valid till ${coupon.expiry_date}` : 'Active Now',
        tag
      };
    });
  }, [coupons]);

  // Filter coupons based on active tab
  const filteredOffers = useMemo(() => {
    if (activeTab === 'all') return formattedOffers;
    return formattedOffers.filter(item => item.category === activeTab || item.category === 'all');
  }, [formattedOffers, activeTab]);

  const featuredOffer = formattedOffers[0];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pt-6 pb-28 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="text-center max-w-2xl mx-auto space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E76A54]/10 text-[#E76A54] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Exclusive Bakery Rewards</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-stone-900 tracking-tight">
            Deals, Vouchers & Fresh Perks
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 max-w-lg mx-auto leading-relaxed">
            Apply active discount codes at checkout to enjoy handmade artisan pastries, celebration cakes, and freshly brewed coffees at special prices.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#E76A54]" />
          </div>
        ) : filteredOffers.length === 0 && coupons.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-xs space-y-3">
            <Ticket size={48} className="mx-auto text-stone-300" />
            <h3 className="text-lg font-serif font-bold text-stone-800">No Active Offers Right Now</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Our kitchen team is preparing new daily specials. Check back soon for exciting discount codes and seasonal vouchers!
            </p>
          </div>
        ) : (
          <>
            {/* Featured Hero Deal Card (If available) */}
            {featuredOffer && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1816] via-[#2D1F1B] to-[#1C1816] text-white p-6 sm:p-8 border border-stone-800 shadow-xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-[#E76A54]/20 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E76A54] text-white shadow-xs">
                        Today's Special Deal
                      </span>
                      <span className="text-[11px] text-stone-300 font-mono flex items-center gap-1">
                        <Clock size={12} className="text-[#E5A970]" /> {featuredOffer.expires_in}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-white tracking-tight leading-snug">
                      {featuredOffer.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                      {featuredOffer.description} Use promo code <strong className="text-[#E5A970]">{featuredOffer.code}</strong> at checkout.
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleApplyAndOrder(featuredOffer.code)}
                        className="px-6 py-3 rounded-2xl bg-[#E76A54] hover:bg-[#D55943] text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#E76A54]/25 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <span>Claim & Order</span>
                        <ArrowRight size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyCoupon(featuredOffer.code)}
                        className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono font-bold border border-white/20 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <span>{featuredOffer.code}</span>
                        {copiedCode === featuredOffer.code ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Visual Badge Card */}
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl text-center shrink-0 min-w-[200px] hidden md:block">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#E5A970] mb-1">
                      Verified Code
                    </div>
                    <div className="text-2xl font-serif font-bold text-white tracking-wider">
                      {featuredOffer.code}
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1">Min. order ₹{featuredOffer.min_order_value}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {CATEGORY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer",
                      isActive
                        ? "bg-[#E76A54] text-white shadow-md shadow-[#E76A54]/20 scale-102"
                        : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
                    )}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Coupons Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredOffers.map((item) => {
                const isCopied = copiedCode === item.code;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between group"
                  >
                    {/* Authentic Ticket Notch Cutouts */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FAF8F5] border-r border-stone-200" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#FAF8F5] border-l border-stone-200" />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E76A54]/10 text-[#E76A54] border border-[#E76A54]/20">
                          {item.tag}
                        </span>
                        <span className="text-[11px] text-stone-400 font-medium flex items-center gap-1">
                          <Clock size={11} /> {item.expires_in}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 group-hover:text-[#E76A54] transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-400 font-medium pt-1">
                        <span>Min. Order: <strong>₹{item.min_order_value}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">100% Verified</span>
                      </div>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="mt-5 pt-4 border-t border-dashed border-stone-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 rounded-xl bg-stone-100 font-mono text-xs font-bold text-stone-800 border border-stone-200 select-all">
                          {item.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCoupon(item.code)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-[#E76A54] transition-colors cursor-pointer"
                          title="Copy Code"
                        >
                          {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyAndOrder(item.code)}
                        className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>Use Offer</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Bakery Perks & Loyalty Club Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl p-6 sm:p-8 border border-amber-200/60 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E76A54] text-white flex items-center justify-center font-bold shadow-md shadow-[#E76A54]/20">
              <Gift size={24} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Frosty Bite Baker's Club Perks
              </h3>
              <p className="text-xs text-stone-600">
                Unlock complimentary artisan treats every time you order online.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-amber-200/40 space-y-1">
              <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Free Cookie on ₹499+
              </div>
              <p className="text-[11px] text-stone-500">Auto-added to cart with every dessert order.</p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-amber-200/40 space-y-1">
              <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Birthday Month Surprise
              </div>
              <p className="text-[11px] text-stone-500">Receive an exclusive ₹200 pastry voucher on your special day.</p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-amber-200/40 space-y-1">
              <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Weekend Double Points
              </div>
              <p className="text-[11px] text-stone-500">Earn 2x loyalty credits on every Saturday & Sunday checkout.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OffersPage;
