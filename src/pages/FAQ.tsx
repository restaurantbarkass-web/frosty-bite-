import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Truck,
  CreditCard,
  Cake,
  Palette,
  Tag,
  RotateCcw,
  User,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Share2,
  ChevronDown,
  ArrowRight,
  Clock,
  MapPin,
  ShieldCheck,
  Headphones
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { RESTAURANT_WHATSAPP } from '../constants';
import { FAQ_ITEMS, FAQ_CATEGORIES, FAQCategory, FAQItem } from '../data/faqData';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

// Helper to map category to Lucide icon
const getCategoryIcon = (category: FAQCategory, size = 18) => {
  switch (category) {
    case 'Ordering':
      return <ShoppingBag size={size} />;
    case 'Delivery':
      return <Truck size={size} />;
    case 'Payments':
      return <CreditCard size={size} />;
    case 'Cakes':
      return <Cake size={size} />;
    case 'Custom Orders':
      return <Palette size={size} />;
    case 'Offers':
      return <Tag size={size} />;
    case 'Refunds':
      return <RotateCcw size={size} />;
    case 'Account':
      return <User size={size} />;
    case 'All':
    default:
      return <Sparkles size={size} />;
  }
};

export const FAQ: React.FC = () => {
  useMetadata({
    title: 'Frequently Asked Questions | Frosty Bite Bakery',
    description: 'Find answers to common questions about cake ordering, home delivery, custom celebration tiers, payments, refunds, and dietary options at Frosty Bite Bakery.',
    keywords: [
      'Frosty Bite FAQ',
      'bakery questions',
      'cake delivery FAQ',
      'custom cake orders',
      'eggless cakes Cuttack',
      'bakery delivery Bhubaneswar',
      'cake cancellation refund'
    ]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory>('All');
  const [openIds, setOpenIds] = useState<string[]>(['order-place']); // Default open the first popular question
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [helpfulFeedback, setHelpfulFeedback] = useState<Record<string, 'yes' | 'no'>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus keyboard shortcut (Press / to search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered FAQ Items
  const filteredFAQs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FAQ_ITEMS.filter((item) => {
      // Category check
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!query) return true;

      // Text search matching
      const questionMatch = item.question.toLowerCase().includes(query);
      const answerMatch = item.answer.toLowerCase().includes(query);
      const tagsMatch = item.tags.some((tag) => tag.toLowerCase().includes(query));
      const highlightsMatch = item.highlights?.some((h) =>
        h.toLowerCase().includes(query)
      );

      return questionMatch || answerMatch || tagsMatch || highlightsMatch;
    });
  }, [searchQuery, selectedCategory]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: FAQ_ITEMS.length };
    FAQ_ITEMS.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Toggle Accordion Item
  const toggleFAQ = (id: string) => {
    if (allowMultiple) {
      setOpenIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setOpenIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  const expandAll = () => {
    setOpenIds(filteredFAQs.map((faq) => faq.id));
    toast.success('All questions expanded');
  };

  const collapseAll = () => {
    setOpenIds([]);
  };

  const handleFeedback = (id: string, response: 'yes' | 'no') => {
    setHelpfulFeedback((prev) => ({ ...prev, [id]: response }));
    toast.success(
      response === 'yes'
        ? 'Thank you for your feedback!'
        : 'Thank you! We will refine this answer.',
      {
        icon: response === 'yes' ? '✨' : '💬',
        style: {
          borderRadius: '16px',
          background: '#1c1917',
          color: '#fff',
          fontSize: '13px'
        }
      }
    );
  };

  const handleShare = async (faq: FAQItem) => {
    const shareText = `Frosty Bite Bakery FAQ: ${faq.question}\n\n${faq.answer}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: faq.question,
          text: shareText,
          url: window.location.href
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success('Question and answer copied to clipboard!', {
        icon: '📋',
        style: {
          borderRadius: '16px',
          background: '#1c1917',
          color: '#fff',
          fontSize: '13px'
        }
      });
    }
  };

  return (
    <div
      id="faq-page-container"
      className="min-h-screen bg-[#FAF8F5] text-stone-900 transition-colors duration-300 relative selection:bg-orange-200 selection:text-orange-950"
    >
      {/* Delicate warm ambient gradients */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-amber-100/40 via-orange-50/30 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-10 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-10 w-80 h-80 bg-orange-200/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-24 md:pb-32">
        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section id="faq-hero" className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          {/* Subtle Bakery Pill Tag */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100/80 border border-orange-200/80 text-orange-900 text-xs font-semibold uppercase tracking-wider mb-5 shadow-xs"
          >
            <Sparkles size={14} className="text-orange-600 animate-pulse" />
            <span>Help Center & Knowledge Base</span>
          </motion.div>

          {/* Main Headings */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight font-display mb-4"
          >
            Frequently Asked Questions
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-stone-600 font-medium leading-relaxed max-w-xl mx-auto mb-8"
          >
            Everything you need to know about Frosty Bite Bakery.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative max-w-2xl mx-auto"
          >
            <div className="relative flex items-center bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-stone-200/80 hover:border-orange-300 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/15 transition-all duration-300">
              <div className="pl-5 sm:pl-6 text-stone-400">
                <Search size={22} className="text-stone-500" />
              </div>

              <input
                ref={searchInputRef}
                id="faq-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your question..."
                className="w-full py-4 sm:py-5 pl-3.5 pr-12 sm:pr-20 text-stone-900 placeholder:text-stone-400 bg-transparent text-sm sm:text-base font-medium rounded-2xl sm:rounded-3xl outline-none"
                aria-label="Search FAQ questions"
              />

              {searchQuery ? (
                <button
                  id="faq-search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-4 p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label="Clear search input"
                >
                  <X size={18} />
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 absolute right-4 px-2 py-1 rounded-md bg-stone-100 border border-stone-200/70 text-[11px] font-semibold text-stone-500">
                  <kbd className="font-mono">/</kbd>
                  <span>to search</span>
                </div>
              )}
            </div>

            {/* Live match indicator during search */}
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2.5 flex items-center justify-between text-xs text-stone-500 px-3"
              >
                <span>
                  Found <strong className="text-stone-800 font-bold">{filteredFAQs.length}</strong> {filteredFAQs.length === 1 ? 'question' : 'questions'} matching &ldquo;{searchQuery}&rdquo;
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-orange-600 hover:underline font-semibold"
                >
                  Clear search
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Quick Search Chips */}
          {!searchQuery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-500"
            >
              <span className="font-medium text-stone-400">Popular searches:</span>
              {['Home delivery', 'UPI payment', 'Custom cake', 'Eggless', 'Cancel order'].map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-orange-50 border border-stone-200/60 hover:border-orange-200 text-stone-700 hover:text-orange-800 transition-all font-medium shadow-2xs"
                >
                  {term}
                </button>
              ))}
            </motion.div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* FAQ CATEGORIES TABS */}
        {/* ========================================================================= */}
        <section id="faq-categories-section" className="mb-8 sm:mb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Browse by Category
            </h2>
            <span className="text-xs text-stone-400 font-medium">
              {FAQ_ITEMS.length} total questions
            </span>
          </div>

          {/* Horizontal Scrollable Tabs Container */}
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-hide no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {FAQ_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;
                const count = categoryCounts[category.id] || 0;

                return (
                  <button
                    key={category.id}
                    id={`faq-tab-${category.id.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => {
                      setSelectedCategory(category.id);
                    }}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 select-none shadow-2xs",
                      isSelected
                        ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                        : "bg-white hover:bg-stone-100/80 text-stone-700 border border-stone-200/80 hover:border-stone-300"
                    )}
                    aria-selected={isSelected}
                    role="tab"
                  >
                    <span className={cn(isSelected ? "text-white" : "text-stone-500")}>
                      {getCategoryIcon(category.id, 16)}
                    </span>
                    <span>{category.label}</span>
                    <span
                      className={cn(
                        "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-stone-100 text-stone-500"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ACCORDION CONTROLS (EXPAND/COLLAPSE & STATS) */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
            <span>
              Showing {filteredFAQs.length} {filteredFAQs.length === 1 ? 'result' : 'results'}
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              id="faq-expand-all-btn"
              onClick={expandAll}
              className="text-stone-600 hover:text-orange-600 font-semibold transition-colors"
            >
              Expand all
            </button>
            <span className="text-stone-300">|</span>
            <button
              id="faq-collapse-all-btn"
              onClick={collapseAll}
              className="text-stone-600 hover:text-orange-600 font-semibold transition-colors"
            >
              Collapse all
            </button>
            <span className="text-stone-300">|</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-600 select-none">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 border-stone-300 cursor-pointer"
              />
              <span>Multi-open</span>
            </label>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FAQ ACCORDION LIST */}
        {/* ========================================================================= */}
        <section id="faq-accordion-list" className="space-y-3.5">
          <AnimatePresence mode="popLayout">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((faq, index) => {
                const isOpen = openIds.includes(faq.id);

                return (
                  <motion.div
                    key={faq.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                    className={cn(
                      "group bg-white rounded-2xl sm:rounded-3xl border transition-all duration-300 overflow-hidden",
                      isOpen
                        ? "border-orange-300/90 shadow-[0_10px_30px_rgba(249,115,22,0.08)] ring-1 ring-orange-400/20"
                        : "border-stone-200/80 hover:border-stone-300 shadow-xs hover:shadow-md"
                    )}
                  >
                    {/* Accordion Header / Button */}
                    <button
                      id={`faq-question-btn-${faq.id}`}
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-2xl sm:rounded-3xl"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${faq.id}`}
                    >
                      <div className="flex-1 pr-2">
                        {/* Tags / Category Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200/60">
                            {getCategoryIcon(faq.category, 11)}
                            <span>{faq.category}</span>
                          </span>

                          {faq.isPopular && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200/80">
                              <Sparkles size={10} className="text-amber-600" />
                              <span>Top Question</span>
                            </span>
                          )}
                        </div>

                        {/* Question Text */}
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-orange-950 transition-colors leading-snug">
                          {faq.question}
                        </h3>
                      </div>

                      {/* Expand / Collapse Icon Pill (+ / -) */}
                      <div
                        className={cn(
                          "shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 mt-0.5",
                          isOpen
                            ? "bg-orange-600 text-white rotate-180 shadow-sm shadow-orange-600/30"
                            : "bg-stone-100 text-stone-600 group-hover:bg-orange-50 group-hover:text-orange-600"
                        )}
                        aria-hidden="true"
                      >
                        {isOpen ? (
                          <Minus size={16} strokeWidth={2.5} />
                        ) : (
                          <Plus size={16} strokeWidth={2.5} />
                        )}
                      </div>
                    </button>

                    {/* Accordion Content Panel with Smooth Animation */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`faq-answer-${faq.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                          className="overflow-hidden border-t border-stone-100 bg-gradient-to-b from-stone-50/50 to-white"
                        >
                          <div className="p-5 sm:p-6 pt-4 sm:pt-5 space-y-4">
                            {/* Main Answer Paragraph */}
                            <p className="text-sm sm:text-base text-stone-700 font-normal leading-relaxed">
                              {faq.answer}
                            </p>

                            {/* Highlight Bullet Points if present */}
                            {faq.highlights && faq.highlights.length > 0 && (
                              <div className="bg-orange-50/50 rounded-xl sm:rounded-2xl p-4 border border-orange-100/80 space-y-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-orange-900 flex items-center gap-1.5">
                                  <CheckCircle2 size={14} className="text-orange-600" />
                                  <span>Key Highlights</span>
                                </h4>
                                <ul className="space-y-1.5 text-xs sm:text-sm text-stone-700">
                                  {faq.highlights.map((highlight, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0" />
                                      <span className="leading-snug">{highlight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Micro Actions Bar: Helpful feedback & share */}
                            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Was this answer helpful?</span>
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    id={`faq-helpful-yes-${faq.id}`}
                                    onClick={() => handleFeedback(faq.id, 'yes')}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-all",
                                      helpfulFeedback[faq.id] === 'yes'
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900"
                                    )}
                                    aria-label="Mark answer as helpful"
                                  >
                                    <ThumbsUp size={12} />
                                    <span>Yes</span>
                                  </button>

                                  <button
                                    id={`faq-helpful-no-${faq.id}`}
                                    onClick={() => handleFeedback(faq.id, 'no')}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-all",
                                      helpfulFeedback[faq.id] === 'no'
                                        ? "bg-rose-50 text-rose-700 border-rose-300"
                                        : "bg-white hover:bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900"
                                    )}
                                    aria-label="Mark answer as not helpful"
                                  >
                                    <ThumbsDown size={12} />
                                    <span>No</span>
                                  </button>
                                </div>
                              </div>

                              <button
                                id={`faq-share-btn-${faq.id}`}
                                onClick={() => handleShare(faq)}
                                className="inline-flex items-center gap-1.5 text-stone-500 hover:text-orange-600 font-medium transition-colors"
                                aria-label="Share this question"
                              >
                                <Share2 size={13} />
                                <span>Share</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              /* "NO RESULTS FOUND" EMPTY STATE */
              <motion.div
                key="no-results"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 px-6 bg-white rounded-3xl border border-stone-200/80 shadow-sm max-w-lg mx-auto"
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-100/60 text-orange-600 flex items-center justify-center mx-auto mb-4 border border-orange-200/60">
                  <HelpCircle size={32} />
                </div>

                <h3 className="text-lg font-bold text-stone-900 mb-2 font-display">
                  No matching questions found
                </h3>

                <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                  We could not find any FAQ matching &ldquo;
                  <span className="font-semibold text-stone-800">{searchQuery}</span>
                  &rdquo; in {selectedCategory === 'All' ? 'any category' : selectedCategory}. Try using broader terms or ask our bakery butler directly!
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    id="faq-reset-filters-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-orange-600/20"
                  >
                    Clear All Filters
                  </button>

                  <a
                    href={`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(
                      `Hello Frosty Bite, I have a question about: ${searchQuery}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <MessageCircle size={14} className="text-emerald-600" />
                    <span>Ask on WhatsApp</span>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ========================================================================= */}
        {/* TRUST & SERVICE BADGES */}
        {/* ========================================================================= */}
        <section
          id="faq-trust-badges"
          className="mt-14 pt-10 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6"
        >
          <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-stone-200/70 flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-orange-100/70 text-orange-700 shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-1">30–45 Min Fresh Delivery</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Fast temperature-controlled dispatch for fresh celebration cakes and treats.
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-stone-200/70 flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-700 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-1">100% Freshness Guarantee</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Pristine arrival assurance with prompt replacement or instant full refund.
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-stone-200/70 flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-amber-100/70 text-amber-700 shrink-0">
              <Cake size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 mb-1">Custom Cake Artistry</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Handcrafted bespoke designs, 100% eggless options, and personal dedication piping.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* STILL HAVE QUESTIONS? CALLOUT CARD */}
        {/* ========================================================================= */}
        <section
          id="faq-contact-card"
          className="mt-10 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white rounded-3xl p-7 sm:p-10 shadow-xl relative overflow-hidden"
        >
          {/* Subtle warm glow inside card */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-orange-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <Headphones size={13} />
                <span>Need Personalized Help?</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white">
                Still have questions?
              </h3>
              <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
                Can&apos;t find the answer you&apos;re looking for? Chat directly with our head pastry team or customer concierge on WhatsApp for instant assistance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <a
                id="faq-whatsapp-support-btn"
                href={`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(
                  'Hello Frosty Bite Bakery! I have an inquiry regarding my order.'
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <MessageCircle size={18} />
                <span>Chat on WhatsApp</span>
              </a>

              <Link
                id="faq-explore-menu-btn"
                to="/"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10"
              >
                <span>Browse Menu</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FAQ;
