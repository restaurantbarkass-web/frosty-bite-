import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Haptic vibration utility using the HTML5 Vibration API
export const triggerHaptic = (pattern: number | number[] = 10) => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration failed:', e);
    }
  }
};

export const haptic = {
  light: () => triggerHaptic(15),
  medium: () => triggerHaptic(35),
  success: () => triggerHaptic([20, 60, 20]),
  error: () => triggerHaptic([60, 120, 60]),
  checkout: () => triggerHaptic([30, 70, 30, 70, 40])
};

// Smooth scroll utility using custom events (handled by Lenis in App.tsx)
export const smoothScroll = {
  toTop: () => {
    window.dispatchEvent(new CustomEvent('scroll-to-top'));
  },
  toElement: (target: string | HTMLElement, options?: { offset?: number; duration?: number }) => {
    window.dispatchEvent(new CustomEvent('scroll-to-element', { 
      detail: { target, ...options } 
    }));
  }
};
