import { supabase } from '../supabase';
import { AppConfig } from '../types';

export type AlertType = 
  | 'STORE_CLOSED'
  | 'STORE_OPEN'
  | 'PICKUP_ONLY'
  | 'DELIVERY_RESTORED'
  | 'CUSTOM_ANNOUNCEMENT'
  | 'MENU_UPDATED';

export interface LiveAlertEvent {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  reason?: string;
  closureReason?: string;
  reopenDate?: string;
  reopenTime?: string;
  closureTitle?: string;
  closureMessage?: string;
  closureImage?: string;
  reopeningMessage?: string;
  badge?: string;
  timestamp: number;
  actionText?: string;
  actionLink?: string;
  source?: 'admin_toggle' | 'server_sync' | 'admin_broadcast' | 'test';
}

type AlertListener = (event: LiveAlertEvent) => void;

let listeners: AlertListener[] = [];
let realtimeChannel: any = null;
let lastKnownConfig: Partial<AppConfig> | null = null;
let hasInitializedConfig = false;

// Web Audio API Gentle Bakery Chime
export const playBakeryChime = (tone: 'celebrate' | 'notice' | 'close' = 'celebrate') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (tone === 'celebrate') {
      // Pleasant uplifting major chord chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.65);
      });
    } else if (tone === 'close') {
      // Gentle, cozy descending two-tone chime: G4 (392Hz) -> E4 (329.6Hz)
      const freqs = [440, 349.23];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0.001, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.15 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.85);
      });
    } else {
      // Gentle double ping
      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        gain.gain.setValueAtTime(0.001, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.55);
      });
    }
  } catch (e) {
    // AudioContext blocked by browser policy prior to user interaction
  }
};

// Subtle device vibration for tactile notification on mobile devices
export const triggerDeviceHaptic = (pattern: number[] = [40, 60, 40]) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {}
};

// Initialize Supabase Broadcast Channel for sub-100ms real-time delivery
const initRealtimeChannel = () => {
  if (realtimeChannel) return;

  try {
    realtimeChannel = supabase.channel('frosty_live_announcements', {
      config: { broadcast: { self: false } }
    });

    realtimeChannel
      .on('broadcast', { event: 'store_status_changed' }, ({ payload }: { payload: LiveAlertEvent }) => {
        console.log('[liveAlertService] Received live broadcast alert:', payload);
        if (payload) {
          triggerAlertListeners(payload);
        }
      })
      .subscribe((status: string) => {
        console.log('[liveAlertService] Supabase broadcast channel status:', status);
      });
  } catch (err) {
    console.warn('[liveAlertService] Failed to initialize broadcast channel:', err);
  }
};

const triggerAlertListeners = (event: LiveAlertEvent) => {
  // Play appropriate chime
  if (event.type === 'STORE_OPEN') {
    playBakeryChime('celebrate');
    triggerDeviceHaptic([50, 80, 50, 80]);
  } else if (event.type === 'STORE_CLOSED') {
    playBakeryChime('close');
    triggerDeviceHaptic([80, 100]);
  } else {
    playBakeryChime('notice');
    triggerDeviceHaptic([40, 50, 40]);
  }

  listeners.forEach(fn => {
    try {
      fn(event);
    } catch (e) {
      console.error('[liveAlertService] Error in alert listener:', e);
    }
  });
};

