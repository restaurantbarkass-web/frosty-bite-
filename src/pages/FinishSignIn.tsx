import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';

export const FinishSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success'>('loading');

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        // Let Supabase handle any redirect hash parsing automatically
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          localStorage.setItem('frostybite_active_session_email', data.session.user.email || '');
          localStorage.setItem('frostybite_has_active_session', 'true');
        }
      } catch (err) {
        console.warn('[FinishSignIn] Parsing session error:', err);
      }
      
      setStatus('success');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    };

    completeSignIn();
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl"
      >
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <Loader2 className="text-orange-500 animate-spin" size={64} />
              <div className="absolute inset-0 blur-xl bg-orange-500/20 rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Verifying Session</h2>
              <p className="text-gray-400 text-sm font-medium">Completing your secure sign-in process...</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-6">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/20"
            >
              <CheckCircle2 className="text-white" size={40} />
            </motion.div>
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Welcome Back!</h2>
              <p className="text-gray-400 text-sm font-medium">Successfully signed in. Redirecting you home...</p>
              <div className="mt-8 flex justify-center">
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full bg-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FinishSignIn;
