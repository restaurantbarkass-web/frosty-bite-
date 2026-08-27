import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ShoppingBag, 
  Search as SearchIcon, 
  Trash2, 
  Grid, 
  ChevronRight, 
  ArrowRight,
  HelpCircle,
  TrendingDown
} from 'lucide-react';
import { useMenu } from '../context/MenuContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

import { safeTrim, safeTrimLowerCase } from '../utils/string';

interface VoiceAssistantProps {
  onSearchQueryChange?: (q: string) => void;
  onDietFilterChange?: (filter: 'All' | 'Vegetarian' | 'Spicy') => void;
  onCategoryChange?: (category: string) => void;
}

// Simple synthesizer for custom high-tech feedback sounds (start, success, error)
const playSynthBeep = (type: 'start' | 'success' | 'error') => {
  try {
    // @ts-ignore
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'start') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1300, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.warn('Audio synthesis failed:', err);
  }
};

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onSearchQueryChange,
  onDietFilterChange,
  onCategoryChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('How can I sweeten up your day?');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // AI Butler conversational states
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { items } = useMenu();
  const { addToCart, setIsCartOpen, clearCart, updateQuantity } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Suggested commands shown as hints in UI
  const SUGGESTIONS = [
    { text: 'Order Chocolate Truffle', desc: 'Adds Chocolate Truffle to your cart' },
    { text: 'Search for Bento Cakes', desc: 'Queries the active items' },
    { text: 'Reset filter to Vegetarian', desc: 'Show only eggless & veg offerings' },
    { text: 'Empty my basket', desc: 'Clears all items in the cart' },
    { text: 'Open the cart', desc: 'Views cart slide' },
    { text: 'Go to checkout', desc: 'Navigate to shipping details' },
  ];

  // TTS response function
  const speakLocal = (text: string) => {
    if (!soundEnabled) return;
    try {
      window.speechSynthesis.cancel(); // cancel current speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis failed:', e);
    }
  };

  // Convert numbers written as word strings to numerical value
  const parseWordNumber = (word: string): number => {
    const numMap: { [key: string]: number } = {
      one: 1, single: 1, a: 1, an: 1,
      two: 2, double: 2, pair: 2,
      three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    const cleaned = safeTrimLowerCase(word);
    if (!isNaN(Number(cleaned))) return Number(cleaned);
    return numMap[cleaned] || 1;
  };

  // Process voice or text input via unified Gemini AI Butler endpoint
  const sendMsgToAI = async (messageText: string) => {
    const trimmedInput = safeTrim(messageText);
    if (!trimmedInput) return;
    setIsLoading(true);
    setTranscript(`"${trimmedInput}"`);
    setFeedbackMsg("Thinking...");

    const userMsg = { role: 'user' as const, content: trimmedInput };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch('/api/butler/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: chatHistory,
          items: items,
          customerName: (user as any)?.full_name || user?.displayName || user?.email || null
        })
      });

      if (!response.ok) {
        throw new Error(`Butler Chat API status: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply;
      setFeedbackMsg(reply);
      speakLocal(reply);

      setChatHistory(prev => [...prev, { role: 'model', content: reply }]);

      // Execute structural Web UI actions returned on the JSON payload
      if (data.action) {
        console.log('[AI Butler Route Action]:', data.action, data.actionData);
        switch (data.action) {
          case 'ADD_TO_CART': {
            const itemName = data.actionData?.itemName;
            const quantity = data.actionData?.quantity || 1;
            if (itemName) {
              const matchedItem = items.find(item => 
                item.name.toLowerCase().includes(itemName.toLowerCase()) || 
                itemName.toLowerCase().includes(item.name.toLowerCase())
              );
              
              if (matchedItem) {
                playSynthBeep('success');
                for (let i = 0; i < quantity; i++) {
                  addToCart(matchedItem);
                }
                confetti({
                  particleCount: 80,
                  spread: 80,
                  origin: { y: 0.6 }
                });
                toast.success(`Success! Added ${quantity > 1 ? `${quantity}x ` : ''}${matchedItem.name}`);
                setTimeout(() => {
                  setIsOpen(false);
                  setIsCartOpen(true);
                }, 2000);
              } else {
                toast.error(`Locating ${itemName} failed.`);
              }
            }
            break;
          }
          case 'CLEAR_CART':
            playSynthBeep('success');
            clearCart();
            confetti({ particleCount: 30, spread: 50 });
            toast.success('All items cleared from basket.');
            break;
          case 'OPEN_CART':
            playSynthBeep('success');
            setIsOpen(false);
            setIsCartOpen(true);
            break;
          case 'NAVIGATE_CHECKOUT':
            playSynthBeep('success');
            setTimeout(() => {
              setIsOpen(false);
              navigate('/checkout');
            }, 1500);
            break;
          case 'SET_FILTER': {
            const diet = data.actionData?.diet;
            if (diet && onDietFilterChange) {
              playSynthBeep('success');
              onDietFilterChange(diet);
              toast.success(`Filter applied: ${diet}`);
            }
            break;
          }
          default:
            break;
        }
      } else {
        playSynthBeep('success');
      }
    } catch (e) {
      console.warn('[AI Butler falling back to client-side matcher]:', e);
      runLocalCommandFallback(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  // Local fallback command matching
  const runLocalCommandFallback = (command: string) => {
    const text = safeTrimLowerCase(command);
    setTranscript(`"${command}"`);

    // 1. HELP / PROTOCOL Command
    if (text.includes('help') || text.includes('how to use') || text.includes('what can i say')) {
      playSynthBeep('success');
      const msg = "You can say 'Order Cocoa Cake', 'Search Bento', 'Show Vegetarian', or 'Clear Cart'!";
      setFeedbackMsg(msg);
      speakLocal(msg);
      return;
    }

    // 2. CHECKOUT & CART OPEN/CLOSE / CLEAR
    if (text.includes('checkout') || text.includes('pay now') || text.includes('place my order') && !text.includes('add')) {
      playSynthBeep('success');
      setFeedbackMsg('Heading to checkout page now!');
      speakLocal('Heading to checkout page!');
      setTimeout(() => {
        setIsOpen(false);
        navigate('/checkout');
      }, 1000);
      return;
    }

    if (text.includes('clear cart') || text.includes('empty cart') || text.includes('empty my basket') || text.includes('clear my basket')) {
      playSynthBeep('success');
      clearCart();
      confetti({ particleCount: 40, spread: 60 });
      setFeedbackMsg('Your cart has been completely emptied.');
      speakLocal('I have emptied your cart.');
      toast.success('Cart cleared successfully!');
      return;
    }

    if (text.includes('open cart') || text.includes('show cart') || text.includes('view cart') || text.includes('open basket') || text.includes('show basket')) {
      playSynthBeep('success');
      setIsOpen(false);
      setIsCartOpen(true);
      setFeedbackMsg('Opening your cart now.');
      speakLocal('Opening your cart.');
      return;
    }

    // 3. DIETARY FILTERS
    if (text.includes('vegetarian') || text.includes('veg ') || text.includes('vegless') || text.includes('eggless')) {
      if (onDietFilterChange) {
        playSynthBeep('success');
        onDietFilterChange('Vegetarian');
        setFeedbackMsg('Filtering menu to Vegetarian & Eggless treats only!');
        speakLocal('Filtering for vegetarian products.');
        toast.success('Veg Filter Applied');
        setTimeout(() => {
          setIsOpen(false);
          const scrollTarget = document.getElementById('menu-section');
          scrollTarget?.scrollIntoView({ behavior: 'smooth' });
        }, 1200);
        return;
      }
    }

    if (text.includes('spicy') || text.includes('chili') || text.includes('chilli') || text.includes('hot sauce')) {
      if (onDietFilterChange) {
        playSynthBeep('success');
        onDietFilterChange('Spicy');
        setFeedbackMsg('Filtering menu to Spicy items now!');
        speakLocal('Filtering for spicy items.');
        toast.success('Spicy Filter Applied');
        setTimeout(() => {
          setIsOpen(false);
          const scrollTarget = document.getElementById('menu-section');
          scrollTarget?.scrollIntoView({ behavior: 'smooth' });
        }, 1200);
        return;
      }
    }

    if (text.includes('show all') || text.includes('reset filter') || text.includes('reset filters')) {
      if (onDietFilterChange) {
        playSynthBeep('success');
        onDietFilterChange('All');
        if (onCategoryChange) onCategoryChange('All');
        setFeedbackMsg('Removing filters to show our entire delicious menu.');
        speakLocal('Showing full menu.');
        setTimeout(() => {
          setIsOpen(false);
        }, 1000);
        return;
      }
    }

    // 4. ADD TO CART / PLACE ORDER COMMAND
    const orderMatch = text.match(/(?:order|add|buy|get|want|crave|put|purchase)\s+(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(.*?)(?:\s+(?:to cart|my order|to basket))?$/);
    
    let isOrdering = text.includes('add') || text.includes('order') || text.includes('buy') || text.includes('get') || text.includes('want');
    let searchCandidate = text;
    let quantityParsed = 1;

    if (orderMatch) {
      isOrdering = true;
      const parsedQty = orderMatch[1];
      if (parsedQty) {
        quantityParsed = parseWordNumber(parsedQty);
      }
      searchCandidate = orderMatch[2];
    } else {
      searchCandidate = text.replace(/^(?:search for|find|show me|where is|look up|filter for)\s+/i, '');
    }

    const cleanQuery = safeTrim(searchCandidate.replace(/(?:item|pieces|piece|qty|quantity)/gi, ''));

    if (isOrdering && cleanQuery.length > 2) {
      const matchedItem = items.find(item => 
        item.name.toLowerCase().includes(cleanQuery) || 
        cleanQuery.includes(item.name.toLowerCase())
      );

      if (matchedItem) {
        playSynthBeep('success');
        for (let i = 0; i < quantityParsed; i++) {
          addToCart(matchedItem);
        }
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });

        const quantityText = quantityParsed > 1 ? `${quantityParsed} portions of ` : '';
        const msg = `Success! Added ${quantityText}${matchedItem.name} to your basket.`;
        setFeedbackMsg(msg);
        speakLocal(`Added ${quantityText}${matchedItem.name} to your basket!`);
        toast.success(`Added ${quantityText}${matchedItem.name} x${quantityParsed}`);
        setTimeout(() => {
          setIsOpen(false);
          setIsCartOpen(true);
        }, 1500);
        return;
      }
    }

    // 5. SEARCH LOGIC AS FALLBACK
    const searchQuery = safeTrim(text.replace(/^(?:search for|find|show me|where is|look up|filter for)\s+/gi, ''));
    if (searchQuery.length > 1) {
      if (onSearchQueryChange) {
        playSynthBeep('success');
        onSearchQueryChange(searchQuery);
        
        const catMatched = items.find(i => i.category.toLowerCase().includes(searchQuery));
        if (catMatched && onCategoryChange) {
          onCategoryChange(catMatched.category);
        }
        
        setFeedbackMsg(`Searching our menu for "${searchQuery}"...`);
        speakLocal(`Searching the menu for ${searchQuery}.`);
        
        setTimeout(() => {
          setIsOpen(false);
          const scrollTarget = document.getElementById('menu-section');
          scrollTarget?.scrollIntoView({ behavior: 'smooth' });
        }, 1200);
        return;
      }
    }

    playSynthBeep('error');
    setFeedbackMsg(`I heard "${command}". Could you please try again with simpler commands?`);
    speakLocal("I couldn't quite catch that. Please try again.");
  };

  const processVoiceCommand = (command: string) => {
    sendMsgToAI(command);
  };

  // Launch Speech Recognition
  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Web Speech API is not supported in this browser.");
      return;
    }

    setTranscript('');
    setFeedbackMsg('Listening for command...');
    setIsListening(true);
    playSynthBeep('start');

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-IN'; // set English India localization for optimal regional pronunciations

    rec.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      processVoiceCommand(command);
    };

    rec.onerror = (event: any) => {
      console.warn('Speech Recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setFeedbackMsg('Microphone permission blocked. Please enable browser permissions.');
        speakLocal('Please grant microphone permissions.');
        playSynthBeep('error');
      } else if (event.error !== 'no-speech') {
        setFeedbackMsg('There was a recognition issue. Please speak clearly.');
        playSynthBeep('error');
      } else {
        setFeedbackMsg('I didn\'t hear anything. Speak when you see the pulsing wave!');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
  };

  const handleToggleOpen = () => {
    if (!isOpen) {
      setIsOpen(true);
      setTranscript('');
      setFeedbackMsg('Hello! Order sweets, find dishes, filter menu, or empty basket with your voice.');
      speakLocal('Hello! I am your Frosty Voice Assistant. Listening.');
      setTimeout(() => {
        startListening();
      }, 300);
    } else {
      stopListening();
      window.speechSynthesis.cancel();
      setIsOpen(false);
    }
  };

  // Set readiness flag for external buttons (e.g. search bar microphone)
  useEffect(() => {
    // @ts-ignore
    window.__voiceAssistantReady = true;
    return () => {
      // @ts-ignore
      delete window.__voiceAssistantReady;
    };
  }, []);

  // Hook into search bar trigger events
  useEffect(() => {
    const handleVoiceTrigger = (e: any) => {
      setIsOpen(true);
      setTranscript('');
      setFeedbackMsg('Ready to listen. Say your command!');
      speakLocal('Listening for voice commands.');
      setTimeout(() => {
        startListening();
      }, 500);
    };

    window.addEventListener('open-voice-assistant', handleVoiceTrigger);
    return () => {
      window.removeEventListener('open-voice-assistant', handleVoiceTrigger);
    };
  }, []);

  return (
    <>
      {/* Elegant Immersive Voice Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-999 flex flex-col justify-between p-6 md:p-12 overflow-y-auto">
            
            {/* Header Area */}
            <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
              <div className="flex items-center gap-2.5">
                <div id="voice-indicator-logo" className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white font-black text-sm shadow-xl">
                  FV
                </div>
                <div>
                  <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-1.5">
                    Frosty Voice <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-zinc-400">Web Speech Natural Assistant</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="btn_toggle_voice_audio"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-3 bg-white/5 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white rounded-xl transition-all"
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>

                <button
                  id="btn_close_voice_modal"
                  onClick={() => {
                    stopListening();
                    window.speechSynthesis.cancel();
                    setIsOpen(false);
                  }}
                  className="p-3 bg-white/5 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Immersive Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full my-8 text-center">
              
              {/* Dynamic Soundwave Visualizer */}
              <div className="h-32 flex items-center justify-center gap-1.5 mb-8">
                {isListening ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-primary via-accent to-purple-500 rounded-full"
                      animate={{
                        height: [16, Math.max(20, Math.floor(Math.random() * 110)), 16]
                      }}
                      transition={{
                        duration: 0.6 + (i * 0.05),
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                  ))
                ) : (
                  <div className="relative">
                    <motion.div 
                      className="w-24 h-24 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center text-zinc-500 border border-white/5"
                      animate={{ scale: isSpeaking ? [1, 1.1, 1] : 1 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      <Mic size={36} className="text-zinc-500" />
                    </motion.div>
                    {isSpeaking && (
                      <span className="absolute inset-0 rounded-full border border-primary animate-ping opacity-25" />
                    )}
                  </div>
                )}
              </div>

              {/* Live Speech Recognition Transcript block */}
              <div id="voice-assistant-transcript-container" className="min-h-16 mb-4 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl w-full max-w-lg shadow-inner">
                {transcript ? (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white text-lg font-semibold tracking-wide italic"
                  >
                    {transcript}
                  </motion.p>
                ) : (
                  <p className="text-zinc-500 text-sm italic">
                    {isListening ? 'Speak now...' : 'Tap microphone to dictate command'}
                  </p>
                )}
              </div>

              {/* Status / TTS feedback message */}
              <div className="max-w-xl mb-4">
                <motion.h4
                  key={feedbackMsg}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-primary text-xl sm:text-2xl font-black italic tracking-tight leading-relaxed"
                >
                  {feedbackMsg}
                </motion.h4>
              </div>

              {/* Optional Scrollable Chat History Log */}
              {chatHistory.length > 0 && (
                <div className="w-full max-w-lg max-h-40 overflow-y-auto mb-4 bg-white/5 border border-white/5 rounded-2xl p-3 text-left flex flex-col gap-2">
                  {chatHistory.map((item, index) => (
                    <div 
                      key={index} 
                      className={`max-w-[85%] rounded-xl p-2.5 text-xs ${
                        item.role === 'user' 
                          ? 'self-end bg-primary/20 border border-primary/25 text-white' 
                          : 'self-start bg-zinc-800 border border-zinc-700/50 text-zinc-200'
                      }`}
                    >
                      <span className="font-extrabold uppercase text-[9px] block text-primary/80 mb-0.5">
                        {item.role === 'user' ? 'You' : 'Frosty Butler'}
                      </span>
                      {item.content}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="self-start max-w-[85%] bg-zinc-800 border border-zinc-700/50 rounded-xl p-2.5 text-xs text-zinc-400 italic flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                      Butler is typing...
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input Field with Send Trigger */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = safeTrim(textInput);
                  if (trimmed && !isLoading) {
                    sendMsgToAI(trimmed);
                    setTextInput('');
                  }
                }}
                className="w-full max-w-lg mb-6 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 focus-within:border-primary/50 transition-all"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ask about cakes, track orders, or request recommendations..."
                  className="flex-1 bg-transparent border-none text-white text-sm px-3 focus:outline-none placeholder:text-zinc-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !safeTrim(textInput)}
                  className="px-4 py-2 bg-primary hover:bg-accent text-white text-xs font-bold rounded-lg transition-colors hover:scale-102 flex items-center gap-1.5 disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isLoading ? 'Checking...' : 'Send'} <ArrowRight size={12} />
                </button>
              </form>

              {/* Large Mic Trigger button inside modal */}
              <div className="mt-8">
                <button
                  id="btn_mic_action_trigger"
                  onClick={isListening ? stopListening : startListening}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-500/20 scale-105' 
                      : 'bg-primary hover:bg-accent text-white shadow-xl shadow-primary/25 hover:scale-105'
                  }`}
                >
                  <Mic size={32} className={isListening ? 'animate-pulse' : ''} />
                </button>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mt-2.5">
                  {isListening ? 'Tap to Stop Listening' : 'Tap to Speak'}
                </p>
              </div>
            </div>

            {/* Bottom Suggestions / Help area */}
            <div className="w-full max-w-4xl mx-auto border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle size={14} className="text-primary animate-bounce shrink-0" />
                <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                  Try Saying these Voice Commands
                </h5>
              </div>

              <div id="voice-suggestions-bgrid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Allow users to test command instantly on tap! Perfect fallback and onboarding.
                      processVoiceCommand(s.text);
                    }}
                    className="flex flex-col items-start p-3 bg-white/5 border border-white/5 rounded-xl text-left hover:border-primary/20 hover:bg-primary/5 transition-all group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1">
                      {s.text} <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceAssistant;
