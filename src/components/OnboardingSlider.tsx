import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  ChefHat, 
  Navigation, 
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { UNIVERSAL_LOGO_URL } from '../constants/logo';

export interface OnboardingSliderProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface SlideData {
  id: number;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  icon: React.ReactNode;
  accentBg: string;
  pillColor: string;
  primaryActionLabel?: string;
}

const ONBOARDING_SLIDES: SlideData[] = [
  {
    id: 1,
    tag: "Master Patisserie",
    title: "Handcrafted Luxury, Baked Fresh Daily",
    subtitle: "Pure ingredients, master craftsmanship",
    description: "Indulge in artisanal celebration cakes, flaky French croissants, and velvety desserts prepared from scratch by master pastry chefs every single morning.",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBc-lm9Ey9mgeBv1UimokBXVn3Oahh5Jsk-YiVGss9sSL5rtkgdSQyS6k_jeYhBz1TmBkYXYm_GeINLDsVpYSMqaQG_hWoeawPGwxHYgHB3cOPvcGEonAZ7bpOpW9RbyTchz_XNrwnjQYryyzcNMpfd_vMkFSq3eX8PglP4katAqlRTkgTlbz19Uj0buYJM2rc-dcMcZNxeQA78lamH8Ll6lHkUv1HR4jTfXbNPZniDtC6aW5mFzPBntinmj68seHWMRg7LlDAFbCwQ",
    icon: <ChefHat className="w-5 h-5 text-[#a83255]" />,
    accentBg: "from-[#ffd9df]/30 via-[#fbf9f5] to-[#fbf9f5]",
    pillColor: "bg-[#ffd9df] text-[#88183e]"
  },
  {
    id: 2,
    tag: "Live Kitchen to Doorstep",
    title: "Real-Time Tracking From Oven to Door",
    subtitle: "Live GPS & precision dispatch",
    description: "Follow your handcrafted treats from oven dispatch to your doorstep. Live rider tracking and instant notifications keep you informed at every milestone.",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDLsJPkkA9KSZPEYKdQSk4Qun1bk3T3haxts5taVpqFri1bVvGshBuoEqCMl_nBx-fb2ue7k7B9MwH_QpmAuo3ORKKoeuV__4nJxlPJRZ_CLdNrgKh0qjOiPL47HyiQkhleVEMJPV1yqIn4xaxWFW5NS-71y7Qp4SXgYsbBWacigURCOF-9g0juh9TAHAhgHDuCyRWzPCQO5BsiKZZ6uGeT8WUgOVih8fG6SfzhAWHUeusG_VXB3jdhXWb30gx1lBcPq52Tnm_RLOsu",
    icon: <Navigation className="w-5 h-5 text-[#904d00]" />,
    accentBg: "from-[#ffdcc3]/30 via-[#fbf9f5] to-[#fbf9f5]",
    pillColor: "bg-[#ffdcc3] text-[#6e3900]"
  },
  {
    id: 3,
    tag: "Instant Ordering",
    title: "Fast Checkout & Chilled Delivery",
    subtitle: "Google, Phone OTP or Instant Guest",
    description: "Checkout seamlessly with 1-click Google, 6-digit SMS OTP, or zero-password Guest mode. Temperature-regulated packaging preserves pristine flavor.",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD-ggJytrfU3pJjXeItvv0wIMeQm7yrxSqwigkXX-hjYBUurqI5_vTQ1wgUVMj5o_SnbooLM3nwcECRLUO625knPLgzdt29qzs_VEUCWQcf1F3YITXY4AI78VIjQKKTRBavhqicc_4C9CaW-Te2qIlQUtgFldHiYiVXEfJ5lpT_D0lb3kLKfcVy5EK0Pgum30MTMRmSOyk6RFmOptj6VCXGat4U_TTLeNlKeMRVEaRxjJKhQlP586uUXspRYCpzByauDrLZvSVP8fhJ",
    icon: <ShoppingBag className="w-5 h-5 text-[#795745]" />,
    accentBg: "from-[#fed1b9]/30 via-[#fbf9f5] to-[#fbf9f5]",
    pillColor: "bg-[#fed1b9] text-[#5e402f]",
    primaryActionLabel: "Get Started & Sign In"
  }
];

