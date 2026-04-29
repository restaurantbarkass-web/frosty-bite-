import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

export const FinishSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const [emailForConfirm, setEmailForConfirm] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    const handleFinishSignIn = async () => {
      console.log('Checking for sign-in link. Current URL:', window.location.href);
      try {
        const isLink = await authService.isSignInLink(window.location.href);
        
        if (isLink) {
          let email = window.localStorage.getItem('emailForSignIn');
          
          if (!email) {
            console.log('Email not found in localStorage. Showing input.');
            setShowEmailInput(true);
            setStatus('error');
            setError('Please confirm your email address to complete the sign-in.');
            return;
          }

          if (email) {
            const result = await authService.handleSignInWithLink(email, window.location.href);
            console.log('Sign-in successful!', result.user.email);
            
            setStatus('success');
            
            // Wait for a brief moment to ensure AuthContext picks up the change
            // and show the success message to the user
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 2500);
          }
        } else {
          console.log('URL is not a valid sign-in link.');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Sign-in Error:', err);
        let errorMsg = err.message || 'Failed to complete sign-in.';
        
        if (err.code === 'auth/invalid-action-code') {
          errorMsg = 'This sign-in link has already been used or has expired.';
        } else if (err.code === 'auth/user-disabled') {
           errorMsg = 'This account has been disabled.';
        } else if (err.code === 'auth/expired-action-code') {
          errorMsg = 'The link has expired. Please request a new one.';
        }

        setError(errorMsg);
        setStatus('error');
      }
    };

    handleFinishSignIn();
  }, [navigate]);

  const handleManualEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForConfirm) return;

    setStatus('loading');
    setError(null);
    try {
      await authService.handleSignInWithLink(emailForConfirm, window.location.href);
      setStatus('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed.');
      setStatus('error');
    }
  };

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
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Verifying Link</h2>
              <p className="text-gray-400 text-sm font-medium">Completing your sign-in process...</p>
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

        {status === 'error' && (
          <div className="flex flex-col items-center gap-6">
            {showEmailInput ? (
              <div className="w-full space-y-6">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mx-auto">
                  <CheckCircle2 className="text-blue-400" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Confirm Email</h2>
                  <p className="text-gray-400 text-sm font-medium mb-6">
                    You opened this link in a new browser or device. Please enter your email to confirm.
                  </p>
                  <form onSubmit={handleManualEmailSubmit} className="space-y-4">
                    <input 
                      type="email" 
                      value={emailForConfirm}
                      onChange={(e) => setEmailForConfirm(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-all"
                      required
                    />
                    <button 
                      type="submit"
                      className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-xl shadow-orange-500/20"
                    >
                      Complete Sign-in
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mx-auto mb-6">
                  <AlertCircle className="text-red-400" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Sign-in Failed</h2>
                  <p className="text-red-400/80 text-sm font-medium mb-8 leading-relaxed max-w-xs mx-auto">
                    {error}
                  </p>
                  <button 
                    onClick={() => navigate('/login')}
                    className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FinishSignIn;
