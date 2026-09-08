import React from 'react';
import { Truck, Sparkles, ShieldCheck, PackageCheck } from 'lucide-react';

const VALUES = [
  {
    icon: Truck,
    title: 'Fast Delivery',
    subtitle: 'On time, every time',
  },
  {
    icon: Sparkles,
    title: 'Freshly Baked',
    subtitle: 'Made with love daily',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Payments',
    subtitle: '100% safe & secure',
  },
  {
    icon: PackageCheck,
    title: 'Hygienic Packaging',
    subtitle: 'Safe & hygienic',
  },
];

export const HomeValuePropositions: React.FC = () => {
  return (
    <section className="pt-1 pb-3 w-full">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {VALUES.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-[#FCF9F5] border border-[#F3EFE9] rounded-xl p-2.5 sm:p-3 flex items-center gap-2.5 shadow-2xs transition-colors hover:bg-[#faede2]/50"
            >
              <div className="text-neutral-700 shrink-0">
                <Icon className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-bold text-neutral-800 leading-tight truncate">
                  {item.title}
                </p>
                <p className="text-[9px] sm:text-[10px] text-neutral-500 truncate">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
