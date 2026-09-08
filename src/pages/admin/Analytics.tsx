import React, { useState, useEffect } from 'react';
import { 
  LineChart,
  Line,
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
import { supabase } from '../../supabase';

import { Order } from '../../types';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xl">
        <p className="text-stone-500 text-xs font-bold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-stone-900 text-lg font-bold">
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
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1000);
        
        if (error) throw error;
        if (data) {
          // Filter out UPI/Online orders that haven't submitted a UTR yet and haven't been paid
          const actionableOrders = data.filter((o: Order) => {
            if ((o.payment_method === 'upi' || o.payment_method === 'online') && !o.utr && o.payment_status !== 'paid') {
              return false;
            }
            return true;
          });

          setOrders(actionableOrders);
          setFilteredOrders(actionableOrders);
        }
      } catch (error) {
        console.error('Error fetching orders for analytics from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // Subscribe to order changes for real-time analytics
    const channel = supabase
      .channel('analytics_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    { name: 'Cakes', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cake') && !i.name?.toLowerCase().includes('cheesecake'))).length },
    { name: 'Cheesecakes', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cheesecake'))).length },
    { name: 'Pastries', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('pastry') || i.name?.toLowerCase().includes('croissant'))).length },
    { name: 'Cupcakes', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cupcake'))).length },
    { name: 'Brownies', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('brownie'))).length },
    { name: 'Breads', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('bread') || i.name?.toLowerCase().includes('loaf'))).length },
    { name: 'Cookies', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('cookie'))).length },
    { name: 'Beverages', sales: filteredOrders.filter(o => o.items?.some((i: any) => i.name?.toLowerCase().includes('beverage') || i.name?.toLowerCase().includes('coffee') || i.name?.toLowerCase().includes('chocolate'))).length },
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
      <div className="bg-white border border-stone-200/80 rounded-3xl p-12 sm:p-20 flex flex-col items-center justify-center gap-4 shadow-xs">
        <div className="w-12 h-12 border-4 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
        <p className="text-stone-500 font-bold animate-pulse text-sm">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight mb-1 sm:mb-2">Advanced Analytics</h1>
          <p className="text-stone-500 font-medium text-sm">Deep dive into your bakery's performance metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 relative">
          <div className="relative w-full sm:w-auto">
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-4 sm:px-6 py-3 bg-white border border-stone-200 rounded-2xl text-stone-800 font-bold hover:bg-stone-50 transition-all text-sm shadow-xs"
            >
              <Calendar size={18} className="text-[#E76A54]" />
              <span className="truncate">{startDate || endDate ? `${startDate || '...'} to ${endDate || '...'}` : 'Select Date Range'}</span>
            </button>
            
            <AnimatePresence>
              {showDatePicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 sm:left-auto sm:right-0 mt-3 p-5 sm:p-6 bg-white border border-stone-200 rounded-3xl shadow-2xl z-[100] w-full sm:min-w-[300px]"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Start Date</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">End Date</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-900 focus:outline-none focus:border-[#E76A54]"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => { setStartDate(''); setEndDate(''); setShowDatePicker(false); }}
                        className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold hover:bg-stone-200 transition-colors"
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 py-2.5 rounded-xl bg-[#E76A54] text-white text-xs font-bold hover:bg-[#d95c46] transition-colors"
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
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white border border-stone-200 rounded-2xl text-stone-800 font-bold hover:bg-stone-50 transition-all text-sm shadow-xs"
          >
            <Download size={18} className="text-stone-500" />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={generatePDFReport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-8 py-3 bg-[#E76A54] text-white rounded-2xl font-bold shadow-md shadow-orange-500/15 hover:bg-[#d95c46] transition-all text-sm"
          >
            <FileText size={18} />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {[
          { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, trend: 12.5, icon: DollarSign, color: 'emerald' },
          { title: 'Total Orders', value: totalOrders.toString(), trend: 8.2, icon: TrendingUp, color: 'blue' },
          { title: 'Delivered', value: deliveredOrders.toString(), trend: 15.8, icon: ShoppingBag, color: 'orange' },
        ].map((stat) => (
          <motion.div 
            key={stat.title}
            whileHover={{ y: -3 }}
            className="bg-white border border-stone-200/80 rounded-[28px] p-6 sm:p-8 relative overflow-hidden group shadow-xs"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54] mb-5">
                <stat.icon size={26} />
              </div>
              <p className="text-stone-500 text-xs font-bold uppercase tracking-widest mb-1.5">{stat.title}</p>
              <h4 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3">{stat.value}</h4>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                  <TrendingUp size={13} />
                  +100%
                </div>
                <span className="text-xs text-stone-400 font-medium">vs previous period</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 bg-white border border-stone-200/80 rounded-[28px] p-6 sm:p-10 h-[420px] sm:h-[500px] flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">Revenue Growth</h3>
              <p className="text-xs sm:text-sm text-stone-500">Total revenue generated over time</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[260px] min-w-0 relative">
            <ResponsiveContainer 
              width="100%" 
              height="100%" 
              minWidth={100} 
              minHeight={200} 
              initialDimension={{ width: 600, height: 350 }}
              debounce={100}
            >
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#78716c', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#78716c', fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(value) => `₹${value/1000}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#E76A54" 
                  strokeWidth={3}
                  dot={{ fill: '#E76A54', strokeWidth: 2, r: 4, stroke: '#ffffff' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#d95c46' }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-[28px] p-6 sm:p-10 h-[420px] sm:h-[500px] flex flex-col shadow-xs">
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight mb-1 sm:mb-2">Order Distribution</h3>
          <p className="text-xs sm:text-sm text-stone-500 mb-6 sm:mb-8">Breakdown by category</p>
          <div className="flex-1 w-full min-h-[260px] min-w-0 relative">
            <ResponsiveContainer 
              width="100%" 
              height="100%" 
              minWidth={100} 
              minHeight={200} 
              initialDimension={{ width: 400, height: 350 }}
              debounce={100}
            >
              <BarChart data={popularItemsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#78716c', fontSize: 11, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'rgba(231, 106, 84, 0.05)' }} />
                <Bar dataKey="sales" radius={[8, 8, 0, 0]} barSize={36}>
                  {popularItemsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#E76A54' : '#EAB308'} fillOpacity={0.9} />
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