export const OnboardingSlider: React.FC<OnboardingSliderProps> = ({ onComplete, onSkip }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const activeSlide = ONBOARDING_SLIDES[currentSlideIndex];
  const isLastSlide = currentSlideIndex === ONBOARDING_SLIDES.length - 1;

  const handleNext = () => {
    if (currentSlideIndex < ONBOARDING_SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setDirection(-1);
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.96
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
      }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 80 : -80,
      opacity: 0,
      scale: 0.96,
      transition: {
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
      }
    })
  };

  return (
    <div className="fixed inset-0 z-[900] bg-[#fbf9f5] text-[#1b1c1a] flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Ambient Patisserie Lighting */}
      <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full bg-[#ffd9df]/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full bg-[#ffdbca]/30 blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <header className="relative z-20 w-full px-5 pt-5 flex items-center justify-between">
        {/* Frosty Bite Branding */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center p-1 border border-[#e4e2de]">
            <img 
              src={UNIVERSAL_LOGO_URL} 
              alt="Frosty Bite" 
              className="w-full h-full object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-sm font-bold text-[#1b1c1a] font-serif tracking-tight">Frosty Bite</span>
        </div>

        {/* Skip Action Button */}
        <button
          onClick={handleSkip}
          className="text-[11px] font-semibold uppercase text-[#795745] px-3 py-1.5 rounded-full bg-white/50 border border-[#e4e2de] active:scale-95 transition-all cursor-pointer"
        >
          Skip
        </button>
      </header>

      {/* Main Slide Carousel Area */}
      <main className="relative z-10 flex-1 w-full px-5 flex flex-col justify-center items-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -45) {
                handleNext();
              } else if (info.offset.x > 45) {
                handlePrev();
              }
            }}
            className="w-full flex flex-col items-center text-center cursor-grab active:cursor-grabbing"
          >
            {/* Visual Card */}
            <div className="relative w-full max-w-[280px] aspect-square rounded-[32px] bg-white p-2 shadow-lg mb-5 overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-tr ${activeSlide.accentBg} opacity-60`} />
              
              <img
                src={activeSlide.imageUrl}
                alt={activeSlide.title}
                className="w-full h-full object-cover rounded-[24px] relative z-10"
                referrerPolicy="no-referrer"
              />

              {/* Floating Pill Emblem */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm text-[10px] font-bold">
                {activeSlide.icon}
                <span>{activeSlide.tag}</span>
              </div>
            </div>

            {/* Content */}
            <h2 className="text-xl font-bold text-[#1b1c1a] font-serif leading-tight mb-2 max-w-[280px]">
              {activeSlide.title}
            </h2>
            <p className="text-xs text-[#564145] leading-relaxed max-w-[280px]">
              {activeSlide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Controls */}
      <footer className="relative z-20 w-full px-5 pb-8 pt-2 flex flex-col gap-4">
        
        {/* Slide Progress Indicators */}
        <div className="flex items-center justify-center gap-1.5">
          {ONBOARDING_SLIDES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentSlideIndex ? 'w-6 bg-[#a83255]' : 'w-1.5 bg-[#dbdad6]'
              }`}
            />
          ))}
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-3 w-full">
          {currentSlideIndex > 0 && (
            <button
              onClick={handlePrev}
              className="w-12 h-12 rounded-xl bg-white border border-[#e4e2de] text-[#795745] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <button
            onClick={handleNext}
            className="flex-1 h-12 rounded-xl bg-[#a83255] text-white font-semibold text-sm active:scale-[0.98] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{isLastSlide ? (activeSlide.primaryActionLabel || "Get Started") : "Continue"}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
};
