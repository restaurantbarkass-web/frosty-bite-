import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, Palette, RotateCcw, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ThemeMode } from '../types';
import { cn } from '../lib/utils';

interface ThemeSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, resetTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>(theme.mode === 'custom' ? 'custom' : 'presets');

  const presets: { mode: ThemeMode; label: string; icon: any; color: string }[] = [
    { mode: 'light', label: 'Light Mode', icon: Sun, color: '#f97316' },
    { mode: 'dark', label: 'Dark Mode', icon: Moon, color: '#f97316' },
  ];

  const handleModeChange = (mode: ThemeMode) => {
    if (mode === 'light') {
      setTheme({
        mode: 'light',
        primary: '#f97316',
        background: '#f8fafc',
        text: '#0f172a',
        card: '#ffffff',
        isDark: false,
      });
    } else if (mode === 'dark') {
      setTheme({
        mode: 'dark',
        primary: '#f97316',
        background: '#050505',
        text: '#ffffff',
        card: '#141414',
        isDark: true,
      });
    } else {
      setTheme({ mode: 'custom' });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-zinc-950 border-l border-white/5 z-[101] shadow-2xl overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: theme.card, color: theme.text }}
          >
            <div className="p-8 space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Theme Settings</h2>
                  <p className="text-xs font-semibold opacity-50 tracking-widest uppercase mt-1">Personalize your experience</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-1 bg-black/20 rounded-2xl border border-white/5">
                <button
                  onClick={() => setActiveTab('presets')}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    activeTab === 'presets' ? "bg-primary text-white shadow-lg" : "text-muted hover:text-white"
                  )}
                >
                  Presets
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    activeTab === 'custom' ? "bg-primary text-white shadow-lg" : "text-muted hover:text-white"
                  )}
                >
                  Custom
                </button>
              </div>

              {/* Presets Grid */}
              {activeTab === 'presets' && (
                <div className="grid grid-cols-2 gap-4">
                  {presets.map((p) => (
                    <button
                      key={p.mode}
                      onClick={() => handleModeChange(p.mode)}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 group",
                        theme.mode === p.mode 
                          ? "border-primary bg-primary/10" 
                          : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                        theme.mode === p.mode ? "bg-primary text-white" : "bg-white/5 text-muted"
                      )}>
                        <p.icon size={24} />
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em]",
                        theme.mode === p.mode ? "text-primary" : "text-muted"
                      )}>
                        {p.label}
                      </span>
                      {theme.mode === p.mode && (
                        <div className="absolute top-4 right-4">
                          <Check size={14} className="text-primary" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Theme Controls */}
              {activeTab === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-6">
                    <ColorPicker 
                      label="Primary Color" 
                      value={theme.primary} 
                      onChange={(val) => setTheme({ primary: val, mode: 'custom' })} 
                    />
                    <ColorPicker 
                      label="Background Color" 
                      value={theme.background} 
                      onChange={(val) => setTheme({ background: val, mode: 'custom' })} 
                    />
                    <ColorPicker 
                      label="Card Surface" 
                      value={theme.card} 
                      onChange={(val) => setTheme({ card: val, mode: 'custom' })} 
                    />
                    <ColorPicker 
                      label="Text Color" 
                      value={theme.text} 
                      onChange={(val) => setTheme({ text: val, mode: 'custom' })} 
                    />
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 text-[10px] font-bold text-primary leading-relaxed">
                    <Palette size={16} className="shrink-0" />
                    <p>Dark/Light mode is automatically detected based on your background choice to ensure UI contrast.</p>
                  </div>
                </motion.div>
              )}

              {/* Bottom Actions */}
              <div className="pt-8 mt-auto border-t border-white/5 space-y-4">
                <button
                  onClick={resetTheme}
                  className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-muted hover:text-white flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all"
                >
                  <RotateCcw size={16} />
                  Reset to Default
                </button>
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                    <Palette size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Sync Active</p>
                    <p className="text-[10px] font-medium text-orange-400/60 mt-0.5">Your theme is saved to your profile and across devices.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{label}</label>
      <span className="text-[10px] font-mono text-zinc-500">{value}</span>
    </div>
    <div className="flex gap-2">
      <div 
        className="w-12 h-12 rounded-xl border border-white/10 shadow-inner"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-12 bg-black/20 border border-white/5 rounded-xl cursor-pointer p-1"
      />
    </div>
  </div>
);
