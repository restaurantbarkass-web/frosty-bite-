import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Search as SearchIcon, 
  BarChart3, 
  Clock, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Share2,
  Download,
  ArrowRight,
  History as HistoryIcon
} from 'lucide-react';
import { supabase } from '../../supabase';
import { format, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

interface AnalyticItem {
  query: string;
  count: number;
  last_searched: string;
}

interface SearchHistoryItem {
  query: string;
  user_id: string;
  created_at: string;
}

export const SearchAnalytics: React.FC = () => {
  const [topSearches, setTopSearches] = useState<AnalyticItem[]>([]);
  const [recentHistory, setRecentHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch top searches from Supabase
        const { data: topData, error: topError } = await supabase
          .from('search_analytics')
          .select('*')
          .order('count', { ascending: false })
          .limit(10);
        
        if (topError) throw topError;
        setTopSearches(topData as AnalyticItem[]);

        // Fetch recent history from Supabase
        const { data: recentData, error: recentError } = await supabase
          .from('search_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (recentError) throw recentError;
        setRecentHistory(recentData as SearchHistoryItem[]);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const chartData = topSearches.map(item => ({
    name: item.query.charAt(0).toUpperCase() + item.query.slice(1),
    searches: item.count
  }));

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch (e) {
      return 'Recently';
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM dd, HH:mm');
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight">Search Insights</h1>
          <p className="text-stone-600">Analyze user behavior and trending flavors</p>
        </div>
        <div className="flex items-center gap-2">
            <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm text-stone-800 shadow-sm focus:ring-2 focus:ring-[#E76A54] outline-none"
            >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
            </select>
            <button className="p-2 bg-white border border-stone-200 rounded-xl text-stone-500 hover:text-stone-900 shadow-sm transition-all cursor-pointer">
                <Download size={20} />
            </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Searches', value: '1,284', icon: SearchIcon, trend: '+12%', isUp: true },
          { label: 'Conversion Rate', value: '8.4%', icon: BarChart3, trend: '+2.1%', isUp: true },
          { label: 'Unique Users', value: '452', icon: Users, trend: '-3%', isUp: false },
          { label: 'Avg Results', value: '14.2', icon: Clock, trend: '+5%', isUp: true },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white border border-stone-200/80 rounded-3xl group hover:border-[#E76A54]/30 shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-[#E76A54]/10 rounded-2xl text-[#E76A54] group-hover:scale-110 transition-transform">
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full",
                stat.isUp ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
              )}>
                {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
            <h4 className="text-stone-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</h4>
            <div className="text-2xl font-black text-stone-900">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trending Chart */}
        <div className="lg:col-span-2 p-8 bg-white border border-stone-200/80 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={20} className="text-[#E76A54]" />
              Volume by Query
            </h3>
          </div>
          <div className="h-[400px] w-full min-h-[300px] min-w-0 relative">
            <ResponsiveContainer 
              width="100%" 
              height="100%" 
              minWidth={100} 
              minHeight={200} 
              initialDimension={{ width: 600, height: 400 }}
              debounce={100}
            >
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E76A54" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#E76A54" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#78716c" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#78716c' }}
                />
                <YAxis 
                  stroke="#78716c" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#78716c' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e7e5e4', 
                    borderRadius: '16px',
                    color: '#1c1917',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                  itemStyle={{ color: '#E76A54', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="searches" 
                  stroke="#E76A54" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSearches)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Log */}
        <div className="p-8 bg-white border border-stone-200/80 rounded-[32px] shadow-sm">
          <h3 className="text-lg font-black text-stone-900 uppercase tracking-widest mb-8 flex items-center gap-2">
            <Clock size={20} className="text-[#E76A54]" />
            Live Search Log
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
            {recentHistory.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-stone-50 rounded-2xl border border-stone-200/60 hover:border-stone-300 transition-all">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-500 shadow-xs border border-stone-200/60">
                  <SearchIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-stone-900 text-sm font-bold truncate">"{item.query}"</h4>
                  <p className="text-[10px] text-stone-500 font-medium">User: {item.user_id.slice(0, 8)}...</p>
                </div>
                <div className="text-[10px] text-stone-400 font-bold whitespace-nowrap">
                  {formatDate(item.created_at)}
                </div>
              </div>
            ))}
            {recentHistory.length === 0 && (
                <div className="text-center py-12 text-stone-400">
                    <HistoryIcon size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-xs uppercase font-black">No search activity found</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Keywords Table */}
      <div className="p-8 bg-white border border-stone-200/80 rounded-[32px] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-stone-900 uppercase tracking-widest">Keyword Efficiency</h3>
            <button className="flex items-center gap-2 text-xs font-bold text-[#E76A54] hover:underline cursor-pointer">
                View Full Report <ArrowRight size={14} />
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="pb-4 text-[10px] font-black text-stone-500 uppercase tracking-widest">Keyword</th>
                <th className="pb-4 text-[10px] font-black text-stone-500 uppercase tracking-widest text-center">Volume</th>
                <th className="pb-4 text-[10px] font-black text-stone-500 uppercase tracking-widest text-center">Avg Result Size</th>
                <th className="pb-4 text-[10px] font-black text-stone-500 uppercase tracking-widest text-center">CTR</th>
                <th className="pb-4 text-[10px] font-black text-stone-500 uppercase tracking-widest text-right">Last Peak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {topSearches.map((item, i) => (
                <tr key={i} className="group hover:bg-stone-50/80 transition-colors">
                  <td className="py-4 font-bold text-stone-900 uppercase text-sm tracking-wide">{item.query}</td>
                  <td className="py-4 text-center">
                    <span className="px-2 py-1 bg-[#E76A54]/10 text-[#E76A54] text-[10px] font-black rounded-lg">{(item.count * 1.5).toFixed(0)}</span>
                  </td>
                  <td className="py-4 text-center text-stone-600 text-sm font-medium">12.4</td>
                  <td className="py-4 text-center text-emerald-600 text-sm font-bold">14.2%</td>
                  <td className="py-4 text-right text-stone-500 text-[10px] font-bold">
                    {formatFullDate(item.last_searched)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
