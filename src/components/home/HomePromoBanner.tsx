import React, { useState, useEffect } from 'react';
import { Tag, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface HomePromoBannerProps {
  onOrderNow?: () => void;
}

export const HomePromoBanner: React.FC<HomePromoBannerProps> = ({ onOrderNow }) => {
  const [promoCode, setPromoCode] = useState<string>('FIRST10');
  const [promoTitle, setPromoTitle] = useState<string>('Flat 10% OFF on your first order!');
  const [promoSubtitle, setPromoSubtitle] = useState<string>('Use code');

  useEffect(() => {
    let isMounted = true;

    async function fetchPromo() {
      try {
        // 1. Check for backend banners with auto_apply_coupon
        const { data: bannerData } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .not('auto_apply_coupon', 'is', null)
          .order('priority', { ascending: false })
          .limit(1);

        if (isMounted && bannerData && bannerData.length > 0 && bannerData[0].auto_apply_coupon) {
          const banner = bannerData[0];
          setPromoCode(banner.auto_apply_coupon);
          if (banner.title) {
            setPromoTitle(banner.title);
          }
          return;
        }

        // 2. Check coupons table for active coupons
        const { data: couponsData } = await supabase
          .from('coupons')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);

        if (isMounted && couponsData && couponsData.length > 0) {
          const coupon = couponsData[0];
          if (coupon.code) {
            setPromoCode(coupon.code);
            const discText = coupon.type === 'fixed' ? `₹${coupon.value} OFF` : `${coupon.value}% OFF`;
            setPromoTitle(`Flat ${discText} with code: ${coupon.code}`);
          }
        }
      } catch (err) {
        console.warn('[HomePromoBanner] Could not load backend promo:', err);
      }
    }

    fetchPromo();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(promoCode);
      toast.success(`Coupon code ${promoCode} copied!`, { id: 'coupon-copy' });
    }
  };

  const handleOrderClick = () => {
    handleCopyCode();
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
    <section className="w-full bg-gradient-to-r from-[#FFF0ED] via-[#FFEBE7] to-[#FFE5E0] rounded-2xl p-3.5 sm:p-4 border border-[#FCD9D3] flex items-center justify-between shadow-xs relative overflow-hidden">
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* Discount Tag Icon */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0 text-[#E76A54] border border-rose-100">
          <Tag className="w-5 h-5 stroke-[2]" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-xs sm:text-sm text-neutral-900 leading-tight truncate">
            {promoTitle}
          </h4>
          <p 
            onClick={handleCopyCode}
            className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 cursor-pointer hover:text-neutral-800 transition-colors"
            title="Click to copy code"
          >
            {promoSubtitle}: <span className="font-bold text-neutral-900 underline decoration-dotted">{promoCode}</span>
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={handleOrderClick}
        className="bg-[#E76A54] hover:bg-[#d65943] text-white text-[10px] sm:text-xs font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-xs transition-colors shrink-0 cursor-pointer select-none"
      >
        ORDER NOW
      </motion.button>
    </section>
  );
};

