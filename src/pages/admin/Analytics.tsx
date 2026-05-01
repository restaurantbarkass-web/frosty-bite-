import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Download, FileText, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { safeFirestore } from '../../services/firestoreService';

import { Order } from '../../types';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">
          ₹{payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export const Analytics: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      orderBy('created_at', 'asc'),
      limit(500)
    );

    const unsubscribe = safeFirestore.listen(q, (data: Order[]) => {
      if (data) {
        // Filter out UPI/Online orders that haven't submitted a UTR yet and haven't been paid
        const actionableOrders = data.filter(o => {
          if ((o.payment_method === 'upi' || o.payment_method === 'online') && !o.utr && o.payment_status !== 'paid') {
            return false;
          }
          return true;
        });

        setOrders(actionableOrders);
        setFilteredOrders(actionableOrders);
      }
      setLoading(false);
    }, 'admin_analytics_cache');

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!startDate && !endDate) {
      setFilteredOrders(orders);
      return;
    }

    const filtered = orders.filter(order => {
      if (!order.created_at) return false;
      const orderDate = new Date(order.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && orderDate < start) return false;
      if (end) {
        // Set end to end of day
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (orderDate > endOfDay) return false;
      }
      return true;
    });

    setFilteredOrders(filtered);
  }, [startDate, endDate, orders]);

  // Calculate stats
  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalOrders = filteredOrders.length;
  const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length;
  
  // Group by date for chart
  const revenueByDate = filteredOrders.reduce((acc: any, curr: any) => {
    if (!curr.created_at) return acc;
    const dateObj = new Date(curr.created_at);
    const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + (curr.total || 0);
    return acc;
  }, {});

  const chartData = Object.entries(revenueByDate).map(([name, revenue]) => ({ name, revenue }));

  // Group by category
  const popularItemsData = [
    { name: 'Cakes', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cake'))).length },
    { name: 'Pastries', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('pastry') || i.name?.toLowerCase().includes('croissant'))).length },
    { name: 'Breads', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('bread') || i.name?.toLowerCase().includes('loaf'))).length },
    { name: 'Cookies', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cookie'))).length },
  ];

  const exportToCSV = () => {
    const headers = ['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'];
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map(order => [
      order.id,
      order.customer_name || 'N/A',
      order.items?.map((i: any) => {
        if (typeof i === 'string') return i;
        return `${i.name || 'Unknown'} (x${i.quantity || 1})`;
      }).join('; ') || 'No items',
      order.total || 0,
      order.status,
      order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'
    ].map(escapeCSV));

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics_report_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generatePDFReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Advanced Analytics</h1>
          <p className="text-gray-500 font-medium">Deep dive into your restaurant's performance metrics.</p>
        </div>
        <div className="flex items-center gap-4 relative">
          <div className="relative">
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all"
            >
              <Calendar size={20} className="text-orange-500" />
              {startDate || endDate ? `${startDate || '...'} to ${endDate || '...'}` : 'Select Date Range'}
            </button>
            
            <AnimatePresence>
              {showDatePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-4 p-6 bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl z-[100] min-w-[300px] backdrop-blur-xl"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Start Date</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">End Date</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500/50"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setShowDatePicker(false); }}
                        className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={exportToCSV}
            className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all"
          >
            <Download size={20} className="text-gray-400" />
            Export CSV
          </button>
          <button 
            onClick={generatePDFReport}
            className="flex items-center gap-3 px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
          >
            <FileText size={20} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, trend: 12.5, icon: DollarSign, color: 'emerald' },
          { title: 'Total Orders', value: totalOrders.toString(), trend: 8.2, icon: TrendingUp, color: 'blue' },
          { title: 'Delivered', value: deliveredOrders.toString(), trend: 15.8, icon: ShoppingBag, color: 'orange' },
        ].map((stat) => (
          <motion.div 
            key={stat.title}
            whileHover={{ y: -5 }}
            className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform`} />
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 border border-${stat.color}-500/20 mb-6`}>
                <stat.icon size={28} />
              </div>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-2">{stat.title}</p>
              <h4 className="text-3xl font-black text-white mb-4">{stat.value}</h4>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                  <TrendingUp size={14} />
                  +100%
                </div>
                <span className="text-xs text-gray-600 font-medium">vs previous period</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-10 h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Revenue Growth</h3>
              <p className="text-sm text-gray-500">Total revenue generated over time</p>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
              <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7dd3fc" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#7dd3fc" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#666', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#666', fontSize: 12, fontWeight: 500 }}
                tickFormatter={(value) => `₹${value/1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#7dd3fc" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

        <div className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-10 h-[500px] flex flex-col">
          <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Order Distribution</h3>
          <p className="text-sm text-gray-500 mb-10">Breakdown by category</p>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
              <BarChart data={popularItemsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#666', fontSize: 10, fontWeight: 500 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="sales" radius={[10, 10, 0, 0]} barSize={40}>
                {popularItemsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f97316' : '#3b82f6'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
  );
};
