import React, { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface HomePromoBannerProps {
  onOrderNow?: () => void;
}

export const HomePromoBanner: React.FC<HomePromoBannerProps> = ({ onOrderNow }) => {
  const [promoCode, setPromoCode] = useState<string>('FIRST10');
  const [promoTitle, setPromoTitle] = useState<string>('First order');
  const [promoSubtitle, setPromoSubtitle] = useState<string>('Use code:');

  const fetchPromo = async () => {
    try {
      // 1. Check for backend banners with auto_apply_coupon
      const { data: bannerData } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .not('auto_apply_coupon', 'is', null)
        .order('priority', { ascending: false })
        .limit(1);

      if (bannerData && bannerData.length > 0 && bannerData[0].auto_apply_coupon) {
        const banner = bannerData[0];
        setPromoCode(banner.auto_apply_coupon.toUpperCase());
        setPromoTitle(banner.title || 'Special Offer');
        setPromoSubtitle('Use code:');
        return;
      }

      // 2. Check coupons table for active coupons
      const { data: couponsData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      let activeCoupons = couponsData || [];

      // Fallback to local cache if offline or empty
      if (activeCoupons.length === 0) {
        try {
          const cached = JSON.parse(localStorage.getItem('coupons_cache') || '{}');
          if (Array.isArray(cached.data)) {
            activeCoupons = cached.data.filter((c: any) => c.status === 'active' && !c.is_hidden);
          }
        } catch (e) {}
      }

      if (activeCoupons.length > 0) {
        // Prioritize first-order coupon or latest active visible coupon
        const firstOrderCoupon = activeCoupons.find(c => c.is_first_order_only && !c.is_hidden);
        const visibleCoupon = activeCoupons.find(c => !c.is_hidden);
        const coupon = firstOrderCoupon || visibleCoupon || activeCoupons[0];

        if (coupon && coupon.code) {
          setPromoCode(coupon.code.toUpperCase());
          if (coupon.is_first_order_only) {
            setPromoTitle('First order');
          } else if (coupon.type === 'percentage') {
            setPromoTitle(`${coupon.value}% OFF on order`);
          } else if (coupon.type === 'fixed') {
            setPromoTitle(`Flat ₹${coupon.value} OFF`);
          } else if (coupon.type === 'free_item') {
            setPromoTitle('Free Bakery Gift');
          } else {
            setPromoTitle('Special discount');
          }
          setPromoSubtitle('Use code:');
        }
      }
    } catch (err) {
      console.warn('[HomePromoBanner] Could not load backend promo:', err);
    }
  };

  useEffect(() => {
    fetchPromo();

    // Subscribe to real-time changes in coupons and banners
    const couponChannel = supabase
      .channel('home_promo_coupons_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchPromo();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => {
        fetchPromo();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(couponChannel);
    };
  }, []);

  const handleClaimCode = () => {
    const code = promoCode.toUpperCase();
    localStorage.setItem('claimed_coupon', code);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    
    toast.success(`Coupon "${code}" claimed & saved! 🎉`, {
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

  const handleOrderClick = () => {
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

  return (
    <section 
      id="home-promo-banner"
      className="w-full bg-[#FFF0ED] hover:bg-[#FFEAE6] transition-colors rounded-2xl p-3 sm:p-3.5 border border-[#FCD9D3] flex items-center justify-between shadow-xs relative overflow-hidden"
    >
      <div 
        onClick={handleClaimCode} 
        className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer group select-none"
        title="Click to claim coupon"
      >
        {/* Discount Tag Icon Card */}
        <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0 text-[#E76A54] border border-[#FCD9D3]/60 group-hover:scale-105 transition-transform">
          <Tag className="w-5 h-5 stroke-[2.2]" />
        </div>
        
        <div className="min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-stone-900 leading-tight truncate">
            {promoTitle}
          </h4>
          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
            <span>{promoSubtitle}</span>
            <span className="font-bold text-stone-900 underline decoration-dotted tracking-wide">
              {promoCode}
            </span>
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        id="order-now-coupon-btn"
        whileTap={{ scale: 0.94 }}
        onClick={handleOrderClick}
        className="bg-[#E76A54] hover:bg-[#d85c46] text-white text-xs font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-full shadow-xs transition-colors shrink-0 cursor-pointer select-none tracking-wide"
      >
        ORDER NOW
      </motion.button>
    </section>
  );
};


