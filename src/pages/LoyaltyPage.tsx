import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Gift, CheckCircle2, AlertCircle, ArrowLeft, 
  Cake, Coffee, Utensils, Award, PartyPopper, RefreshCw 
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
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [scratchReward, setScratchReward] = useState<any>(null);
  const [isScratched, setIsScratched] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function validateToken() {
      if (!token) {
        if (isMounted) {
          setState({ status: 'invalid', message: 'No loyalty token provided.', stampsCollected: 0, stampsRequired: 5 });
          setLoading(false);
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
            setTimeout(() => setAnimationPhase('drop'), 500);
            setTimeout(() => setAnimationPhase('tick'), 1200);
            setTimeout(() => {
              setAnimationPhase('complete');
              if (res.status === 'valid') {
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
              }
            }, 2200);
          }
        }
      } catch (err) {
        if (isMounted) {
          setState({ status: 'error', message: 'Network or server error validating loyalty card.', stampsCollected: 0, stampsRequired: 5 });
          setLoading(false);
        }
      }
    }
    validateToken();
    return () => { isMounted = false; };
  }, [token]);

  // Scratch canvas setup
  useEffect(() => {
    if (!isScratched && scratchReward && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.parentElement?.clientWidth || 320;
      canvas.height = 160;

      // Fill with gold foil gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#E5C158');
      gradient.addColorStop(0.5, '#F3E5AB');
      gradient.addColorStop(1, '#C59B27');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#4A2E2A';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨ SCRATCH TO REVEAL ✨', canvas.width / 2, canvas.height / 2 + 5);
    }
  }, [scratchReward, isScratched]);

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
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Calculate scratched percentage roughly
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparentPixels = 0;
    for (let i = 3; i < imgData.data.length; i += 32) {
      if (imgData.data[i] < 128) transparentPixels++;
    }
    const totalSamples = imgData.data.length / 32;
    const percent = (transparentPixels / totalSamples) * 100;
    setScratchProgress(percent);

    if (percent > 45 && !isScratched) {
      setIsScratched(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      toast.success('Sweet reward revealed! 🎉');
    }
  };

  const handleOpenBox = async () => {
    if (isOpeningBox || scratchReward) return;
    setIsOpeningBox(true);
    try {
      const reward = await loyaltyService.openMysteryBox(state?.order?.customer_id || 'customer_demo');
      setTimeout(() => {
        setScratchReward(reward);
        setIsOpeningBox(false);
        confetti({ particleCount: 80, spread: 70 });
      }, 1500);
    } catch {
      setIsOpeningBox(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-20 h-20 bg-gradient-to-tr from-pink-400 to-orange-400 rounded-3xl flex items-center justify-center shadow-xl mb-6"
        >
          <Cake className="text-white" size={36} />
        </motion.div>
        <h2 className="font-sans font-black text-2xl text-[#4A2E2A] mb-2">Preparing something sweet...</h2>
        <p className="text-sm text-stone-500">Validating your Frosty Bite loyalty passport</p>
      </div>
    );
  }

  const stampsCollected = state?.stampsCollected || 0;
  const stampsRequired = state?.stampsRequired || 5;

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#4A2E2A] flex flex-col items-center justify-start p-4 sm:p-8 font-sans">
      {/* Top Navigation */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-[#4A2E2A] font-medium text-sm transition-colors cursor-pointer bg-white/80 px-4 py-2 rounded-full shadow-xs border border-stone-200"
        >
          <ArrowLeft size={16} />
          <span>Back to Bakery</span>
        </button>
        <div className="flex items-center gap-1.5 bg-orange-100/60 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-200/50">
          <Sparkles size={14} className="text-orange-500" />
          <span>Digital Loyalty Pass</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="text-center mb-8 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#F3A6B8] to-[#D96C8B] rounded-3xl shadow-lg mb-4 text-white">
          <Cake size={32} />
        </div>
        <h1 className="font-sans font-black text-3xl tracking-tight text-[#4A2E2A] mb-1">
          FROSTY BITE BAKERY
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 italic font-medium">
          "A little sweetness, a little surprise."
        </p>
      </div>

      {/* State View */}
      {state?.status === 'invalid' || state?.status === 'expired' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-stone-100 text-center"
        >
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Oops! Link Issue</h3>
          <p className="text-sm text-stone-600 mb-6">{state.message}</p>
          <Button onClick={() => navigate('/')} className="w-full">
            Browse Bakery Menu
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_20px_50px_rgba(74,46,42,0.08)] border border-stone-100 relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-pink-200/40 via-orange-100/20 to-transparent rounded-full blur-2xl pointer-events-none" />

          {/* Status Message */}
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${state?.status === 'already_collected' ? 'bg-amber-50 text-amber-800 border border-amber-200/60' : 'bg-pink-50 text-pink-900 border border-pink-200/60'}`}>
            <CheckCircle2 className="text-[#D96C8B] shrink-0" size={22} />
            <div className="text-xs sm:text-sm font-bold">
              {state?.message}
            </div>
          </div>

          {/* Progress Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-extrabold text-stone-400">Stamp Card Progress</span>
              <h2 className="text-xl font-black text-[#4A2E2A]">
                {stampsCollected} / {stampsRequired} Stamps
              </h2>
            </div>
            <div className="w-12 h-12 bg-pink-100/80 rounded-2xl flex items-center justify-center text-[#D96C8B]">
              <Award size={24} />
            </div>
          </div>

          {/* Stamp Grid */}
          <div className="grid grid-cols-5 gap-2.5 sm:gap-3 mb-8">
            {Array.from({ length: stampsRequired }).map((_, index) => {
              const isCollected = index < stampsCollected;
              const isJustCollected = isCollected && index === stampsCollected - 1 && state?.status !== 'already_collected';

              return (
                <motion.div
                  key={index}
                  initial={isJustCollected ? { scale: 0.5, opacity: 0 } : false}
                  animate={isJustCollected && animationPhase !== 'loading' ? { scale: [0.8, 1.15, 1], opacity: 1 } : { opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative border-2 transition-all ${
                    isCollected
                      ? 'bg-gradient-to-br from-pink-50 to-orange-50 border-[#D96C8B] shadow-sm text-[#D96C8B]'
                      : 'bg-stone-50 border-stone-200 text-stone-300 border-dashed'
                  }`}
                >
                  {isCollected ? (
                    <>
                      <Cake size={20} className="text-[#D96C8B] mb-0.5" />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="absolute -top-1.5 -right-1.5 bg-[#D96C8B] text-white rounded-full p-0.5 shadow-xs"
                      >
                        <CheckCircle2 size={14} />
                      </motion.div>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-stone-300">{index + 1}</span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Mystery Box Unlocked Section */}
          {stampsCollected >= stampsRequired ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-gradient-to-br from-pink-500/10 via-amber-500/10 to-orange-500/10 rounded-3xl border border-orange-200/60 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-xl pointer-events-none" />

              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-3xl shadow-lg mb-3 text-white animate-bounce">
                <Gift size={32} />
              </div>

              <h3 className="font-sans font-black text-xl text-[#4A2E2A] mb-1">
                YOU DID IT! 🎉
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mb-5">
                Your loyalty card is complete. Your mystery gift is waiting for you!
              </p>

              {!scratchReward ? (
                <Button
                  onClick={handleOpenBox}
                  disabled={isOpeningBox}
                  className="w-full h-12 bg-gradient-to-r from-pink-500 via-orange-500 to-amber-500 text-white font-black text-sm tracking-wide rounded-2xl shadow-lg shadow-orange-500/25 cursor-pointer"
                >
                  {isOpeningBox ? 'Opening Mystery Box...' : 'OPEN MY MYSTERY BOX 🎁'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white/90 backdrop-blur-xs rounded-2xl border border-orange-200 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 block mb-1">Your Reward Voucher</span>
                    <h4 className="font-bold text-lg text-[#4A2E2A] mb-1">{scratchReward.reward_prizes?.name}</h4>
                    <p className="text-xs text-stone-600 mb-3">{scratchReward.reward_prizes?.description}</p>
                    
                    {/* Scratch Canvas / Revealed Coupon */}
                    <div className="relative w-full h-40 bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 flex items-center justify-center">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 text-center">
                        <PartyPopper className="text-orange-500 mb-2" size={28} />
                        <span className="text-xs font-bold text-stone-500">Redemption Code:</span>
                        <span className="font-mono font-black text-xl text-orange-600 bg-white px-3 py-1 rounded-xl shadow-xs border border-orange-200 mt-1">
                          {scratchReward.unique_redemption_code}
                        </span>
                        <span className="text-[10px] text-stone-400 mt-2">{scratchReward.reward_prizes?.redemption_rules}</span>
                      </div>

                      {!isScratched && (
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
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-center pt-2">
              <p className="text-xs text-stone-500 font-medium">
                Collect {stampsRequired - stampsCollected} more stamp{stampsRequired - stampsCollected > 1 ? 's' : ''} to unlock your mystery gift! 🎁
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
