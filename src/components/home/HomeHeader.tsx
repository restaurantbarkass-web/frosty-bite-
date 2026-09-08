import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronDown, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { useGeofence } from '../../context/GeofenceContext';
import { useNotifications } from '../../context/NotificationContext';
import toast from 'react-hot-toast';

export const HomeHeader: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { detectedCity, detectedState, recheckLocation, isCheckingPosition } = useGeofence();
  const { unreadCount } = useNotifications();
  const [isLocChecking, setIsLocChecking] = useState(false);

  const displayCity = detectedCity || 'Cuttack';
  const displayState = detectedState || 'Odisha';

  const handleLocationClick = async () => {
    try {
      setIsLocChecking(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
      if (recheckLocation) {
        toast.loading('Checking delivery zone in ' + displayCity + '...', { id: 'loc-check', duration: 1500 });
        await recheckLocation();
      } else {
        toast.success(`Delivering fresh treats to ${displayCity}, ${displayState}`, { id: 'loc-check' });
      }
    } catch {
      toast.success(`Delivering fresh treats to ${displayCity}, ${displayState}`, { id: 'loc-check' });
    } finally {
      setIsLocChecking(false);
    }
  };

  const handleNotificationClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    navigate('/notifications');
  };

  return (
    <header 
      className="sticky top-0 bg-white z-40 px-4 pt-3 pb-2.5 transition-all border-b border-stone-200/90 shadow-2xs"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1">
        {/* Deliver To (Left) */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="text-[#E76A54] shrink-0">
            <MapPin size={16} className={isCheckingPosition || isLocChecking ? 'animate-bounce text-[#E76A54]' : 'text-[#E76A54]'} fill="currentColor" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-stone-500 font-bold uppercase tracking-wider leading-none">GPS City</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <button 
              type="button"
              onClick={handleLocationClick}
              className="flex items-center gap-0.5 mt-0.5 text-left focus:outline-none cursor-pointer group"
              aria-label="Change delivery location"
            >
              <span className="text-xs font-bold text-stone-900 leading-tight truncate max-w-[110px] sm:max-w-[180px]">
                {displayCity}{displayState ? `, ${displayState}` : ''}
              </span>
              <ChevronDown size={12} className="text-stone-600 stroke-[2.5] shrink-0 transition-transform group-hover:translate-y-0.5" />
            </button>
          </div>
        </div>

        {/* Center: Frosty Bite Branding */}
        <div 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center justify-center shrink-0 px-2 text-center cursor-pointer select-none group"
        >
          <div className="flex items-center justify-center mb-0.5 text-[#E5A970] transition-transform duration-300 group-hover:scale-110">
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="currentColor"
              className="drop-shadow-xs"
              aria-hidden="true"
            >
              <path d="M12 2a1.5 1.5 0 0 1 1.5 1.5c0 .3-.09.58-.24.81.96.44 1.74 1.25 2.14 2.26.85.24 1.6.76 2.1 1.43H6.5c.5-.67 1.25-1.19 2.1-1.43.4-1.01 1.18-1.82 2.14-2.26A1.5 1.5 0 0 1 12 2m-7 8h14v2c0 1.1-.9 2-2 2h-1c-.55 0-1-.45-1-1s-.45-1-1-1-.95.45-.95 1-.45 1-1 1-1-.45-1-1-.45-1-1-1-.95.45-.95 1-.45 1-1 1-1-.45-1-1-.45-1-1-1-.95.45-.95 1H6c-1.1 0-2-.9-2-2v-2m-1 6h16v4c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-4z"/>
            </svg>
          </div>
          <span className="font-serif text-[17px] sm:text-[20px] font-bold tracking-tight text-stone-900 leading-none">
            Frosty Bite
          </span>
          <span className="text-[7px] sm:text-[8px] uppercase tracking-[0.24em] text-stone-500 font-bold mt-0.5">
            PURE BITES, PURE JOY
          </span>
        </div>

        {/* Right: Notification Bell Button */}
        <div className="flex justify-end items-center flex-1">
          <motion.button
            type="button"
            onClick={handleNotificationClick}
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.05 }}
            className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 shadow-2xs active:scale-95 transition-all cursor-pointer focus:outline-none"
            aria-label="Notifications"
          >
            <Bell size={17} className="stroke-[1.8]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 ring-1 ring-white" />
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  );
});

HomeHeader.displayName = 'HomeHeader';
