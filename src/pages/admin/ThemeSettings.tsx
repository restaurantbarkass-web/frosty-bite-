import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Layout,
  Type,
  Image as ImageIcon,
  Moon,
  Sun,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  fontFamily: string;
  borderRadius: string;
  darkMode: boolean;
  offerText: string;
  showOfferBanner: boolean;
  offerLink: string;
  offerColor: string;
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#f97316',
  secondaryColor: '#18181b',
  accentColor: '#fbbf24',
  backgroundColor: '#050505',
  surfaceColor: '#121212',
  fontFamily: 'Inter',
  borderRadius: '1.5rem',
  darkMode: true,
  offerText: 'Special Offer: 20% Off on your first order! 🥐',
  showOfferBanner: false,
  offerLink: '',
  offerColor: '#f97316',
};

export const ThemeSettings: React.FC = () => {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'theme'), (docSnap) => {
      if (docSnap.exists()) {
        setTheme(docSnap.data() as ThemeConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/theme');
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'theme'), theme);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/theme');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset to default theme?')) {
      setTheme(DEFAULT_THEME);
    }
  };

  const ColorInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="space-y-2">
      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">{label}</label>
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-xl border border-white/10 shadow-lg" 
          style={{ backgroundColor: value }}
        />
        <input 
          type="text" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
        />
        <input 
          type="color" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 bg-transparent border-none cursor-pointer"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Theme & Branding</h2>
          <p className="text-zinc-500 text-sm font-medium">Customize the look and feel of your application</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 bg-white/5 text-zinc-500 px-6 py-3 rounded-2xl font-bold hover:bg-white/10 hover:text-white transition-all"
          >
            <RotateCcw size={20} />
            Reset
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all disabled:opacity-50"
          >
            {isSaving ? <Save size={20} className="animate-spin" /> : <Save size={20} />}
            Save Changes
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm"
          >
            <CheckCircle size={18} />
            <p>Theme settings saved successfully! Changes will be applied globally.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Color Palette */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Palette size={20} />
              </div>
              <h3 className="text-xl font-black text-white">Color Palette</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ColorInput 
                label="Primary Color" 
                value={theme.primaryColor} 
                onChange={(val) => setTheme({...theme, primaryColor: val})} 
              />
              <ColorInput 
                label="Secondary Color" 
                value={theme.secondaryColor} 
                onChange={(val) => setTheme({...theme, secondaryColor: val})} 
              />
              <ColorInput 
                label="Accent Color" 
                value={theme.accentColor} 
                onChange={(val) => setTheme({...theme, accentColor: val})} 
              />
              <ColorInput 
                label="Background Color" 
                value={theme.backgroundColor} 
                onChange={(val) => setTheme({...theme, backgroundColor: val})} 
              />
              <ColorInput 
                label="Surface Color" 
                value={theme.surfaceColor} 
                onChange={(val) => setTheme({...theme, surfaceColor: val})} 
              />
            </div>
          </div>

          <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Type size={20} />
              </div>
              <h3 className="text-xl font-black text-white">Typography & Layout</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Font Family</label>
                <select 
                  value={theme.fontFamily}
                  onChange={(e) => setTheme({...theme, fontFamily: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-sans"
                >
                  <option value="Inter">Inter (Default)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Poppins">Poppins</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Border Radius</label>
                <select 
                  value={theme.borderRadius}
                  onChange={(e) => setTheme({...theme, borderRadius: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
                >
                  <option value="0">None</option>
                  <option value="0.5rem">Small (8px)</option>
                  <option value="1rem">Medium (16px)</option>
                  <option value="1.5rem">Large (24px)</option>
                  <option value="2.5rem">Extra Large (40px)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Tag className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white leading-tight">Offer Banner Settings</h3>
                <p className="text-xs text-zinc-500 font-medium">Configure global promotional announcements</p>
              </div>
              <button 
                onClick={() => setTheme({...theme, showOfferBanner: !theme.showOfferBanner})}
                className={`w-12 h-6 rounded-full transition-all relative ${theme.showOfferBanner ? 'bg-orange-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme.showOfferBanner ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Announcement Text</label>
                <textarea 
                  value={theme.offerText}
                  onChange={(e) => setTheme({...theme, offerText: e.target.value})}
                  placeholder="e.g. 🎉 Get 50% Off on all Mandi Items today!"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none focus:border-orange-500 transition-all h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Banner Background Color</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border border-white/10" style={{ backgroundColor: theme.offerColor }} />
                    <input 
                      type="text" 
                      value={theme.offerColor}
                      onChange={(e) => setTheme({...theme, offerColor: e.target.value})}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                    />
                    <input 
                      type="color" 
                      value={theme.offerColor}
                      onChange={(e) => setTheme({...theme, offerColor: e.target.value})}
                      className="w-8 h-8 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Action Link (Optional)</label>
                  <input 
                    type="text" 
                    value={theme.offerLink}
                    onChange={(e) => setTheme({...theme, offerLink: e.target.value})}
                    placeholder="e.g. /menu or external URL"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-orange-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Sidebar */}
        <div className="space-y-6">
          <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-8 sticky top-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Layout size={20} />
              </div>
              <h3 className="text-xl font-black text-white">Live Preview</h3>
            </div>

            <div 
              className="w-full aspect-video rounded-3xl border border-white/10 p-0 relative overflow-hidden shadow-2xl"
              style={{ backgroundColor: theme.backgroundColor }}
            >
              {/* Preview Offer Banner */}
              <AnimatePresence>
                {theme.showOfferBanner && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    style={{ backgroundColor: theme.offerColor }}
                    className="w-full py-1.5 px-3 mb-2 flex items-center justify-center gap-2"
                  >
                    <div className="h-1.5 w-1/2 bg-white/30 rounded-full" />
                    <div className="h-2 w-4 bg-white/20 rounded-full" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: theme.primaryColor }} />
                  <div className="flex gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/10" />
                    <div className="w-4 h-4 rounded-full bg-white/10" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-white/10 rounded-full" />
                  <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                </div>

                <div 
                  className="p-4 rounded-2xl border border-white/5"
                  style={{ backgroundColor: theme.surfaceColor, borderRadius: theme.borderRadius }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-full bg-white/10 rounded-full" />
                      <div className="h-1 w-2/3 bg-white/5 rounded-full" />
                    </div>
                  </div>
                </div>

                <button 
                  className="w-full py-2 rounded-xl font-black text-[8px] uppercase tracking-widest text-white shadow-lg"
                  style={{ backgroundColor: theme.primaryColor, borderRadius: theme.borderRadius }}
                >
                  Action Button
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  {theme.darkMode ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-orange-400" />}
                  <span className="text-xs font-bold text-white">Dark Mode</span>
                </div>
                <button 
                  onClick={() => setTheme({...theme, darkMode: !theme.darkMode})}
                  className={`w-12 h-6 rounded-full transition-all relative ${theme.darkMode ? 'bg-orange-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme.darkMode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-start gap-3 text-orange-400 text-[10px] leading-relaxed">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>Note: Some theme changes may require a page refresh to be fully applied across all components.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
