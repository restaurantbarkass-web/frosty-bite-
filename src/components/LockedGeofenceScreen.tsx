import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Globe, ArrowRight, ShieldAlert, Sparkles, Navigation, Lock, Phone, Mail, Map, Check, RefreshCw, AlertCircle, Clock, Trash2, History, ChevronUp } from 'lucide-react';
import { useGeofence, RecentValidatedLocation } from '../context/GeofenceContext';
import { Logo } from './Logo';
import { MapSelector } from './MapSelector';
import toast from 'react-hot-toast';
import { safeTrim, safeTrimLowerCase } from '../utils/string';

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
    clearLockedState,
    v2Serviceability,
    validateCityAndCheckCoverage,
    setSelectedCandidateLocation,
    checkPincodeAvailability,
    recentLocations,
    removeRecentLocation,
    clearRecentLocations,
  } = useGeofence();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showNotifyForm, setShowNotifyForm] = useState(false);

  const [manualPin, setManualPin] = useState(() => detectedPincode || '');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    const container = document.getElementById('locked-geofence-screen');
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop > 180) {
        setIsScrolledDown(true);
      } else {
        setIsScrolledDown(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToElement = (elementId: string) => {
    try {
      const target = document.getElementById(elementId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e) {
      console.warn('[Scroll] Smooth scroll failed:', e);
    }
  };

  const scrollToTop = () => {
    try {
      const container = document.getElementById('locked-geofence-screen');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      console.warn('[Scroll] Smooth scroll to top failed:', e);
    }
  };

  const getReasonText = (reason: string | null) => {
    switch (reason) {
      case 'OUTSIDE_GLOBAL_SERVICE_AREA':
        return "We haven't expanded to your region yet. Frosty Bite currently operates in select Odisha cities (Cuttack & Bhubaneswar).";
      case 'OUTSIDE_CITY':
        return 'Our kitchens are not yet open in this city. Check our active cities below!';
      case 'PINCODE_INACTIVE':
        return 'Deliveries to this pincode are currently paused or outside our service radius.';
      case 'OUTSIDE_LOCALITY':
        return 'Your location is outside our active neighborhood delivery radius.';
      case 'LOCALITY_INACTIVE':
        return 'Deliveries to your locality are temporarily offline.';
      case 'SERVICEABILITY_UNAVAILABLE':
        return "We couldn't verify your delivery area. Please try again.";
      default:
        return 'This location is outside our service delivery radius.';
    }
  };

  /**
   * Prominent visual feedback toast alert when location is outside delivery radius
   */
  const showOutsideRadiusToast = (reason: string | null, customMsg?: string, toastId?: string) => {
    const reasonDetail = customMsg || getReasonText(reason);
    toast.error(
      () => (
        <div className="flex flex-col gap-1 text-left py-0.5 max-w-xs">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-red-400 shrink-0" />
            <span className="font-extrabold text-xs text-red-400 uppercase tracking-wide">
              Outside Delivery Radius
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-snug">
            {reasonDetail}
          </p>
        </div>
      ),
      {
        id: toastId,
        duration: 5500,
        style: {
          background: '#181820',
          color: '#FFFFFF',
          border: '1px solid rgba(248, 113, 113, 0.35)',
          borderRadius: '16px',
          padding: '12px 14px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
        },
      }
    );
  };

  /**
   * Positive visual feedback toast when location is within delivery radius
   */
  const showServiceableToast = (locationName: string, toastId?: string) => {
    toast.success(
      () => (
        <div className="flex flex-col gap-1 text-left py-0.5 max-w-xs">
          <div className="flex items-center gap-1.5">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span className="font-extrabold text-xs text-emerald-400 uppercase tracking-wide">
              Delivery Active
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-snug">
            Coverage confirmed for <strong className="text-white">{locationName}</strong>. Welcome to Frosty Bite! 🍰
          </p>
        </div>
      ),
      {
        id: toastId,
        duration: 4500,
        style: {
          background: '#181820',
          color: '#FFFFFF',
          border: '1px solid rgba(52, 211, 153, 0.35)',
          borderRadius: '16px',
          padding: '12px 14px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
        },
      }
    );
  };

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setManualPin(val);
  };

  const handleValidateCityClick = async () => {
    setStatusBanner(null);
    const toastId = 'validate-city-gate';
    toast.loading('Checking delivery serviceability...', { id: toastId });

    const result = await validateCityAndCheckCoverage();
    if (result.status === 'serviceable') {
      showServiceableToast(result.locality || result.city || 'your area', toastId);
    } else if (result.status === 'unserviceable') {
      showOutsideRadiusToast(result.reason, undefined, toastId);
    } else {
      toast.error("We couldn't verify your delivery area. Please try again.", { id: toastId });
    }
  };

  const handleVerifyManualPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = safeTrim(manualPin).replace(/\s/g, '');
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      toast.error('Pincode must be exactly 6 digits.', { id: 'pincode-error' });
      return;
    }

    const toastId = `pin-check-${cleanPin}`;
    toast.loading(`Validating delivery radius for Pincode ${cleanPin}...`, { id: toastId });

    const defaultLat = v2Serviceability.coordinates?.latitude || 20.4625;
    const defaultLng = v2Serviceability.coordinates?.longitude || 85.8828;
    setSelectedCandidateLocation(defaultLat, defaultLng, `Pincode ${cleanPin}`, detectedCity || 'Cuttack', cleanPin);

    // Fast check if pincode is marked allowed in DB
    const isPinActive = await checkPincodeAvailability(cleanPin);
    if (!isPinActive) {
      setStatusBanner(`Pincode ${cleanPin} is currently outside our active delivery radius.`);
      showOutsideRadiusToast(
        'PINCODE_INACTIVE',
        `Pincode ${cleanPin} is outside our active delivery zones. Register below for launch notifications!`,
        toastId
      );
      return;
    }

    // Check spatial coverage
    const result = await validateCityAndCheckCoverage(defaultLat, defaultLng);
    if (result.status === 'serviceable') {
      setStatusBanner(`Delivery is active in Pincode ${cleanPin}!`);
      showServiceableToast(`Pincode ${cleanPin}`, toastId);
    } else if (result.status === 'unserviceable') {
      setStatusBanner(`Pincode ${cleanPin} is outside our delivery radius: ${getReasonText(result.reason)}`);
      showOutsideRadiusToast(result.reason, undefined, toastId);
    } else {
      toast.error("We couldn't verify delivery for this pincode. Please try again.", { id: toastId });
    }
  };

  const handleSelectRecentLocation = async (loc: RecentValidatedLocation) => {
    setSelectedCandidateLocation(
      loc.latitude,
      loc.longitude,
      loc.name,
      loc.city,
      loc.pincode || undefined
    );
    setStatusBanner(`Selected address: ${loc.name}. Verifying delivery availability...`);
    const toastId = 'recent-loc-check';
    toast.loading(`Checking delivery radius for ${loc.name}...`, { id: toastId });

    const result = await validateCityAndCheckCoverage(loc.latitude, loc.longitude);
    scrollToElement('primary-validation-card');
    if (result.status === 'serviceable') {
      showServiceableToast(loc.name, toastId);
    } else if (result.status === 'unserviceable') {
      showOutsideRadiusToast(result.reason, undefined, toastId);
    } else {
      toast.error("Couldn't verify delivery at this location. Please try again.", { id: toastId });
    }
  };

  const handleMapLocationSelect = async (lat: number, lng: number, address: string) => {
    setSelectedCandidateLocation(lat, lng, address);
    setStatusBanner(`Location pinned: ${address}. Checking delivery radius...`);
    
    const toastId = 'map-location-check';
    toast.loading('Checking delivery radius for pinned location...', { id: toastId });

    const result = await validateCityAndCheckCoverage(lat, lng);
    scrollToElement('primary-validation-card');
    if (result.status === 'serviceable') {
      setStatusBanner(`Delivery is active at ${address}!`);
      showServiceableToast(result.locality || result.city || address, toastId);
    } else if (result.status === 'unserviceable') {
      setStatusBanner(`Pinned location is outside delivery radius: ${getReasonText(result.reason)}`);
      showOutsideRadiusToast(result.reason, undefined, toastId);
    } else {
      toast.error("Couldn't verify delivery at this location. Please try again.", { id: toastId });
    }
  };

  const handleCityCardSelect = async (zone: any) => {
    if (zone.comingSoon) {
      setCity(zone.name);
      setShowNotifyForm(true);
      showOutsideRadiusToast(
        'OUTSIDE_CITY',
        `${zone.name} is currently outside our active delivery radius. We are coming soon! Register below for launch alerts.`,
        'coming-soon-toast'
      );
      setTimeout(() => {
        scrollToElement('notification-section');
      }, 150);
    } else {
      const ok = selectManualCity(zone.id);
      if (ok) {
        setStatusBanner(`City ${zone.name} selected. Verifying delivery coverage...`);
        const toastId = `city-check-${zone.name}`;
        toast.loading(`Verifying delivery coverage in ${zone.name}...`, { id: toastId });

        const result = await validateCityAndCheckCoverage(zone.latitude, zone.longitude);
        scrollToElement('primary-validation-card');
        if (result.status === 'serviceable') {
          setStatusBanner(`Delivery is active in ${zone.name}!`);
          showServiceableToast(zone.name, toastId);
        } else if (result.status === 'unserviceable') {
          setStatusBanner(`${zone.name} is outside active delivery radius: ${getReasonText(result.reason)}`);
          showOutsideRadiusToast(result.reason, undefined, toastId);
        } else {
          toast.error(`Could not verify delivery for ${zone.name}.`, { id: toastId });
        }
      }
    }
  };

  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    const toastId = 'gps-fetch';
    toast.loading('Fetching your GPS coordinates & checking delivery radius...', { id: toastId });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setSelectedCandidateLocation(latitude, longitude, 'GPS Location');
        setStatusBanner(`GPS location detected (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Verifying coverage...`);

        const result = await validateCityAndCheckCoverage(latitude, longitude);
        if (result.status === 'serviceable') {
          setStatusBanner(`Delivery active at your GPS location!`);
          showServiceableToast(result.locality || result.city || 'your GPS location', toastId);
        } else if (result.status === 'unserviceable') {
          setStatusBanner(`GPS location is outside delivery radius: ${getReasonText(result.reason)}`);
          showOutsideRadiusToast(result.reason, undefined, toastId);
        } else {
          toast.error("Couldn't verify delivery at your GPS location. Please try again.", { id: toastId });
        }
      },
      () => {
        toast.dismiss(toastId);
        toast.error('Could not retrieve GPS location. Please select your city or pin on the map.');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  // High-fidelity background images & descriptions for visual city cards
  const cityMeta: Record<string, { desc: string; img: string; nickname: string }> = {
    cuttack: {
      nickname: 'Silver City',
      desc: 'Artisan cakes, pastries and premium celebration treats delivered warm.',
      img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400',
    },
    bhubaneswar: {
      nickname: 'Temple City',
      desc: 'Rapid delivery of custom layered bakes, desserts and artisan donuts.',
      img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=400',
    },
    puri: {
      nickname: 'Holy Seaside',
      desc: 'Our future seaside kitchen expansion. Register for early launch invites!',
      img: 'https://images.unsplash.com/photo-1517433456452-f9633a875f6f?auto=format&fit=crop&q=80&w=400',
    },
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

  const displayZones =
    allowedZonesList.length > 0
      ? allowedZonesList
      : [
          { id: 'zone_cuttack', name: 'Cuttack', latitude: 20.4625, longitude: 85.8828, radius: 12, enabled: true },
          { id: 'zone_bhubaneswar', name: 'Bhubaneswar', latitude: 20.2961, longitude: 85.8245, radius: 15, enabled: true },
        ];

  const allCardZonesMap: Record<string, any> = {};
  displayZones.forEach((z) => {
    if (!z.name) return;
    const key = safeTrimLowerCase(z.name);
    allCardZonesMap[key] = {
      ...z,
      id: 'zone_' + key,
      comingSoon: false,
    };
  });

  if (!allCardZonesMap['puri']) {
    allCardZonesMap['puri'] = {
      id: 'zone_puri',
      name: 'Puri',
      latitude: 19.8134,
      longitude: 85.8312,
      radius: 10,
      enabled: false,
      comingSoon: true,
    };
  }

  const allCardZones = Object.values(allCardZonesMap);

  return (
    <div 
      id="locked-geofence-screen"
      className="fixed inset-0 z-[999] bg-[#0F0F12] text-white overflow-y-auto overflow-x-hidden scroll-smooth overscroll-contain"
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Immersive Atmospheric Radial Gradients (Fixed in background) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
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

      {/* Floating Sweet Bakery Assets (Fixed in background) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
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
              ease: 'easeInOut',
            }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </div>

      {/* Main Scrollable Content Container */}
      <div className="min-h-full w-full relative z-10 flex flex-col items-center justify-start py-8 md:py-14 px-2 sm:px-4">
        <div className="max-w-xl w-full flex flex-col items-center space-y-6">
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

        {/* V2 Serviceability Status Banner */}
        {v2Serviceability.status === 'serviceability_error' || v2Serviceability.reason === 'SERVICEABILITY_UNAVAILABLE' ? (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left flex items-start gap-3 shadow-lg">
            <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                Temporary Serviceability Verification Error
              </h4>
              <p className="text-[11px] text-zinc-300">
                We are currently unable to reach our PostGIS spatial verification service. Please retry.
              </p>
              <button
                type="button"
                onClick={recheckLocation}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors"
              >
                <RefreshCw size={12} />
                Retry Check
              </button>
            </div>
          </div>
        ) : v2Serviceability.status === 'unserviceable' && (
          <div className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left flex items-start gap-3 shadow-lg">
            <ShieldAlert size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-red-300 uppercase tracking-wide">
                Delivery Unavailable at Your Location
              </h4>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {getReasonText(v2Serviceability.reason)}
              </p>
            </div>
          </div>
        )}

        {/* Lock Screen Frame Container */}
        <div className="w-full space-y-6 text-center">
          <div className="space-y-2 px-4">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Verify Delivery Coverage 🍰
            </h1>
            <p className="text-[#B0B0B0] text-xs leading-relaxed max-w-md mx-auto">
              Select your city or pin your address below, then click <strong className="text-white font-bold">Validate City</strong> to check serviceability.
            </p>
          </div>

          {/* PRIMARY VALIDATE CITY GATE CARD */}
          <div id="primary-validation-card" className="bg-gradient-to-b from-[#1C1C24] to-[#14141B] border border-white/10 rounded-[28px] p-6 text-left space-y-4 shadow-2xl relative overflow-hidden max-w-lg mx-auto w-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4D6D]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FFD6A5] font-black text-[11px] uppercase tracking-wider">
                <MapPin size={15} className="text-[#FF4D6D]" />
                Selected Delivery Target
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                v2Serviceability.status === 'serviceable'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : v2Serviceability.status === 'validating'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {v2Serviceability.status === 'serviceable' ? 'Coverage Confirmed' : v2Serviceability.status === 'validating' ? 'Checking...' : 'Locked / Pending Validation'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-white text-lg font-black leading-tight">
                {v2Serviceability.selectedLocationName || detectedAddress || detectedCity || 'Cuttack, Odisha'}
              </div>
              <p className="text-zinc-400 text-xs">
                City: <span className="text-white font-semibold">{detectedCity || 'Cuttack'}</span>
                {detectedPincode && (
                  <> &bull; Pincode: <span className="text-[#FF4D6D] font-mono font-bold">{detectedPincode}</span></>
                )}
              </p>
            </div>

            {statusBanner && (
              <div className="p-3 bg-[#FFD6A5]/10 border border-[#FFD6A5]/25 rounded-xl text-[11px] text-[#FFD6A5] flex items-center gap-2">
                <Sparkles size={14} className="shrink-0 text-[#FFD6A5]" />
                <span>{statusBanner}</span>
              </div>
            )}

            {/* V2 SERVICEABILITY REASON / ERROR BANNERS */}
            {v2Serviceability.status === 'unserviceable' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
                <ShieldAlert size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-red-300 uppercase tracking-wide">
                    Delivery Unavailable at Selected Location
                  </h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {getReasonText(v2Serviceability.reason)}
                  </p>
                </div>
              </div>
            )}

            {(v2Serviceability.status === 'serviceability_error' || v2Serviceability.reason === 'SERVICEABILITY_UNAVAILABLE') && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Serviceability Verification Error
                  </h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    We couldn't verify your delivery area. Please try again.
                  </p>
                  <button
                    type="button"
                    onClick={handleValidateCityClick}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold uppercase tracking-wider hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    Retry Verification
                  </button>
                </div>
              </div>
            )}

            {/* THE AUTHORITATIVE "VALIDATE CITY" BUTTON */}
            <button
              type="button"
              onClick={handleValidateCityClick}
              disabled={v2Serviceability.status === 'validating'}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF4D6D] via-[#FF3355] to-[#FF4D6D] hover:brightness-110 active:scale-[0.99] text-white font-black text-sm uppercase tracking-widest shadow-[0_8px_25px_rgba(255,77,109,0.35)] flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer relative overflow-hidden"
            >
              {v2Serviceability.status === 'validating' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Checking Availability...</span>
                </>
              ) : v2Serviceability.status === 'serviceable' ? (
                <>
                  <Check size={18} className="text-emerald-300" />
                  <span>Delivery Verified! Unlocking...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>VALIDATE CITY</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {detectedCity && (
              <button
                type="button"
                onClick={clearLockedState}
                className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors py-1"
              >
                Reset Location Selection
              </button>
            )}
          </div>

          {/* RECENT VALIDATED LOCATIONS SECTION (Saved in localStorage, max 5) */}
          {recentLocations && recentLocations.length > 0 && (
            <div className="w-full max-w-lg mx-auto bg-gradient-to-b from-[#1C1C24] to-[#14141B] border border-white/10 rounded-[28px] p-5 text-left space-y-3.5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#FFD6A5] font-black text-xs uppercase tracking-wider">
                  <Clock size={15} className="text-[#FF4D6D]" />
                  <span>Recent Locations</span>
                  <span className="text-[10px] font-bold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    {recentLocations.length} / 5
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentLocations();
                    toast.success('Recent locations cleared');
                  }}
                  className="text-[10px] font-bold text-zinc-400 hover:text-red-400 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  title="Clear all recent locations"
                >
                  <Trash2 size={12} />
                  <span>Clear All</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Quickly re-select any of your last 5 verified delivery locations:
              </p>

              <div className="space-y-2.5">
                {recentLocations.map((loc) => {
                  const isCurrent =
                    v2Serviceability.coordinates?.latitude &&
                    Math.abs(v2Serviceability.coordinates.latitude - loc.latitude) < 0.0008 &&
                    Math.abs(v2Serviceability.coordinates.longitude - loc.longitude) < 0.0008;

                  return (
                    <motion.div
                      key={loc.id}
                      whileHover={{ scale: 1.01 }}
                      className={`group relative flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-[#FF4D6D]/10 border-[#FF4D6D]/40 ring-1 ring-[#FF4D6D]/30'
                          : 'bg-[#0F0F12]/80 hover:bg-[#181820] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div
                        onClick={() => handleSelectRecentLocation(loc)}
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isCurrent
                              ? 'bg-[#FF4D6D] text-white shadow-md shadow-[#FF4D6D]/30'
                              : 'bg-white/5 text-[#FFD6A5] group-hover:bg-[#FF4D6D]/20 group-hover:text-[#FF4D6D] transition-colors'
                          }`}
                        >
                          <MapPin size={16} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-xs font-bold truncate group-hover:text-[#FFD6A5] transition-colors">
                              {loc.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
                            <span className="text-zinc-300 font-medium">{loc.city}</span>
                            {loc.pincode && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-[#FFD6A5]">PIN {loc.pincode}</span>
                              </>
                            )}
                            <span>&bull;</span>
                            <span className="text-zinc-400">
                              {new Date(loc.timestamp).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectRecentLocation(loc)}
                          disabled={v2Serviceability.status === 'validating'}
                          className="h-8 px-3 rounded-xl bg-white/10 hover:bg-[#FF4D6D] text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <span>Select</span>
                          <ArrowRight size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentLocation(loc.id);
                            toast.success('Removed from recent locations');
                          }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Remove this location"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* INPUT HELPERS SECTION */}
          <div className="space-y-4 max-w-xl mx-auto w-full pt-2">
            <div className="flex items-center gap-2 justify-center text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <div className="h-px bg-white/10 flex-1" />
              <span>Or Choose / Change Location Below</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Active City Selection Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
              {allCardZones.map((zone) => {
                const metaKey = zone.name.toLowerCase();
                const meta = cityMeta[metaKey] || {
                  nickname: 'Active Kitchen',
                  desc: 'Artisan bakehouse kitchen operating with dedicated local delivery riders.',
                  img: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400',
                };

                return (
                  <motion.div
                    key={zone.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCityCardSelect(zone)}
                    className={`relative group rounded-[26px] overflow-hidden border border-white/10 p-4 flex flex-col justify-between text-left h-44 cursor-pointer shadow-lg transition-all bg-gradient-to-b from-[#1C1C24]/90 to-[#121218]/95 ${
                      zone.comingSoon
                        ? 'opacity-80 border-dashed border-white/10 hover:border-[#FFD6A5]/40'
                        : 'hover:border-[#FF4D6D]/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                    }`}
                  >
                    <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity">
                      <img
                        src={meta.img}
                        alt={zone.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover filter brightness-75 scale-105 group-hover:scale-100 transition-transform duration-700"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 z-0 pointer-events-none" />

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

                    <div className="relative z-10 space-y-1 mt-auto">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white group-hover:text-[#FF4D6D] transition-colors flex items-center gap-1.5">
                          {zone.name}
                          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </h3>
                        {!zone.comingSoon && <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />}
                      </div>
                      <p className="text-zinc-400 text-[10px] leading-relaxed line-clamp-2">{meta.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Map Selector & Manual Pincode Input */}
            <div className="px-2 space-y-4 max-w-lg mx-auto w-full pt-2">
              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#1C1C24] border border-white/10 hover:border-[#FF4D6D]/50 text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Map size={16} className="text-[#FF4D6D]" />
                  {showMapPicker ? 'Hide Interactive Map' : 'Pin Exact Location on MapLibre Map'}
                </span>
                <span className="text-zinc-400 text-xs">{showMapPicker ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {showMapPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <MapSelector onLocationSelect={handleMapLocationSelect} />
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleVerifyManualPin} className="bg-[#1C1C24]/90 border border-white/10 p-5 rounded-[24px] space-y-3 text-left shadow-lg w-full">
                <h3 className="font-extrabold text-[#FFD6A5] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={12} /> ENTER PINCODE MANUALLY
                </h3>
                <p className="text-[10px] text-[#B0B0B0] leading-relaxed">
                  Enter your 6-digit delivery pincode to set candidate location, then click Validate City.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={manualPin}
                    onChange={handlePincodeChange}
                    placeholder="e.g. 753001"
                    className="flex-1 h-10 px-4 rounded-xl bg-[#0F0F12] border border-white/5 text-white placeholder-zinc-650 text-xs uppercase tracking-widest focus:outline-none focus:border-[#FF4D6D] transition-all font-mono font-bold"
                  />
                  <button
                    type="submit"
                    disabled={manualPin.trim().length !== 6}
                    className="h-10 px-5 rounded-xl bg-[#FF4D6D] hover:bg-[#FF4D6D]/90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-sm whitespace-nowrap"
                  >
                    <span>Set Pincode</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={handleFetchGPS}
                className="w-full flex text-[11px] font-bold text-zinc-300 hover:text-[#FF4D6D] transition-colors py-3 px-5 rounded-2xl bg-[#1C1C24] hover:bg-white/[0.05] border border-white/10 active:scale-98 cursor-pointer items-center justify-center gap-2"
              >
                <Navigation size={14} className="text-[#FF4D6D]" />
                Use My Current GPS Location
              </button>
            </div>
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
                          Enter your details and location to register your interest for future expansion!
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
                        Thank you! We've stored your coordinates.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(errorMessage || isMockLocationDetected) && (
            <div className="max-w-md mx-auto px-2 pt-2">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 text-left text-xs leading-relaxed space-y-1.5">
                <p className="text-red-400 font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                  <ShieldAlert size={14} /> Diagnostic Safety Alerts
                </p>
                {isMockLocationDetected && (
                  <p className="text-zinc-300 text-[10px]">
                    Virtual/Mock location simulator coordinates detected.
                  </p>
                )}
                {errorMessage && <p className="text-zinc-300 text-[10px]">{errorMessage}</p>}
              </div>
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          className="flex items-center gap-2 text-zinc-500 text-[8px] uppercase tracking-[0.25em]"
        >
          <Globe size={10} />
          <span>Active PostGIS Spatial Boundaries V2 (20.46° N, 85.88° E)</span>
        </motion.div>
      </div>
    </div>

    {/* Smooth Floating Navigation Pill */}
    <AnimatePresence>
      {isScrolledDown && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1C1C24]/90 hover:bg-[#FF4D6D] border border-white/10 hover:border-[#FF4D6D] text-white text-xs font-black uppercase tracking-wider shadow-2xl backdrop-blur-xl transition-all duration-200 active:scale-95 cursor-pointer group"
          >
            <ChevronUp size={14} className="text-[#FF4D6D] group-hover:text-white transition-colors" />
            <span>Top</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
};
