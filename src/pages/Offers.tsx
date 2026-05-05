import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Zap, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { Coupon, Banner } from '../types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BannerCarousel } from '../components/BannerCarousel';

const OffersPage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(true);
  const navigate = useNavigate();

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
      <div className="pt-8 sm:pt-12 px-6 pb-6 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10 rounded-full" />
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-primary border border-white/10 shadow-2xl backdrop-blur-xl">
              <Gift size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Offers & deals</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/30">Premium curated perks</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live Now</span>
             </div>
          </div>
        </motion.div>
      </div>

      <div className="px-6 space-y-12">
        {/* Flash Deal Section */}
        {flashDeal && (
          <motion.div
            animate={{ 
              scale: flash ? 1.01 : 1,
            }}
            className="rounded-[3.5rem] p-[1.5px] text-white shadow-2xl relative overflow-hidden group cursor-pointer transition-all duration-700"
            onClick={() => {
              if (flashDeal.redirect_url) navigate(flashDeal.redirect_url);
              if (flashDeal.auto_apply_coupon) handleApplyCoupon(flashDeal.auto_apply_coupon);
            }}
          >
            {/* Animated Border Gradient */}
            <motion.div 
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#FF5200_360deg)] opacity-60"
            />
            
            <div className="relative z-10 bg-[#0A0A0A] rounded-[3.4rem] p-8 overflow-hidden h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-transparent opacity-60" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full" />
              
              <div className="relative z-10 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="px-4 py-1.5 bg-rose-600 rounded-full flex items-center gap-2 shadow-[0_4px_15px_rgba(225,29,72,0.4)]">
                    <Zap size={14} className="fill-white" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Flash Deal</span>
                  </div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                    Ending soon
                  </div>
                </div>
                <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-[0.85] line-clamp-2 max-w-[90%] drop-shadow-2xl">{flashDeal.title}</h2>
                <div className="flex items-center gap-5 mt-3">
                   <button className="px-8 py-3.5 bg-white text-black rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:scale-95">
                     Claim Now
                   </button>
                   {flashDeal.auto_apply_coupon && (
                     <div className="text-primary font-black text-[10px] tracking-[0.2em] bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 backdrop-blur-md">
                       {flashDeal.auto_apply_coupon}
                     </div>
                   )}
                </div>
              </div>
              <Zap size={220} className="absolute -right-16 -bottom-16 text-white/5 rotate-12 blur-sm pointer-events-none" />
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
        <div className="space-y-8">
          <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 px-2">Elite Rewards</h3>
          <div className="grid gap-8">
            {loading ? (
              [1, 2].map(i => (
                <div key={i} className="h-44 rounded-[3.5rem] bg-white/[0.02] border border-white/5 animate-pulse" />
              ))
            ) : coupons.map((coupon) => (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 rounded-[3.5rem] p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 group hover:border-primary/40 transition-all duration-500 hover:shadow-[0_40px_80px_-30px_rgba(255,82,0,0.25)] relative overflow-hidden"
              >
                {/* Visual Identity Watermark */}
                <div className="absolute -right-8 -bottom-8 text-white/[0.01] text-[10rem] font-black italic pointer-events-none uppercase select-none">
                   {coupon.code.slice(0, 3)}
                </div>

                <div className="flex gap-8 items-center flex-1 relative z-10">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-[#0A0A0A] flex items-center justify-center border border-white/10 text-primary shadow-[0_20px_40px_rgba(0,0,0,0.5)] transform group-hover:rotate-6 transition-transform">
                    <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                    <Ticket size={40} className="relative z-10" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <h4 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-lg">
                        {coupon.type === 'percentage' ? `${coupon.value}% OFF` : 
                         coupon.type === 'fixed' ? `₹${coupon.value} OFF` :
                         'Secret Gift'}
                      </h4>
                      {coupon.is_first_order_only && (
                        <div className="bg-primary/20 text-primary text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-primary/20 shadow-lg">New Client</div>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.3em] mt-3 block">Threshold: ₹{coupon.min_order}</p>
                    
                    <div className="flex items-center gap-4 mt-6">
                       <div className="px-6 py-3 bg-black/60 rounded-2xl border border-white/10 flex items-center gap-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] backdrop-blur-md">
                         <span className="text-[14px] font-black text-white uppercase tracking-[0.4em]">{coupon.code}</span>
                       </div>
                       {coupon.gift_url && (
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             window.open(coupon.gift_url, '_blank');
                           }}
                           className="flex items-center gap-2 px-5 py-3 bg-white/5 rounded-2xl text-[10px] font-black text-white/40 uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-white/5 shadow-xl"
                         >
                           <Sparkles size={14} /> Gift Vault
                         </button>
                       )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleApplyCoupon(coupon.code)}
                  className="w-full sm:w-20 h-20 rounded-[2.5rem] bg-white text-black flex items-center justify-center hover:bg-primary hover:text-white transition-all transform group-hover:scale-110 active:scale-90 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative z-10"
                >
                  <ArrowRight size={32} className="hidden sm:block" />
                  <span className="sm:hidden text-xs font-black uppercase tracking-[0.4em] italic">Redeem Now</span>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffersPage;
