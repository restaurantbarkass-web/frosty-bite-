import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import { X, RefreshCw, Check, Undo, Redo, Sparkles, Camera, Upload, Wand2, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface AvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (avatarConfig: any) => void;
  initialConfig?: any;
  user?: any;
}

const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

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

const VIBES = [
  { id: 'bakery_buddy', label: 'Bakery Buddy', icon: '🥐', description: 'Warm hoodie, fresh croissant, friendly vibes' },
  { id: 'strawberry_dream', label: 'Strawberry Dream', icon: '🍓', description: 'Pink pastels, sweet dessert, soft blush' },
  { id: 'cozy_cafe', label: 'Cozy Cafe', icon: '☕', description: 'Coffee cup, oversized sweater, warm lighting' },
  { id: 'bubble_tea', label: 'Bubble Tea Mood', icon: '🧋', description: 'Cozy aesthetics, soft colors, boba love' },
  { id: 'kawaii_core', label: 'Kawaii Core', icon: '✨', description: 'Big expressive eyes, sparkling joy, ultra cute' },
  { id: 'soft_girl', label: 'Soft Girl', icon: '🥐', description: 'Floral patterns, gentle pastels, dainty vibes' },
  { id: 'cozy_boy', label: 'Cozy Boy', icon: '🧸', description: 'Minimalist beanies, flannel, relaxed mood' },
  { id: 'anime_hero', label: 'Anime Hero', icon: '🐱', description: 'Dynamic style, adventurous spirit, bold lines' },
  { id: 'pastry_princess', label: 'Pastry Princess', icon: '👑', description: 'Elegant tiara, royal sweets, sophisticated' },
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialConfig,
  user
}) => {
  const [step, setStep] = useState<'welcome' | 'vibe_selection' | 'loading' | 'editor' | 'gallery' | 'ai_loading' | 'ai_result'>(initialConfig?.seed ? 'editor' : 'welcome');
  const [seed, setSeed] = useState(initialConfig?.seed || Math.random().toString());
  const [config, setConfig] = useState<any>(initialConfig?.options || {});
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [aiUsage, setAiUsage] = useState(initialConfig?.aiUsageStats || { count: user?.avatar_generation_count || 0, month: new Date().getMonth() });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (aiUsage.count >= 3) {
      toast.error("AI Generation limit reached (3 per account)");
      return;
    }

    setSelfieFile(file);
    setStep('vibe_selection');
  };

  const generateAIAvatar = async (vibeId: string) => {
    if (!selfieFile) return;
    
    const vibe = VIBES.find(v => v.id === vibeId);
    if (!vibe) return;

    try {
      setStep('ai_loading');
      setIsGenerating(true);

      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        setStep('welcome');
        toast.error("Cloudinary keys missing! Please ensure you've added VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in Settings > Environment Variables, then REFRESH this page.", {
          duration: 8000,
          icon: '🔑'
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", selfieFile);
      formData.append("upload_preset", uploadPreset);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      let cloudData;
      try {
        const text = await cloudRes.text();
        cloudData = text ? JSON.parse(text) : {};
      } catch (e) {
        cloudData = {};
      }

      if (!cloudRes.ok) {
        throw new Error(cloudData.error?.message || `Cloudinary upload failed (${cloudRes.status})`);
      }
      
      const selfieUrl = cloudData.secure_url;
      if (!selfieUrl) {
        throw new Error("Cloudinary response missing image URL");
      }

      const aiRes = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selfieUrl,
          userId: user?.uid,
          vibe: vibeId,
          prompt: `Cute bakery-themed chibi avatar, ${vibe.label} aesthetic, anime-inspired, soft pastel colors, big expressive eyes, holding a pastry, cozy cafe vibe, mobile app profile picture`
        }),
      });

      let aiData;
      const contentType = aiRes.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        aiData = await aiRes.json();
      } else {
        const text = await aiRes.text();
        console.error("Server returned non-JSON response:", text.substring(0, 200));
        throw new Error(`Server Error: Received unexpected response format (${aiRes.status})`);
      }

      if (!aiRes.ok) {
        throw new Error(aiData.error || `AI Generation failed (${aiRes.status})`);
      }

      if (!aiData.image) {
        throw new Error("No image was returned from the AI lab");
      }

      setGeneratedImageUrl(aiData.image);
      setStep('ai_result');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Something went wrong");
      setStep('welcome');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWrapper = async (avatarConfig: any) => {
    try {
      await onSave(avatarConfig);
    } catch (err) {
      console.error("Save error:", err);
      // toast is handled in parent mostly, but we catch it here to prevent unhandled rejection
    }
  };

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

  const handleVibeSelect = async (vibeId: string) => {
    setSelectedVibe(vibeId);
    
    if (selfieFile) {
      try {
        await generateAIAvatar(vibeId);
      } catch (err) {
        console.error("Vibe selection AI error:", err);
      }
      return;
    }

    setStep('loading');
    
    // Apply baseline styles based on selection (for DiceBear fallback/path)
    const newConfig: any = {};
    if (vibeId === 'soft_girl' || vibeId === 'pastry_princess') {
      newConfig.hair = ['long01'];
      newConfig.hairColor = ['d5b08b'];
      newConfig.skinColor = ['f2d3b1'];
      newConfig.shirt = ['variant01'];
      newConfig.bakeryTheme = ['cupcake'];
    } else if (vibeId === 'cozy_boy' || vibeId === 'bakery_buddy') {
      newConfig.hair = ['short05'];
      newConfig.hairColor = ['4a312c'];
      newConfig.skinColor = ['ebbe9d'];
      newConfig.shirt = ['variant03'];
      newConfig.bakeryTheme = ['croissant'];
    } else if (vibeId === 'cozy_cafe' || vibeId === 'bubble_tea') {
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
        className="absolute inset-0 bg-white/20 backdrop-blur-2xl"
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
              
              <div className="flex flex-col gap-3 w-full">
                <Button 
                  variant="primary" 
                  onClick={() => {
                    setSelfieFile(null);
                    setStep('vibe_selection');
                  }}
                  className="w-full rounded-2xl h-16 bg-[#E8928A] hover:bg-[#D67C74] text-white font-bold text-base shadow-lg shadow-[#E8928A]/30"
                >
                  Enter Stylist Lab
                </Button>

                <div className="relative group w-full">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSelfieUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={aiUsage.count >= 3}
                  />
                  <Button 
                    variant="outline"
                    className="w-full rounded-2xl h-16 border-2 border-[#4A312C]/10 hover:border-[#4A312C]/30 bg-white text-bakery-chocolate font-bold text-base shadow-sm gap-3 group-hover:scale-[1.02] transition-transform"
                  >
                    <Wand2 size={20} className="text-[#E8928A]" />
                    AI Magic Avatar
                  </Button>
                </div>
                
                <p className="text-[10px] text-bakery-chocolate/40 font-bold uppercase tracking-widest mt-2">
                  AI Attempts: {aiUsage.count}/3
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'vibe_selection' && (
          <motion.div
            key="vibe_selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-[85vh] bg-[#FFFBF2] md:rounded-[3rem] p-8 md:p-10 overflow-hidden flex flex-col"
          >
            <div className="mb-8 text-center">
              <div className="w-12 h-12 bg-bakery-pink/20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Sparkles size={24} className="text-[#E8928A]" />
              </div>
              <h3 className="text-3xl font-black text-bakery-chocolate tracking-tight mb-2">
                Choose Your<br/>Avatar Vibe ✨
              </h3>
              <p className="text-bakery-chocolate/50 text-sm font-medium">
                Pick a mood that fits your<br/>bakery personality
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar pb-6">
              <div className="grid grid-cols-1 gap-3">
                {VIBES.map((vibe, idx) => (
                  <motion.button
                    key={vibe.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleVibeSelect(vibe.id)}
                    className="flex items-center gap-4 p-4 bg-white rounded-3xl border border-bakery-chocolate/5 shadow-sm group hover:border-[#E8928A] transition-colors text-left"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-bakery-cream flex items-center justify-center text-3xl shadow-inner">
                       {vibe.icon}
                    </div>
                    <div>
                      <span className="block text-sm font-black text-bakery-chocolate uppercase tracking-widest">{vibe.label}</span>
                      <span className="block text-[10px] font-bold text-bakery-chocolate/40 leading-tight mt-0.5">{vibe.description}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
            
            <div className="pt-6 flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep('welcome')}
                className="flex-1 rounded-2xl h-14 border-2 border-bakery-chocolate/5 text-bakery-chocolate font-bold text-sm"
              >
                Back
              </Button>
              <Button 
                variant="primary" 
                onClick={() => handleVibeSelect('random')}
                className="flex-1 rounded-2xl h-14 bg-bakery-chocolate text-white font-bold text-sm"
              >
                Surprise Me 🎲
              </Button>
            </div>
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

        {step === 'ai_loading' && (
          <motion.div
            key="ai_loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full md:max-w-md h-full md:h-auto bg-[#FFFBF2] md:rounded-[3rem] flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-8 rounded-full border-t-2 border-[#E8928A]"
              />
              <div className="relative w-48 h-48 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-xl border-4 border-white">
                 <motion.div
                   animate={{ scale: [1, 1.1, 1] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="text-6xl"
                 >
                   🍜
                 </motion.div>
              </div>
            </div>
            <h3 className="text-2xl font-black text-bakery-chocolate tracking-tight mb-4">
              Cooking your foodie avatar...
            </h3>
            <div className="flex gap-2">
               {['✨', '☕', '🥐'].map((emoji, i) => (
                 <motion.span
                   key={i}
                   animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
                   transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                   className="text-2xl"
                 >
                   {emoji}
                 </motion.span>
               ))}
            </div>
            <p className="mt-8 text-bakery-chocolate/40 text-xs font-medium italic">
              Our AI is hand-crafting a unique style for you
            </p>
          </motion.div>
        )}

        {step === 'ai_result' && (
          <motion.div
            key="ai_result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="relative z-10 w-full md:max-w-2xl h-full md:h-auto bg-[#FFF9F0] md:rounded-[4rem] p-8 md:p-20 text-center overflow-hidden flex flex-col items-center justify-center"
          >
            <h3 className="text-5xl md:text-6xl font-[1000] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.1)] tracking-tight mb-12 flex items-center gap-4">
              Your AI Avatar <span className="animate-pulse">✨</span>
            </h3>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-80 h-80 md:w-[450px] md:h-[450px] rounded-[3.5rem] border-[16px] border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.15)] overflow-hidden mb-20 bg-white"
            >
              <img src={generatedImageUrl!} alt="AI Avatar" className="w-full h-full object-cover" />
            </motion.div>

            <div className="flex flex-col gap-6 w-full max-w-md">
               <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSaveWrapper({ 
                  avatar_url: generatedImageUrl,
                  avatar_style: 'chibi_ai',
                  avatar_vibe: selectedVibe,
                  isAI: true
                })}
                className="w-full h-24 rounded-[2.5rem] bg-white text-bakery-chocolate font-black uppercase tracking-[0.3em] text-sm md:text-lg shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-xl transition-all flex items-center justify-center border border-white/50"
               >
                Keep this Avatar
               </motion.button>
               <button 
                onClick={() => setStep('welcome')}
                className="text-[10px] md:text-xs font-black text-bakery-chocolate/20 uppercase tracking-[0.3em] hover:text-bakery-chocolate transition-colors"
               >
                Try Different Photo
               </button>
            </div>
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
                onClick={() => setStep('vibe_selection')}
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
                onClick={() => handleSaveWrapper({ 
                  seed, 
                  options: config, 
                  svg: avatarSvg,
                  avatar_vibe: selectedVibe,
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
