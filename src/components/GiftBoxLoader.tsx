import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import gsap from 'gsap';

export const GiftBoxLoader: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) {
      gsap.to(boxRef.current, {
        y: -20,
        rotate: 15,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
        ease: "power1.inOut"
      });
      
      gsap.to(boxRef.current, {
        scale: 1.15,
        duration: 0.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="relative">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
        
        <div ref={boxRef} className="relative z-10 w-20 h-20 bg-gradient-to-br from-primary to-orange-600 rounded-3xl flex items-center justify-center shadow-[0_20px_50px_rgba(255,82,0,0.4)] border border-white/20">
          <Gift size={40} className="text-white drop-shadow-lg" />
        </div>
      </div>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.4, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-8 text-[10px] font-black uppercase tracking-[0.6em] text-white/50"
      >
        Unlocking Vault
      </motion.p>
    </div>
  );
};
