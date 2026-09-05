import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface CategoryItem {
  id: string;
  name: string;
  emoji?: string;
  isOffer?: boolean;
  bgColor: string;
  borderColor: string;
}

const CATEGORY_ITEMS: CategoryItem[] = [
  { id: 'Cakes', name: 'Cakes', emoji: '🍰', bgColor: 'bg-[#FFF1EE]', borderColor: 'border-[#FADCD6]' },
  { id: 'Pastries', name: 'Pastries', emoji: '🍮', bgColor: 'bg-[#F7F2EB]', borderColor: 'border-[#E9DFD3]' },
  { id: 'Cupcakes', name: 'Cupcakes', emoji: '🧁', bgColor: 'bg-[#FDF0F3]', borderColor: 'border-[#F8DBE2]' },
  { id: 'Brownies', name: 'Brownies', emoji: '🍫', bgColor: 'bg-[#F5ECE5]', borderColor: 'border-[#E8D8CC]' },
  { id: 'Cookies', name: 'Cookies', emoji: '🍪', bgColor: 'bg-[#FEF7EA]', borderColor: 'border-[#F6E7CA]' },
  { id: 'Desserts', name: 'Desserts', emoji: '🍨', bgColor: 'bg-[#F5F2EC]', borderColor: 'border-[#E8E1D5]' },
  { id: 'Offers', name: 'Offers', isOffer: true, bgColor: 'bg-[#FFF0E8]', borderColor: 'border-[#FED8C6]' },
  { id: 'Custom', name: 'Custom', emoji: '🎂', bgColor: 'bg-[#F3EFF8]', borderColor: 'border-[#E3DAED]' },
];

interface HomeQuickCategoriesProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const HomeQuickCategories: React.FC<HomeQuickCategoriesProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  const navigate = useNavigate();

  const handleClick = (item: CategoryItem) => {
    if (item.isOffer) {
      navigate('/offers');
      return;
    }
    if (item.id === 'Custom') {
      navigate('/custom-cake');
      return;
    }
    onSelectCategory(item.id);
    const el = document.getElementById('menu-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleViewAll = () => {
    navigate('/categories');
  };

  return (
    <section className="space-y-2.5 pt-1">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-[18px] font-bold text-[#1F1A17] tracking-tight">Categories</h3>
        <button 
          type="button"
          onClick={handleViewAll}
          className="text-[13px] font-semibold text-[#E76A54] hover:text-[#d35842] flex items-center gap-0.5 transition-colors cursor-pointer"
        >
          <span>View all</span>
          <span className="text-sm leading-none">→</span>
        </button>
      </div>

      {/* Horizontal Category Scroll Row */}
      <div className="flex gap-3.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 snap-x snap-mandatory scroll-smooth">
        {CATEGORY_ITEMS.map((item) => {
          const isActive = activeCategory.toLowerCase() === item.id.toLowerCase();
          return (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              className="snap-start shrink-0 w-[76px] flex flex-col items-center group cursor-pointer active:scale-95 transition-transform select-none"
            >
              <div 
                className={`w-[74px] h-[74px] rounded-2xl ${item.bgColor} border ${item.borderColor} flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.03)] group-hover:shadow-md transition-all ${
                  isActive ? 'ring-2 ring-[#E76A54] shadow-md scale-105' : ''
                }`}
              >
                {item.isOffer ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E76A54] to-[#F29479] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    %
                  </div>
                ) : (
                  <div className="w-11 h-11 flex items-center justify-center text-3xl transition-transform group-hover:scale-110">
                    {item.emoji}
                  </div>
                )}
              </div>
              <span className={`text-[12px] font-medium mt-1.5 text-center leading-tight truncate max-w-full ${
                isActive ? 'text-[#E76A54] font-bold' : 'text-[#1F1A17]'
              }`}>
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

