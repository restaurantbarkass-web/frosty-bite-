import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
