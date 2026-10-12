import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Mail, LogOut, Home, MessageCircle, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RESTAURANT_WHATSAPP } from '../constants';

export const AccountBlocked: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleSupportClick = () => {
    // Open WhatsApp support or email
    const text = encodeURIComponent("Hello Frosty Bite Support, my account access has been restricted. I need assistance regarding account ID: " + (user?.id || user?.uid || 'N/A'));
    const waUrl = `https://wa.me/${RESTAURANT_WHATSAPP}?text=${text}`;
    window.open(waUrl, '_blank');
  };

  const handleSignOut = async () => {
    try {
      await logout(true);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Decorative Warm Particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#E76A54]/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-400/10 rounded-full blur-[100px] animate-pulse-slow" />
      </div>

      {/* Top Header Logo */}
      <header className="w-full max-w-2xl py-6 flex items-center justify-between relative z-10">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-2xl bg-[#E76A54] flex items-center justify-center text-white font-black text-lg italic shadow-md group-hover:scale-105 transition-all">
            FB
          </div>
          <span className="font-black text-xl text-stone-900 tracking-tight italic uppercase">
            Frosty <span className="text-[#E76A54]">Bite</span>
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-white border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-black uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-lg my-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-white/90 backdrop-blur-xl border border-stone-200/80 rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 text-center"
        >
          {/* Visual Icon */}
          <div className="w-20 h-20 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto text-[#E76A54] shadow-sm">
            <ShieldAlert size={40} className="stroke-[1.75]" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Account Access Restricted
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed max-w-md mx-auto">
              Your Frosty Bite account has been temporarily blocked and you cannot access your account at this time.
            </p>
          </div>

          {/* Help Box */}
          <div className="p-4 sm:p-5 bg-[#FAF8F5] border border-stone-200/80 rounded-2xl text-left space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-extrabold text-xs uppercase tracking-wider">
              <HelpCircle size={16} className="text-[#E76A54]" />
              <span>Need help?</span>
            </div>
            <p className="text-xs text-stone-600 font-medium leading-relaxed">
              Please contact Frosty Bite Support if you believe this was a mistake. Our team is available to assist you with account verification.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleSupportClick}
              className="w-full h-14 bg-[#E76A54] hover:bg-[#d55842] text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} />
              <span>Contact Support</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/')}
                className="h-12 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Home size={15} />
                <span>Return to Home</span>
              </button>

              <button
                onClick={handleSignOut}
                className="h-12 border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl font-extrabold uppercase text-[11px] tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl py-4 text-center text-[11px] text-stone-400 font-medium relative z-10">
        &copy; {new Date().getFullYear()} Frosty Bite Bakery • Account Protection & Security
      </footer>
    </div>
  );
};
