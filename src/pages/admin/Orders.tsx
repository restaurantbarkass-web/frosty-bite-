import React, { useState, useEffect } from 'react';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { Filter, Search, Download, Calendar, Clock, X } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

import { Order } from '../../types';

export const Orders: React.FC = () => {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setAllOrders(ordersData);
      
      const now = new Date().getTime();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      
      const last24hOrders = ordersData.filter(o => {
        const d = o.createdAt 
          ? (typeof (o.createdAt as any).toDate === 'function' 
              ? (o.createdAt as any).toDate() 
              : new Date((o.createdAt as any).seconds * 1000))
          : null;
        return d && d.getTime() >= twentyFourHoursAgo;
      });

      setStats({
        pending: last24hOrders.filter(o => o.status === 'pending').length,
        preparing: last24hOrders.filter(o => o.status === 'preparing').length,
        out_for_delivery: last24hOrders.filter(o => o.status === 'out_for_delivery').length,
        delivered: last24hOrders.filter(o => o.status === 'delivered').length,
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    return () => unsubscribe();
  }, []);

  const filteredOrders = allOrders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.phone && order.phone.includes(searchQuery));
    
    let matchesDate = true;
    if (startDate || endDate) {
      const orderDate = order.createdAt 
        ? (typeof (order.createdAt as any).toDate === 'function' 
            ? (order.createdAt as any).toDate() 
            : new Date((order.createdAt as any).seconds * 1000))
        : null;
      if (orderDate) {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate;
  });

  const exportToCSV = () => {
    const headers = ['Order ID', 'Customer', 'Phone', 'Address', 'Items', 'Total', 'Status', 'Date'];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map(order => {
      const orderDate = order.createdAt 
        ? (typeof (order.createdAt as any).toDate === 'function' 
            ? (order.createdAt as any).toDate() 
            : new Date((order.createdAt as any).seconds * 1000))
        : null;

      return [
        order.id,
        order.customerName,
        order.phone || 'N/A',
        order.address || 'N/A',
        order.items.map((i: any) => typeof i === 'string' ? i : i.name).join('; '),
        order.total,
        order.status,
        orderDate ? orderDate.toLocaleString() : 'N/A'
      ].map(escapeCSV);
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Order Management</h1>
          <p className="text-gray-500 font-medium">Track and manage all customer orders in real-time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 text-[10px] sm:text-xs font-bold whitespace-nowrap">
            <Clock size={14} />
            <span className="hidden xs:inline">Last 24 Hours</span>
            <span className="xs:hidden">24h</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-4 py-1 flex-1 sm:flex-none">
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-bold uppercase">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            <div className="w-px h-8 bg-white/10 mx-1 sm:mx-2" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-bold uppercase">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-1 sm:ml-2 text-gray-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 flex-1 sm:flex-none px-6 sm:px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all text-sm"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pending', count: stats.pending, color: 'amber' },
          { label: 'Preparing', count: stats.preparing, color: 'blue' },
          { label: 'Out for Delivery', count: stats.out_for_delivery, color: 'purple' },
          { label: 'Delivered', count: stats.delivered, color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex items-center justify-between group hover:border-white/10 transition-all">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black text-white">{stat.count}</h4>
            </div>
            <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 border border-${stat.color}-500/20 shadow-lg shadow-${stat.color}-500/5`}>
              <span className="text-xl font-black">#</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by Order ID, Customer Name, Phone..." 
            className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-3 px-6 py-4 bg-[#111]/80 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all">
          <Filter size={18} />
          More Filters
        </button>
      </div>

      <OrdersTable orders={filteredOrders} loading={loading} />
    </div>
  );
};
