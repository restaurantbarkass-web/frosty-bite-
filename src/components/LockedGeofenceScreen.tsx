import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Globe, ArrowRight, ShieldAlert, Sparkles, Navigation, Lock, Phone, Mail, Map, Check } from 'lucide-react';
import { useGeofence } from '../context/GeofenceContext';
import { Logo } from './Logo';
import toast from 'react-hot-toast';

const FLOATING_ITEMS = [
  { emoji: '🍰', left: '10%', top: '15%', delay: 0 },
  { emoji: '🎂', left: '80%', top: '22%', delay: 1.5 },
  { emoji: '🧁', left: '12%', top: '75%', delay: 3 },
  { emoji: '🍩', left: '88%', top: '78%', delay: 0.5 },
  { emoji: '🍪', left: '78%', top: '60%', delay: 2 },
  { emoji: '🥐', left: '18%', top: '42%', delay: 4 },
];

export const LockedGeofenceScreen: React.FC = () => {
  const {
    errorMessage,
    permissionState,
    isMockLocationDetected,
    recheckLocation,
    submitNotifyRequest,
    allowedZonesList,
    selectManualCity,
    detectedCity,
    detectedState,
    detectedPincode,
    detectedAddress,
    isPincodeAllowed,
    manualUnlockWithPincode,
    clearLockedState
  } = useGeofence();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showNotifyForm, setShowNotifyForm] = useState(false);

  const [manualPin, setManualPin] = useState('');
  const [isCheckingPin, setIsCheckingPin] = useState(false);

  const handleVerifyManualPin = async () => {
    if (manualPin.trim().length !== 6) {
      toast.error('Pincode must be exactly 6 digits.');
      return;
    }
    setIsCheckingPin(true);
    try {
      const isOk = await manualUnlockWithPincode(manualPin);
      if (isOk) {
        toast.success(`Hurray! Pincode ${manualPin} is active. Welcome to Frosty Bite! 🍰`);
      } else {
        toast.error(`Sorry, we are not delivering to ${manualPin} yet.`);
      }
    } catch (e) {
      toast.error('An error occurred during pincode coverage validation.');
    } finally {
      setIsCheckingPin(false);
    }
  };

  // High-fidelity background images & descriptions for visual city cards
  const cityMeta: Record<string, { desc: string; img: string; nickname: string }> = {
    cuttack: {
      nickname: 'Silver City',
      desc: 'Artisan cakes, pastries and premium celebration treats delivered warm.',
      img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400'
    },
    bhubaneswar: {
      nickname: 'Temple City',
      desc: 'Rapid delivery of custom layered bakes, desserts and artisan donuts.',
      img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=400'
    },
    puri: {
      nickname: 'Holy Seaside',
      desc: 'Our future seaside kitchen expansion. Register for early launch invites!',
      img: 'https://images.unsplash.com/photo-1517433456452-f9633a875f6f?auto=format&fit=crop&q=80&w=400'
    }
  };

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please specify a valid email address.');
      return;
    }
    if (phone && phone.replace(/\D/g, '').length < 10) {
      toast.error('Please specify a valid 10-digit phone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await submitNotifyRequest(email, phone, city);
      if (ok) {
        setIsSubmitted(true);
        toast.success("We've registered your interest! You'll be first to know when we launch! 🍰");
      } else {
        toast.error('Could not log subscription. Please try again.');
      }
    } catch {
      toast.error('An unexpected error occurred during subscription registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combine fetched allowedZonesList with dynamic fallbacks to ensure the picker always displays options
  const displayZones = allowedZonesList.length > 0 
    ? allowedZonesList 
    : [
        { id: 'zone_cuttack', name: 'Cuttack', latitude: 20.4625, longitude: 85.8828, radius: 12, enabled: true },
        { id: 'zone_bhubaneswar', name: 'Bhubaneswar', latitude: 20.2961, longitude: 85.8245, radius: 15, enabled: true }
      ];

  // Safeguard against duplicate rendering keys by using normalized lowercase name as key
  const allCardZonesMap: Record<string, any> = {};
  displayZones.forEach(z => {
    const key = z.name.toLowerCase().trim();
    allCardZonesMap[key] = {
      ...z,
      id: 'zone_' + key,
      comingSoon: false
    };
  });

  // Ensure 'puri' exists precisely once and is appropriately styled as Coming Soon
  if (!allCardZonesMap['puri']) {
    allCardZonesMap['puri'] = {
      id: 'zone_puri',
      name: 'Puri',
      latitude: 19.8134,
      longitude: 85.8312,
      radius: 10,
      enabled: false,
      comingSoon: true
    };
  } else {
    const existingPuri = allCardZonesMap['puri'];
    if (!existingPuri.enabled) {
      allCardZonesMap['puri'] = {
        ...existingPuri,
        id: 'zone_puri',
        comingSoon: true
      };
    }
  }

  const allCardZones = Object.values(allCardZonesMap);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-start bg-[#0F0F12] text-white overflow-y-auto p-4 md:p-8 select-none">
      
      {/* Immersive Atmospheric Radial Gradients (Pink Glow) */}
      <div className="absolute inset-0 pointer-events-none sticky top-0 h-screen">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.25, 0.4, 0.25],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF4D6D]/20 via-transparent to-transparent blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 0.9, 1.1],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-32 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-[#FFD6A5]/15 via-transparent to-transparent blur-[140px]"
        />
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Floating Sweet Bakery Assets */}
      {FLOATING_ITEMS.map((item, idx) => (
        <motion.div
          key={idx}
          className="absolute text-3xl select-none pointer-events-none filter drop-shadow-[0_12px_24px_rgba(255,77,109,0.2)]"
          style={{ left: item.left, top: item.top }}
          animate={{
            y: [0, -18, 0],
            rotate: [0, 12, -12, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            delay: item.delay,
            ease: "easeInOut"
          }}
        >
          {item.emoji}
        </motion.div>
      ))}

      <div className="max-w-xl w-full relative z-10 flex flex-col items-center space-y-6 my-auto py-8">
        {/* Animated Brand Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center space-y-3"
        >
          <div className="scale-110">
            <Logo />
          </div>
          <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-[#FF4D6D] to-transparent" />
          <p className="text-[11px] font-black uppercase tracking-[0.6em] text-[#FF4D6D] whitespace-nowrap">
            PRESERVED BAKEHOUSE
          </p>
        </motion.div>

        {/* Lock Screen Frame Container */}
        <div className="w-full space-y-5 text-center">
          <div className="space-y-2 px-4">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Choose your city to explore 🎂
            </h1>
            <p className="text-[#B0B0B0] text-xs leading-relaxed max-w-md mx-auto">
              Select one of our active delivery cities below to view custom menus, check pastry inventory and arrange instant delivery or pre-orders!
            </p>
          </div>

          {/* Interactive Custom City Selection Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
            {allCardZones.map((zone) => {
              const metaKey = zone.name.toLowerCase();
              const meta = cityMeta[metaKey] || {
                nickname: 'Active Frontier',
                desc: 'Artisan bakehouse kitchen operating with dedicated local delivery riders.',
                img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400'
              };

              return (
                <motion.div
                  key={zone.id}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (zone.comingSoon) {
                      setCity(zone.name);
                      setShowNotifyForm(true);
                      toast.success(`We are coming to ${zone.name} soon! Let's get you registered.`);
                      // Scroll to notification form
                      setTimeout(() => {
                        document.getElementById('notification-section')?.scrollIntoView({ behavior: 'smooth' });
                      }, 150);
                    } else {
                      const ok = selectManualCity(zone.id);
                      if (ok) {
                        toast.success(`Welcome to Frosty Bite ${zone.name}! 🍰`);
                      }
                    }
                  }}
                  className={`relative group rounded-[30px] overflow-hidden border border-white/10 p-5 flex flex-col justify-between text-left h-52 cursor-pointer shadow-lg transition-all bg-gradient-to-b from-[#1C1C24]/90 to-[#121218]/95 ${
                    zone.comingSoon ? 'opacity-85 border-dashed border-white/10 hover:border-[#FFD6A5]/40' : 'hover:border-[#FF4D6D]/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  {/* Visual Background image overlay */}
                  <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity">
                    <img
                      src={meta.img}
                      alt={zone.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover filter brightness-75 scale-105 group-hover:scale-100 transition-transform duration-700"
                    />
                  </div>
                  {/* Subtle vignette gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 z-0 pointer-events-none" />

                  {/* Top content row (Status badges) */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#FFD6A5]/80 tracking-wider uppercase bg-[#FFD6A5]/10 px-2.5 py-1 rounded-full border border-[#FFD6A5]/25">
                      {meta.nickname}
                    </span>
                    {zone.comingSoon ? (
                      <span className="text-[9px] font-black tracking-widest uppercase bg-[#FFD6A5] text-black px-2.5 py-1 rounded-full animate-bounce">
                        Coming Soon
                      </span>
                    ) : (
                      <span className="text-[9px] font-black tracking-widest uppercase bg-[#4ADE80] text-black px-2.5 py-1 rounded-full">
                        Kitchen Active
                      </span>
                    )}
                  </div>

                  {/* Bottom content row (Title & Description) */}
                  <div className="relative z-10 space-y-1.5 mt-auto">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white group-hover:text-[#FF4D6D] transition-colors flex items-center gap-1.5">
                        {zone.name}
                        <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                      </h3>
                      {!zone.comingSoon && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                      )}
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                      {meta.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Alternative Trigger: Detect position manually via raw GPS */}
          <div className="px-2 pt-2 space-y-4 max-w-md mx-auto w-full">
            {detectedCity && (
              <div className="bg-[#1C1C24]/80 border border-white/10 rounded-[24px] p-5 text-left space-y-2 relative overflow-hidden shadow-xl w-full">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF4D6D]/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center gap-2 text-[#FFD6A5] font-black text-[10px] uppercase tracking-wider">
                  <MapPin size={13} className="text-[#FF4D6D]" />
                  User Location Detected
                </div>
                <div className="text-white text-base font-black leading-tight">
                  {detectedCity}{detectedState ? `, ${detectedState}` : ''}
                </div>
                <div className="text-zinc-300 text-xs font-semibold">
                  Detected Pincode: <span className="text-[#FF4D6D] font-extrabold font-mono tracking-wider">{detectedPincode || 'Not found'}</span>
                </div>
                {detectedAddress && (
                  <p className="text-zinc-500 text-[10px] leading-relaxed line-clamp-2 pt-1 border-t border-white/5">
                    {detectedAddress}
                  </p>
                )}
                {isPincodeAllowed === false ? (
                  <div className="text-[#FF4D6D] font-bold text-[10px] uppercase tracking-wider pt-2 flex items-center gap-1.5 animate-pulse">
                    <ShieldAlert size={12} className="shrink-0" />
                    We are not delivering here yet.
                  </div>
                ) : isPincodeAllowed === true ? (
                  <div className="text-[#4ADE80] font-bold text-[10px] uppercase tracking-wider pt-2 flex items-center gap-1.5">
                    <Check size={12} className="shrink-0" />
                    Service is active! Under lock screen override.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={clearLockedState}
                  className="mt-3 w-full h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-98 text-xs font-bold uppercase tracking-widest text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-1 z-10 relative cursor-pointer"
                >
                  Change Address / Reset Location
                </button>
              </div>
            )}

            <div className="bg-[#1C1C24]/90 border border-white/10 p-5 rounded-[24px] space-y-3 text-left shadow-lg w-full">
              <h3 className="font-extrabold text-[#FFD6A5] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={12} /> ENTER PINCODE MANUALLY
              </h3>
              <p className="text-[10px] text-[#B0B0B0] leading-relaxed">
                Check delivery coverage or override lock system by entering your 6-digit delivery pincode below.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={manualPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setManualPin(val);
                  }}
                  placeholder="e.g. 753001"
                  className="flex-1 h-10 px-4 rounded-xl bg-[#0F0F12] border border-white/5 text-white placeholder-zinc-650 text-xs uppercase tracking-widest focus:outline-none focus:border-[#FF4D6D] transition-all font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleVerifyManualPin}
                  disabled={manualPin.trim().length !== 6 || isCheckingPin}
                  className="h-10 px-5 rounded-xl bg-[#FF4D6D] hover:bg-[#FF4D6D]/90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-sm whitespace-nowrap"
                >
                  {isCheckingPin ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Check</span>
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={recheckLocation}
              className="mx-auto flex text-[11px] font-bold text-zinc-400 hover:text-[#FF4D6D] transition-colors py-2.5 px-5 rounded-full bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 active:scale-98 cursor-pointer items-center justify-center gap-2"
            >
              <Navigation size={12} className="text-[#FF4D6D] animate-pulse" />
              Use My Current GPS Location Instead
            </button>
          </div>

          {/* Quick notification accordion */}
          <div id="notification-section" className="pt-4 max-w-md mx-auto w-full px-2">
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowNotifyForm(!showNotifyForm)}
                className="text-[11px] text-[#FFD6A5] font-extrabold tracking-wider uppercase hover:underline flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <Sparkles size={12} className="#FFD6A5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Don't see your city? Get launch alerts!</span>
                <span>{showNotifyForm ? '▲' : '▼'}</span>
              </button>
            </div>

            <AnimatePresence>
              {showNotifyForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  {!isSubmitted ? (
                    <form
                      onSubmit={handleNotifyMe}
                      className="bg-[#1C1C24]/90 border border-white/10 p-5 rounded-[24px] space-y-3.5 text-left text-xs"
                    >
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-[#FFD6A5] text-[11px] uppercase tracking-wider">
                          Let us bake in your neighborhood 🍰
                        </h4>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          Enter your details and location. We track guest interest and target future kitchen coverages directly based on registered request heatmaps!
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="relative flex items-center">
                          <Mail size={13} className="absolute left-3 text-zinc-500" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email address *"
                            className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#0F0F12] border border-white/5 text-white placeholder-zinc-550 text-xs focus:outline-none focus:border-[#FF4D6D] transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative flex items-center">
                            <Phone size={13} className="absolute left-3 text-zinc-500" />
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="Phone No"
                              className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#0F0F12] border border-white/5 text-white placeholder-zinc-550 text-xs focus:outline-none focus:border-[#FF4D6D] transition-all"
                            />
                          </div>
                          <div className="relative flex items-center">
                            <Globe size={13} className="absolute left-3 text-zinc-500" />
                            <input
                              type="text"
                              required
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="City/Region *"
                              className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#0F0F12] border border-white/5 text-white placeholder-zinc-550 text-xs focus:outline-none focus:border-[#FF4D6D] transition-all"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full h-10 rounded-xl bg-[#FF4D6D] hover:bg-[#FF4D6D]/90 active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-1 cursor-pointer"
                        >
                          {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              Notify Me On Launch
                              <ArrowRight size={12} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-5 bg-gradient-to-r from-[#4ADE80]/10 to-transparent border border-[#4ADE80]/20 rounded-[24px] text-center space-y-1.5 text-xs">
                      <p className="text-[#4ADE80] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 text-[10px]">
                        <Check size={12} /> Request Registered successfully!
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        Thank you! We've stored your coordinates. You'll represent your region on our kitchen strategic map!
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Diagnostic messages display if there's error or mock GPS alert */}
          {(errorMessage || isMockLocationDetected) && (
            <div className="max-w-md mx-auto px-2 pt-2">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 text-left text-xs leading-relaxed space-y-1.5">
                <p className="text-red-400 font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <ShieldAlert size={14} /> Diagnostic Safety Alerts
                </p>
                {isMockLocationDetected && (
                  <p className="text-zinc-300 text-[10px]">
                    Virtual/Mock location simulator coordinates detected. Please restore authentic device GPS settings to confirm transactions.
                  </p>
                )}
                {errorMessage && (
                  <p className="text-zinc-300 text-[10px]">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Global Coordinates Status indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          className="flex items-center gap-2 text-zinc-500 text-[8px] uppercase tracking-[0.25em]"
        >
          <Globe size={10} />
          <span>Active Frontier Boundaries (20.46° N, 85.88° E)</span>
        </motion.div>
      </div>
    </div>
  );
};
