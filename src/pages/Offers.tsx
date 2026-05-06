import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Zap, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { Coupon, Banner } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BannerCarousel } from '../components/BannerCarousel';
import { GiftBoxLoader } from '../components/GiftBoxLoader';

const OffersPage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const flashDeal = banners.find(b => b.is_flash_deal);
  const regularBanners = banners.filter(b => !b.is_flash_deal);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bannersRes, couponsRes] = await Promise.all([
          supabase
            .from('banners')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false }),
          supabase
            .from('coupons')
            .select('*')
            .eq('status', 'active')
            .eq('is_hidden', false)
            .order('created_at', { ascending: false })
        ]);

        if (bannersRes.data) setBanners(bannersRes.data);
        if (couponsRes.data) setCoupons(couponsRes.data);
      } catch (error) {
        console.error('Error fetching offers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(() => {
      setFlash((prev) => !prev);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const handleApplyCoupon = (code: string) => {
    localStorage.setItem('claimed_coupon', code);
    toast.success(`Coupon ${code} Claimed! 🎉`, {
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        fontWeight: 'bold',
      },
      icon: '🎁'
    });
    // Navigate to home and scroll to menu
    navigate('/');
    setTimeout(() => {
      document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-black pb-32 overflow-hidden">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      {/* Header */}
      <section className="relative pt-16 sm:pt-24 px-8 pb-12 flex flex-col space-y-4">
        <div className="absolute top-0 right-0 w-[50%] h-[40%] bg-primary/10 blur-[120px] -z-10 rounded-full" />
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-2"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-[1px] bg-primary/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-primary/80">Private Collection</p>
          </div>
          <motion.h1 
            initial={{ opacity: 0, filter: 'blur(20px)', y: 60 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-7xl sm:text-9xl font-black italic uppercase tracking-tighter leading-[0.75] text-white"
          >
            <motion.span 
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 1 }}
              className="block"
            >
              Offers &
            </motion.span>
            <motion.span 
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="text-primary/90 block"
            >
              Deals
            </motion.span>
          </motion.h1>
          <p className="text-[11px] text-white/30 font-medium tracking-[0.2em] max-w-sm mt-6 leading-relaxed">
            A curated selection of high-end rewards and exclusive gastronomic perks for our most valued guests.
          </p>
        </motion.div>
      </section>

      <div className="px-6 space-y-16">
        {/* Flash Deal Section Loading / Content */}
        {loading ? (
          <GiftBoxLoader />
        ) : flashDeal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[4rem] p-[1.5px] text-white shadow-[0_50px_100px_-30px_rgba(255,82,0,0.3)] relative overflow-hidden group cursor-pointer"
            onClick={() => {
              if (flashDeal.redirect_url) navigate(flashDeal.redirect_url);
              if (flashDeal.auto_apply_coupon) handleApplyCoupon(flashDeal.auto_apply_coupon);
            }}
          >
            {/* Animated Border Gradient */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#FF5200_360deg)] opacity-40"
            />
            
            <div className="relative z-10 bg-[#080808] rounded-[3.95rem] p-10 overflow-hidden min-h-[340px] flex flex-col justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/10 blur-[100px] rounded-full" />
              
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="px-5 py-2 bg-rose-600 rounded-full flex items-center gap-2.5 shadow-[0_8px_20px_rgba(225,29,72,0.5)]">
                    <Zap size={12} className="fill-white" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Imperial Deal</span>
                  </div>
                  <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Strictly Limited
                  </div>
                </div>
                <h2 className="text-6xl sm:text-7xl font-black italic uppercase tracking-tighter leading-[0.8] drop-shadow-3xl max-w-2xl">{flashDeal.title}</h2>
                <div className="flex items-center gap-6 mt-6">
                   <button className="h-16 px-10 bg-white text-black rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:scale-95">
                     Claim Access
                   </button>
                   {flashDeal.auto_apply_coupon && (
                     <div className="h-16 flex items-center gap-4 px-8 bg-white/5 rounded-[1.8rem] border border-white/10 backdrop-blur-3xl">
                        <Ticket size={16} className="text-primary" />
                        <span className="text-primary font-black text-xs tracking-[0.3em]">{flashDeal.auto_apply_coupon}</span>
                     </div>
                   )}
                </div>
              </div>
              <Zap size={300} className="absolute -right-24 -bottom-12 text-white/[0.03] rotate-12 blur-sm pointer-events-none" />
            </div>
          </motion.div>
        )}
        {/* Premium Rotational Banner Section */}
        {regularBanners.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 px-2">Featured Promos</h3>
            <BannerCarousel 
              banners={regularBanners} 
              onApplyCoupon={handleApplyCoupon}
              onNavigate={(url) => navigate(url)}
            />
          </div>
        )}

        {/* Premium Coupons Section */}
        <div id="rewards-section" className="space-y-10 py-10">
          <div className="flex items-center gap-4 px-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 whitespace-nowrap">Elite Rewards</h3>
            <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          
          <div className="grid gap-12 px-6">
            {loading ? (
              [1, 2, 3].map(i => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-56 rounded-[4rem] bg-white/[0.02] border border-white/[0.05] relative overflow-hidden group"
                >
                  {/* Shimmer Effect */}
                  <motion.div 
                    animate={{ 
                      x: ['-100%', '200%'],
                    }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -skew-x-12"
                  />
                  
                  <div className="p-10 flex items-center gap-10">
                    <div className="w-28 h-28 rounded-[2.5rem] bg-white/[0.03] border border-white/5 shrink-0" />
                    <div className="flex-1 space-y-4">
                      <div className="h-10 w-48 bg-white/[0.03] rounded-xl" />
                      <div className="h-4 w-32 bg-white/[0.02] rounded-lg" />
                      <div className="flex gap-4">
                        <div className="h-12 w-32 bg-white/[0.03] rounded-2xl" />
                        <div className="h-12 w-40 bg-white/[0.03] rounded-2xl" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : coupons.map((coupon) => (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="group relative overflow-hidden rounded-[4rem] bg-[#0A0A0A] border border-white/[0.08] transition-all duration-700 hover:border-primary/50 hover:shadow-[0_60px_100px_-40px_rgba(255,82,0,0.4)]"
              >
                {/* Backdrop Visual */}
                <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-primary/5 to-transparent flex items-center justify-end pr-8 overflow-hidden pointer-events-none">
                  <span className="text-[18rem] font-black italic text-white/[0.02] transform translate-x-20 rotate-12">{coupon.code.slice(0, 1)}</span>
                </div>

                <div className="relative z-10 p-10 flex flex-col sm:flex-row items-center gap-10">
                  <div className="w-28 h-28 shrink-0 rounded-[2.5rem] bg-gradient-to-br from-white/[0.05] to-transparent flex items-center justify-center border border-white/10 shadow-2xl relative group-hover:scale-110 transition-transform duration-700">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Ticket size={48} className="text-primary drop-shadow-[0_0_15px_rgba(255,82,0,0.5)]" />
                  </div>

                  <div className="flex-1 space-y-6 text-center sm:text-left">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                        <h4 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                          {coupon.type === 'percentage' ? `${coupon.value}% OFF` : 
                           coupon.type === 'fixed' ? `₹${coupon.value} OFF` :
                           'Privilege'}
                        </h4>
                        {coupon.is_first_order_only && (
                          <span className="px-4 py-1.5 bg-primary/20 text-primary text-[8px] font-black rounded-xl uppercase tracking-[0.2em] border border-primary/20 shadow-xl">Prestige Only</span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/20 font-black uppercase tracking-[0.4em]">Minimum Order: ₹{coupon.min_order}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                      <div className="h-14 px-8 bg-black/80 rounded-2xl border border-white/10 flex items-center gap-4 shadow-inner">
                        <span className="text-base font-black text-white uppercase tracking-[0.5em]">{coupon.code}</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleApplyCoupon(coupon.code)}
                        className="h-14 px-10 bg-white text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-primary hover:text-white transition-all"
                      >
                        Claim Reward
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffersPage;
