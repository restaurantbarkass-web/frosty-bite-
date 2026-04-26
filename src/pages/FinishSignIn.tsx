import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

export const FinishSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleFinishSignIn = async () => {
      console.log('Checking for sign-in link in URL:', window.location.href);
      try {
        const isLink = await authService.isSignInLink(window.location.href);
        console.log('Is sign-in link?', isLink);
        
        if (isLink) {
          let email = window.localStorage.getItem('emailForSignIn');
          console.log('Retrieved email from localStorage:', email);
          
          if (!email) {
            console.log('Email missing from localStorage, prompting user.');
            email = window.prompt('Please provide your email for confirmation');
          }

          if (email) {
            console.log('Attempting sign-in with email:', email);
            await authService.handleSignInWithLink(email, window.location.href);
            console.log('Sign-in successful!');
            setStatus('success');
            setTimeout(() => {
              navigate('/');
            }, 2000);
          } else {
            console.warn('Sign-in aborted: Email not provided.');
            setError('Email is required to complete sign-in. Please try again.');
            setStatus('error');
          }
        } else {
          console.log('Not a sign-in link, redirecting to login.');
          navigate('/login');
        }
      } catch (err: any) {
        console.error('Sign-in error:', err);
        let errorMsg = err.message || 'Failed to complete sign-in.';
        
        if (err.code === 'auth/invalid-action-code') {
          errorMsg = 'This sign-in link has already been used or has expired.';
        } else if (err.code === 'auth/user-disabled') {
           errorMsg = 'This account has been disabled.';
        }

        setError(errorMsg);
        setStatus('error');
      }
    };

    handleFinishSignIn();
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
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Verifying Link</h2>
              <p className="text-gray-400 text-sm font-medium">Completing your sign-in process...</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
              <CheckCircle2 className="text-green-400" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Welcome Back!</h2>
              <p className="text-gray-400 text-sm font-medium">Successfully signed in. Redirecting you home...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
              <AlertCircle className="text-red-400" size={32} />
            </div>
            <div className="w-full">
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
      </motion.div>
    </div>
  );
};
