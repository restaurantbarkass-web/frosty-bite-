/**
 * Sound Effects Utility using native Web Audio API.
 * Provides synthesized, zero-latency, offline UI audio feedback
 * for clicks, pops, transitions, success chimes, and error shake animations.
 */

let audioCtx: AudioContext | null = null;
let isMuted: boolean = false;

// Initialize mute setting from localStorage
try {
  const saved = localStorage.getItem('frosty_sound_muted');
  if (saved !== null) {
    isMuted = saved === 'true';
  }
} catch (e) {
  // Ignore localStorage access errors
}

/**
 * Returns an active AudioContext instance, initializing or resuming it if needed.
 */

export const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    
    return audioCtx;
  } catch (e) {
    return null;
  }
};

/**
 * Check if sound effects are muted
 */
export const isSoundMuted = (): boolean => isMuted;

/**
 * Mute or unmute sound effects
 */
export const setSoundMuted = (muted: boolean): void => {
  isMuted = muted;
  try {
    localStorage.setItem('frosty_sound_muted', String(muted));
  } catch (e) {}
};

/**
 * Toggle sound mute state
 */
export const toggleSoundMute = (): boolean => {
  setSoundMuted(!isMuted);
  return isMuted;
};

/**
 * Play crisp UI click sound (for buttons, toggles, checkboxes, tabs)
 */
export const playClickSound = (pitch = 600) => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {}
};

/**
 * Play soft organic bubble pop sound (for adding to cart, favoriting, badges)
 */
export const playPopSound = () => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);
  } catch (e) {}
};

/**
 * Play error / shake sound (for validation errors, invalid form fields)
 */
export const playErrorShakeSound = () => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // First low thud
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(130, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.08);

    // Second thud (shake bounce)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(100, now + 0.09);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.17);

    gain2.gain.setValueAtTime(0.15, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.09);
    osc2.stop(now + 0.17);
  } catch (e) {}
};

/**
 * Play success chime (for order completed, OTP verified, action success)
 */
export const playSuccessChime = () => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12); // C6

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Second tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.08); // G5
    osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.22); // G6

    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch (e) {}
};

/**
 * Play soft tab switch / filter selection tick
 */
export const playTabSound = () => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.025);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  } catch (e) {}
};

/**
 * Play whoosh / transition sweep for modals, drawers, overlays
 */
export const playWhooshSound = () => {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  } catch (e) {}
};

/**
 * Attaches a global event listener to automatically play sound effects on button clicks,
 * links, radio buttons, checkboxes, and interactive controls across the app.
 */
let isInitialized = false;

export const initGlobalSoundListeners = (): (() => void) => {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }

  isInitialized = true;

  const handleGlobalPointerDown = (event: PointerEvent | MouseEvent) => {
    // Ensure AudioContext is resumed on user gesture
    getAudioContext();

    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Check if element or any ancestor asks to skip sound
    if (target.closest('[data-sound-skip="true"]')) {
      return;
    }

    // Check custom sound attribute
    const customSoundEl = target.closest('[data-sound]') as HTMLElement | null;
    if (customSoundEl) {
      const soundType = customSoundEl.getAttribute('data-sound');
      if (soundType === 'pop') {
        playPopSound();
        return;
      }
      if (soundType === 'chime' || soundType === 'success') {
        playSuccessChime();
        return;
      }
      if (soundType === 'error' || soundType === 'shake') {
        playErrorShakeSound();
        return;
      }
      if (soundType === 'tab') {
        playTabSound();
        return;
      }
      if (soundType === 'whoosh') {
        playWhooshSound();
        return;
      }
      if (soundType === 'click') {
        playClickSound();
        return;
      }
      if (soundType === 'none') {
        return;
      }
    }

    // Identify standard interactive elements
    const interactiveEl = target.closest(
      'button, a, input[type="button"], input[type="submit"], input[type="reset"], input[type="radio"], input[type="checkbox"], [role="button"], [role="tab"]'
    ) as HTMLElement | null;

    if (interactiveEl) {
      // Check if it's a special button type like add-to-cart
      const isAddToCart = interactiveEl.textContent?.toLowerCase().includes('add') ||
        interactiveEl.id?.includes('cart') ||
        interactiveEl.className?.includes('cart');

      if (isAddToCart) {
        playPopSound();
      } else {
        playClickSound();
      }
    }
  };

  window.addEventListener('pointerdown', handleGlobalPointerDown, { capture: true, passive: true });

  return () => {
    window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
    isInitialized = false;
  };
};
