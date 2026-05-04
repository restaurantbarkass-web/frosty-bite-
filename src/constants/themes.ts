export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    border: string;
    primary: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'dark-premium',
    name: 'Dark Premium',
    colors: {
      background: '#0a0a0a',
      card: '#161616',
      primary: '#ff6b26',
      accent: '#ff8a53',
      textPrimary: '#ffffff',
      textSecondary: '#a1a1aa',
      border: 'rgba(255, 255, 255, 0.08)',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    colors: {
      background: '#020617',
      card: '#0f172a',
      primary: '#38bdf8',
      accent: '#7dd3fc',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      border: 'rgba(56, 189, 248, 0.15)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      background: '#180a0a',
      card: '#241414',
      primary: '#f43f5e',
      accent: '#fb7185',
      textPrimary: '#fff1f2',
      textSecondary: '#fda4af',
      border: 'rgba(244, 63, 94, 0.15)',
    },
  },
  {
    id: 'light-minimal',
    name: 'Light Minimal',
    colors: {
      background: '#ffffff',
      card: '#f8fafc',
      primary: '#0f172a',
      accent: '#334155',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      border: 'rgba(15, 23, 42, 0.08)',
    },
  },
];
