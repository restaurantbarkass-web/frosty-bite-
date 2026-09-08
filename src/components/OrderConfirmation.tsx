import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { formatOrderId } from '../utils/orderUtils';
import { cn, haptic } from '../lib/utils';
import { playSuccessChime } from '../utils/soundEffects';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  description?: string;
}

interface OrderConfirmationProps {
  isOpen: boolean;
  orderData: {
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
    notes?: string;
    delivery_date?: string;
    delivery_time?: string;
    delivery_time_slot?: string;
    cake_message?: string;
    cake_occasion?: string;
    cake_candle_knife?: boolean;
    is_scheduled?: boolean;
    method: 'upi' | 'cod' | 'online';
    amount: number;
    delivery_charge?: number;
    discount?: number;
    couponCode?: string;
    items?: OrderItem[];
    estimatedDelivery?: number | string;
    id?: string;
    total?: number;
    utr?: string;
  };
  onClose: () => void;
}

interface SparkleParticle {
  id: number;
  symbol: string;
  color: string;
  tx: string;
  ty: string;
  scale: number;
  rot: string;
  delay: number;
  fontSize: string;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ 
  isOpen, 
  orderData, 
  onClose 
}) => {
  const navigate = useNavigate();

  const idValue = orderData?.orderId || orderData?.id || 'FB-849204';
  const formattedId = formatOrderId(idValue);
  const amountValue = orderData?.amount || orderData?.total || 1030;
  const deliveryTime = orderData?.estimatedDelivery || '25-35 mins';
  const isInitialUpi = orderData?.method === 'upi' || orderData?.method === 'online';

  const [paymentMode, setPaymentMode] = useState<'upi' | 'cod'>(isInitialUpi ? 'upi' : 'cod');
  
  // Animation state steps (0: State 1 Loading, 1: Closing ring, 2: Settled & Tick draw, 3: Sparkles & Headline switch, 4: State 3 Cards Reveal)
  const [step, setStep] = useState<number>(0);
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);
  const [copied, setCopied] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('10:42 AM');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  const generateSugarSparkles = () => {
    const symbols = ['✦', '✧', '✨', '🧁', '❤️', '•', '•'];
    const colors = ['#D9777F', '#DFB15B', '#C96868', '#F3A8AF', '#8C5E58'];
    const count = 22;
    const newSparkles: SparkleParticle[] = [];

    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const distance = 52 + Math.random() * 65;
      const tx = `${Math.cos(angle) * distance}px`;
      const ty = `${Math.sin(angle) * distance}px`;
      const scale = 0.5 + Math.random() * 0.8;
      const rot = `${Math.floor(Math.random() * 360)}deg`;
      const delay = Math.random() * 0.2;
      const fontSize = symbol === '🧁' ? '14px' : (symbol === '•' ? '8px' : '12px');

      newSparkles.push({
        id: i,
        symbol,
        color,
        tx,
        ty,
        scale,
        rot,
        delay,
        fontSize
      });
    }

    setSparkles(newSparkles);
  };

  const startSequence = () => {
    clearAllTimers();
    setSparkles([]);
    setStep(0); // State 1: Loading

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    } catch (e) {}

    // Timeline Progression:
    // 0.95s: Ring begins closing smoothly into complete circle
    const t1 = setTimeout(() => {
      setStep(1);
    }, 950);

    // 1.15s: Ring settles, soft inner glow appears, and checkmark draws
    const t2 = setTimeout(() => {
      setStep(2);
      try {
        playSuccessChime();
        haptic.success();
      } catch (e) {}
    }, 1150);

    // 1.70s: Halo bloom pulse & sugar sparkles burst
    const t3 = setTimeout(() => {
      generateSugarSparkles();
    }, 1700);

    // 1.95s: Headline transitions smoothly from "Confirming..." to "Order Confirmed! 🎉"
    const t4 = setTimeout(() => {
      setStep(3);
    }, 1950);

    // 2.35s: Smooth upward transition of Hero + Staggered slide-in of State 3 Cards & Bottom CTA
    const t5 = setTimeout(() => {
      setStep(4);
    }, 2350);

    timersRef.current.push(t1, t2, t3, t4, t5);
  };

  useEffect(() => {
    if (isOpen) {
      startSequence();
    }
    return () => {
      clearAllTimers();
    };
  }, [isOpen]);

  const togglePaymentMode = () => {
    setPaymentMode(prev => prev === 'upi' ? 'cod' : 'upi');
    startSequence();
  };

  const copyOrderNumber = () => {
    const textToCopy = `#${formattedId || idValue}`;
    navigator.clipboard?.writeText(textToCopy);
    haptic.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewOrder = () => {
    haptic.medium();
    onClose();
    navigate(`/order-tracking/${idValue}`);
  };

  const handleContinueShopping = () => {
    haptic.light();
    onClose();
    navigate('/menu');
  };

  if (!isOpen || !orderData) return null;

  // Fallback items if needed
  const items = (orderData.items && orderData.items.length > 0) ? orderData.items : [
    { id: '1', name: 'Dark Belgian Chocolate Cake', description: '500g · Eggless · Ribbon Packed', price: 450, quantity: 1, category: 'Cakes' },
    { id: '2', name: 'Velvet Berry Cupcakes (Box of 2)', description: 'Cream cheese swirl', price: 180, quantity: 2, category: 'Cupcakes' },
    { id: '3', name: 'Salted Caramel Brownie Box', description: 'Fudgy walnut blend', price: 220, quantity: 1, category: 'Brownies' }
  ];

  const totalItemsCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const signatureItem = items[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[200] flex justify-center items-center p-0 sm:p-4 md:p-8 bg-black/75 backdrop-blur-md overflow-y-auto selection:bg-rose-100 selection:text-[#C96868]"
      >
        <style>{`
          /* Smooth Luxury Animation Timers & Physics */
          @keyframes spinner-spin {
            0% { transform: rotate(0deg); }
            70% { transform: rotate(720deg); }
            100% { transform: rotate(900deg); }
          }
          @keyframes drawCheck {
            0% { stroke-dashoffset: 75; opacity: 0; }
            15% { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 1; }
          }
          @keyframes gentlePulse {
            0% { transform: scale(1); }
            40% { transform: scale(1.09); }
            70% { transform: scale(0.97); }
            100% { transform: scale(1); }
          }
          @keyframes haloBloom {
            0% { transform: scale(0.85); opacity: 0; }
            60% { opacity: 0.6; }
            100% { transform: scale(1.35); opacity: 0; }
          }
          @keyframes sparkleFloat {
            0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; }
            50% { opacity: 0.9; }
            100% { transform: translate(var(--tx), var(--ty)) scale(var(--scale, 1)) rotate(var(--rot, 90deg)); opacity: 0; }
          }
          .sparkle-particle {
            animation: sparkleFloat 1.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .bg-frosty-radial {
            background: radial-gradient(circle at 50% 25%, rgba(246, 233, 227, 0.85) 0%, rgba(253, 250, 246, 0.98) 55%, #F7F2EB 100%);
          }
          .shadow-luxury {
            box-shadow: 0 10px 30px -5px rgba(140, 94, 88, 0.07), 0 4px 12px rgba(0,0,0,0.03);
          }
          .shadow-cta {
            box-shadow: 0 12px 28px -6px rgba(217, 119, 127, 0.38), 0 4px 10px -2px rgba(217, 119, 127, 0.2);
          }
          .bakery-divider {
            background-image: linear-gradient(to right, #D9777F 40%, rgba(255, 255, 255, 0) 0%);
            background-position: bottom;
            background-size: 8px 1.5px;
            background-repeat: repeat-x;
          }
        `}</style>

        {/* Mobile Screen Frame Container (390px iPhone / responsive) */}
        <main 
          className="w-full max-w-[430px] min-h-screen sm:min-h-[880px] sm:max-h-[920px] bg-frosty-radial relative flex flex-col justify-between sm:rounded-[44px] shadow-2xl overflow-hidden border border-[#8C5E58]/20 sm:ring-8 sm:ring-black/5 font-sans text-[#221815] my-auto transition-all"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          {/* Top Status Bar & Frosty Bite Micro Navigation */}
          <header className="relative z-30 pt-4 pb-2 px-6 flex items-center justify-between">
            {/* Brand Logo / Wordmark */}
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-white/90 border border-[#8C5E58]/15 shadow-xs flex items-center justify-center text-[#D9777F]">
                {/* Whisk / Sparkle Icon */}
                <svg className="w-4 h-4 text-[#D9777F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c2.5 0 4.5-1.5 5.5-3.5"/>
                  <path d="M19 7c1.5 1.5 2 4 1 6.5"/>
                  <circle cx="12" cy="12" r="3" fill="#D9777F" stroke="none"/>
                  <path d="m19 3 1.5 1.5L19 6l-1.5-1.5z"/>
                </svg>
              </div>
              <div>
                <span className="font-serif tracking-wide text-[16px] font-semibold text-[#221815] block leading-none" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                  Frosty Bite
                </span>
                <span className="text-[9px] uppercase tracking-widest text-[#C96868] font-semibold">
                  Artisan Pâtisserie
                </span>
              </div>
            </div>

            {/* State Demo Controller / Live Replay Button */}
            <div className="flex items-center space-x-1.5 bg-white/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#8C5E58]/15 text-[10px] text-[#7A6E6A]">
              <button 
                type="button"
                onClick={startSequence} 
                className="hover:text-[#221815] flex items-center space-x-1 font-medium text-[#D9777F] active:scale-95 transition-transform cursor-pointer" 
                title="Replay Full Sequence"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span>Replay</span>
              </button>
              <span className="text-stone-300">|</span>
              <button 
                type="button"
                onClick={togglePaymentMode} 
                className="hover:text-[#221815] font-medium text-stone-600 cursor-pointer uppercase"
              >
                <span>{paymentMode === 'upi' ? 'UPI' : 'COD'}</span>
              </button>
            </div>
          </header>

          {/* Content Scrollable Body */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-5 pt-3 pb-24 relative z-20 flex flex-col justify-start no-scrollbar"
          >
            {/* ========================================================
                 STATE 1 & STATE 2: MORPHING HERO ANIMATION
            ======================================================== */}
            <section 
              className={cn(
                "flex flex-col items-center justify-center transition-all duration-700 ease-out",
                step >= 4 ? "py-4 min-h-[220px]" : "py-10 min-h-[340px]"
              )}
            >
              {/* Animated Transformation Center Stage */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                
                {/* Outer Pulsing Halo (Revealed on Tick Completion) */}
                <div 
                  className={cn(
                    "absolute inset-0 rounded-full border border-[#D9777F]/40 pointer-events-none transition-all duration-700",
                    step >= 2 ? "opacity-100" : "opacity-0 scale-90"
                  )}
                  style={{
                    animation: step >= 2 ? 'haloBloom 0.9s ease-out forwards' : 'none'
                  }}
                />
                
                {/* Secondary Outer Soft Glow */}
                <div 
                  className={cn(
                    "absolute w-28 h-28 rounded-full bg-gradient-to-tr from-rose-100/40 via-[#D9777F]/10 to-transparent blur-md transition-opacity duration-700",
                    step >= 1 ? "opacity-100" : "opacity-0"
                  )}
                />

                {/* Dynamic SVG Vector: Dual-mode Loader + Morphing Checkmark */}
                <div 
                  className="relative w-28 h-28 flex items-center justify-center"
                  style={{
                    animation: step >= 2
                      ? 'gentlePulse 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      : 'none'
                  }}
                >
                  <svg 
                    className="w-full h-full -rotate-90 origin-center" 
                    viewBox="0 0 100 100"
                    style={{
                      animation: step === 0 ? 'spinner-spin 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite' : 'none'
                    }}
                  >
                    <defs>
                      <linearGradient id="frostyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E27B83"/>
                        <stop offset="60%" stopColor="#D9777F"/>
                        <stop offset="100%" stopColor="#C25962"/>
                      </linearGradient>

                      <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#FFF5F5" stopOpacity="0.85"/>
                        <stop offset="100%" stopColor="#FCECEE" stopOpacity="0.2"/>
                      </radialGradient>
                    </defs>

                    {/* Inner Soft Disc (Fades in on confirmation) */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="42" 
                      fill="url(#innerGlow)" 
                      className={cn(
                        "transition-opacity duration-500",
                        step >= 2 ? "opacity-100" : "opacity-0"
                      )}
                    />

                    {/* Main Morphing Ring */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="44" 
                      fill="none" 
                      stroke="url(#frostyGradient)" 
                      strokeWidth="2.75" 
                      strokeLinecap="round"
                      strokeDasharray={step === 0 ? "75 208" : "283 0"}
                      strokeDashoffset="0"
                      className="origin-center transition-all duration-500 ease-in-out"
                    />
                  </svg>

                  {/* Custom Elegant Checkmark (Drawn stroke with rounded line caps) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" fill="none">
                    <path 
                      d="M 32 51.5 L 44.5 64 L 68.5 38.5" 
                      stroke="#D9777F" 
                      strokeWidth="3.6" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      strokeDasharray="75"
                      strokeDashoffset={step >= 2 ? "0" : "75"}
                      style={{
                        animation: step >= 2 ? 'drawCheck 0.65s cubic-bezier(0.65, 0, 0.35, 1) forwards' : 'none'
                      }}
                      className="transition-all"
                    />
                  </svg>

                  {/* Center Loader Micro Accent (State 1 small spinning indicator) */}
                  {step === 0 && (
                    <div className="absolute w-2 h-2 rounded-full bg-[#D9777F]/60 blur-[1px] animate-ping" />
                  )}
                </div>

                {/* Particles & Sugar Sparkles Container (State 2 Celebration) */}
                <div className="absolute inset-0 pointer-events-none overflow-visible flex items-center justify-center">
                  {sparkles.map(sp => (
                    <span
                      key={sp.id}
                      className="absolute sparkle-particle select-none pointer-events-none"
                      style={{
                        color: sp.color,
                        fontSize: sp.fontSize,
                        animationDelay: `${sp.delay}s`,
                        // @ts-ignore
                        '--tx': sp.tx,
                        '--ty': sp.ty,
                        '--scale': sp.scale,
                        '--rot': sp.rot
                      }}
                    >
                      {sp.symbol}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dynamic State Headline & Subtext */}
              <div className="text-center mt-6 transition-all duration-500 max-w-[320px] min-h-[76px] flex flex-col justify-center">
                {step < 3 ? (
                  <div className="transition-opacity duration-300">
                    <h2 className="font-serif text-[22px] font-semibold text-[#221815] tracking-tight" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      Confirming your order…
                    </h2>
                    <p className="text-[13px] text-[#7A6E6A] mt-1.5 font-normal leading-relaxed">
                      Please wait while we finalize everything for you. <span className="text-rose-400">❤️</span>
                    </p>
                    <span className="text-[11px] text-[#7A6E6A]/70 tracking-wide mt-1 block">
                      This will only take a moment.
                    </span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  >
                    <h1 className="font-serif text-[27px] font-bold text-[#221815] tracking-tight" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      Order Confirmed! <span className="inline-block animate-bounce" style={{ animationDuration: '2s' }}>🎉</span>
                    </h1>
                    <p className="text-[13px] text-[#7A6E6A] mt-1.5 font-normal leading-relaxed">
                      Thank you for ordering from <strong className="text-[#221815]">Frosty Bite Bakery</strong>. ❤️<br />
                      <span className="text-stone-500 text-[12px]">Your sweet treats have been successfully confirmed.</span>
                    </p>
                  </motion.div>
                )}
              </div>
            </section>

            {/* ========================================================
                 STATE 3: FULL LUXURY CONFIRMATION DETAILS (Cards & Summary)
            ======================================================== */}
            <div 
              className={cn(
                "flex flex-col space-y-4 transition-all duration-700 ease-out",
                step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-8"
              )}
            >
              {/* 1. Frosty Bite Signature Minimalist Bakery Graphic Card */}
              <div className="bg-gradient-to-r from-white via-white/95 to-[#FFF7F5] rounded-2xl p-4 border border-[#8C5E58]/12 shadow-luxury flex items-center justify-between relative overflow-hidden">
                <div className="flex items-center space-x-3.5">
                  {/* Subtle Handcrafted Bakery Cake Icon with Sugar Glaze */}
                  <div className="w-12 h-12 rounded-xl bg-[#FFF1EF] flex items-center justify-center border border-rose-100 shrink-0 shadow-inner">
                    <svg className="w-7 h-7 text-[#D9777F]" viewBox="0 0 64 64" fill="none" stroke="currentColor">
                      <ellipse cx="32" cy="54" rx="26" ry="4" stroke="#D9777F" strokeWidth="2" strokeOpacity="0.5"/>
                      <path d="M14 36 C14 33, 50 33, 50 36 L50 49 C50 52, 14 52, 14 49 Z" fill="#FBF2EC" stroke="#D9777F" strokeWidth="2.2" strokeLinejoin="round"/>
                      <path d="M14 36 C18 41, 22 41, 26 37 C30 42, 34 42, 38 37 C42 42, 46 41, 50 36" stroke="#D9777F" strokeWidth="2.2" strokeLinecap="round" fill="#FFF"/>
                      <circle cx="32" cy="24" r="5" fill="#D9777F" stroke="#C25962" strokeWidth="1.5"/>
                      <path d="M33 19 C35 15, 39 14, 42 16" stroke="#8C5E58" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M46 22 L48 24 L46 26 L44 24 Z" fill="#E06D76"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-bold tracking-widest text-[#C96868] uppercase">Signature Baking</span>
                      <span className="w-1 h-1 rounded-full bg-[#D9777F]"></span>
                      <span className="text-[10px] text-stone-400">Fresh from the oven</span>
                    </div>
                    <p className="text-[13.5px] font-semibold text-[#221815] mt-0.5">
                      {signatureItem.name}
                    </p>
                    <p className="text-[11px] text-[#7A6E6A]">
                      {signatureItem.description || 'Crafted with single-origin Madagascan vanilla'}
                    </p>
                  </div>
                </div>
                {/* Sparkle badge */}
                <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center text-[#D9777F] text-[11px]">
                  ✨
                </div>
              </div>

              {/* 2. Order Number Floating Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#8C5E58]/12 shadow-luxury flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-[#7A6E6A] block">Order Number</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-[17px] font-bold text-[#221815] tracking-wide">
                      #{formattedId || idValue}
                    </span>
                    <button 
                      type="button"
                      onClick={copyOrderNumber} 
                      className="p-1 rounded-md hover:bg-stone-100 text-[#C96868] active:scale-95 transition-all cursor-pointer" 
                      title="Copy Order Number"
                    >
                      {copied ? (
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> Confirmed
                  </span>
                  <span className="block text-[10px] text-stone-400 mt-1">
                    Est. Prep: {deliveryTime}
                  </span>
                </div>
              </div>

              {/* 3. Real-Time Bakery Order Status Stepper */}
              <div className="bg-white rounded-2xl p-4 border border-[#8C5E58]/12 shadow-luxury">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100">
                  <h3 className="text-[13px] font-bold text-[#221815] flex items-center space-x-1.5">
                    <span>Your order is being prepared</span>
                    <span className="text-sm">🍰</span>
                  </h3>
                  <span className="text-[11px] text-[#C96868] font-semibold">Live Tracker</span>
                </div>

                {/* Vertical / Compact Horizontal Status Timeline */}
                <div className="grid grid-cols-4 gap-1 relative text-center">
                  {/* Step 1: Confirmed (Active/Completed) */}
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-[#D9777F] text-white flex items-center justify-center text-xs shadow-xs font-bold">
                      ✓
                    </div>
                    <span className="text-[10.5px] font-semibold text-[#221815] mt-1.5">Confirmed</span>
                    <span className="text-[9px] text-stone-400 font-mono">{currentTimeStr}</span>
                  </div>

                  {/* Step 2: Preparing (Active In Progress) */}
                  <div className="flex flex-col items-center relative">
                    <div className="w-7 h-7 rounded-full bg-rose-50 border-2 border-[#D9777F] text-[#D9777F] flex items-center justify-center text-xs font-bold ring-4 ring-rose-50/70">
                      <span className="w-2 h-2 rounded-full bg-[#D9777F] animate-ping"></span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-[#D9777F] mt-1.5">Preparing</span>
                    <span className="text-[9px] text-[#C96868] font-medium">Baking now</span>
                  </div>

                  {/* Step 3: Ready for Pickup/Dispatch */}
                  <div className="flex flex-col items-center opacity-45">
                    <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-center text-xs">
                      3
                    </div>
                    <span className="text-[10.5px] font-medium text-stone-600 mt-1.5">Ready</span>
                    <span className="text-[9px] text-stone-400">~11:10 AM</span>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="flex flex-col items-center opacity-45">
                    <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-center text-xs">
                      4
                    </div>
                    <span className="text-[10.5px] font-medium text-stone-600 mt-1.5">Delivered</span>
                    <span className="text-[9px] text-stone-400">Doorstep</span>
                  </div>
                </div>
              </div>

              {/* 4. Order Summary Compact Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#8C5E58]/12 shadow-luxury">
                <div className="flex items-center justify-between pb-2 mb-2 bakery-divider">
                  <span className="text-[11px] font-bold tracking-wider text-[#7A6E6A] uppercase">Your Artisan Selection</span>
                  <span className="text-[11px] text-[#C96868] font-medium">{totalItemsCount} Fresh Items</span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 pt-1 text-[13px]">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-start space-x-2">
                        <span className="text-xs mt-0.5">
                          {idx === 0 ? '🍫' : idx === 1 ? '🧁' : '📦'}
                        </span>
                        <div>
                          <p className="font-medium text-[#221815]">{item.name}</p>
                          <p className="text-[10.5px] text-[#7A6E6A]">
                            {item.description || `${item.quantity} × ₹${item.price}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-medium text-[#221815]">₹{item.price * item.quantity}</span>
                        <span className="text-[10px] text-stone-400 block">{item.quantity} × ₹{item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Calculation */}
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-[#221815]">
                      {paymentMode === 'upi' ? 'Total Amount Paid' : 'Total Amount Due'}
                    </span>
                    <span className="block text-[10px] text-stone-400">Includes taxes & eco-packaging</span>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-[20px] font-bold text-[#221815]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
                      ₹{amountValue}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Payment Method Card (Contextual UPI vs COD) */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#8C5E58]/12 shadow-luxury flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    paymentMode === 'upi' ? "bg-emerald-50 border border-emerald-200/80 text-emerald-600" : "bg-amber-50 border border-amber-200/80 text-amber-700"
                  )}>
                    {paymentMode === 'upi' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-[12px] font-bold",
                        paymentMode === 'upi' ? "text-emerald-800" : "text-stone-800"
                      )}>
                        {paymentMode === 'upi' ? 'Payment Verified' : 'Cash on Delivery'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                        {paymentMode === 'upi' ? 'INSTANT' : 'DOORSTEP'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {paymentMode === 'upi' 
                        ? (orderData.utr ? `UPI Transfer · Ref #${orderData.utr}` : 'UPI Transfer · Google Pay (•••• 7821)')
                        : `Pay ₹${amountValue} in cash or QR at doorstep`}
                    </p>
                  </div>
                </div>
                {/* Verified Shield Icon */}
                <span className="text-xs text-stone-400">🛡️ Encrypted</span>
              </div>

              {/* Delivery Address Details */}
              <div className="bg-white/70 rounded-2xl p-3.5 border border-[#8C5E58]/12 text-[12px] flex items-start space-x-2.5">
                <svg className="w-4 h-4 text-[#D9777F] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <div>
                  <span className="font-semibold text-[#221815]">
                    Delivering to {orderData.customerName || 'Home'}
                  </span>
                  <p className="text-stone-500 text-[11px] mt-0.5">
                    {orderData.address || 'Apt 402, Rosewood Heights, 12th Main Indiranagar, Bengaluru'}
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ========================================================
               BOTTOM FIXED CALL TO ACTION (One-Handed Safe Experience)
          ======================================================== */}
          <footer 
            className={cn(
              "p-4 sm:p-5 bg-gradient-to-t from-white via-white/95 to-transparent relative z-30 flex flex-col space-y-2.5 transition-all duration-700 ease-out",
              step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-6"
            )}
          >
            {/* Primary Action CTA */}
            <button 
              type="button"
              onClick={handleViewOrder} 
              className="w-full h-14 bg-gradient-to-r from-[#D9777F] via-[#C96868] to-[#C95C65] text-white font-semibold text-[15px] tracking-wide rounded-2xl shadow-cta hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-[#D9777F]/50 cursor-pointer"
            >
              <span>VIEW ORDER DETAILS</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>

            {/* Secondary Subtle Action */}
            <button 
              type="button"
              onClick={handleContinueShopping} 
              className="w-full py-2.5 text-center text-[13px] font-medium text-[#7A6E6A] hover:text-[#221815] transition-colors active:scale-95 cursor-pointer"
            >
              Continue Browsing Pastries
            </button>

            {/* Safe Area Indicator for mobile bottom bar */}
            <div className="w-28 h-1 bg-stone-300/80 rounded-full mx-auto mt-1"></div>
          </footer>

        </main>
      </motion.div>
    </AnimatePresence>
  );
};
