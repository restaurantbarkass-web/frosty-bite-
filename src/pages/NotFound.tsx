import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Home, 
  Cake, 
  Search, 
  ArrowRight, 
  Sparkles, 
  HelpCircle,
  ShoppingBag,
  ArrowLeft
} from 'lucide-react';
import { Logo } from '../components/Logo';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Dynamic SEO Page Title
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Page Not Found | Frosty Bite Bakery";
    return () => {
      document.title = prevTitle || "Frosty Bite Bakery • Artisan Treats";
    };
  }, []);

  // 2. Search Handler (Reuses app's native Search system)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      // Trigger global search overlay
      window.dispatchEvent(new CustomEvent('open-search', { detail: { query } }));
    } else {
      navigate('/categories');
    }
  };

  const handleQuickCategory = (catName: string) => {
    window.dispatchEvent(new CustomEvent('open-search', { detail: { query: catName } }));
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto min-h-screen bg-[#FFFDF8] text-[#4A2925] flex flex-col justify-between selection:bg-[#D6B574]/30 selection:text-[#321C1A]">
      
      {/* Delicate background ambient glows */}
      <div 
        aria-hidden="true" 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-[#FFF4DF] via-[#F5EBDD]/60 to-transparent rounded-full blur-3xl pointer-events-none -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="absolute bottom-10 right-10 w-80 h-80 bg-[#D6B574]/10 rounded-full blur-2xl pointer-events-none -z-10" 
      />

      {/* ================= MINIMAL TOP HEADER ================= */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <Link 
          to="/" 
          className="flex items-center gap-2 group transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B574] rounded-xl"
          aria-label="Frosty Bite Bakery Home"
        >
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#6B4B44] hover:text-[#4A2925] px-3 py-1.5 rounded-xl hover:bg-[#FFF4DF] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go Back</span>
          </button>
          <Link
            to="/faq"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B4B44] hover:text-[#4A2925] px-3.5 py-1.5 rounded-xl border border-[#D6B574]/40 hover:border-[#D6B574] hover:bg-[#FFF4DF] transition-all"
          >
            <HelpCircle size={14} className="text-[#D6B574]" />
            <span>Bakery FAQ</span>
          </Link>
        </div>
      </header>

      {/* ================= MAIN 404 CONTENT HERO ================= */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 sm:py-12 max-w-4xl mx-auto w-full text-center z-10">
        
        {/* Animated Entrance Container */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col items-center"
        >

          {/* 404 COMPOSITION WITH ARTISAN BAKERY ILLUSTRATION */}
          <div className="relative flex items-center justify-center select-none py-2 my-2 sm:my-4">
            
            {/* The First "4" */}
            <span 
              className="text-7xl sm:text-9xl md:text-[11rem] font-black tracking-tighter leading-none text-[#4A2925] drop-shadow-[0_10px_20px_rgba(74,41,37,0.12)] pr-1 sm:pr-3"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              4
            </span>

            {/* Centerpiece: The Animated Missing-Slice Artisan Cake / Bundt */}
            <div className="relative w-32 h-32 sm:w-44 sm:h-44 md:w-52 md:h-52 flex items-center justify-center mx-1 sm:mx-3">
              
              {/* Floating golden sparkle particles */}
              {[
                { x: '-38%', y: '-28%', delay: 0, size: 14 },
                { x: '42%', y: '-32%', delay: 0.6, size: 12 },
                { x: '-42%', y: '36%', delay: 1.2, size: 10 },
                { x: '38%', y: '40%', delay: 1.8, size: 14 },
              ].map((spark, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.15, 0.8],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: spark.delay,
                    ease: "easeInOut",
                  }}
                  className="absolute text-[#D6B574] pointer-events-none"
                  style={{ top: '50%', left: '50%', transform: `translate(${spark.x}, ${spark.y})` }}
                >
                  <Sparkles size={spark.size} />
                </motion.div>
              ))}

              {/* Floating Pastry Crumbs */}
              <motion.span 
                animate={{ y: [0, 4, 0], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute -bottom-1 -left-2 w-2 h-2 rounded-full bg-[#D6B574]/80" 
              />
              <motion.span 
                animate={{ y: [0, -3, 0], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
                className="absolute bottom-2 -right-1 w-2.5 h-1.5 rounded-full bg-[#4A2925]/40" 
              />
              <motion.span 
                animate={{ y: [0, 5, 0], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3.2, repeat: Infinity, delay: 0.8 }}
                className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-[#D6B574]" 
              />

              {/* Floating Cake / Pastry SVG Illustration */}
              <motion.div
                animate={{
                  y: [-5, 5, -5],
                  rotate: [-1, 1, -1],
                }}
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-full h-full relative flex items-center justify-center filter drop-shadow-[0_12px_24px_rgba(74,41,37,0.15)]"
              >
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Artisan chocolate cake with a missing slice"
                >
                  {/* Pedestal Cake Stand */}
                  <ellipse cx="100" cy="165" rx="72" ry="12" fill="#EADBC8" />
                  <ellipse cx="100" cy="162" rx="68" ry="10" fill="#FFF4DF" stroke="#D6B574" strokeWidth="2" />
                  <path d="M92 165 L90 180 L110 180 L108 165 Z" fill="#D6B574" />
                  <ellipse cx="100" cy="180" rx="26" ry="5" fill="#C5A059" />

                  {/* Cake Base Sponge Body */}
                  <path
                    d="M38 120 C38 140 70 152 100 152 C130 152 162 140 162 120 L162 90 C162 70 130 58 100 58 C70 58 38 70 38 90 Z"
                    fill="#3B221E"
                  />

                  {/* Golden Caramel & Cream Layer Line */}
                  <path
                    d="M38 106 C42 122 72 134 100 134 C128 134 158 122 162 106"
                    stroke="#D6B574"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Rich Ganache Glaze Top */}
                  <ellipse cx="100" cy="90" rx="62" ry="28" fill="#4A2925" />
                  <ellipse cx="100" cy="87" rx="58" ry="24" fill="#321C1A" />

                  {/* Decadent Chocolate Drips Running Down */}
                  <path
                    d="M40 92 Q46 112 50 110 Q54 102 62 100 Q68 118 72 116 Q78 104 88 102 Q94 122 100 120 Q106 104 116 102 Q122 118 128 116 Q134 102 144 100 Q150 112 154 110 Q158 96 160 92"
                    fill="#321C1A"
                  />

                  {/* Missing Slice Wedge Gap (The Page That Melted/Baked Away) */}
                  <path
                    d="M100 87 L142 76 L154 118 L100 134 Z"
                    fill="#FFFDF8"
                    opacity="0.95"
                  />
                  <path
                    d="M100 87 L142 76 L130 112 L100 122 Z"
                    fill="#F5EBDD"
                  />
                  {/* Cake Texture on Exposed Interior */}
                  <circle cx="118" cy="98" r="2" fill="#D6B574" />
                  <circle cx="126" cy="104" r="2.5" fill="#4A2925" />
                  <circle cx="112" cy="110" r="1.5" fill="#D6B574" />
                  <line x1="102" y1="106" x2="132" y2="100" stroke="#E76A54" strokeWidth="2" strokeDasharray="3 3" />

                  {/* Swirled Whipped Cream Frosting Rosette on Top */}
                  <ellipse cx="94" cy="74" rx="14" ry="9" fill="#FFF4DF" stroke="#D6B574" strokeWidth="1.5" />
                  <path
                    d="M86 74 C86 64 96 60 102 62 C106 54 116 54 120 62 C126 62 130 68 128 75 C124 80 88 80 86 74 Z"
                    fill="#FFFDF8"
                    stroke="#D6B574"
                    strokeWidth="1.2"
                  />

                  {/* Glossy Red Cherry with Stem */}
                  <circle cx="106" cy="56" r="8.5" fill="#DC2626" />
                  <circle cx="104" cy="53" r="2" fill="#FFFFFF" opacity="0.8" />
                  <path
                    d="M108 50 C114 42 122 40 125 42"
                    stroke="#15803D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />

                  {/* Delicate Golden Sparkle Crown */}
                  <path
                    d="M100 32 L102 38 L108 40 L102 42 L100 48 L98 42 L92 40 L98 38 Z"
                    fill="#D6B574"
                  />
                </svg>
              </motion.div>
            </div>

            {/* The Second "4" */}
            <span 
              className="text-7xl sm:text-9xl md:text-[11rem] font-black tracking-tighter leading-none text-[#4A2925] drop-shadow-[0_10px_20px_rgba(74,41,37,0.12)] pl-1 sm:pr-3"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              4
            </span>
          </div>

          {/* MAIN HEADING */}
          <h1 className="text-2xl sm:text-4xl md:text-[2.6rem] font-black tracking-tight text-[#4A2925] mt-4 mb-3 leading-tight">
            Oops! This page got baked away.
          </h1>

          {/* SUPPORTING TEXT */}
          <p className="text-sm sm:text-base md:text-lg text-[#6B4B44] max-w-lg mx-auto leading-relaxed mb-7 sm:mb-8 font-medium">
            Looks like this page isn’t on today’s menu. Don’t worry — there’s plenty of fresh sweetness waiting for you at Frosty Bite Bakery.
          </p>

          {/* PRIMARY ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md mx-auto mb-9">
            
            {/* Primary: Back to Home */}
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto flex-1 min-h-[48px] h-12 px-6 bg-[#4A2925] hover:bg-[#321C1A] text-[#FFFDF8] border-2 border-[#4A2925] hover:border-[#D6B574] rounded-2xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all shadow-md hover:shadow-xl hover:shadow-[#4A2925]/15 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 group"
            >
              <Home size={17} className="transition-transform group-hover:scale-110 text-[#D6B574]" />
              <span>Back to Home</span>
            </button>

            {/* Secondary: Explore Our Treats */}
            <button
              onClick={() => navigate('/categories')}
              className="w-full sm:w-auto flex-1 min-h-[48px] h-12 px-6 bg-[#FFF4DF] hover:bg-[#F5EBDD] text-[#4A2925] border-2 border-[#D6B574]/80 hover:border-[#D6B574] rounded-2xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all shadow-xs hover:shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 group"
            >
              <Cake size={17} className="transition-transform group-hover:scale-110 text-[#E76A54]" />
              <span>Explore Our Treats</span>
            </button>
          </div>

          {/* REUSED SEARCH EXPERIENCE */}
          <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xs p-2 sm:p-2.5 rounded-2xl border border-[#D6B574]/35 shadow-xs mb-6">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="pl-2.5 text-[#8C6D65]">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Looking for something sweet?"
                className="flex-1 bg-transparent border-none text-xs sm:text-sm text-[#4A2925] placeholder:text-[#8C6D65]/70 focus:outline-none py-1.5"
              />
              <button
                type="submit"
                className="h-9 px-3.5 bg-[#4A2925] hover:bg-[#321C1A] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                aria-label="Search Frosty Bite Treats"
              >
                <span>Find</span>
                <ArrowRight size={13} />
              </button>
            </form>
          </div>

          {/* QUICK POPULAR CATEGORY SUGGESTIONS (Zero-Pill Typographic Navigation) */}
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-[#8C6D65] font-semibold">
            <span className="text-[#4A2925] font-bold">Popular:</span>
            <button 
              onClick={() => handleQuickCategory('Cakes')} 
              className="hover:text-[#4A2925] hover:underline underline-offset-4 cursor-pointer transition-colors"
            >
              Artisan Cakes
            </button>
            <span aria-hidden="true" className="text-[#D6B574]">•</span>
            <button 
              onClick={() => handleQuickCategory('Pastries')} 
              className="hover:text-[#4A2925] hover:underline underline-offset-4 cursor-pointer transition-colors"
            >
              Pastries
            </button>
            <span aria-hidden="true" className="text-[#D6B574]">•</span>
            <button 
              onClick={() => handleQuickCategory('Breads')} 
              className="hover:text-[#4A2925] hover:underline underline-offset-4 cursor-pointer transition-colors"
            >
              Fresh Breads
            </button>
            <span aria-hidden="true" className="text-[#D6B574]">•</span>
            <button 
              onClick={() => handleQuickCategory('Cheesecakes')} 
              className="hover:text-[#4A2925] hover:underline underline-offset-4 cursor-pointer transition-colors"
            >
              Cheesecakes
            </button>
          </div>

        </motion.div>
      </main>

      {/* ================= OPTIONAL BAKERY BRAND FOOTER ================= */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-[#D6B574]/20 text-center space-y-1.5 z-10">
        <p className="text-xs sm:text-[13px] font-bold text-[#6B4B44] tracking-wide">
          Freshly baked happiness, just a click away.
        </p>
        <p className="text-[11px] font-medium text-[#8C6D65]/80 uppercase tracking-widest">
          © {new Date().getFullYear()} Frosty Bite Bakery
        </p>
      </footer>

    </div>
  );
};

export default NotFound;
