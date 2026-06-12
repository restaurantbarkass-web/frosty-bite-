import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('customer' | 'admin')[];
  autoLogout?: boolean;
  requireVerification?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  autoLogout = false,
  requireVerification = false
}) => {
  const { user, loading, isAdmin, isCustomer, isVerified, logout } = useAuth();
  const location = useLocation();

  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && user) {
      if (allowedRoles) {
        const hasAccess = allowedRoles.some(r => {
          if (r === 'admin') return isAdmin;
          if (r === 'customer') return isCustomer;
          return false;
        });

        if (!hasAccess && autoLogout) {
          logout(true).then(() => navigate('/login', { replace: true })).catch(err => console.error("Auto logout error:", err));
        }
      }
      if (requireVerification && !isVerified && !isAdmin) {
         // Optionally force logout or just show block
      }
    }
  }, [user, loading, allowedRoles, isAdmin, isCustomer, isVerified, requireVerification, autoLogout, navigate]);

  if (loading) {
    // ... same loading UI ...
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.1)]"
          />
          <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.4em] animate-pulse">Checking Access</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verification Block
  if (requireVerification && !isVerified && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#050505] text-white">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8 shadow-2xl shadow-primary/20"
        >
          <ShieldAlert size={48} />
        </motion.div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight">Verify Your Email</h1>
        <p className="text-gray-400 mb-10 max-w-md text-lg leading-relaxed">
          For your security, this area requires a verified email address. Please check your inbox for the verification link.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => window.location.reload()}
            className="bg-white/10 hover:bg-white/20 text-white px-10 py-4 rounded-2xl font-bold transition-all border border-white/10"
          >
            I've Verified
          </button>
          <button
            onClick={() => logout()}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-10 py-4 rounded-2xl font-bold transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles) {
    const hasAccess = allowedRoles.some(r => {
      if (r === 'admin') return isAdmin;
      if (r === 'customer') return isCustomer;
      return false;
    });

    if (!hasAccess) {
      if (autoLogout) {
        return null; // Handle via useEffect
      }

      const roleNeeded = allowedRoles.join(' or ');

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#050505] text-white">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-8 shadow-2xl shadow-red-500/20"
          >
            <ShieldAlert size={48} />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Access Denied</h1>
          <p className="text-gray-400 mb-10 max-w-md text-lg leading-relaxed">
            You are not authorized as <span className="text-white font-semibold uppercase">{roleNeeded}</span>. 
            Please contact support if you believe this is an error.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.history.back()}
              className="bg-white/10 hover:bg-white/20 text-white px-10 py-4 rounded-2xl font-bold transition-all border border-white/10"
            >
              Go Back
            </button>
            <button
              onClick={() => logout()}
              className="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/20"
            >
              Logout
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
