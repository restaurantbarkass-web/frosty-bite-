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
  ArrowRight,
  Clock,
  ShieldCheck,
  Headphones,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { RESTAURANT_WHATSAPP } from '../constants';
import { FAQ_ITEMS, FAQ_CATEGORIES, FAQCategory, FAQItem } from '../data/faqData';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

// Helper to map category to Lucide icon
const getCategoryIcon = (category: FAQCategory, size = 16) => {
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
  const [openIds, setOpenIds] = useState<string[]>(['order-place']); // Default open first question
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

      // Text search matching across all fields
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
    toast.success('All questions expanded', {
      style: { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
    });
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
          background: '#18181b',
          color: '#fff',
          fontSize: '13px',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }
    );
  };

  const handleShare = async (faq: FAQItem) => {
    const shareText = `Frosty Bite Bakery FAQ:\nQ: ${faq.question}\n\nA: ${faq.answer}`;
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
      toast.success('Answer copied to clipboard!', {
        icon: '📋',
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
          fontSize: '13px',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      });
    }
  };

  return (
    <div
      id="faq-page-container"
      className="min-h-screen bg-black text-white selection:bg-primary/30 selection:text-white relative pb-28 md:pb-20"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-10 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section id="faq-hero" className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          {/* Subtle Bakery Pill Tag */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-5"
          >
            <Sparkles size={14} className="animate-pulse text-primary" />
            <span>Help Center & Knowledge Base</span>
          </motion.div>

          {/* Main Headings */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4"
          >
            Frequently Asked Questions
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-zinc-400 font-medium leading-relaxed max-w-xl mx-auto mb-8"
          >
            Instant answers about ordering, delivery speeds, custom cake designs, refunds, and dietary choices.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative max-w-2xl mx-auto"
          >
            <div className="relative flex items-center bg-zinc-900/90 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/10 hover:border-primary/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20 transition-all duration-300 shadow-2xl">
              <div className="pl-5 sm:pl-6 text-zinc-400">
                <Search size={22} className="text-zinc-400" />
              </div>

              <input
                ref={searchInputRef}
                id="faq-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your question (e.g., eggless, delivery, refund)..."
                className="w-full py-4 sm:py-5 pl-3.5 pr-12 sm:pr-24 text-white placeholder:text-zinc-500 bg-transparent text-sm sm:text-base font-medium rounded-2xl sm:rounded-3xl outline-none"
                aria-label="Search FAQ questions"
              />

              {searchQuery ? (
                <button
                  id="faq-search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  aria-label="Clear search input"
                >
                  <X size={18} />
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 absolute right-5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-white/10 text-[11px] font-semibold text-zinc-400">
                  <kbd className="font-mono text-zinc-300">/</kbd>
                  <span>to search</span>
                </div>
              )}
            </div>

            {/* Live match indicator during search */}
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center justify-between text-xs text-zinc-400 px-3"
              >
                <span>
                  Found <strong className="text-white font-bold">{filteredFAQs.length}</strong> {filteredFAQs.length === 1 ? 'question' : 'questions'} matching &ldquo;{searchQuery}&rdquo;
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-primary hover:underline font-semibold"
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
              className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs"
            >
              <span className="font-medium text-zinc-500">Popular:</span>
              {['Home delivery', 'UPI payment', 'Custom cake', 'Eggless', 'Cancel order', 'Pickup'].map((term) => (
                <button
                  key={term}
                  onClick={() => setSearchQuery(term)}
                  className="px-3 py-1.5 rounded-full bg-zinc-900/80 hover:bg-primary/20 border border-white/10 hover:border-primary/40 text-zinc-300 hover:text-primary transition-all font-medium"
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Browse by Category
            </h2>
            <span className="text-xs text-zinc-500 font-medium">
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
                      "relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap shrink-0 select-none cursor-pointer",
                      isSelected
                        ? "bg-primary text-white shadow-lg shadow-primary/30 border border-primary"
                        : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-white/10 hover:border-white/20"
                    )}
                    aria-selected={isSelected}
                    role="tab"
                  >
                    <span className={cn(isSelected ? "text-white" : "text-primary")}>
                      {getCategoryIcon(category.id, 16)}
                    </span>
                    <span>{category.label}</span>
                    <span
                      className={cn(
                        "ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-black",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-zinc-800 text-zinc-400"
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
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>
              Showing {filteredFAQs.length} {filteredFAQs.length === 1 ? 'result' : 'results'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              id="faq-expand-all-btn"
              onClick={expandAll}
              className="text-zinc-400 hover:text-primary font-semibold transition-colors cursor-pointer"
            >
              Expand all
            </button>
            <span className="text-zinc-700">|</span>
            <button
              id="faq-collapse-all-btn"
              onClick={collapseAll}
              className="text-zinc-400 hover:text-primary font-semibold transition-colors cursor-pointer"
            >
              Collapse all
            </button>
            <span className="text-zinc-700">|</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-zinc-700 bg-zinc-800 cursor-pointer"
              />
              <span>Multi-open</span>
            </label>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FAQ ACCORDION LIST */}
        {/* ========================================================================= */}
        <section id="faq-accordion-list" className="space-y-3.5">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => {
              const isOpen = openIds.includes(faq.id);

              return (
                <div
                  key={faq.id}
                  className={cn(
                    "group bg-zinc-900/80 backdrop-blur-md rounded-2xl sm:rounded-3xl border transition-all duration-200 overflow-hidden",
                    isOpen
                      ? "border-primary/50 shadow-[0_10px_30px_rgba(255,107,38,0.1)] ring-1 ring-primary/20"
                      : "border-white/10 hover:border-white/20"
                  )}
                >
                  {/* Accordion Header / Button */}
                  <button
                    id={`faq-question-btn-${faq.id}`}
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl sm:rounded-3xl"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${faq.id}`}
                  >
                    <div className="flex-1 pr-2">
                      {/* Tags / Category Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-white/10">
                          {getCategoryIcon(faq.category, 12)}
                          <span>{faq.category}</span>
                        </span>

                        {faq.isPopular && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Sparkles size={11} className="text-amber-400" />
                            <span>Top Question</span>
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors leading-snug">
                        {faq.question}
                      </h3>
                    </div>

                    {/* Expand / Collapse Icon Pill (+ / -) */}
                    <div
                      className={cn(
                        "shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 mt-0.5",
                        isOpen
                          ? "bg-primary text-white rotate-180 shadow-md shadow-primary/30"
                          : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white"
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

                  {/* Accordion Content Panel */}
                  {isOpen && (
                    <div
                      id={`faq-answer-${faq.id}`}
                      className="border-t border-white/10 bg-zinc-950/60 transition-all duration-200"
                    >
                      <div className="p-5 sm:p-6 pt-4 sm:pt-5 space-y-4">
                        {/* Main Answer Paragraph */}
                        <p className="text-sm sm:text-base text-zinc-300 font-normal leading-relaxed">
                          {faq.answer}
                        </p>

                        {/* Highlight Bullet Points if present */}
                        {faq.highlights && faq.highlights.length > 0 && (
                          <div className="bg-primary/5 rounded-xl sm:rounded-2xl p-4 border border-primary/20 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <CheckCircle2 size={14} className="text-primary" />
                              <span>Key Highlights</span>
                            </h4>
                            <ul className="space-y-1.5 text-xs sm:text-sm text-zinc-300">
                              {faq.highlights.map((highlight, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                  <span className="leading-snug">{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Micro Actions Bar: Helpful feedback & share */}
                        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-400">Was this answer helpful?</span>
                            <div className="inline-flex items-center gap-1">
                              <button
                                id={`faq-helpful-yes-${faq.id}`}
                                onClick={() => handleFeedback(faq.id, 'yes')}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-all cursor-pointer",
                                  helpfulFeedback[faq.id] === 'yes'
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-300 hover:text-white"
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
                                  "px-2.5 py-1 rounded-lg border flex items-center gap-1 font-semibold transition-all cursor-pointer",
                                  helpfulFeedback[faq.id] === 'no'
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : "bg-zinc-800 hover:bg-zinc-700 border-white/10 text-zinc-300 hover:text-white"
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
                            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-primary font-medium transition-colors cursor-pointer"
                            aria-label="Share this question"
                          >
                            <Share2 size={13} />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* "NO RESULTS FOUND" EMPTY STATE */
            <div className="text-center py-16 px-6 bg-zinc-900/70 rounded-3xl border border-white/10 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <HelpCircle size={32} />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                No matching questions found
              </h3>

              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                We could not find any FAQ matching &ldquo;
                <span className="font-semibold text-white">{searchQuery}</span>
                &rdquo; in {selectedCategory === 'All' ? 'any category' : selectedCategory}. Try using broader terms or chat with our team directly!
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  id="faq-reset-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-primary/20 cursor-pointer"
                >
                  Clear All Filters
                </button>

                <a
                  href={`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(
                    `Hello Frosty Bite, I have a question about: ${searchQuery}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
                >
                  <MessageCircle size={14} className="text-emerald-400" />
                  <span>Ask on WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* TRUST & SERVICE BADGES */}
        {/* ========================================================================= */}
        <section
          id="faq-trust-badges"
          className="mt-14 pt-10 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-5"
        >
          <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 border border-primary/20">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">30–45 Min Fresh Delivery</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Fast temperature-controlled dispatch for fresh celebration cakes and treats.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 border border-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">100% Freshness Guarantee</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pristine arrival assurance with prompt replacement or instant full refund.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 border border-amber-500/20">
              <Cake size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Custom Cake Artistry</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
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
          className="mt-10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black text-white rounded-3xl p-7 sm:p-10 border border-white/10 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
                <Headphones size={13} />
                <span>Need Personalized Help?</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Still have questions?
              </h3>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                Can&apos;t find the answer you&apos;re looking for? Chat directly with our pastry concierge on WhatsApp for instant order assistance.
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
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <MessageCircle size={18} />
                <span>Chat on WhatsApp</span>
              </a>

              <Link
                id="faq-explore-menu-btn"
                to="/"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
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
