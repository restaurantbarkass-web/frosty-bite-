import React, { useState, useEffect } from 'react';
import { Bike, Phone, MapPin, Star, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../../firebase';
import { collection, query } from 'firebase/firestore';
import { safeFirestore } from '../../services/firestoreService';

interface Rider {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'on-delivery';
  phone?: string;
  rating?: number;
  total_deliveries?: number;
  current_order_id?: string;
  current_order_number?: string;
}

export const RiderPanel: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'riders'));
    const unsubscribe = safeFirestore.listen(q, (data: Rider[]) => {
      setRiders(data);
      setLoading(false);
    }, 'riders_panel_cache');

    return () => unsubscribe();
  }, []);

  const onlineCount = riders.filter(r => r.status === 'online').length;
  const offlineCount = riders.filter(r => r.status === 'offline').length;
  const onDeliveryCount = riders.filter(r => r.status === 'on-delivery').length;

  if (loading) {
    return (
      <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Loading riders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Rider Management</h2>
          <p className="text-gray-500 font-medium">Track and manage your delivery fleet</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <span className="text-emerald-500 font-bold text-sm">{onlineCount} Online</span>
          </div>
          <div className="px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
            <span className="text-blue-500 font-bold text-sm">{onDeliveryCount} On Delivery</span>
          </div>
          <div className="px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            <span className="text-rose-500 font-bold text-sm">{offlineCount} Offline</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {riders.map((rider) => (
          <motion.div 
            key={rider.id}
            whileHover={{ y: -5 }}
            className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 ${rider.status === 'online' ? 'bg-emerald-500/10' : rider.status === 'on-delivery' ? 'bg-blue-500/10' : 'bg-gray-500/10'} blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform`} />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-[2px]">
                    <div className="w-full h-full rounded-2xl bg-[#111] overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/${rider.id}/100/100`} 
                        alt={rider.name} 
                        className="w-full h-full object-cover opacity-90"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-1">{rider.name}</h4>
                    <div className="flex items-center gap-2">
                      <Star className="text-orange-500 fill-orange-500" size={14} />
                      <span className="text-sm font-bold text-white">{rider.rating || '5.0'}</span>
                      <span className="text-xs text-gray-500 font-medium">({rider.total_deliveries || 0} deliveries)</span>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  rider.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                  rider.status === 'on-delivery' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                  'bg-gray-500/10 text-gray-500 border-gray-500/20'
                }`}>
                  {rider.status.replace('-', ' ')}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-gray-400">
                  <Phone size={16} className="text-orange-500" />
                  <span className="text-sm font-medium">{rider.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <MapPin size={16} className="text-orange-500" />
                  <span className="text-sm font-medium">Live Tracking Active</span>
                </div>
                {rider.current_order_id && (
                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Bike size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Active Order</p>
                        <p className="text-sm font-bold text-white">#{rider.current_order_number || rider.current_order_id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all">
                      <Clock size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all">
                  View Profile
                </button>
                <button className="flex-1 py-4 rounded-2xl bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all">
                  Send Message
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {riders.length === 0 && (
          <div className="col-span-full py-20 text-center text-zinc-500 font-bold">
            No riders found.
          </div>
        )}
      </div>
    </div>
  );
};
