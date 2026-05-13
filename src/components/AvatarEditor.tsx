import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import { X, RefreshCw, Check, Undo, Redo, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';

interface AvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (avatarConfig: any) => void;
  initialConfig?: any;
}

const CATEGORIES = [
  { id: 'hair', label: 'Hair', options: [
    'long01', 'long02', 'long03', 'long04', 'long05', 'long06', 'long07', 'long08', 'long09', 'long10',
    'short01', 'short02', 'short03', 'short04', 'short05', 'short06', 'short07', 'short08', 'short09', 'short10'
  ] },
  { id: 'hairColor', label: 'Hair Color', options: ['0e0e0e', '4a312c', '6a4e35', 'a55728', 'b58143', 'c93305', 'd5b08b', 'e0b48d', 'f0c05a'] },
  { id: 'eyes', label: 'Eyes', options: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10', 'variant11', 'variant12', 'variant13', 'variant14', 'variant15'] },
  { id: 'mouth', label: 'Mouth', options: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10', 'variant11', 'variant12', 'variant13', 'variant14', 'variant15', 'variant16'] },
  { id: 'shirt', label: 'Outfit', options: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10'] },
  { id: 'hat', label: 'Headwear', options: ['none', 'variant01', 'variant02', 'variant03', 'variant04', 'variant05'] },
  { id: 'hatColor', label: 'Hat Color', options: ['ffffff', 'fbcfe8', '4a312c', 'f97316', '000000'] },
  { id: 'skinColor', label: 'Skin', options: ['f2d3b1', 'ebbe9d', 'cfaba4', 'e0b48d', '764639', 'b67d50', '9c5c3c', 'b16a40'] },
  { id: 'features', label: 'Face', options: ['none', 'mustache', 'blush', 'birthmark', 'freckles'] },
  { id: 'bakeryTheme', label: 'Props', options: ['none', 'croissant', 'cupcake', 'chef_hat', 'coffee_mug', 'whisk', 'cake_slice'] },
];

const BAKERY_PROPS: any = {
  croissant: '🥐',
  cupcake: '🧁',
  chef_hat: '👩‍🍳',
  coffee_mug: '☕',
  whisk: '🥣',
  cake_slice: '🍰'
};

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialConfig 
}) => {
  const [step, setStep] = useState<'welcome' | 'style' | 'loading' | 'editor' | 'gallery'>(initialConfig?.seed ? 'editor' : 'welcome');
  const [seed, setSeed] = useState(initialConfig?.seed || Math.random().toString());
  const [config, setConfig] = useState<any>(initialConfig?.options || {});
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [aiUsage, setAiUsage] = useState(initialConfig?.aiUsageStats || { count: 0, month: new Date().getMonth() });

  const galleryPreviews = useMemo(() => {
    return [
      createAvatar(adventurer, { seed: '1', hair: ['long01'], hairColor: ['d5b08b'], mouth: ['variant01'] } as any).toString(),
      createAvatar(adventurer, { seed: '2', hair: ['short05'], hairColor: ['4a312c'], eyes: ['variant02'] } as any).toString(),
      createAvatar(adventurer, { seed: '3', hair: ['long05'], hairColor: ['a55728'], features: ['blush'] } as any).toString(),
    ];
  }, []);

  const scenes = useMemo(() => [
    { id: 'kitchen', label: 'Chef Kitchen', bg: 'bg-orange-500/10', icon: '👨‍🍳', text: 'Master of Crusts' },
    { id: 'patisserie', label: 'Elegance Cafe', bg: 'bg-pink-500/10', icon: '🍰', text: 'Sweet Perfection' },
    { id: 'roastery', label: 'Coffee Loft', bg: 'bg-bakery-chocolate/20', icon: '☕', text: 'Bold & Aromatic' },
  ], []);

  const avatarSvg = useMemo(() => {
    const dicebearConfig = { ...config };
    delete dicebearConfig.bakeryTheme;

    return createAvatar(adventurer, {
      seed,
      ...dicebearConfig,
    }).toString();
  }, [seed, config]);

  const handleStyleSelect = (style: string) => {
    setStep('loading');
    
    // Apply baseline styles based on selection
    const newConfig: any = {};
    if (style === 'feminine') {
      newConfig.hair = ['long01'];
      newConfig.hairColor = ['d5b08b'];
      newConfig.skinColor = ['f2d3b1'];
      newConfig.shirt = ['variant01'];
      newConfig.bakeryTheme = ['cupcake'];
    } else if (style === 'masculine') {
      newConfig.hair = ['short05'];
      newConfig.hairColor = ['4a312c'];
      newConfig.skinColor = ['ebbe9d'];
      newConfig.shirt = ['variant03'];
      newConfig.bakeryTheme = ['croissant'];
    } else if (style === 'neutral') {
      newConfig.hair = ['short10'];
      newConfig.hairColor = ['6a4e35'];
      newConfig.skinColor = ['cfaba4'];
      newConfig.shirt = ['variant05'];
      newConfig.bakeryTheme = ['coffee_mug'];
    } else {
      // Random
      setSeed(Math.random().toString());
    }

    setConfig(newConfig);

    // Assembly animation delay
    setTimeout(() => {
      setStep('editor');
    }, 2500);
  };

  const handleRandomize = () => {
    setSeed(Math.random().toString());
    setConfig({});
  };

  const handleOptionSelect = (categoryId: string, option: string) => {
    setConfig((prev: any) => ({
      ...prev,
      [categoryId]: [option]
    }));
  };

  const currentProp = config.bakeryTheme?.[0] || 'none';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#4A312C]/40 backdrop-blur-md"
      />
      
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full md:max-w-md h-full md:h-auto bg-[#FFFBF2] md:rounded-[3rem] p-10 md:p-14 text-center overflow-hidden shadow-2xl flex flex-col items-center justify-center"
          >
            <div className="absolute top-0 right-0 p-8">
               <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}>
                 <Sparkles size={24} className="text-bakery-chocolate opacity-20" />
               </motion.div>
            </div>

            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="mb-8">
                 <div className="w-12 h-12 bg-bakery-pink/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl">🧁</span>
                 </div>
                 <h1 className="text-4xl font-black text-bakery-chocolate tracking-tight mb-2">
                   Create Your<br/>Bakery Avatar
                 </h1>
                 <p className="text-bakery-chocolate/60 text-sm font-medium">
                   Let's build your cozy<br/>bakery identity ✨
                 </p>
              </div>

              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative w-64 h-64 bg-white/50 rounded-full border-4 border-white shadow-xl overflow-hidden mb-12 flex items-center justify-center"
              >
                 <div 
                   className="w-full h-full scale-110 translate-y-4"
                   dangerouslySetInnerHTML={{ __html: createAvatar(adventurer, { seed: 'welcome', hair: ['long01'], hairColor: ['4a312c'], eyes: ['variant12'], mouth: ['variant01'], hat: ['variant01'], hatColor: ['fbcfe8'] } as any).toString() }}
                 />
                 <div className="absolute top-1/2 right-4 text-4xl animate-bounce-slow">
                    🥣
                 </div>
              </motion.div>
              
              <Button 
                variant="primary" 
                onClick={() => setStep('style')}
                className="w-full rounded-2xl h-16 bg-[#E8928A] hover:bg-[#D67C74] text-white font-bold text-base shadow-lg shadow-[#E8928A]/30"
              >
                Get Started
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'style' && (
          <motion.div
            key="style"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-auto bg-[#FFFBF2] md:rounded-[3rem] p-8 md:p-12 overflow-hidden flex flex-col"
          >
            <div className="mb-10 text-center">
              <h3 className="text-3xl font-black text-bakery-chocolate tracking-tight mb-2">
                Choose Your<br/>Avatar Style
              </h3>
              <p className="text-bakery-chocolate/50 text-sm font-medium">
                Pick your style, we'll<br/>recommend the best for you
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 flex-1">
              {[
                { id: 'feminine', label: 'Feminine', icon: createAvatar(adventurer, { seed: 'fem_base', hair: ['long01'], hairColor: ['4a312c'] } as any).toString() },
                { id: 'masculine', label: 'Masculine', icon: createAvatar(adventurer, { seed: 'mas_base', hair: ['short05'], hairColor: ['4a312c'] } as any).toString() },
                { id: 'neutral', label: 'Neutral', icon: createAvatar(adventurer, { seed: 'neu_base', hair: ['short10'], hairColor: ['4a312c'] } as any).toString() },
                { id: 'random', label: 'Random', icon: '🎲' }
              ].map((style, idx) => (
                <motion.button
                  key={style.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleStyleSelect(style.id)}
                  className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl border border-bakery-chocolate/5 shadow-sm group"
                >
                  <div className="w-24 h-24 rounded-2xl bg-bakery-cream overflow-hidden mb-3 relative flex items-center justify-center">
                    {style.id === 'random' ? (
                       <span className="text-4xl">{style.icon}</span>
                    ) : (
                       <div className="w-full h-full scale-125 translate-y-2" dangerouslySetInnerHTML={{ __html: style.icon }} />
                    )}
                  </div>
                  <span className="text-xs font-bold text-bakery-chocolate">{style.label}</span>
                </motion.button>
              ))}
            </div>
            
            <Button 
                variant="primary" 
                onClick={() => setStep('welcome')}
                className="mt-12 w-full rounded-2xl h-16 bg-bakery-chocolate hover:bg-bakery-chocolate/90 text-white font-bold text-base shadow-lg"
              >
                Continue
            </Button>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-auto bg-[#FFFBF2] md:rounded-[3rem] flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-8 rounded-full border-t-2 border-bakery-chocolate/20"
              />
              <div className="relative w-48 h-48 bg-white rounded-full p-4 border border-bakery-chocolate/5 flex items-center justify-center overflow-hidden shadow-xl">
                 <div className="w-full h-full scale-110 translate-y-4" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
              </div>
            </div>
            <h3 className="text-2xl font-black text-bakery-chocolate tracking-tight animate-pulse">
              Baking your identity...
            </h3>
          </motion.div>
        )}

        {step === 'editor' && (
          <motion.div 
            key="editor"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-[90vh] bg-[#FFFBF2] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-bakery-chocolate/5 bg-white/50 backdrop-blur-md">
              <button 
                onClick={() => setStep('style')}
                className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-bakery-chocolate/40 hover:text-bakery-chocolate border border-bakery-chocolate/5"
              >
                <Undo size={18} />
              </button>
              <h3 className="text-lg font-black text-bakery-chocolate tracking-tight">Your Avatar</h3>
              <button 
                onClick={() => setStep('gallery')}
                className="w-10 h-10 rounded-2xl bg-bakery-chocolate flex items-center justify-center text-white shadow-md active:scale-90 transition-transform"
              >
                <Check size={18} />
              </button>
            </div>

            {/* Preview Section */}
            <div className="relative h-[40%] flex items-center justify-center bg-gradient-to-b from-white to-bakery-cream overflow-hidden">
               <div className="absolute top-4 left-6 flex flex-col gap-3">
                  <button onClick={handleRandomize} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-bakery-chocolate/40 hover:text-bakery-chocolate transition-colors border border-bakery-chocolate/5">
                    <RefreshCw size={18} />
                  </button>
               </div>
               <div className="absolute top-4 right-6 flex flex-col gap-3">
                   <div className="w-10 h-10 rounded-full bg-bakery-pink/20 flex items-center justify-center">
                    <Sparkles size={18} className="text-[#E8928A]" />
                   </div>
               </div>

               <motion.div 
                 animate={{ y: [0, -8, 0] }}
                 transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                 className="relative w-56 h-56 bg-white rounded-full border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center"
               >
                  <div className="w-full h-full scale-125 translate-y-6" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
                  {currentProp !== 'none' && (
                    <motion.div 
                      key={currentProp}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute bottom-4 right-4 text-6xl drop-shadow-lg"
                    >
                      {BAKERY_PROPS[currentProp]}
                    </motion.div>
                  )}
               </motion.div>
            </div>

            {/* Controls */}
            <div className="flex-1 flex flex-col bg-white rounded-t-[3rem] shadow-[0_-20px_40px_rgba(74,49,44,0.05)] overflow-hidden">
               {/* Categories */}
               <div className="flex overflow-x-auto scrollbar-hide py-6 px-8 gap-4 bg-white border-b border-bakery-chocolate/5">
                {CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 min-w-[70px] transition-all duration-300",
                      activeCategory === cat.id ? "scale-105" : "opacity-40"
                    )}
                  >
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm border border-bakery-chocolate/5",
                      activeCategory === cat.id ? "bg-[#E8928A] text-white shadow-lg shadow-[#E8928A]/20" : "bg-bakery-beige text-bakery-chocolate"
                    )}>
                      {cat.id === 'bakeryTheme' ? '🥨' : 
                       cat.id === 'shirt' ? '👕' : 
                       cat.id === 'hair' ? '💇' : 
                       cat.id === 'hairColor' ? '🎨' :
                       cat.id === 'hat' ? '👒' :
                       cat.id === 'eyes' ? '👁️' :
                       cat.id === 'mouth' ? '👄' :
                       cat.id === 'skinColor' ? '👤' :
                       '✨'}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-bakery-chocolate truncate max-w-[80px]">{cat.label}</span>
                  </button>
                ))}
              </div>

               {/* Grid */}
               <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-bakery-cream/30">
                  <div className="grid grid-cols-4 gap-3">
                    {activeCategory === 'bakeryTheme' ? (
                       CATEGORIES.find(c => c.id === 'bakeryTheme')?.options.map((option) => (
                          <button
                            key={option}
                            onClick={() => handleOptionSelect('bakeryTheme', option)}
                            className={cn(
                              "aspect-square rounded-2xl border-2 transition-all flex items-center justify-center text-2xl shadow-sm",
                              config.bakeryTheme?.[0] === option ? "border-[#E8928A] bg-white scale-105" : "border-bakery-chocolate/5 bg-white hover:border-bakery-chocolate/20"
                            )}
                          >
                            {option === 'none' ? <X size={16} className="text-bakery-chocolate/20" /> : BAKERY_PROPS[option]}
                          </button>
                       ))
                    ) : (
                      CATEGORIES.find(c => c.id === activeCategory)?.options.map((option) => {
                        const isSelected = config[activeCategory]?.[0] === option;
                        if (activeCategory.includes('Color')) {
                           return (
                            <button
                               key={option}
                               onClick={() => handleOptionSelect(activeCategory, option)}
                               className={cn(
                                 "aspect-square rounded-2xl border-2 transition-all p-1.5 flex items-center justify-center",
                                 isSelected ? "border-[#E8928A] scale-110" : "border-transparent"
                               )}
                             >
                                <div className="w-full h-full rounded-xl shadow-inner border border-black/5" style={{ backgroundColor: `#${option}` }} />
                             </button>
                           );
                        }

                        const optionPreviewSvg = createAvatar(adventurer, {
                          seed,
                          [activeCategory]: [option],
                        }).toString();

                        return (
                          <button
                            key={option}
                            onClick={() => handleOptionSelect(activeCategory, option)}
                            className={cn(
                              "aspect-square rounded-2xl border-2 transition-all p-1 overflow-hidden bg-white shadow-sm",
                              isSelected ? "border-[#E8928A] bg-[#E8928A]/5 scale-105" : "border-bakery-chocolate/5 hover:border-bakery-chocolate/20"
                            )}
                          >
                            <div 
                              className="w-full h-full transform scale-125 translate-y-1"
                              dangerouslySetInnerHTML={{ __html: optionPreviewSvg }}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {step === 'gallery' && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-auto bg-[#FFFBF2] md:rounded-[3rem] p-8 md:p-12 overflow-hidden flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-bakery-pink/20 to-transparent pointer-events-none" />
            
            <div className="relative z-10 text-center mb-8">
              <h3 className="text-2xl font-black text-bakery-chocolate tracking-tight mb-2">
                So Many Cute Avatars<br/>You Can Create! ✨
              </h3>
              <p className="text-bakery-chocolate/40 text-[10px] font-bold uppercase tracking-widest">Your cinematic bakery collection</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 flex-1">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="aspect-square bg-white border border-bakery-chocolate/5 rounded-3xl shadow-sm overflow-hidden flex items-center justify-center p-2 relative group"
                >
                   <div className="w-full h-full scale-125 translate-y-3" dangerouslySetInnerHTML={{ __html: i === 0 ? avatarSvg : galleryPreviews[i-1] || avatarSvg }} />
                   <div className="absolute top-2 right-2 p-1 bg-bakery-pink/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Sparkles size={12} className="text-bakery-chocolate" />
                   </div>
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 flex flex-col gap-4">
               <Button 
                variant="primary" 
                onClick={() => onSave({ 
                  seed, 
                  options: config, 
                  svg: avatarSvg,
                  aiUsageStats: aiUsage
                })}
                className="w-full h-16 rounded-2xl bg-bakery-chocolate text-white font-bold text-base shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
               >
                Save My Identity
               </Button>
               <button 
                onClick={() => setStep('editor')}
                className="text-[10px] font-black text-bakery-chocolate/40 uppercase tracking-widest hover:text-bakery-chocolate transition-colors"
               >
                ← Back to Edit
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
