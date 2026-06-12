import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ArrowRight, Sparkles, Navigation, ChefHat, Timer } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  badge: string;
  icon: React.ReactNode;
  accent: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Fresh Baked Daily, Delivered Warm",
    subtitle: "Artisanal Luxury Bakery",
    description: "Savor the luxury of handcrafted celebration cakes, gourmet croissants, decadent pastries, and frozen delicacies prepared by our master pastry chefs every single morning.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBc-lm9Ey9mgeBv1UimokBXVn3Oahh5Jsk-YiVGss9sSL5rtkgdSQyS6k_jeYhBz1TmBkYXYm_GeINLDsVpYSMqaQG_hWoeawPGwxHYgHB3cOPvcGEonAZ7bpOpW9RbyTchz_XNrwnjQYryyzcNMpfd_vMkFSq3eX8PglP4katAqlRTkgTlbz19Uj0buYJM2rc-dcMcZNxeQA78lamH8Ll6lHkUv1HR4jTfXbNPZniDtC6aW5mFzPBntinmj68seHWMRg7LlDAFbCwQ",
    badge: "Master Patisserie",
    icon: <ChefHat className="text-orange-500 w-5 h-5" />,
    accent: "from-amber-600/20 via-[#1c0e07]/40 to-black/90"
  },
  {
    id: 2,
    title: "Observe the Culinary Journey",
    subtitle: "Real-Time Tracking & GPS",
    description: "Watch your fresh baked treats embark from our kitchen directly to your doorstep. Know exactly where our riders are with high-precision delivery updates.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDLsJPkkA9KSZPEYKdQSk4Qun1bk3T3haxts5taVpqFri1bVvGshBuoEqCMl_nBx-fb2ue7k7B9MwH_QpmAuo3ORKKoeuV__4nJxlPJRZ_CLdNrgKh0qjOiPL47HyiQkhleVEMJPV1yqIn4xaxWFW5NS-71y7Qp4SXgYsbBWacigURCOF-9g0juh9TAHAhgHDuCyRWzPCQO5BsiKZZ6uGeT8WUgOVih8fG6SfzhAWHUeusG_VXB3jdhXWb30gx1lBcPq52Tnm_RLOsu",
    badge: "Sensing Dispatch",
    icon: <Navigation className="text-orange-400 w-5 h-5" />,
    accent: "from-[#ef4444]/15 via-[#1c0e07]/40 to-black/95"
  },
  {
    id: 3,
    title: "Lightning Fast Nearby Deliveries",
    subtitle: "Express Pincode Hand-off",
    description: "Our high-velocity local delivery zones in Cuttack and Bhubaneswar guarantee your custom cakes arrive crisp, and frozen treats stay chilled.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD-ggJytrfU3pJjXeItvv0wIMeQm7yrxSqwigkXX-hjYBUurqI5_vTQ1wgUVMj5o_SnbooLM3nwcECRLUO625knPLgzdt29qzs_VEUCWQcf1F3YITXY4AI78VIjQKKTRBavhqicc_4C9CaW-Te2qIlQUtgFldHiYiVXEfJ5lpT_D0lb3kLKfcVy5EK0Pgum30MTMRmSOyk6RFmOptj6VCXGat4U_TTLeNlKeMRVEaRxjJKhQlP586uUXspRYCpzByauDrLZvSVP8fhJ",
    badge: "Rapid Hand-off",
    icon: <Timer className="text-orange-400 w-5 h-5" />,
    accent: "from-amber-500/10 via-[#1c0e07]/40 to-black/95"
  }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for previous, 1 for next

  const activeSlide = slides[currentIndex];

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Variants for sliding content animations
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      filter: "blur(6px)"
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
      filter: "blur(6px)",
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
    })
  };

  return (
    <div className="fixed inset-0 z-[950] bg-black text-white select-none overflow-hidden flex flex-col justify-between">
      
      {/* Background Image & Animated Atmospheric Overlay */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeSlide.image}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 0.45, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            src={activeSlide.image}
            alt={activeSlide.title}
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
        
        {/* Dynamic mesh gradient matching active slide's signature */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className={`absolute inset-0 bg-gradient-to-b ${activeSlide.accent} mix-blend-multiply`}
          />
        </AnimatePresence>
        
        {/* Universal Ambient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
      </div>

      {/* Top Header Row */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-8 flex items-center justify-between">
        {/* Minimal branding */}
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="bakery cake">🍰</span>
          <span className="text-xs uppercase tracking-[0.3em] font-black font-sans text-white/90">
            Frosty Bite
          </span>
        </div>

        {/* Skip button for onboarding slides */}
        <button
          onClick={onComplete}
          className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors cursor-pointer px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.08]"
          id="btn_onboarding_skip"
        >
          Skip
        </button>
      </div>

      {/* Main Slide Body Container */}
      <div className="relative z-10 flex-1 flex flex-col justify-end max-w-[480px] mx-auto px-6 pb-12 w-full">
        
        {/* Slide Carousel Frame */}
        <div className="min-h-[300px] flex flex-col justify-end space-y-6">
          
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {/* Premium Category Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10">
                {activeSlide.icon}
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                  {activeSlide.badge}
                </span>
                <Sparkles size={11} className="text-orange-500 animate-pulse ml-0.5" />
              </div>

              {/* Slide Title */}
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {activeSlide.title}
              </h2>

              {/* Slide Subheading */}
              <p className="text-orange-400 font-sans tracking-wide text-xs uppercase font-black">
                {activeSlide.subtitle}
              </p>

              {/* Slide Narrative */}
              <p className="text-zinc-300 text-sm leading-relaxed font-sans font-normal opacity-90">
                {activeSlide.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator Grid & Control Buttons Row */}
          <div className="pt-6 border-t border-white/5 flex items-center justify-between">
            
            {/* Visual Dot Array */}
            <div className="flex gap-2.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentIndex 
                      ? 'w-7 bg-orange-500' 
                      : 'w-2 bg-zinc-650 hover:bg-zinc-500'
                  }`}
                  id={`onboarding_dot_${idx}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Back & Next/Get Started Navigation Buttons */}
            <div className="flex items-center gap-3">
              {currentIndex > 0 && (
                <button
                  onClick={handlePrev}
                  className="h-12 px-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                  id="btn_onboarding_prev"
                >
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                className="h-12 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-sans font-black tracking-wide text-xs uppercase flex items-center gap-2 group cursor-pointer shadow-[0_10px_25px_rgba(249,115,22,0.25)] hover:scale-[1.03] active:scale-[0.97] transition-all"
                id="btn_onboarding_next"
              >
                <span>{currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
