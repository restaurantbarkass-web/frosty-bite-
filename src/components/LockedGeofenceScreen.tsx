import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, MapPin, Globe, ArrowRight, ShieldAlert, Navigation, Clock, Bell, CheckCircle2 } from 'lucide-react';
import { useGeofence } from '../context/GeofenceContext';
import { Logo } from './Logo';
import toast from 'react-hot-toast';

const FLOATING_PASTRIES = [
  { emoji: '🍰', left: '12%', top: '18%', delay: 0 },
  { emoji: '🎂', left: '82%', top: '24%', delay: 1.5 },
  { emoji: '🧁', left: '15%', top: '78%', delay: 3 },
  { emoji: '🍩', left: '86%', top: '74%', delay: 0.5 },
  { emoji: '🍪', left: '76%', top: '58%', delay: 2 },
  { emoji: '🥐', left: '20%', top: '45%', delay: 4 },
];

export const LockedGeofenceScreen: React.FC = () => {
  const { submitNotifyRequest } = useGeofence();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone) {
      toast.error('Please enter your email or phone number');
      return;
    }
    setIsSubmitting(true);
    try {
      if (submitNotifyRequest) {
        await submitNotifyRequest(email, phone, 'Coming Soon Notice');
      }
      setIsSubmitted(true);
      toast.success("You're on the priority list! We'll notify you when geofencing launches.");
    } catch (err) {
      toast.error('Failed to submit notification request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="locked-geofence-screen" className="min-h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col items-center justify-center p-6 selection:bg-primary selection:text-white">
      {/* Background Glows & Ambient Gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-primary/20 via-orange-500/15 to-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Pastry Emojis */}
      {FLOATING_PASTRIES.map((item, index) => (
        <motion.div
          key={index}
          className="absolute text-3xl md:text-5xl select-none opacity-25 pointer-events-none filter drop-shadow-[0_0_15px_rgba(255,165,0,0.3)]"
          style={{ left: item.left, top: item.top }}
          animate={{
            y: [-15, 15, -15],
            rotate: [-10, 10, -10],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 6 + index,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: item.delay,
          }}
        >
          {item.emoji}
        </motion.div>
      ))}

      {/* Main Card Container */}
      <motion.div 
        initial={{ opacity: 0, y: 25, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 text-center space-y-8"
      >
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-primary/30 border border-white/20">
            <Sparkles size={32} className="text-white animate-pulse" />
          </div>
          <Logo size="lg" />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 via-primary/20 to-amber-500/20 text-orange-400 text-xs font-black uppercase tracking-widest border border-orange-500/35 shadow-inner">
            <Clock size={12} className="animate-spin" />
            <span>Service Geofence • Coming Soon</span>
          </div>
        </div>

        {/* Heading & Description */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
            Next-Gen GPS Geofencing <br />
            <span className="bg-gradient-to-r from-orange-400 via-primary to-amber-300 bg-clip-text text-transparent">
              Is Under Construction 🚀
            </span>
          </h1>
          <p className="text-sm md:text-base text-zinc-300 leading-relaxed max-w-md mx-auto">
            We are upgrading our multi-zone delivery radius engine and precise coordinate polygon mapping to bring you an even faster, more delightful patisserie experience.
          </p>
        </div>

        {/* Status Callout Box */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 text-left flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5 border border-primary/30">
            <Globe size={18} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Global Access Currently Active</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              While our geofencing service is temporarily deactivated for maintenance, all customer orders and deliveries are fully operational worldwide without location restrictions.
            </p>
          </div>
        </div>

        {/* Notify Form */}
        {!isSubmitted ? (
          <form onSubmit={handleNotifySubmit} className="space-y-4 pt-2">
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Get Notified When Live
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-all shadow-inner"
                />
                <input
                  type="tel"
                  placeholder="Enter your phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-all shadow-inner"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-primary/30 hover:opacity-95 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Subscribing...' : 'Notify Me at Launch'}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        ) : (
          <div className="bg-primary/15 border border-primary/30 rounded-2xl p-6 text-center space-y-2">
            <CheckCircle2 size={32} className="text-primary mx-auto animate-bounce" />
            <h3 className="text-base font-extrabold text-white">You're on the VIP list!</h3>
            <p className="text-xs text-zinc-300">We'll notify you the moment our advanced geofencing engine goes live.</p>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
          <span>Frosty Bite Patisserie</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Services Online
          </span>
        </div>
      </motion.div>
    </div>
  );
};
