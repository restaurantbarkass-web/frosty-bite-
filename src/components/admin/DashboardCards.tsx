import React, { useState, useEffect } from 'react';
import { ShoppingBag, DollarSign, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { safeFirestore } from '../../services/firestoreService';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend: number;
  color: string;
}

const StatCard: React.FC<CardProps> = ({ title, value, icon: Icon, trend, color }) => {
  const isPositive = trend >= 0;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-${color}-500/20 transition-all`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-500 border border-${color}-500/20 shadow-lg shadow-${color}-500/5`}>
          <Icon size={24} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 relative z-10">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(trend)}%
        </div>
        <span className="text-xs text-gray-600 font-medium">vs last 24h</span>
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
    // Listen to orders
    const qOrders = query(
      collection(db, 'orders'),
      orderBy('created_at', 'desc'),
      limit(1000)
    );

    const unsubscribeOrders = safeFirestore.listen(
      qOrders,
      (orders: any[]) => {
        if (orders) {
          processOrders(orders);
        }
      },
      'dashboard_stats_orders_cache'
    );

    // Listen to users/customers
    const unsubscribeUsers = safeFirestore.listen(
      collection(db, 'users'),
      (users: any[]) => {
        if (users) {
          setStats(prev => ({ ...prev, totalCustomers: users.length }));
        }
      },
      'dashboard_stats_users_cache'
    );

    return () => {
      unsubscribeOrders();
      unsubscribeUsers();
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
