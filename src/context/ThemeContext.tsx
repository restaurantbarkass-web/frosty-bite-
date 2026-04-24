import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  fontFamily: string;
  borderRadius: string;
  darkMode: boolean;
  offerText?: string;
  showOfferBanner?: boolean;
  offerLink?: string;
  offerColor?: string;
}

const defaultTheme: ThemeSettings = {
  primaryColor: '#f97316',
  secondaryColor: '#3b82f6',
  accentColor: '#10b981',
  backgroundColor: '#000000',
  surfaceColor: '#111111',
  fontFamily: 'Inter',
  borderRadius: '1rem',
  darkMode: true,
  offerText: 'Special Offer: 20% Off on your first order! 🥐',
  showOfferBanner: false,
  offerLink: '',
  offerColor: '#f97316',
};

const ThemeContext = createContext<{
  theme: ThemeSettings;
  loading: boolean;
}>({
  theme: defaultTheme,
  loading: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'theme'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as ThemeSettings;
        setTheme(data);
        applyTheme(data);
      } else {
        applyTheme(defaultTheme);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching theme settings:', error);
      applyTheme(defaultTheme);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const applyTheme = (settings: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', settings.primaryColor);
    root.style.setProperty('--secondary', settings.secondaryColor);
    root.style.setProperty('--accent', settings.accentColor);
    root.style.setProperty('--background', settings.backgroundColor);
    root.style.setProperty('--surface', settings.surfaceColor);
    root.style.setProperty('--radius', settings.borderRadius);
    root.style.setProperty('--font-family', settings.fontFamily);

    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
