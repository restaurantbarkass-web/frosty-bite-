import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Banner } from '../types';
import { useAuth } from '../context/AuthContext';
import { ExternalLink, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const BannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = async (banner: Banner) => {
    try {
      // Track click asynchronously
      supabase
        .from('banner_clicks')
        .insert([{ 
          banner_id: banner.id, 
          user_id: user?.uid 
        }])
        .then(({ error }) => {
          if (error) console.error('Error tracking click:', error);
        });

      if (banner.auto_apply_coupon) {
        localStorage.setItem('claimed_coupon', banner.auto_apply_coupon);
        toast.success(`Deal Claimed: ${banner.auto_apply_coupon}! 🎉`, {
          style: {
            borderRadius: '16px',
            background: '#18181b',
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            fontWeight: 'bold',
          }
        });
      }

      if (banner.redirect_url) {
        if (banner.redirect_url.startsWith('http')) {
          window.open(banner.redirect_url, '_blank');
        } else {
          window.location.href = banner.redirect_url;
        }
      }
    } catch (error) {
      console.error('Banner click handling error:', error);
    }
  };

  if (loading) return (
    <div className="px-4 py-2">
      <div className="w-full h-40 bg-zinc-800 rounded-3xl animate-pulse" />
    </div>
  );
  
  if (banners.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden py-4">
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 no-scrollbar pb-2">
        {banners.map((banner) => (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleBannerClick(banner)}
            className="flex-shrink-0 w-[85%] sm:w-[500px] aspect-[21/9] rounded-3xl overflow-hidden relative group cursor-pointer snap-center shadow-xl shadow-black/20"
          >
            <img
              src={banner.image_url}
              alt={banner.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
              <h3 className="text-white font-black uppercase tracking-widest text-lg mb-1 drop-shadow-lg">{banner.title}</h3>
              {banner.redirect_url && (
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em]">
                  View Details <ExternalLink size={12} />
                </div>
              )}
              {banner.gift_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(banner.gift_url, '_blank');
                  }}
                  className="mt-3 w-max flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95 shadow-xl"
                >
                  <Sparkles size={12} />
                  View Gift Info
                </button>
              )}
            </div>
            
            <div className="absolute top-4 left-4 sm:hidden">
               <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[8px] font-black uppercase text-white tracking-widest border border-white/10">
                 Featured
               </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
