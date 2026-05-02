import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Search, Mail, Phone, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { supabase } from '../../supabase';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  created_at?: string;
  last_login?: string;
}

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (error) throw error;
        if (data) setCustomers(data);
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();

    // Subscribe to user changes
    const channel = supabase
      .channel('users_admin_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCustomers = customers.filter(c => 
    (c.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const formatDate = (dateString: any) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Syncing Customer Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Customer Base</h1>
          <p className="text-gray-500 font-medium">Real-time insights into your registered customers.</p>
        </div>
        <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Active Users</p>
            <p className="text-2xl font-black text-white">{customers.length}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <User size={20} />
          </div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Search by Name, Email, or Phone..." 
          className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((customer) => (
            <motion.div 
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 space-y-6 relative overflow-hidden group hover:border-primary/20 transition-all"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-all" />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary text-2xl font-black">
                    {customer.full_name ? customer.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white capitalize leading-tight">{customer.full_name || 'Guest User'}</h3>
                    <span className="inline-block px-2 py-0.5 mt-1 rounded-md bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest border border-white/5">
                      {customer.role || 'customer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Mail className="shrink-0 text-primary" size={16} />
                  <span className="truncate">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <Phone className="shrink-0 text-primary" size={16} />
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Calendar className="shrink-0 text-primary" size={16} />
                  <span>Joined: {formatDate(customer.created_at)}</span>
                </div>
                {customer.address && (
                  <div className="flex items-start gap-3 text-sm text-gray-400">
                    <MapPin className="shrink-0 text-primary mt-1" size={16} />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3 relative z-10">
                <button className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <ExternalLink size={14} />
                  View Activity
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-[40px]">
          <p className="text-gray-500 font-bold">No customers found matching your search.</p>
        </div>
      )}
    </div>
  );
};
