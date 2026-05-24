import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Particle {
  id: string;
  image: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const FlyingCartOverlay: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const handleFly = (e: any) => {
      const { startX, startY, image } = e.detail || {};
      if (startX === undefined || startY === undefined) return;

      const cartBtn = document.getElementById('cart-btn-desktop') || document.getElementById('cart-btn-mobile');
      const rect = cartBtn?.getBoundingClientRect();
      
      // Calculate terminal coordinates dynamically
      const endX = rect ? rect.left + rect.width / 2 : window.innerWidth - 60;
      const endY = rect ? rect.top + rect.height / 2 : 40;

      const id = Math.random().toString(36).substring(2, 9) + Date.now();
      
      setParticles(prev => [
        ...prev,
        {
          id,
          image: image || 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg',
          startX,
          startY,
          endX,
          endY
        }
      ]);
    };

    window.addEventListener('add-to-cart-fly' as any, handleFly);
    return () => {
      window.removeEventListener('add-to-cart-fly' as any, handleFly);
    };
  }, []);

  const handleAnimationComplete = (id: string) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => {
          // Define a beautiful arc curve for the particle translation
          return (
            <motion.div
              key={p.id}
              initial={{
                x: p.startX - 24,
                y: p.startY - 24,
                scale: 0.6,
                rotate: 0,
                opacity: 0
              }}
              animate={{
                x: [p.startX - 24, (p.startX + p.endX) / 2, p.endX - 16],
                y: [p.startY - 24, Math.min(p.startY, p.endY) - 120, p.endY - 16], // Elegant parabolic arc arching upward!
                scale: [0.6, 1.4, 0.3],
                rotate: [0, 180, 360],
                opacity: [0, 1, 1, 0.7, 0]
              }}
              exit={{
                opacity: 0
              }}
              transition={{
                duration: 0.85,
                ease: [0.25, 1, 0.5, 1] // Super smooth deceleration profile
              }}
              onAnimationComplete={() => handleAnimationComplete(p.id)}
              className="fixed w-12 h-12 rounded-full border-2 border-primary bg-zinc-950 p-1 flex items-center justify-center shadow-[0_0_25px_rgba(249,115,22,0.4)]"
            >
              <img
                src={p.image}
                alt="baked item"
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
