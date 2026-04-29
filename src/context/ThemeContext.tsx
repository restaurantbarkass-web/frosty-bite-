import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AppTheme, ThemeMode } from '../types';

const defaultTheme: AppTheme = {
  mode: 'dark',
  primary: '#f97316',
  background: '#050505',
  text: '#ffffff',
  card: '#141414',
  isDark: true,
};

const lightTheme: AppTheme = {
  mode: 'light',
  primary: '#f97316',
  background: '#f8fafc',
  text: '#0f172a',
  card: '#ffffff',
  isDark: false,
};

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (newTheme: Partial<AppTheme>) => void;
  resetTheme: () => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
  resetTheme: () => {},
  loading: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);
  const [loading, setLoading] = useState(true);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('user-theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setThemeState(parsed);
        applyTheme(parsed);
      } catch (e) {
        console.error('Error parsing saved theme', e);
      }
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? defaultTheme : lightTheme;
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    }
    setLoading(false);
  }, []);

  // Sync with Firebase if user is logged in for theme preference
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const unsubTheme = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();
            if (userData.theme) {
              setThemeState(prev => {
                const updated = { ...prev, ...userData.theme };
                applyTheme(updated);
                return updated;
              });
            }
          }
        });
        return () => unsubTheme();
      }
    });

    return () => unsubAuth();
  }, []);

  // Sync with Global Admin Settings (for Offer Banner and Default branding)
  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'settings', 'theme'), (snapshot) => {
      if (snapshot.exists()) {
        const globalData = snapshot.data();
        setThemeState(prev => {
          const isUserCustomized = localStorage.getItem('user-theme') !== null;
          
          const updated = {
            ...prev,
            showOfferBanner: globalData.showOfferBanner,
            offerText: globalData.offerText,
            offerColor: globalData.offerColor,
            offerLink: globalData.offerLink
          };

          // If no user customization, follow global branding
          if (!isUserCustomized) {
            updated.primary = globalData.primaryColor || updated.primary;
            updated.background = globalData.backgroundColor || updated.background;
            updated.card = globalData.surfaceColor || updated.card;
            updated.mode = globalData.darkMode ? 'dark' : 'light';
            updated.isDark = globalData.darkMode;
            applyTheme(updated);
          }

          return updated;
        });
      }
    });

    return () => unsubGlobal();
  }, []);

  const applyTheme = (t: AppTheme) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--background', t.background);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--card', t.card);

    if (t.mode === 'dark' || (t.mode === 'custom' && t.isDark)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Smooth transition effect
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease';
  };

  const setTheme = async (newTheme: Partial<AppTheme>) => {
    setThemeState(prev => {
      const updated = { ...prev, ...newTheme };
      
      // Auto-detect isDark for custom theme if not provided
      if (updated.mode === 'custom' && newTheme.background) {
        // Simple luminance check
        const hex = updated.background.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        updated.isDark = luminance < 0.5;
      }

      applyTheme(updated);
      localStorage.setItem('user-theme', JSON.stringify(updated));

      // Also save to Firebase if possible
      if (auth.currentUser) {
        setDoc(doc(db, 'users', auth.currentUser.uid), { theme: updated }, { merge: true })
          .catch(err => console.error('Error saving theme to Firebase', err));
      }

      return updated;
    });
  };

  const resetTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const target = prefersDark ? defaultTheme : lightTheme;
    setTheme(target);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
