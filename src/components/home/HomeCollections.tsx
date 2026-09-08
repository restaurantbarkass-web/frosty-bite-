import React from 'react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface CollectionItem {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  border: string;
  image: string;
  filterTag: string;
}

const COLLECTIONS: CollectionItem[] = [
  {
    id: 'birthday',
    title: 'Birthday\nSpecial',
    subtitle: 'Make birthdays extra special',
    bg: 'bg-[#FBF0EE]',
    border: 'border-[#F8E2DE]',
    image: '/images/stitch/collection-birthday.png',
    filterTag: 'Birthday',
  },
  {
    id: 'minicakes',
    title: 'Mini\nCakes',
    subtitle: 'Small in size, big on happiness',
    bg: 'bg-[#FFF6E9]',
    border: 'border-[#FDEACD]',
    image: '/images/stitch/collection-minicakes.png',
    filterTag: 'Cake',
  },
  {
    id: 'chocolate',
    title: 'Chocolate\nLovers',
    subtitle: 'Rich. Decadent. Irresistible.',
    bg: 'bg-[#F5EFEA]',
    border: 'border-[#E9DCD1]',
    image: '/images/stitch/collection-chocolate.png',
    filterTag: 'Chocolate',
  },
];

interface HomeCollectionsProps {
  onSelectCollection: (tag: string) => void;
}

export const HomeCollections: React.FC<HomeCollectionsProps> = ({ onSelectCollection }) => {
  const handleCardClick = (tag: string) => {
    onSelectCollection(tag);
    const el = document.getElementById('menu-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-3 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
          Collections for you
        </h3>
        <button
          type="button"
          onClick={() => handleCardClick('')}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 cursor-pointer transition-colors"
        >
          <span>View all</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
        </button>
      </div>

      {/* Horizontal Scrollable Cards */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 snap-x overscroll-x-contain">
        {COLLECTIONS.map((c) => (
          <motion.div
            key={c.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleCardClick(c.filterTag)}
            className={`snap-start shrink-0 w-60 sm:w-64 ${c.bg} rounded-2xl p-3.5 border ${c.border} flex items-center justify-between relative overflow-hidden shadow-xs cursor-pointer select-none hover:shadow-md transition-shadow`}
          >
            <div className="max-w-[55%] z-10 flex flex-col justify-center">
              <h4 className="font-serif font-bold text-neutral-900 text-sm sm:text-base leading-snug whitespace-pre-line">
                {c.title}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-1 leading-normal line-clamp-2">
                {c.subtitle}
              </p>
            </div>
            <div className="w-20 h-20 sm:w-22 sm:h-22 shrink-0 relative">
              <img
                src={c.image}
                alt={c.title.replace('\n', ' ')}
                className="w-full h-full object-cover rounded-full drop-shadow-md"
                loading="lazy"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
