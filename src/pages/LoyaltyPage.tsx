import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Gift, CheckCircle2, AlertCircle, ArrowLeft, 
  Cake, Coffee, Utensils, Award, PartyPopper, RefreshCw,
  Share2, Copy, Check, MessageCircle, ExternalLink, Heart, ShoppingBag, User
} from 'lucide-react';
import { loyaltyService, LoyaltyState } from '../services/loyaltyService';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export const LoyaltyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LoyaltyState | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'loading' | 'drop' | 'tick' | 'complete'>('loading');
  
  // Full-Screen Mystery Box Opening Overlay states
  const [isOpeningBoxModal, setIsOpeningBoxModal] = useState(false);
  const [openingPhase, setOpeningPhase] = useState<'idle' | 'anticipation' | 'shaking' | 'explosion' | 'revealed'>('idle');
  
  const [scratchReward, setScratchReward] = useState<any>(null);
  const [isScratched, setIsScratched] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Default Bakery Contact
  const BAKERY_WHATSAPP = '919876543210';

  useEffect(() => {
    let isMounted = true;
    async function validateToken() {
      if (!token) {
        // If loaded directly without a token parameter, fetch general customer loyalty status
        try {
          const userStored = localStorage.getItem('fb_customer_user') || localStorage.getItem('guest_session_id') || 'guest_session';
          const summary = await loyaltyService.getCustomerRewards(userStored);
          if (isMounted) {
            setState({
              status: 'valid',
              message: 'Welcome to Frosty Bite Bakery Loyalty Rewards!',
              stampsCollected: summary.stampsCollected,
              stampsRequired: summary.stampsRequired
            });
            if (summary.rewards && summary.rewards.length > 0) {
              const latestReward = summary.rewards[summary.rewards.length - 1];
              setScratchReward(latestReward);
              if (latestReward.status === 'opened' || latestReward.status === 'redeemed') {
                setIsScratched(true);
              }
            }
            setLoading(false);
            setAnimationPhase('complete');
          }
        } catch {
          if (isMounted) {
            setState({ status: 'invalid', message: 'Unable to load loyalty rewards session.', stampsCollected: 0, stampsRequired: 5 });
            setLoading(false);
          }
        }
        return;
      }

      try {
        const res = await loyaltyService.validateAndAwardToken(token);
        if (isMounted) {
          setState(res);
          if (res.scratchReward) {
            setScratchReward(res.scratchReward);
            if (res.scratchReward.status === 'opened' || res.scratchReward.status === 'redeemed') {
              setIsScratched(true);
            }
          }
          setLoading(false);

          if (res.status === 'valid' || res.status === 'already_collected') {
            setTimeout(() => setAnimationPhase('drop'), 400);
            setTimeout(() => setAnimationPhase('tick'), 1100);
            setTimeout(() => {
              setAnimationPhase('complete');
              if (res.status === 'valid') {
                confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 }, colors: ['#F3A6B8', '#D96C8B', '#D8B56D', '#FFFFFF'] });
                toast.success("Sweet! You've earned another stamp! 🧁");
              }
            }, 2000);
          }
        }
      } catch (err) {
        if (isMounted) {
          setState({ status: 'error', message: 'Network error validating loyalty token.', stampsCollected: 0, stampsRequired: 5 });
          setLoading(false);
        }
      }
    }
    validateToken();
    return () => { isMounted = false; };
  }, [token]);

  // Render Scratch Canvas with Champagne Gold Foil Gradient
  const initScratchCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 320;
    canvas.height = 180;

    // Champagne gold foil gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#D8B56D');
    gradient.addColorStop(0.3, '#F3E5AB');
    gradient.addColorStop(0.7, '#C59B27');
    gradient.addColorStop(1, '#D8B56D');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative foil pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Text instructions on foil
    ctx.fillStyle = '#4A2E2A';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('✨ SCRATCH HERE TO REVEAL ✨', canvas.width / 2, canvas.height / 2 - 6);

    ctx.fillStyle = '#8B5A2B';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Your Mystery Reward Awaits! 🎁', canvas.width / 2, canvas.height / 2 + 16);
  }, []);

  useEffect(() => {
    if (!isScratched && scratchReward && canvasRef.current) {
      initScratchCanvas();
    }
  }, [scratchReward, isScratched, initScratchCanvas]);

  const handleScratchMove = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current || !canvasRef.current || isScratched) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    // Calculate scratched percentage
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparentPixels = 0;
    const totalPixels = imgData.data.length / 32;
    for (let i = 3; i < imgData.data.length; i += 32) {
      if (imgData.data[i] < 128) transparentPixels++;
    }
    const percent = (transparentPixels / totalPixels) * 100;
    setScratchProgress(percent);

    if (percent >= 50 && !isScratched) {
      setIsScratched(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#F3A6B8', '#D96C8B', '#D8B56D', '#FFFFFF'] });
      toast.success('Sweet reward revealed! 🎉');
    }
  };

  // Trigger 4-Phase Full-Screen Mystery Box Opening Animation
  const handleStartOpenMysteryBox = async () => {
    if (openingPhase !== 'idle') return;

    setIsOpeningBoxModal(true);
    setOpeningPhase('anticipation');

    try {
      const userStored = localStorage.getItem('fb_customer_user') || localStorage.getItem('guest_session_id') || 'customer_demo';
      const reward = await loyaltyService.openMysteryBox(userStored);
      setScratchReward(reward);

      // Phase 1 -> Phase 2: Shaking
      setTimeout(() => {
        setOpeningPhase('shaking');
      }, 1000);

      // Phase 2 -> Phase 3: Explosion & Confetti
      setTimeout(() => {
        setOpeningPhase('explosion');
        confetti({
          particleCount: 140,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#F3A6B8', '#D96C8B', '#D8B56D', '#FFFFFF', '#4A2E2A']
        });
      }, 2400);

      // Phase 3 -> Phase 4: Scratch Card Revealed
      setTimeout(() => {
        setOpeningPhase('revealed');
      }, 3600);

    } catch (err: any) {
      toast.error(err?.message || 'Failed to unlock mystery box.');
      setIsOpeningBoxModal(false);
      setOpeningPhase('idle');
    }
  };

  // WhatsApp Redemption Request Generator
  const handleWhatsAppRedeem = () => {
    if (!scratchReward) return;

    const prizeName = scratchReward.reward_prizes?.name || 'Mystery Box Reward';
    const code = scratchReward.unique_redemption_code || 'VOUCHER-FB';
    const customerName = localStorage.getItem('fb_customer_name') || 'Valued Bakery Guest';
    const contact = localStorage.getItem('fb_customer_phone') || 'Registered Mobile';

    const message = `Hi Frosty Bite Bakery! 💗\n\nI've unlocked a Mystery Box reward through your loyalty program and would like to request redemption.\n\n🎁 Reward: ${prizeName}\n🎟️ Reward Reference: ${code}\n👤 Customer: ${customerName}\n📱 Registered Contact: ${contact}\n\nPlease let me know the next steps for redeeming my gift.\n\nThank you! 🍰✨\nFrosty Bite Bakery Rewards Customer`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${BAKERY_WHATSAPP}?text=${encoded}`;

    window.open(waUrl, '_blank');
    toast.success('Opening WhatsApp to request redemption! 💬');
  };

  const handleCopyCode = () => {
    if (!scratchReward?.unique_redemption_code) return;
    navigator.clipboard.writeText(scratchReward.unique_redemption_code);
    setCopiedCode(true);
    toast.success('Redemption code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-20 h-20 bg-gradient-to-tr from-[#F3A6B8] to-[#D96C8B] rounded-3xl flex items-center justify-center shadow-xl mb-6 ring-4 ring-[#D8B56D]/30"
        >
          <Cake className="text-white" size={38} />
        </motion.div>
        <h2 className="font-serif font-black text-2xl text-[#4A2E2A] mb-2 tracking-tight">Preparing something sweet...</h2>
        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Validating your Frosty Bite loyalty passport</p>
      </div>
    );
  }

  const stampsCollected = state?.stampsCollected || 0;
  const stampsRequired = state?.stampsRequired || 5;
  const remainingStamps = Math.max(0, stampsRequired - stampsCollected);
  const isCardComplete = stampsCollected >= stampsRequired;

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#4A2E2A] flex flex-col items-center justify-start p-4 sm:p-8 font-sans selection:bg-[#F3A6B8] selection:text-white">
      
      {/* Top Header Navigation */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[#4A2E2A] hover:text-[#D96C8B] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer bg-white/90 px-3 py-2.5 rounded-2xl shadow-2xs border border-[#D8B56D]/30 shrink-0 active:scale-95"
        >
          <ArrowLeft size={16} />
          <span>Menu</span>
        </button>

        <div className="flex items-center justify-center shrink-0">
          <Logo size="sm" />
        </div>

        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1.5 text-[#4A2E2A] hover:text-[#D96C8B] font-bold text-xs bg-white/90 px-3 py-2.5 rounded-2xl shadow-2xs border border-[#D8B56D]/30 shrink-0 active:scale-95"
        >
          <User size={16} className="text-[#D96C8B]" />
          <span>Account</span>
        </button>
      </div>

      {/* Main Page Title Banner */}
      <div className="text-center mb-6 max-w-md space-y-1">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F3A6B8]/20 border border-[#F3A6B8]/40 text-[#D96C8B] text-xs font-black uppercase tracking-widest shadow-2xs mb-2">
          <Sparkles size={14} className="animate-pulse text-[#D8B56D]" />
          <span>Frosty Bite Loyalty Pass</span>
        </div>
        <h1 className="font-serif font-black text-3xl sm:text-4xl text-[#4A2E2A] tracking-tight">
          Your Sweet Rewards
        </h1>
        <p className="text-xs text-stone-600 font-medium italic">
          Collect stamps on every order and unlock a magical Mystery Box!
        </p>
      </div>

      {/* Error / Invalid State View */}
      {state?.status === 'invalid' || state?.status === 'expired' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-xl border border-stone-200/80 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-black text-[#4A2E2A]">Loyalty Pass Notice</h3>
          <p className="text-xs text-stone-600 font-medium leading-relaxed">{state.message}</p>
          <Button onClick={() => navigate('/')} className="w-full bg-[#D96C8B] text-white font-bold rounded-2xl py-3.5">
            Browse Frosty Bite Menu
          </Button>
        </motion.div>
      ) : (

        /* MAIN LOYALTY STAMP CARD CONTAINER */
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(74,46,42,0.08)] border-2 border-[#D8B56D]/40 relative overflow-hidden space-y-6"
        >
          {/* Subtle Pink Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-b from-[#F3A6B8]/30 via-amber-100/20 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Status Alert Banner */}
          {state?.message && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
              state?.status === 'already_collected' 
                ? 'bg-amber-50 text-amber-900 border border-amber-200/80' 
                : 'bg-[#F3A6B8]/15 text-[#4A2E2A] border border-[#F3A6B8]/40'
            }`}>
              <CheckCircle2 className="text-[#D96C8B] shrink-0" size={20} />
              <div className="leading-snug">
                {stampsCollected === 0 && !state?.stampAwarded
                  ? 'Welcome to your Frosty Bite Passport! Place orders to earn stamps.'
                  : state.message}
              </div>
            </div>
          )}

          {/* Loyalty Summary Header & Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-stone-400 block mb-0.5">Passport Stamp Counter</span>
                <h2 className="text-2xl font-serif font-black text-[#4A2E2A]">
                  {stampsCollected} / {stampsRequired} Stamps
                </h2>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-[#F3A6B8] to-[#D96C8B] rounded-2xl flex items-center justify-center text-white shadow-md shadow-[#D96C8B]/20">
                <Award size={26} />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3.5 w-full bg-stone-100 rounded-full p-0.5 border border-stone-200/80 overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stampsCollected / stampsRequired) * 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#F3A6B8] via-[#D96C8B] to-[#D8B56D] rounded-full shadow-xs"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                <span>{isCardComplete ? '100% Completed!' : `${remainingStamps} stamp${remainingStamps > 1 ? 's' : ''} remaining`}</span>
                <span className="text-[#D96C8B] font-extrabold">{Math.round((stampsCollected / stampsRequired) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* STAMP GRID (CIRCULAR SLOTS) */}
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-stone-400 block mb-3">Your Cupcake Stamps</span>
            <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
              {Array.from({ length: stampsRequired }).map((_, index) => {
                const isCollected = index < stampsCollected;
                const isJustCollected = isCollected && index === stampsCollected - 1 && state?.status !== 'already_collected';

                return (
                  <motion.div
                    key={index}
                    initial={isJustCollected ? { scale: 0.4, opacity: 0 } : false}
                    animate={isJustCollected && animationPhase !== 'loading' ? { scale: [0.8, 1.2, 1], opacity: 1 } : { opacity: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.08 }}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative border-2 transition-all ${
                      isCollected
                        ? 'bg-gradient-to-br from-[#F3A6B8] to-[#D96C8B] border-[#D8B56D] shadow-md text-white'
                        : 'bg-stone-50 border-dashed border-[#D8B56D]/50 text-stone-300'
                    }`}
                  >
                    {isCollected ? (
                      <>
                        <Cake size={22} className="text-white drop-shadow-xs" />
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2 }}
                          className="absolute -top-1.5 -right-1.5 bg-[#D8B56D] text-[#4A2E2A] rounded-full p-0.5 shadow-xs border border-white"
                        >
                          <CheckCircle2 size={12} className="fill-white text-[#D8B56D]" />
                        </motion.div>
                      </>
                    ) : (
                      <>
                        <Cake size={18} className="text-stone-300 mb-0.5 opacity-60" />
                        <span className="text-[10px] font-black text-stone-400">{index + 1}</span>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* MYSTERY BOX REWARD CARD (INSIDE THE LOYALTY CARD) */}
          <div className="pt-2 border-t border-stone-100">
            <div className={`p-6 rounded-3xl text-center relative overflow-hidden transition-all ${
              isCardComplete 
                ? 'bg-gradient-to-br from-[#F3A6B8]/20 via-amber-100/30 to-[#D8B56D]/20 border-2 border-[#D8B56D] shadow-lg ring-4 ring-[#D8B56D]/10' 
                : 'bg-gradient-to-br from-stone-50 to-[#FFF9F5] border border-stone-200'
            }`}>
              
              {/* Gift Box Icon with Idle Floating or Completion Bounce */}
              <motion.div
                animate={isCardComplete ? { y: [0, -8, 0], scale: [1, 1.05, 1] } : { y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: isCardComplete ? 2 : 3, ease: 'easeInOut' }}
                className={`inline-flex items-center justify-center w-16 h-16 rounded-3xl shadow-lg mb-3 text-white ${
                  isCardComplete 
                    ? 'bg-gradient-to-tr from-[#D96C8B] via-pink-500 to-[#D8B56D] ring-4 ring-pink-200' 
                    : 'bg-stone-300 text-stone-500'
                }`}
              >
                <Gift size={32} />
              </motion.div>

              {isCardComplete ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest border border-amber-300">
                    <Sparkles size={12} className="text-[#D8B56D]" />
                    <span>Reward Entitlement Ready</span>
                  </div>
                  <h3 className="font-serif font-black text-xl text-[#4A2E2A]">
                    Congratulations! Your Mystery Box is Unlocked!
                  </h3>
                  <p className="text-xs text-stone-600 font-medium">
                    Tap below to open your gift box and reveal your secret bakery reward!
                  </p>

                  <Button
                    onClick={handleStartOpenMysteryBox}
                    className="w-full py-4 bg-gradient-to-r from-[#D96C8B] via-pink-600 to-[#D8B56D] hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-[#D96C8B]/30 cursor-pointer active:scale-95 transition-all"
                  >
                    Open My Mystery Box 🎁
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-[#4A2E2A]">Keep collecting stamps!</h4>
                  <p className="text-xs text-stone-500 font-medium">
                    You're <strong>{remainingStamps} stamp{remainingStamps > 1 ? 's' : ''}</strong> away from unlocking your Mystery Box reward.
                  </p>
                </div>
              )}
            </div>
          </div>

        </motion.div>
      )}

      {/* FULL-SCREEN MYSTERY BOX OPENING & SCRATCH CARD MODAL */}
      <AnimatePresence>
        {isOpeningBoxModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9F5] rounded-[3rem] p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl border-2 border-[#D8B56D]/50 relative overflow-hidden"
            >
              {/* Close Modal Button */}
              <button 
                onClick={() => {
                  setIsOpeningBoxModal(false);
                  setOpeningPhase('idle');
                }}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 p-2 rounded-full cursor-pointer transition-colors"
              >
                ✕
              </button>

              {/* PHASES A, B, C: ANIMATED GIFT BOX UNWRAPPING */}
              {openingPhase !== 'revealed' && (
                <div className="py-8 space-y-6">
                  <div className="relative flex justify-center items-center py-6">
                    {/* Glowing aura under box */}
                    <div className="absolute w-48 h-48 bg-gradient-to-tr from-[#F3A6B8] via-[#D8B56D] to-orange-400 rounded-full blur-2xl opacity-60 animate-pulse" />

                    {/* Shaking / Floating Gift Box */}
                    <motion.div
                      animate={
                        openingPhase === 'shaking'
                          ? { rotate: [-6, 6, -6, 6, 0], scale: [1, 1.1, 1] }
                          : openingPhase === 'explosion'
                          ? { scale: [1, 1.3, 0], opacity: [1, 1, 0] }
                          : { y: [0, -10, 0] }
                      }
                      transition={{
                        duration: openingPhase === 'shaking' ? 0.3 : openingPhase === 'explosion' ? 0.6 : 2,
                        repeat: openingPhase === 'shaking' ? Infinity : 0
                      }}
                      className="w-32 h-32 bg-gradient-to-br from-[#F3A6B8] via-[#D96C8B] to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-[#D8B56D] relative z-10"
                    >
                      <Gift size={64} className="text-white drop-shadow-md" />
                      {/* Ribbon details */}
                      <div className="absolute inset-y-0 w-6 bg-[#D8B56D] opacity-90 rounded-sm" />
                      <div className="absolute inset-x-0 h-6 bg-[#D8B56D] opacity-90 rounded-sm" />
                    </motion.div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-serif font-black text-2xl text-[#4A2E2A]">
                      {openingPhase === 'anticipation' && 'Your sweet surprise is waiting...'}
                      {openingPhase === 'shaking' && 'Unwrapping your Mystery Box... 🎁'}
                      {openingPhase === 'explosion' && 'Ta-Da! Prize Unlocked! ✨'}
                    </h3>
                    <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                      {openingPhase === 'anticipation' && 'Preparing your prize assignment'}
                      {openingPhase === 'shaking' && 'Hold tight! Something delicious inside'}
                      {openingPhase === 'explosion' && 'Preparing your scratch card...'}
                    </p>
                  </div>
                </div>
              )}

              {/* PHASE D: GOLD SCRATCH CARD & REWARD REVEAL */}
              {openingPhase === 'revealed' && scratchReward && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pt-2"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#D96C8B] bg-[#F3A6B8]/20 px-3 py-1 rounded-full border border-[#F3A6B8]/40">
                      You Won Something Sweet! 🎉
                    </span>
                    <h3 className="font-serif font-black text-2xl text-[#4A2E2A] pt-1">
                      {isScratched ? 'Your Sweet Reward' : 'Scratch To Reveal!'}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">
                      {isScratched ? 'Your prize details and redemption pass' : 'Scratch the gold foil below to unveil your gift'}
                    </p>
                  </div>

                  {/* SCRATCH CANVAS OR REVEALED PRIZE CARD */}
                  <div className="p-4 bg-white rounded-3xl border-2 border-[#D8B56D]/40 shadow-md space-y-3">
                    {!isScratched ? (
                      <div className="relative w-full h-44 bg-stone-50 rounded-2xl overflow-hidden border border-stone-200 flex items-center justify-center">
                        {/* Revealed Content Behind Foil */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#FFF9F5] to-orange-50 text-center space-y-1">
                          <PartyPopper className="text-[#D96C8B]" size={32} />
                          <h4 className="font-black text-base text-[#4A2E2A]">{scratchReward.reward_prizes?.name || 'Mystery Gift'}</h4>
                          <span className="font-mono font-black text-sm text-[#D96C8B] bg-white px-3 py-1 rounded-xl border border-pink-200 shadow-2xs">
                            {scratchReward.unique_redemption_code}
                          </span>
                        </div>

                        {/* Interactive Canvas Foil Overlay */}
                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 cursor-crosshair touch-none"
                          onMouseDown={() => (isDrawingRef.current = true)}
                          onMouseUp={() => (isDrawingRef.current = false)}
                          onMouseMove={(e) => handleScratchMove(e.clientX, e.clientY)}
                          onTouchStart={() => (isDrawingRef.current = true)}
                          onTouchEnd={() => (isDrawingRef.current = false)}
                          onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (touch) handleScratchMove(touch.clientX, touch.clientY);
                          }}
                        />
                      </div>
                    ) : (
                      
                      /* REVEALED REWARD DETAILS CARD */
                      <div className="space-y-4 py-2">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#F3A6B8] to-[#D96C8B] text-white rounded-3xl flex items-center justify-center mx-auto shadow-md">
                          <Cake size={32} />
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-serif font-black text-xl text-[#4A2E2A]">{scratchReward.reward_prizes?.name}</h4>
                          <p className="text-xs text-stone-600 leading-relaxed font-medium">{scratchReward.reward_prizes?.description}</p>
                        </div>

                        {/* Redemption Reference Code & Copy */}
                        <div className="bg-[#FFF9F5] p-3 rounded-2xl border border-[#D8B56D]/30 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[9px] font-black uppercase text-stone-400 block">Voucher Code</span>
                            <span className="font-mono font-black text-sm text-[#D96C8B]">{scratchReward.unique_redemption_code}</span>
                          </div>
                          <button
                            onClick={handleCopyCode}
                            className="p-2 text-stone-500 hover:text-[#4A2E2A] bg-white rounded-xl border border-stone-200 text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        {/* WORKFLOW 1: FREE CLAIM WHATSAPP REDEMPTION */}
                        {scratchReward.redemption_type === 'free_claim' || (scratchReward.reward_prizes?.minimum_order_amount || 0) === 0 ? (
                          <div className="space-y-2 pt-1">
                            <Button
                              onClick={handleWhatsAppRedeem}
                              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                              <MessageCircle size={18} />
                              <span>Request Redemption on WhatsApp</span>
                            </Button>

                            <Button
                              onClick={() => navigate('/profile')}
                              variant="outline"
                              fullWidth={false}
                              className="w-full py-2.5 border-stone-300 text-stone-700 hover:bg-stone-100 rounded-2xl text-xs font-bold cursor-pointer"
                            >
                              View in My Rewards Wallet
                            </Button>
                          </div>
                        ) : (

                          /* WORKFLOW 2: MINIMUM PURCHASE CHECKOUT REDEMPTION */
                          <div className="space-y-2 pt-1">
                            <p className="text-[11px] text-amber-800 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                              Unlock your gift with a qualifying order of ₹{scratchReward.reward_prizes?.minimum_order_amount || 299}!
                            </p>
                            <Button
                              onClick={() => navigate('/')}
                              className="w-full py-3.5 bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <ShoppingBag size={18} />
                              <span>Shop & Redeem at Checkout</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
