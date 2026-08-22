import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, Save, Info, MapPin, IndianRupee, Clock, Navigation, Plus, Trash2, ShieldAlert, Globe, Sparkles } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { InputField } from '../../components/InputField';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { config, updateDeliveryPricing, updateGeofencingSettings, updatePickupOnlyStatus, isLoading: configLoading } = useConfig();
  const [baseFee, setBaseFee] = useState(20);
  const [perKm, setPerKm] = useState(8);
  const [freeKm, setFreeKm] = useState(5);
  const [defaultDeliveryTime, setDefaultDeliveryTime] = useState(25);
  const [isInstantDeliveryClosed, setIsInstantDeliveryClosed] = useState(false);
  const [isPickupOnly, setIsPickupOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Geofencing states
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [geofencingLatitude, setGeofencingLatitude] = useState(20.4625);
  const [geofencingLongitude, setGeofencingLongitude] = useState(85.8828);
  const [geofencingRadius, setGeofencingRadius] = useState(12);
  const [zones, setZones] = useState<any[]>([]);
  const [isSavingGeo, setIsSavingGeo] = useState(false);

  // New zone entry fields
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneLat, setNewZoneLat] = useState('');
  const [newZoneLng, setNewZoneLng] = useState('');
  const [newZoneRad, setNewZoneRad] = useState(5);

  const sampleDistance = 7.2;

  useEffect(() => {
    if (config) {
      setBaseFee(config.deliveryBaseFee ?? 20);
      setPerKm(config.deliveryFeePerKm ?? 8);
      setFreeKm(config.deliveryFreeKm ?? 5);
      setDefaultDeliveryTime(config.defaultDeliveryTime ?? 25);
      setIsInstantDeliveryClosed(config.isInstantDeliveryClosed ?? false);
      setIsPickupOnly(Boolean(config.pickup_only ?? config.isPickupOnly ?? false));

      setGeofencingEnabled(config.geofencingEnabled ?? true);
      setGeofencingLatitude(config.geofencingLatitude ?? 20.4625);
      setGeofencingLongitude(config.geofencingLongitude ?? 85.8828);
      setGeofencingRadius(config.geofencingRadius ?? 12);
      try {
        const parsed = config.geofencingZones ? JSON.parse(config.geofencingZones) : [];
        setZones(parsed);
      } catch (e) {
        setZones([]);
      }
      setIsLoading(false);
    } else if (!configLoading) {
      setIsLoading(false);
    }
  }, [config, configLoading]);

  const actualCalculateFee = () => {
    if (sampleDistance <= freeKm) return baseFee;
    return Math.round(baseFee + (sampleDistance * perKm));
  };

  const handleSavePricing = async () => {
    setIsSaving(true);
    try {
      const token = (user && typeof user.getIdToken === 'function' ? await user.getIdToken() : null) || localStorage.getItem('latest_admin_auth_token');
      await updateDeliveryPricing({
        baseFee,
        perKm,
        freeKm,
        defaultDeliveryTime,
        isInstantDeliveryClosed
      }, token);
      await updatePickupOnlyStatus(isPickupOnly, token);
      toast.success('Delivery & pickup settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update pricing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeofencing = async () => {
    setIsSavingGeo(true);
    try {
      const token = (user && typeof user.getIdToken === 'function' ? await user.getIdToken() : null) || localStorage.getItem('latest_admin_auth_token');
      await updateGeofencingSettings({
        geofencingEnabled,
        geofencingLatitude,
        geofencingLongitude,
        geofencingRadius,
        geofencingZones: JSON.stringify(zones)
      }, token);
      toast.success('Geofencing security rules updated successfully!');
    } catch (error) {
      toast.error('Failed to update geofencing settings');
    } finally {
      setIsSavingGeo(false);
    }
  };

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName) {
      toast.error('Please specify a name for the secondary service zone.');
      return;
    }
    const latNum = parseFloat(newZoneLat);
    const lngNum = parseFloat(newZoneLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      toast.error('Please specify valid numerical coordinates.');
      return;
    }

    const newZone = {
      id: `zone_${Date.now()}`,
      name: newZoneName.trim(),
      latitude: latNum,
      longitude: lngNum,
      radius: newZoneRad,
      enabled: true
    };

    setZones([...zones, newZone]);
    setNewZoneName('');
    setNewZoneLat('');
    setNewZoneLng('');
    setNewZoneRad(5);
    toast.success('Secondary zone added locally. Remember to click Save Rules below to apply changes.');
  };

  const handleRemoveZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    toast.success('Zone removed locally. Click Save Rules below to apply.', { icon: '🗑️' });
  };

  const handleToggleZone = (id: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, enabled: !z.enabled } : z));
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
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Delivery Pricing & Security Suite</h1>
        <p className="text-gray-500 font-medium">Configure calculation rules and secure geofence boundaries for Frosty Bite.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column: Controls */}
        <div className="space-y-8">
          {/* Admin Pricing Controls */}
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

              <InputField
                label="Default Estimated Delivery/Arrival Time (mins)"
                type="number"
                value={defaultDeliveryTime}
                onChange={(e) => setDefaultDeliveryTime(Number(e.target.value))}
                icon={Clock}
                placeholder="e.g. 25"
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

              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-gray-300">Close 30-min Instant Delivery</span>
                    <span className="text-[10px] text-gray-500 leading-relaxed max-w-[240px] block mt-1">
                      Turn this ON to temporarily hide instant/rush 30-min delivery options for customers during checkout.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsInstantDeliveryClosed(!isInstantDeliveryClosed)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 ${isInstantDeliveryClosed ? 'bg-orange-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isInstantDeliveryClosed ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                      Pickup Only
                    </span>
                    <span className="text-[10px] text-gray-400 leading-relaxed max-w-[240px] block mt-1">
                      When enabled, customers can place orders online but must collect them from the bakery. Home delivery will be disabled.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsPickupOnly(!isPickupOnly)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 ${isPickupOnly ? 'bg-amber-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isPickupOnly ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePricing}
              disabled={isSaving}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {isSaving ? 'Saving...' : 'Save Pricing'}
            </button>
          </motion.div>

          {/* Luxury Geofencing Controls */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-8 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <Navigation size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Geofence Boundary Security</h2>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Verify coverage in real-time</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setGeofencingEnabled(!geofencingEnabled)}
                className={`w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none ${geofencingEnabled ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${geofencingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {geofencingEnabled ? (
              <div className="space-y-6">
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
                  <ShieldAlert size={18} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Geofencing is <span className="text-white font-bold">active</span>. Customers residing outside verified operational coordinates will be limited from completing checkout and order entries.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Primary Latitude"
                    type="number"
                    step="0.0001"
                    value={geofencingLatitude}
                    onChange={(e) => setGeofencingLatitude(Number(e.target.value))}
                    icon={Globe}
                    placeholder="e.g. 20.4625"
                  />
                  <InputField
                    label="Primary Longitude"
                    type="number"
                    step="0.0001"
                    value={geofencingLongitude}
                    onChange={(e) => setGeofencingLongitude(Number(e.target.value))}
                    icon={Globe}
                    placeholder="e.g. 85.8828"
                  />
                </div>

                {/* Primary Radius slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-medium text-gray-300">Operational Delivery Radius</label>
                    <span className="text-primary font-bold">{geofencingRadius} KM</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={geofencingRadius}
                    onChange={(e) => setGeofencingRadius(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest px-1">
                    <span>1 KM</span>
                    <span>25 KM</span>
                    <span>50 KM</span>
                  </div>
                </div>

                <div className="w-full h-[1px] bg-white/5" />

                {/* Secondary Delivery Zones */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-bold text-white flex items-center gap-2">
                      <Plus size={16} className="text-primary" /> Secondary Service Expansion Zones
                    </h3>
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{zones.length} active</span>
                  </div>

                  <form onSubmit={handleAddZone} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Zone name (e.g. Bhubaneswar)"
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        className="h-10 px-3 bg-[#0d0d12] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="Lat"
                          value={newZoneLat}
                          onChange={(e) => setNewZoneLat(e.target.value)}
                          className="w-1/3 h-10 px-3 bg-[#0d0d12] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="Lng"
                          value={newZoneLng}
                          onChange={(e) => setNewZoneLng(e.target.value)}
                          className="w-1/3 h-10 px-3 bg-[#0d0d12] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Radius"
                          value={newZoneRad}
                          onChange={(e) => setNewZoneRad(Number(e.target.value))}
                          className="w-1/3 h-10 px-3 bg-[#0d0d12] border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full h-10 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Plus size={14} /> Incorporate Secondary Zone
                    </button>
                  </form>

                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div key={zone.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={zone.enabled}
                            onChange={() => handleToggleZone(zone.id)}
                            className="w-4 h-4 text-primary bg-[#0d0d12] border-white/10 rounded cursor-pointer accent-primary focus:ring-0"
                          />
                          <div>
                            <p className={`text-xs font-bold ${zone.enabled ? 'text-white' : 'text-zinc-500 line-through'}`}>{zone.name}</p>
                            <p className="text-[10px] text-zinc-500">
                              Lat: {zone.latitude}, Lng: {zone.longitude} | Radius: {zone.radius} km
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(zone.id)}
                          className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            ) : (
              <div className="py-12 px-6 bg-gradient-to-br from-orange-500/10 via-primary/5 to-purple-500/10 rounded-3xl border border-orange-500/30 text-center space-y-4 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-500/25">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-black uppercase tracking-widest border border-orange-500/30 mb-1">
                    Coming Soon 🚀
                  </div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">Advanced Service Geofence & GPS Radius</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Our next-generation multi-zone geofencing engine, real-time courier radar tracking, and custom delivery polygons are currently in development.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-white/5 px-3.5 py-2 rounded-full border border-white/10 inline-block">
                    Service geofence is deactivated. All customer orders are active globally.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveGeofencing}
              disabled={isSavingGeo}
              className="w-full py-4 bg-primary hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              {isSavingGeo ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {isSavingGeo ? 'Saving Rules...' : 'Save Geofence Rules'}
            </button>
          </motion.div>
        </div>

        {/* Right column: live previews & helpers */}
        <div className="space-y-8">
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
              <h2 className="text-2xl font-bold text-white">Live Pricing Preview</h2>
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
            className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/10 rounded-3xl p-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-white">Pricing Logic Breakdown</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
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
    </div>
  );
};
