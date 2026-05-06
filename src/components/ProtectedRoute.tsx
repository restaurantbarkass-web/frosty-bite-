import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';
import { logout } from '../firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('customer' | 'admin' | 'rider')[];
  autoLogout?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  autoLogout = false 
}) => {
  const { user, loading, isAdmin, isRider, isCustomer } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full shadow-lg shadow-orange-500/20"
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    const hasAccess = allowedRoles.some(r => {
      if (r === 'admin') return isAdmin;
      if (r === 'rider') return isRider;
      if (r === 'customer') return isCustomer;
      return false;
    });

    if (!hasAccess) {
      if (autoLogout) {
        logout();
        return <Navigate to="/login" replace />;
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
