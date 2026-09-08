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
import { supabase } from '../../supabase';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-stone-200 p-3.5 rounded-2xl shadow-xl">
        <p className="text-stone-400 text-xs font-bold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-stone-900 text-lg font-black">
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
    const fetchOrdersData = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1000);
        
        if (error) throw error;
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
      } catch (err) {
        console.error('Error fetching orders chart data:', err);
      }
    };

    fetchOrdersData();

    const channel = supabase
      .channel('orders_chart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrdersData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 h-[380px] sm:h-[400px] flex flex-col shadow-xs">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Orders Over Time</h3>
          <p className="text-xs sm:text-sm text-stone-500">Weekly performance overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#E76A54]" />
            <span className="text-xs text-stone-500 font-medium">Orders</span>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full min-h-[250px] min-w-0 relative">
        <ResponsiveContainer 
          width="100%" 
          height="100%" 
          minWidth={100} 
          minHeight={200} 
          initialDimension={{ width: 500, height: 300 }}
          debounce={100}
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E76A54" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#E76A54" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#78716c', fontSize: 11, fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#78716c', fontSize: 11, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="orders" 
              stroke="#E76A54" 
              strokeWidth={3}
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
    const fetchPopularData = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('items')
          .limit(500);
        
        if (error) throw error;
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
      } catch (err) {
        console.error('Error fetching popular items data:', err);
      }
    };

    fetchPopularData();

    const channel = supabase
      .channel('popular_items_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPopularData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 h-[380px] sm:h-[400px] flex flex-col shadow-xs">
      <div className="mb-6 sm:mb-8">
        <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Popular Items</h3>
        <p className="text-xs sm:text-sm text-stone-500">Most sold items this month</p>
      </div>
      <div className="flex-1 w-full min-h-[250px] min-w-0 relative">
        <ResponsiveContainer 
          width="100%" 
          height="100%" 
          minWidth={100} 
          minHeight={200} 
          initialDimension={{ width: 500, height: 300 }}
          debounce={100}
        >
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#44403c', fontSize: 11, fontWeight: 600 }}
              width={100}
            />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<CustomTooltip />} />
            <Bar dataKey="sales" radius={[0, 10, 10, 0]} barSize={28} animationDuration={1500}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />
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
    const fetchRevenueData = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('created_at, total')
          .order('created_at', { ascending: true })
          .limit(1000);
        
        if (error) throw error;
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
      } catch (err) {
        console.error('Error fetching revenue chart data:', err);
      }
    };

    fetchRevenueData();

    const channel = supabase
      .channel('revenue_chart_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchRevenueData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 h-[380px] sm:h-[400px] flex flex-col shadow-xs">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Revenue Analysis</h3>
          <p className="text-xs sm:text-sm text-stone-500">Earnings from daily cakes & bakes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#E76A54]" />
            <span className="text-xs text-stone-500 font-medium">Revenue (₹)</span>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full min-h-[250px] min-w-0 relative">
        <ResponsiveContainer 
          width="100%" 
          height="100%" 
          minWidth={100} 
          minHeight={200} 
          initialDimension={{ width: 500, height: 300 }}
          debounce={100}
        >
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#78716c', fontSize: 11, fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#78716c', fontSize: 11, fontWeight: 500 }}
              tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#E76A54" 
              strokeWidth={3.5}
              dot={{ fill: '#E76A54', strokeWidth: 2, r: 4, stroke: '#ffffff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={2000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
