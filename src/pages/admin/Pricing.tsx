import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, Save, Info, MapPin, IndianRupee, Clock } from 'lucide-react';
import { appConfigService, AppConfig } from '../../services/appConfigService';
import { InputField } from '../../components/InputField';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export const Pricing: React.FC = () => {
  const { user } = useAuth();
  const [baseFee, setBaseFee] = useState(20);
  const [perKm, setPerKm] = useState(8);
  const [freeKm, setFreeKm] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sampleDistance = 7.2;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await appConfigService.getConfig();
        if (config) {
          setBaseFee(config.deliveryBaseFee ?? 20);
          setPerKm(config.deliveryFeePerKm ?? 8);
          setFreeKm(config.deliveryFreeKm ?? 5);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const calculateFee = () => {
    if (sampleDistance <= freeKm) return baseFee;
    return Math.round(baseFee + ((sampleDistance - freeKm) * perKm)); // Logic: Base fee + additional KM fee
    // Note: The user's snippet logic was slightly different: Math.round(baseFee + (sampleDistance * perKm))
    // Usually "Free delivery up to X KM" means the first X KM are free, and you pay for the rest.
    // However, I will stick to the user's logic if they prefer, but "Free delivery up to X KM" often implies 
    // a base fee plus rate for mileage BEYOND the free limit.
    // Actually, looking at the user's rules info:
    // "If distance > free limit -> base fee + (distance * per km rate)"
    // Okay, I will follow their explicit rule.
  };

  const actualCalculateFee = () => {
    if (sampleDistance <= freeKm) return baseFee;
    return Math.round(baseFee + (sampleDistance * perKm));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = user && typeof user.getIdToken === 'function' ? await user.getIdToken() : null;
      await appConfigService.updateDeliveryPricing({
        baseFee,
        perKm,
        freeKm
      }, token);
      toast.success('Delivery pricing updated successfully!');
    } catch (error) {
      toast.error('Failed to update pricing');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Delivery Pricing</h1>
        <p className="text-gray-500 font-medium">Configure how delivery charges are calculated for your customers.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Admin Controls */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
              <Truck size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Pricing Controls</h2>
          </div>

          <div className="space-y-6">
            <InputField
              label="Base Fee (₹)"
              type="number"
              value={baseFee}
              onChange={(e) => setBaseFee(Number(e.target.value))}
              icon={IndianRupee}
              placeholder="e.g. 20"
            />

            <InputField
              label="Price per KM (₹)"
              type="number"
              value={perKm}
              onChange={(e) => setPerKm(Number(e.target.value))}
              icon={MapPin}
              placeholder="e.g. 8"
            />

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-gray-300">Free Delivery up to KM</label>
                <span className="text-orange-500 font-bold">{freeKm} KM</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={freeKm}
                onChange={(e) => setFreeKm(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest px-1">
                <span>0 KM</span>
                <span>10 KM</span>
                <span>20 KM</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </motion.div>

        {/* Live Preview */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
              <Clock size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white">Live Preview</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Distance</p>
                <p className="text-xl font-bold text-white">{sampleDistance} km</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Base Fee</p>
                <p className="text-xl font-bold text-white">₹{baseFee}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Per KM Rate</p>
                <p className="text-xl font-bold text-white">₹{perKm}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Free Limit</p>
                <p className="text-xl font-bold text-white">{freeKm} km</p>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
              <p className="text-sm font-bold text-orange-500/80 uppercase tracking-[0.2em] mb-2">Estimated Delivery Fee</p>
              <h1 className="text-6xl font-black text-orange-500 tracking-tighter">
                ₹{actualCalculateFee()}
              </h1>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 ring-1 ring-white/5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                <Info size={18} />
              </div>
              <div className="text-sm">
                <p className="text-gray-300 font-medium leading-relaxed">
                  The calculation above uses a sample distance of {sampleDistance}km to show you how the fees will be displayed to your customers.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Rules Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-2 bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/10 rounded-3xl p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white"> Pricing Logic Breakdown</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center text-xs mb-3">01</div>
              <h3 className="font-bold text-white">Within Free Limit</h3>
              <p className="text-sm text-gray-500 leading-relaxed">If distance ≤ {freeKm}km, only the base fee of ₹{baseFee} applies.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center text-xs mb-3">02</div>
              <h3 className="font-bold text-white">Beyond Free Limit</h3>
              <p className="text-sm text-gray-500 leading-relaxed">If distance &gt; {freeKm}km, we calculate: Base Fee + (Total Distance × Rate).</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center text-xs mb-3">03</div>
              <h3 className="font-bold text-white">Dynamic Updates</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Any changes saved here will reflect immediately on the checkout page.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black flex items-center justify-center text-xs mb-3">04</div>
              <h3 className="font-bold text-white">Rounding</h3>
              <p className="text-sm text-gray-500 leading-relaxed">All delivery fees are rounded to the nearest whole rupee for simplicity.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