export const liveAlertService = {
  /**
   * Subscribe to live popup alerts (store close, store open, pickup only, admin announcements)
   */
  subscribe: (listener: AlertListener) => {
    listeners.push(listener);
    initRealtimeChannel();

    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  /**
   * Broadcast an event across all mobile phones and desktop clients immediately
   */
  broadcastLiveEvent: async (event: Omit<LiveAlertEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
    initRealtimeChannel();

    const fullEvent: LiveAlertEvent = {
      id: event.id || `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: event.timestamp || Date.now(),
      ...event
    };

    try {
      if (realtimeChannel) {
        await realtimeChannel.send({
          type: 'broadcast',
          event: 'store_status_changed',
          payload: fullEvent
        });
        console.log('[liveAlertService] Broadcast dispatched successfully:', fullEvent);
      }
    } catch (err) {
      console.warn('[liveAlertService] Broadcast failed:', err);
    }

    return fullEvent;
  },

  /**
   * Trigger an alert locally on the current device (useful for previewing or fallback)
   */
  triggerLocalAlert: (event: Omit<LiveAlertEvent, 'id' | 'timestamp'>) => {
    const fullEvent: LiveAlertEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      ...event
    };
    triggerAlertListeners(fullEvent);
    return fullEvent;
  },

  /**
   * Detect live state transitions from config updates (fallback tier)
   */
  handleConfigTransition: (newConfig: AppConfig) => {
    if (!newConfig) return;

    if (!hasInitializedConfig || !lastKnownConfig) {
      // First boot: record baseline without popping up alerts to avoid disturbing user on cold start
      lastKnownConfig = {
        isOrderingOpen: newConfig.isOrderingOpen,
        pickup_only: Boolean(newConfig.pickup_only ?? newConfig.isPickupOnly)
      };
      hasInitializedConfig = true;
      return;
    }

    const prevOrderingOpen = lastKnownConfig.isOrderingOpen;
    const newOrderingOpen = newConfig.isOrderingOpen;

    const prevPickupOnly = Boolean(lastKnownConfig.pickup_only);
    const newPickupOnly = Boolean(newConfig.pickup_only ?? newConfig.isPickupOnly);

    // Update tracked state
    lastKnownConfig = {
      isOrderingOpen: newOrderingOpen,
      pickup_only: newPickupOnly
    };

    // 1. Store Open / Store Closed transition
    if (prevOrderingOpen !== undefined && prevOrderingOpen !== newOrderingOpen) {
      if (newOrderingOpen === false) {
        triggerAlertListeners({
          id: `transition-closed-${Date.now()}`,
          type: 'STORE_CLOSED',
          title: newConfig.closureTitle || 'Taking a Little Break! ❤️',
          message: newConfig.closureMessage || newConfig.storeClosedReason || newConfig.closureReason || 'Our bakery is temporarily closed while we prepare something special for you.',
          reason: newConfig.closureReason || newConfig.storeClosedReason || 'Our bakery is temporarily closed while we prepare something special for you.',
          reopenDate: newConfig.reopenDate || '',
          reopenTime: newConfig.reopenTime || '',
          closureTitle: newConfig.closureTitle,
          closureMessage: newConfig.closureMessage,
          closureImage: newConfig.closureImage,
          badge: '🔴 Store Temporarily Closed',
          actionText: 'Continue Exploring',
          timestamp: Date.now(),
          source: 'server_sync'
        });
      } else {
        triggerAlertListeners({
          id: `transition-open-${Date.now()}`,
          type: 'STORE_OPEN',
          title: "WE ARE BACK! 🎉",
          message: newConfig.reopeningMessage || 'Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.',
          reopeningMessage: newConfig.reopeningMessage || 'Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.',
          badge: "🟢 We're Open & Baking!",
          actionText: 'Explore Fresh Treats',
          timestamp: Date.now(),
          source: 'server_sync'
        });
      }
      return;
    }

    // 2. Pickup Only transition
    if (prevPickupOnly !== undefined && prevPickupOnly !== newPickupOnly && newOrderingOpen) {
      if (newPickupOnly) {
        triggerAlertListeners({
          id: `transition-pickup-${Date.now()}`,
          type: 'PICKUP_ONLY',
          title: 'Switched to Bakery Pickup Only 🛍️',
          message: 'Due to kitchen capacity or high demand, online orders are currently accepting In-Store Pickup only. Place your order and collect fresh from our counter!',
          badge: '🛍️ Pickup Only Active',
          actionText: 'Got It, View Pickup Menu',
          timestamp: Date.now(),
          source: 'server_sync'
        });
      } else {
        triggerAlertListeners({
          id: `transition-delivery-${Date.now()}`,
          type: 'DELIVERY_RESTORED',
          title: 'Doorstep Delivery Is Back! 🚀',
          message: 'Delivery service is now fully active! Order your favorite bakery delights delivered directly to your doorstep.',
          badge: '🚀 Home Delivery Restored',
          actionText: 'Order for Delivery',
          timestamp: Date.now(),
          source: 'server_sync'
        });
      }
    }
  }
};
