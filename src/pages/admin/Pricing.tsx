import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Truck, 
  Save, 
  Info, 
  MapPin, 
  IndianRupee, 
  Clock, 
  Navigation, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Globe, 
  Sparkles, 
  Building2, 
  ExternalLink, 
  CheckCircle2, 
  Settings,
  ShoppingBag
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { InputField } from '../../components/InputField';
import { SetBakeryLocationModal } from '../../components/admin/SetBakeryLocationModal';
import { getResolvedBakeryLocation, isValidHttpsUrl } from '../../utils/whatsapp';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export const Pricing: React.FC = () => {
  const { user, getAuthToken } = useAuth();
  const { config, updateDeliveryPricing, updateGeofencingSettings, updatePickupOnlyStatus, updateCustomerLinks, isLoading: configLoading } = useConfig();
  const [baseFee, setBaseFee] = useState(20);
  const [perKm, setPerKm] = useState(8);
  const [freeKm, setFreeKm] = useState(5);
  const [defaultDeliveryTime, setDefaultDeliveryTime] = useState(25);
  const [isInstantDeliveryClosed, setIsInstantDeliveryClosed] = useState(false);
  const [isPickupOnly, setIsPickupOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showBakeryLocationModal, setShowBakeryLocationModal] = useState(false);

  // Customer Links states
  const [feedbackUrlInput, setFeedbackUrlInput] = useState('');
  const [websiteUrlInput, setWebsiteUrlInput] = useState('https://frostybite.in');
  const [isSavingLinks, setIsSavingLinks] = useState(false);

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

      setFeedbackUrlInput(config.feedbackUrl ?? '');
      setWebsiteUrlInput(config.websiteUrl ?? 'https://frostybite.in');

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
      const token = await getAuthToken();
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

  const handleSaveCustomerLinks = async () => {
    setIsSavingLinks(true);
    try {
      if (feedbackUrlInput.trim() && !isValidHttpsUrl(feedbackUrlInput.trim())) {
        toast.error('Feedback URL must start with https:// and be a valid URL.');
        setIsSavingLinks(false);
        return;
      }
      if (websiteUrlInput.trim() && !isValidHttpsUrl(websiteUrlInput.trim())) {
        toast.error('Website URL must start with https:// and be a valid URL.');
        setIsSavingLinks(false);
        return;
      }

      const token = await getAuthToken();
      await updateCustomerLinks({
        feedbackUrl: feedbackUrlInput.trim(),
        websiteUrl: websiteUrlInput.trim()
      }, token);
      toast.success('Customer links updated successfully!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update customer links');
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleSaveGeofencing = async () => {
    setIsSavingGeo(true);
    try {
      const token = await getAuthToken();
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
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mb-1 sm:mb-2">Delivery Pricing & Security Suite</h1>
        <p className="text-stone-500 text-xs sm:text-sm font-medium">Configure calculation rules and secure geofence boundaries for Frosty Bite.</p>
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
        {/* Left column: Controls */}
        <div className="space-y-6 sm:space-y-8">
          {/* Admin Pricing Controls */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden shadow-xs"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-[#E76A54]">
                <Truck size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Pricing Controls</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1.5 block">Base Fee (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={baseFee}
                    onChange={(e) => setBaseFee(Number(e.target.value))}
                    placeholder="e.g. 20"
                    className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold"
                  />
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1.5 block">Price per KM (₹)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={perKm}
                    onChange={(e) => setPerKm(Number(e.target.value))}
                    placeholder="e.g. 8"
                    className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold"
                  />
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1.5 block">Default Delivery Time (mins)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={defaultDeliveryTime}
                    onChange={(e) => setDefaultDeliveryTime(Number(e.target.value))}
                    placeholder="e.g. 25"
                    className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold"
                  />
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs sm:text-sm font-bold text-stone-700">Free Delivery up to KM</label>
                  <span className="text-[#E76A54] font-black">{freeKm} KM</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={freeKm}
                  onChange={(e) => setFreeKm(Number(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#E76A54]"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest px-1">
                  <span>0 KM</span>
                  <span>10 KM</span>
                  <span>20 KM</span>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col text-left">
                    <span className="text-xs sm:text-sm font-bold text-stone-800">Close 30-min Instant Delivery</span>
                    <span className="text-[10px] text-stone-500 leading-relaxed max-w-[260px] block mt-0.5">
                      Turn this ON to temporarily hide rush 30-min delivery options for customers.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsInstantDeliveryClosed(!isInstantDeliveryClosed)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 cursor-pointer ${isInstantDeliveryClosed ? 'bg-[#E76A54]' : 'bg-stone-300'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isInstantDeliveryClosed ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-stone-100 gap-4">
                  <div className="flex flex-col text-left">
                    <span className="text-xs sm:text-sm font-bold text-[#E76A54] flex items-center gap-1.5">
                      Pickup Only
                    </span>
                    <span className="text-[10px] text-stone-500 leading-relaxed max-w-[260px] block mt-0.5">
                      When enabled, customers can place orders online but must collect them from the bakery.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsPickupOnly(!isPickupOnly)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 cursor-pointer ${isPickupOnly ? 'bg-[#E76A54]' : 'bg-stone-300'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isPickupOnly ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePricing}
              disabled={isSaving}
              className="w-full py-3.5 bg-[#E76A54] hover:bg-[#d55b45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-[#E76A54]/20 cursor-pointer text-xs uppercase tracking-wider"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSaving ? 'Saving...' : 'Save Pricing'}
            </button>
          </motion.div>

          {/* Bakery Pickup Location & WhatsApp Source Settings */}
          {(() => {
            const resolvedBakery = getResolvedBakeryLocation(config);
            return (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 space-y-6 relative overflow-hidden shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-[#E76A54]">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Bakery Pickup Location</h2>
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">Customer Pickup &amp; WhatsApp Source</p>
                    </div>
                  </div>

                  <button
                    id="btn-edit-bakery-pickup-location"
                    type="button"
                    onClick={() => setShowBakeryLocationModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <MapPin size={14} />
                    <span>Set Bakery Location</span>
                  </button>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> Active Pickup Location
                    </span>
                    <span className="text-[11px] font-mono text-stone-500">
                      {resolvedBakery.bakeryLatitude}, {resolvedBakery.bakeryLongitude}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-stone-900">{resolvedBakery.bakeryName}</p>
                    <p className="text-xs text-stone-600 mt-0.5">{resolvedBakery.bakeryAddress}</p>
                  </div>

                  {resolvedBakery.bakeryMapUrl && (
                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">Directions URL for WhatsApp</span>
                      <a
                        href={resolvedBakery.bakeryMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#E76A54] hover:underline flex items-center gap-1 font-bold"
                      >
                        <ExternalLink size={12} /> Test Google Maps Link
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* Customer Links (Feedback & Website URLs) for WhatsApp Notifications */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 space-y-6 relative overflow-hidden shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-[#E76A54]">
                  <Globe size={24} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Customer Links</h2>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
                    Feedback URL &amp; Website Link for WhatsApp
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Feedback Submission URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="customer-feedback-url-input" className="text-xs font-bold text-stone-700">
                    Feedback Submission URL
                  </label>
                  {feedbackUrlInput && isValidHttpsUrl(feedbackUrlInput) && (
                    <a
                      href={feedbackUrlInput}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#E76A54] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink size={12} /> Test Link
                    </a>
                  )}
                </div>
                <input
                  id="customer-feedback-url-input"
                  type="url"
                  value={feedbackUrlInput}
                  onChange={(e) => setFeedbackUrlInput(e.target.value)}
                  placeholder="e.g. https://frostybite.in/feedback"
                  className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E76A54] transition-all font-mono font-medium"
                />
                <p className="text-[11px] text-stone-500">
                  Included in "Order Collected" WhatsApp notifications. Must start with <code className="text-[#E76A54] font-mono">https://</code>.
                </p>
              </div>

              {/* Frosty Bite Website URL */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label htmlFor="customer-website-url-input" className="text-xs font-bold text-stone-700">
                    Frosty Bite Website URL
                  </label>
                  {websiteUrlInput && isValidHttpsUrl(websiteUrlInput) && (
                    <a
                      href={websiteUrlInput}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#E76A54] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink size={12} /> Test Link
                    </a>
                  )}
                </div>
                <input
                  id="customer-website-url-input"
                  type="url"
                  value={websiteUrlInput}
                  onChange={(e) => setWebsiteUrlInput(e.target.value)}
                  placeholder="https://frostybite.in"
                  className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E76A54] transition-all font-mono font-medium"
                />
                <p className="text-[11px] text-stone-500">
                  Included in customer notifications. Must start with <code className="text-[#E76A54] font-mono">https://</code>.
                </p>
              </div>

              <button
                type="button"
                id="btn-save-customer-links"
                onClick={handleSaveCustomerLinks}
                disabled={isSavingLinks}
                className="w-full mt-2 py-3.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 border border-stone-200 font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSavingLinks ? (
                  <div className="w-4 h-4 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSavingLinks ? 'Saving Links…' : 'Save Customer Links'}</span>
              </button>
            </div>
          </motion.div>

          {/* Geofencing Controls */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden shadow-xs"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-[#E76A54]">
                  <Navigation size={24} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Geofence Boundary</h2>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">Verify coverage area</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setGeofencingEnabled(!geofencingEnabled)}
                className={`w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none cursor-pointer ${geofencingEnabled ? 'bg-[#E76A54]' : 'bg-stone-300'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${geofencingEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {geofencingEnabled ? (
              <div className="space-y-6">
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-start gap-3">
                  <ShieldAlert size={18} className="text-[#E76A54] shrink-0 mt-0.5" />
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Geofencing is <span className="text-stone-900 font-bold">active</span>. Customers residing outside verified operational coordinates will be limited from completing checkout.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1.5 block">Primary Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={geofencingLatitude}
                      onChange={(e) => setGeofencingLatitude(Number(e.target.value))}
                      placeholder="e.g. 20.4625"
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase font-black tracking-widest mb-1.5 block">Primary Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={geofencingLongitude}
                      onChange={(e) => setGeofencingLongitude(Number(e.target.value))}
                      placeholder="e.g. 85.8828"
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold"
                    />
                  </div>
                </div>

                {/* Primary Radius slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs sm:text-sm font-bold text-stone-700">Operational Delivery Radius</label>
                    <span className="text-[#E76A54] font-black">{geofencingRadius} KM</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={geofencingRadius}
                    onChange={(e) => setGeofencingRadius(Number(e.target.value))}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#E76A54]"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest px-1">
                    <span>1 KM</span>
                    <span>25 KM</span>
                    <span>50 KM</span>
                  </div>
                </div>

                <div className="w-full h-[1px] bg-stone-100" />

                {/* Secondary Delivery Zones */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Plus size={16} className="text-[#E76A54]" /> Secondary Service Zones
                    </h3>
                    <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">{zones.length} active</span>
                  </div>

                  <form onSubmit={handleAddZone} className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Zone name (e.g. Bhubaneswar)"
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        className="h-10 px-3.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E76A54]"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="Lat"
                          value={newZoneLat}
                          onChange={(e) => setNewZoneLat(e.target.value)}
                          className="w-1/3 h-10 px-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E76A54]"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="Lng"
                          value={newZoneLng}
                          onChange={(e) => setNewZoneLng(e.target.value)}
                          className="w-1/3 h-10 px-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#E76A54]"
                        />
                        <input
                          type="number"
                          placeholder="Radius"
                          value={newZoneRad}
                          onChange={(e) => setNewZoneRad(Number(e.target.value))}
                          className="w-1/3 h-10 px-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#E76A54]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full h-10 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus size={14} /> Incorporate Secondary Zone
                    </button>
                  </form>

                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div key={zone.id} className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={zone.enabled}
                            onChange={() => handleToggleZone(zone.id)}
                            className="w-4 h-4 text-[#E76A54] border-stone-300 rounded cursor-pointer accent-[#E76A54]"
                          />
                          <div>
                            <p className={`text-xs font-bold ${zone.enabled ? 'text-stone-900' : 'text-stone-400 line-through'}`}>{zone.name}</p>
                            <p className="text-[10px] text-stone-500">
                              Lat: {zone.latitude}, Lng: {zone.longitude} | Radius: {zone.radius} km
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(zone.id)}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            ) : (
              <div className="py-10 px-6 bg-[#FAF8F5] rounded-3xl border border-stone-200 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-[#E76A54] mx-auto shadow-xs">
                  <Sparkles size={24} />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-bold uppercase tracking-wider border border-stone-200 mb-1">
                    Deactivated
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">Geofence Boundary Inactive</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                    Customer orders will be accepted globally without coordinate restrictions.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveGeofencing}
              disabled={isSavingGeo}
              className="w-full py-3.5 bg-[#E76A54] hover:bg-[#d55b45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-[#E76A54]/20 cursor-pointer text-xs uppercase tracking-wider"
            >
              {isSavingGeo ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSavingGeo ? 'Saving Rules...' : 'Save Geofence Rules'}
            </button>
          </motion.div>
        </div>

        {/* Right column: live previews & helpers */}
        <div className="space-y-6 sm:space-y-8">
          {/* Live Preview */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-8 space-y-6 sm:space-y-8 shadow-xs"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600">
                <Clock size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Live Pricing Preview</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-center">
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Distance</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900">{sampleDistance} km</p>
                </div>
                <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-center">
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Base Fee</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900">₹{baseFee}</p>
                </div>
                <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-center">
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Per KM Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900">₹{perKm}</p>
                </div>
                <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl text-center">
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-1">Free Limit</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900">{freeKm} km</p>
                </div>
              </div>

              <div className="p-6 sm:p-8 rounded-3xl bg-[#FAF8F5] border border-stone-200 text-center relative overflow-hidden group">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1.5">Estimated Delivery Fee</p>
                <h1 className="text-5xl sm:text-6xl font-black text-[#E76A54] tracking-tight">
                  ₹{actualCalculateFee()}
                </h1>
              </div>

              <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 shrink-0">
                  <Info size={16} />
                </div>
                <div className="text-xs">
                  <p className="text-stone-600 font-medium leading-relaxed">
                    The calculation above uses a sample distance of {sampleDistance}km to demonstrate the delivery fee formula.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Rules Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="flex items-center gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Pricing Logic Breakdown</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-stone-200 text-[#E76A54] font-black flex items-center justify-center text-xs mb-2">01</div>
                <h3 className="font-bold text-stone-900 text-sm">Within Free Limit</h3>
                <p className="text-xs text-stone-500 leading-relaxed">If distance ≤ {freeKm}km, only the base fee of ₹{baseFee} applies.</p>
              </div>
              <div className="space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-stone-200 text-[#E76A54] font-black flex items-center justify-center text-xs mb-2">02</div>
                <h3 className="font-bold text-stone-900 text-sm">Beyond Free Limit</h3>
                <p className="text-xs text-stone-500 leading-relaxed">If distance &gt; {freeKm}km, calculation: Base Fee + (Total Distance × Rate).</p>
              </div>
              <div className="space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-stone-200 text-[#E76A54] font-black flex items-center justify-center text-xs mb-2">03</div>
                <h3 className="font-bold text-stone-900 text-sm">Dynamic Updates</h3>
                <p className="text-xs text-stone-500 leading-relaxed">Any changes saved here reflect immediately on checkout.</p>
              </div>
              <div className="space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-stone-200 text-[#E76A54] font-black flex items-center justify-center text-xs mb-2">04</div>
                <h3 className="font-bold text-stone-900 text-sm">Rounding</h3>
                <p className="text-xs text-stone-500 leading-relaxed">All delivery fees are rounded to the nearest whole rupee.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Set Bakery Location Modal */}
      <SetBakeryLocationModal
        isOpen={showBakeryLocationModal}
        onClose={() => setShowBakeryLocationModal(false)}
      />
    </div>
  );
};

