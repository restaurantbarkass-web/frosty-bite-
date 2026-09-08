import React, { useState, useEffect } from 'react';
import { ShoppingBag, DollarSign, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend: number;
  color: string;
}

const StatCard: React.FC<CardProps> = ({ title, value, icon: Icon, trend, color }) => {
  const isPositive = trend >= 0;

  const colorStyles: Record<string, { bg: string; text: string; border: string }> = {
    orange: { bg: 'bg-orange-50', text: 'text-[#E76A54]', border: 'border-orange-200/80' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
    blue: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200/80' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80' },
  };

  const style = colorStyles[color] || colorStyles.orange;

  return (
    <motion.div 
      whileHover={{ y: -3 }}
      className="bg-white border border-stone-200/80 shadow-xs hover:shadow-md rounded-3xl p-4 sm:p-6 relative overflow-hidden group transition-all"
    >
      <div className="flex items-start justify-between relative z-10 gap-2">
        <div>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 sm:p-3.5 rounded-2xl ${style.bg} ${style.text} border ${style.border} shrink-0`}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
      </div>

      <div className="mt-4 sm:mt-6 flex items-center gap-2 relative z-10">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold ${isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </div>
        <span className="text-[10px] sm:text-xs text-stone-400 font-medium">vs last 24h</span>
      </div>
    </motion.div>
  );
};

export const DashboardCards: React.FC = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    revenueToday: 0,
    activeOrders: 0,
    totalCustomers: 0
  });

  const processOrders = (orders: any[]) => {
    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const totalOrdersLast24h = orders.filter(o => {
      const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
      return ts >= twentyFourHoursAgo;
    }).length;
    
    const revenueToday = orders
      .filter(o => {
        const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
        return ts >= today;
      })
      .reduce((acc, curr) => acc + (curr.total || 0), 0);
    
    const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;
    
    setStats(prev => ({
      ...prev,
      totalOrders: totalOrdersLast24h,
      revenueToday,
      activeOrders
    }));
  };

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // Fetch orders for stats
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        
        if (ordersError) throw ordersError;
        if (orders) processOrders(orders);

        // Fetch users count
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id');
        
        if (usersError) throw usersError;
        if (users) setStats(prev => ({ ...prev, totalCustomers: users.length }));
      } catch (err) {
        console.error('Error fetching dashboard stats from Supabase:', err);
      }
    };

    fetchDashboardStats();

    // Real-time updates
    const ordersChannel = supabase
      .channel('dashboard_stats_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDashboardStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchDashboardStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      <StatCard 
        title="Total Orders" 
        value={stats.totalOrders.toLocaleString()} 
        icon={ShoppingBag} 
        trend={12.5} 
        color="orange" 
      />
      <StatCard 
        title="Revenue Today" 
        value={`₹${stats.revenueToday.toLocaleString()}`} 
        icon={DollarSign} 
        trend={8.2} 
        color="emerald" 
      />
      <StatCard 
        title="Active Orders" 
        value={stats.activeOrders.toString()} 
        icon={Activity} 
        trend={-2.4} 
        color="blue" 
      />
      <StatCard 
        title="Total Customers" 
        value={stats.totalCustomers.toLocaleString()} 
        icon={Users} 
        trend={15.8} 
        color="purple" 
      />
    </div>
  );
};
