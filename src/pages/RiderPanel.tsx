import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Truck, MapPin, Navigation, CheckCircle, Phone, Power } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const AVAILABLE_ORDERS = [
  { id: 'ORD004', restaurant: 'Frosty Bite Central', distance: '1.2 km', destination: 'Banjara Hills', payout: '₹45' },
  { id: 'ORD005', restaurant: 'Frosty Bite Bakery', distance: '2.5 km', destination: 'Jubilee Hills', payout: '₹65' },
];

export const RiderPanel: React.FC = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rider Dashboard</h1>
          <p className="text-muted">Welcome back, <span className="text-white font-bold">{user?.displayName || 'Rider'}</span></p>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={cn(
            "flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all",
            isOnline ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-secondary text-muted"
          )}
        >
          <Power size={20} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </button>
      </div>

      {!isOnline ? (
        <div className="glass-dark p-12 rounded-3xl border border-border text-center">
          <Truck size={64} className="text-muted mx-auto mb-6 opacity-20" />
          <h2 className="text-2xl font-bold mb-2">You are currently offline</h2>
          <p className="text-muted">Go online to start receiving delivery requests.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Order */}
          {activeOrder ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-dark p-8 rounded-3xl border-2 border-primary"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                    Active Delivery
                  </span>
                  <h2 className="text-2xl font-bold">Order #{activeOrder.id}</h2>
                </div>
                <div className="text-right">
                  <p className="text-muted text-xs mb-1">Estimated Payout</p>
                  <p className="text-2xl font-bold text-primary">{activeOrder.payout}</p>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-muted">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Pickup From</p>
                    <p className="font-bold">{activeOrder.restaurant}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Navigation size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Deliver To</p>
                    <p className="font-bold">{activeOrder.destination}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button className="py-4 bg-secondary text-white rounded-2xl font-bold flex items-center justify-center space-x-2">
                  <Phone size={20} />
                  <span>Call Customer</span>
                </button>
                <button
                  onClick={() => setActiveOrder(null)}
                  className="py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center space-x-2"
                >
                  <CheckCircle size={20} />
                  <span>Mark Delivered</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-6">Available Requests</h2>
              <div className="space-y-4">
                {AVAILABLE_ORDERS.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark p-6 rounded-3xl border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-6">
                      <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center">
                        <Truck size={32} className="text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{order.restaurant}</h4>
                        <p className="text-muted text-sm">{order.destination} • {order.distance}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-primary font-bold text-xl">{order.payout}</p>
                        <p className="text-muted text-[10px] uppercase font-bold tracking-widest">Payout</p>
                      </div>
                      <button
                        onClick={() => setActiveOrder(order)}
                        className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all"
                      >
                        Accept
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
