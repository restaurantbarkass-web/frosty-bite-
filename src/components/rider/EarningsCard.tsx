import React from 'react';
import { DollarSign, Truck, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface EarningsCardProps {
  todayEarnings: number;
  totalDeliveries: number;
  isLoading?: boolean;
}

export const EarningsCard: React.FC<EarningsCardProps> = ({ todayEarnings, totalDeliveries, isLoading }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-dark p-6 rounded-3xl border border-white/5 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <DollarSign size={48} className="text-emerald-500" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <Calendar size={14} />
            <span className="text-[10px] uppercase font-bold tracking-widest">Today Earnings</span>
          </div>
          
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">₹{todayEarnings}</span>
            <span className="text-xs text-emerald-500 font-bold flex items-center gap-0.5">
              <TrendingUp size={10} />
              +12%
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-dark p-6 rounded-3xl border border-white/5 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Truck size={48} className="text-orange-500" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <Truck size={14} />
            <span className="text-[10px] uppercase font-bold tracking-widest">Deliveries</span>
          </div>
          
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">{totalDeliveries}</span>
            <span className="text-[10px] text-zinc-500 font-bold">Total</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
