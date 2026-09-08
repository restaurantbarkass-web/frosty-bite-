import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface CouponItem {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_item';
  value: number;
  min_order: number;
  expiry_date?: string;
  usage_limit?: number;
  usage_count?: number;
  status: 'active' | 'expired' | 'disabled';
  is_hidden?: boolean;
  is_first_order_only?: boolean;
  created_at?: string;
}

interface HomePromoBannerProps {
  onOrderNow?: () => void;
}

export const HomePromoBanner: React.FC<HomePromoBannerProps> = ({ onOrderNow }) => {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate coupon strictly according to admin rules
  const isValidAdminCoupon = useCallback((c: any): c is CouponItem => {
    if (!c || !c.code || typeof c.code !== 'string' || !c.code.trim()) return false;
    if (c.status !== 'active') return false;
    if (c.is_hidden) return false;

    // Check expiry
    if (c.expiry_date) {
      const exp = new Date(c.expiry_date);
      if (!isNaN(exp.getTime())) {
        // Allow throughout the day of expiry
        exp.setHours(23, 59, 59, 999);
        if (exp.getTime() < Date.now()) {
          return false;
        }
      }
    }

    // Check usage limits if set
    if (c.usage_limit && c.usage_limit > 0) {
      if ((c.usage_count || 0) >= c.usage_limit) {
        return false;
      }
    }

    return true;
  }, []);

  const fetchRealCoupons = useCallback(async () => {
    try {
      // 1. Fetch only active, public coupons directly from the coupons table
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[HomePromoBanner] Supabase coupons error:', error.message);
      }

      let activeList = (data || []).filter(isValidAdminCoupon);

      // Cache real coupons locally for snappy page reloads
      if (activeList.length > 0) {
        try {
          localStorage.setItem('coupons_cache', JSON.stringify({ data: activeList, timestamp: Date.now() }));
        } catch (_) {}
      } else {
        // Check if cached items exist and are still valid
        try {
          const cached = JSON.parse(localStorage.getItem('coupons_cache') || '{}');
          if (Array.isArray(cached.data)) {
            activeList = cached.data.filter(isValidAdminCoupon);
          }
        } catch (_) {}
      }

      // Sort: First-order coupons first, then newest
      activeList.sort((a, b) => {
        if (a.is_first_order_only && !b.is_first_order_only) return -1;
        if (!a.is_first_order_only && b.is_first_order_only) return 1;
        return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
      });

      setCoupons(activeList);
      setCurrentIndex(0);
    } catch (err) {
      console.warn('[HomePromoBanner] Failed to load admin coupons:', err);
      setCoupons([]);
    } finally {
      setIsLoading(false);
    }
  }, [isValidAdminCoupon]);

  useEffect(() => {
    fetchRealCoupons();

    // Subscribe to real-time changes in coupons table so admin updates appear instantly
    const couponChannel = supabase
      .channel('home_promo_real_coupons_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchRealCoupons();
      })
      .subscribe();

    // Listen to local storage sync events across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'coupons_cache') {
        fetchRealCoupons();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(couponChannel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchRealCoupons]);

  // Auto cycle between coupons if admin added multiple active coupons
  useEffect(() => {
    if (coupons.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % coupons.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [coupons.length]);

  // STRICT RULE: If no real active coupons exist from the admin, DO NOT render anything.
  if (isLoading || coupons.length === 0) {
    return null;
  }

  const currentCoupon = coupons[currentIndex] || coupons[0];
  if (!currentCoupon) {
    return null;
  }

  // Derive human-friendly title and subtitle from the real coupon configured by admin
  let title = 'Special Discount';
  let subtitle = 'Use code:';

  if (currentCoupon.is_first_order_only) {
    title = 'First order';
    if (currentCoupon.type === 'percentage' && currentCoupon.value > 0) {
      subtitle = `Get ${currentCoupon.value}% OFF with code:`;
    } else if (currentCoupon.type === 'fixed' && currentCoupon.value > 0) {
      subtitle = `Save ₹${currentCoupon.value} with code:`;
    } else {
      subtitle = 'Use code:';
    }
  } else if (currentCoupon.type === 'percentage') {
    title = `${currentCoupon.value}% OFF on order`;
    subtitle = currentCoupon.min_order > 0 ? `Min. ₹${currentCoupon.min_order} • Use code:` : 'Use code:';
  } else if (currentCoupon.type === 'fixed') {
    title = `Flat ₹${currentCoupon.value} OFF`;
    subtitle = currentCoupon.min_order > 0 ? `Min. ₹${currentCoupon.min_order} • Use code:` : 'Use code:';
  } else if (currentCoupon.type === 'free_item') {
    title = 'Free Bakery Treat';
    subtitle = currentCoupon.min_order > 0 ? `Min. ₹${currentCoupon.min_order} • Use code:` : 'Use code:';
  }

  const handleClaimCode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const code = currentCoupon.code.toUpperCase();
    localStorage.setItem('claimed_coupon', code);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }

    const discountSummary = currentCoupon.type === 'percentage' 
      ? `${currentCoupon.value}% OFF` 
      : currentCoupon.type === 'fixed' 
      ? `₹${currentCoupon.value} OFF` 
      : 'Special Offer';

    toast.success(`Coupon "${code}" applied! (${discountSummary}) 🎉`, {
      id: 'coupon-claim',
      style: {
        borderRadius: '16px',
        background: '#1C1816',
        color: '#FAF8F5',
        fontWeight: 'bold',
        fontSize: '13px',
      },
      icon: '🏷️'
    });
  };

  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClaimCode();
    if (onOrderNow) {
      onOrderNow();
    } else {
      const el = document.getElementById('menu-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + coupons.length) % coupons.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % coupons.length);
  };

  return (
    <section 
      id="home-promo-banner"
      className="w-full mb-6 bg-[#FFF0ED] hover:bg-[#FFEAE6] transition-colors rounded-2xl p-3 sm:p-3.5 border border-[#FCD9D3] flex items-center justify-between shadow-xs relative overflow-hidden"
    >
      <div 
        onClick={handleClaimCode} 
        className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer group select-none flex-1"
        title="Click to copy & claim this coupon"
      >
        {/* Discount Tag Icon Card */}
        <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0 text-[#E76A54] border border-[#FCD9D3]/60 group-hover:scale-105 transition-transform">
          <Tag className="w-5 h-5 stroke-[2.2]" />
        </div>
        
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCoupon.id || currentCoupon.code}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
            >
              <h4 className="font-bold text-sm sm:text-base text-stone-900 leading-tight truncate">
                {title}
              </h4>
              <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1 flex-wrap">
                <span>{subtitle}</span>
                <span className="font-bold text-stone-900 underline decoration-dotted tracking-wide">
                  {currentCoupon.code.toUpperCase()}
                </span>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Carousel controls if admin added multiple active coupons */}
        {coupons.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 mr-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous coupon"
              className="w-6 h-6 rounded-full bg-white/80 hover:bg-white text-stone-600 flex items-center justify-center border border-[#FCD9D3]/70 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] font-bold text-stone-500 px-1">
              {currentIndex + 1}/{coupons.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next coupon"
              className="w-6 h-6 rounded-full bg-white/80 hover:bg-white text-stone-600 flex items-center justify-center border border-[#FCD9D3]/70 transition-all cursor-pointer shadow-2xs"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* ORDER NOW CTA button */}
        <motion.button
          type="button"
          id="order-now-coupon-btn"
          whileTap={{ scale: 0.94 }}
          onClick={handleOrderClick}
          className="bg-[#E76A54] hover:bg-[#d85c46] text-white text-xs font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-full shadow-xs transition-colors shrink-0 cursor-pointer select-none tracking-wide"
        >
          ORDER NOW
        </motion.button>
      </div>
    </section>
  );
};


