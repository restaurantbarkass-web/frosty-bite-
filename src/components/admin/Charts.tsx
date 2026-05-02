import React, { useState, useEffect } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { db } from '../../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { safeFirestore } from '../../services/firestoreService';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">
          {payload[0].name === 'revenue' ? `₹${payload[0].value.toLocaleString()}` : `${payload[0].value} orders`}
        </p>
      </div>
    );
  }
  return null;
};

export const OrdersChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      orderBy('created_at', 'asc'),
      limit(1000)
    );

    const unsubscribe = safeFirestore.listen(q, (orders: any[]) => {
      if (orders) {
        const ordersByDate = orders.reduce((acc: any, curr: any) => {
          if (!curr.created_at) return acc;
          const date = new Date(curr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});
        
        const chartData = Object.entries(ordersByDate).map(([name, orders]) => ({ name, orders }));
        setData(chartData);
      }
    }, 'orders_chart_cache');

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Orders Over Time</h3>
          <p className="text-sm text-gray-500">Weekly performance overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-gray-400 font-medium">Orders</span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="orders" 
              stroke="#f97316" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorOrders)" 
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const PopularItemsChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      limit(500)
    );

    const unsubscribe = safeFirestore.listen(q, (orders: any[]) => {
      if (orders) {
        const itemCounts: any = {};
        
        orders.forEach((order: any) => {
          if (order.items) {
            order.items.forEach((item: any) => {
              const name = typeof item === 'string' ? item : (item.name || 'Unknown');
              itemCounts[name] = (itemCounts[name] || 0) + 1;
            });
          }
        });

        const popularItems = Object.entries(itemCounts)
          .map(([name, sales]) => ({ name, sales: sales as number }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);
        
        setData(popularItems);
      }
    }, 'popular_items_chart_cache');

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 h-[400px] flex flex-col">
      <div className="mb-8">
        <h3 className="text-xl font-bold text-white tracking-tight">Popular Items</h3>
        <p className="text-sm text-gray-500">Most sold items this month</p>
      </div>
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#fff', fontSize: 12, fontWeight: 600 }}
              width={100}
            />
            <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
            <Bar dataKey="sales" radius={[0, 10, 10, 0]} barSize={32} animationDuration={1500}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const RevenueChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      orderBy('created_at', 'asc'),
      limit(1000)
    );

    const unsubscribe = safeFirestore.listen(q, (orders: any[]) => {
      if (orders) {
        const revenueByDate = orders.reduce((acc: any, curr: any) => {
          if (!curr.created_at) return acc;
          const date = new Date(curr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + (curr.total || 0);
          return acc;
        }, {});
        
        const chartData = Object.entries(revenueByDate).map(([name, revenue]) => ({ name, revenue }));
        setData(chartData);
      }
    }, 'revenue_chart_cache');

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Revenue Analysis</h3>
          <p className="text-sm text-gray-500">Earnings from daily cakes & bakes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-gray-400 font-medium">Revenue (₹)</span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
          <LineChart data={data}>
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
              tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#f97316" 
              strokeWidth={4}
              dot={{ fill: '#f97316', strokeWidth: 2, r: 4, stroke: '#111' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={2000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
