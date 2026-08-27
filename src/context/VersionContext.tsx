import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getAppVersion, 
  VERSION_STORAGE_KEY, 
  VERSION_BROADCAST_CHANNEL, 
  CURRENT_RELEASE_CONFIG, 
  AppReleaseInfo 
} from '../config/version';

interface VersionContextType {
  currentVersion: string;
  previousVersion: string | null;
  isUpdateAvailable: boolean;
  releaseInfo: AppReleaseInfo;
  acknowledgeUpdate: () => void;
  triggerTestUpdate: () => void;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentVersion = useMemo(() => getAppVersion(), []);
  const [previousVersion, setPreviousVersion] = useState<string | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [releaseInfo] = useState<AppReleaseInfo>(CURRENT_RELEASE_CONFIG);

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      // Check for URL query param to force test the screen in preview / dev
      const urlParams = new URLSearchParams(window.location.search);
      const forceTest = urlParams.get('testUpdate') === 'true';

      const seenVersion = localStorage.getItem(VERSION_STORAGE_KEY);

      if (forceTest) {
        console.log('[AppVersionManager] Test update mode triggered via ?testUpdate=true');
        setPreviousVersion(seenVersion || 'v-test-old');
        setIsUpdateAvailable(true);
        return;
      }

      if (!seenVersion) {
        // First-time user: Initialize stored version silently so new visitors don't see an "update" message
        console.log('[AppVersionManager] First-time visitor detected. Initializing version:', currentVersion);
        localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
        setPreviousVersion(null);
        setIsUpdateAvailable(false);
      } else if (seenVersion !== currentVersion) {
        // Existing user received a genuinely new deployed version
        console.log(`[AppVersionManager] New deployment detected: ${seenVersion} -> ${currentVersion}`);
        setPreviousVersion(seenVersion);
        setIsUpdateAvailable(true);
      } else {
        // Already up-to-date
        setPreviousVersion(seenVersion);
        setIsUpdateAvailable(false);
      }
    } catch (err) {
      console.warn('[AppVersionManager] Storage access error:', err);
      setIsUpdateAvailable(false);
    }
  }, [currentVersion]);

  // Acknowledge the current version and persist to localStorage
  const acknowledgeUpdate = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(VERSION_STORAGE_KEY, currentVersion);
      }

      // Broadcast acknowledgement to any other open tabs
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel(VERSION_BROADCAST_CHANNEL);
          channel.postMessage({ type: 'VERSION_ACKNOWLEDGED', version: currentVersion });
          channel.close();
        } catch {
          // BroadcastChannel fallback ignore
        }
      }
    } catch (err) {
      console.warn('[AppVersionManager] Failed to persist acknowledged version:', err);
    }

    setIsUpdateAvailable(false);
  }, [currentVersion]);

  // Manually trigger test update for demonstration / QA
  const triggerTestUpdate = useCallback(() => {
    setPreviousVersion('v-preview-old');
    setIsUpdateAvailable(true);
  }, []);

  // Multi-tab synchronization listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Listen for storage event across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === VERSION_STORAGE_KEY && e.newValue === currentVersion) {
        setIsUpdateAvailable(false);
      }
    };

    // 2. Listen for BroadcastChannel messages across tabs
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(VERSION_BROADCAST_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === 'VERSION_ACKNOWLEDGED' && event.data?.version === currentVersion) {
            setIsUpdateAvailable(false);
          }
        };
      } catch {
        // BroadcastChannel not available
      }
    }

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore
        }
      }
    };
  }, [currentVersion]);

  const value = useMemo(() => ({
    currentVersion,
    previousVersion,
    isUpdateAvailable,
    releaseInfo,
    acknowledgeUpdate,
    triggerTestUpdate
  }), [currentVersion, previousVersion, isUpdateAvailable, releaseInfo, acknowledgeUpdate, triggerTestUpdate]);

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = () => {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
};
