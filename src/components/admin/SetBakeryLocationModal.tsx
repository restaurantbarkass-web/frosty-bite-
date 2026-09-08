import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Navigation, 
  Check, 
  X, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Building2, 
  Globe, 
  Compass, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { BakeryLocation } from '../../types';
import { validateBakeryCoordinates, getBakeryMapUrl } from '../../utils/whatsapp';
import { BAKERY_ADDRESS, RESTAURANT_LOCATION } from '../../constants';
import toast from 'react-hot-toast';

interface SetBakeryLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (location: BakeryLocation) => void;
}

export const SetBakeryLocationModal: React.FC<SetBakeryLocationModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const { config, updateBakeryLocation } = useConfig();
  const { getAuthToken } = useAuth();

  // Form states initialized from current config
  const [bakeryName, setBakeryName] = useState('Frosty Bite Bakery');
  const [bakeryAddress, setBakeryAddress] = useState(BAKERY_ADDRESS);
  const [bakeryLat, setBakeryLat] = useState<number | string>(20.4625);
  const [bakeryLng, setBakeryLng] = useState<number | string>(85.8828);
  const [bakeryMapUrl, setBakeryMapUrl] = useState('');

  // Geolocation detection states (Admin device GPS)
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Confirmation modal step
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingLocationToSave, setPendingLocationToSave] = useState<BakeryLocation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync with config on open
  useEffect(() => {
    if (isOpen && config) {
      setBakeryName(config.bakeryName || 'Frosty Bite Bakery');
      setBakeryAddress(config.bakeryAddress || BAKERY_ADDRESS);
      setBakeryLat(config.bakeryLatitude ?? config.geofencingLatitude ?? RESTAURANT_LOCATION.lat);
      setBakeryLng(config.bakeryLongitude ?? config.geofencingLongitude ?? RESTAURANT_LOCATION.lng);
      setBakeryMapUrl(config.bakeryMapUrl || '');
      setDetectedCoords(null);
      setGpsError(null);
      setShowConfirmDialog(false);
      setPendingLocationToSave(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  // Handler: Request browser geolocation to detect admin's device GPS
  const handleDetectDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);
    setDetectedCoords(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingGps(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        if (validateBakeryCoordinates(lat, lng)) {
          setDetectedCoords({ lat, lng });
          toast.success('📍 Admin device coordinates detected! Please confirm to use as Bakery Location.');
        } else {
          setGpsError('Detected coordinates are invalid.');
          toast.error('Detected coordinates are invalid.');
        }
      },
      (error) => {
        setIsDetectingGps(false);
        let errorMsg = '⚠️ Location permission was denied.';
        if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = '⚠️ Location information is unavailable on this device.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = '⚠️ Location request timed out.';
        }
        setGpsError(errorMsg);
        toast.error(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Handler: Admin clicks "Confirm Detected Location" to trigger confirmation modal
  const handleApplyDetectedCoords = () => {
    if (!detectedCoords) return;

    const newLocation: BakeryLocation = {
      bakeryName: bakeryName.trim() || 'Frosty Bite Bakery',
      bakeryAddress: bakeryAddress.trim() || BAKERY_ADDRESS,
      bakeryLatitude: detectedCoords.lat,
      bakeryLongitude: detectedCoords.lng,
      bakeryMapUrl: `https://www.google.com/maps/search/?api=1&query=${detectedCoords.lat},${detectedCoords.lng}`
    };

    setPendingLocationToSave(newLocation);
    setShowConfirmDialog(true);
  };

  // Handler: Admin clicks manual save button to trigger confirmation modal
  const handleManualSaveTrigger = (e: React.FormEvent) => {
    e.preventDefault();

    const numLat = typeof bakeryLat === 'string' ? parseFloat(bakeryLat) : bakeryLat;
    const numLng = typeof bakeryLng === 'string' ? parseFloat(bakeryLng) : bakeryLng;

    if (!validateBakeryCoordinates(numLat, numLng)) {
      toast.error('Please enter valid numeric latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    const cleanMapUrl = bakeryMapUrl.trim();
    const finalMapUrl = (cleanMapUrl.startsWith('http://') || cleanMapUrl.startsWith('https://'))
      ? cleanMapUrl
      : `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}`;

    const newLocation: BakeryLocation = {
      bakeryName: bakeryName.trim() || 'Frosty Bite Bakery',
      bakeryAddress: bakeryAddress.trim() || BAKERY_ADDRESS,
      bakeryLatitude: numLat,
      bakeryLongitude: numLng,
      bakeryMapUrl: finalMapUrl
    };

    setPendingLocationToSave(newLocation);
    setShowConfirmDialog(true);
  };

  // Final Action: Save confirmed location to backend config
  const handleExecuteSave = async () => {
    if (!pendingLocationToSave) return;

    setIsSaving(true);
    try {
      const token = await getAuthToken();
      await updateBakeryLocation(pendingLocationToSave, token);

      if (onSaved) {
        onSaved(pendingLocationToSave);
      }

      toast.success('✓ Frosty Bite Bakery location confirmed and saved!', {
        style: {
          background: '#121212',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.4)'
        }
      });
      setShowConfirmDialog(false);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update bakery pickup location.');
    } finally {
      setIsSaving(false);
    }
  };

  // Current preview map URL
  const previewMapUrl = getBakeryMapUrl({
    bakeryMapUrl: bakeryMapUrl.trim() || undefined,
    bakeryLatitude: typeof bakeryLat === 'string' ? parseFloat(bakeryLat) : bakeryLat,
    bakeryLongitude: typeof bakeryLng === 'string' ? parseFloat(bakeryLng) : bakeryLng
  });

  return (
    <div id="set-bakery-location-modal" className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-[#0f0f13] border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative my-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <MapPin size={22} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1">
                Admin Configuration
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                📍 Set Frosty Bite Bakery Location
              </h2>
            </div>
          </div>

          <button
            id="btn-close-bakery-location-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Safety Note Banner */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3">
          <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-300 leading-relaxed">
            <strong className="text-amber-400">Important:</strong> The saved location below is the <strong className="text-white">official customer pickup point</strong> included in all Ready for Pickup WhatsApp notifications. The admin's current device GPS is only used as a suggestion and is never saved without explicit confirmation.
          </p>
        </div>

        {/* Option 1: Browser GPS Capture */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Navigation size={16} className="text-amber-400" />
                Option 1: Use Current Device GPS
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                If you are currently physically located at the bakery counter.
              </p>
            </div>

            <button
              id="btn-detect-admin-gps"
              type="button"
              onClick={handleDetectDeviceLocation}
              disabled={isDetectingGps}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg shadow-amber-500/20"
            >
              {isDetectingGps ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Detecting GPS...</span>
                </>
              ) : (
                <>
                  <Compass size={14} />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
          </div>

          {/* GPS Error Notification */}
          {gpsError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs">
              <AlertTriangle size={15} className="text-red-400 shrink-0" />
              <span>{gpsError} Please enter the bakery address or coordinates manually below.</span>
            </div>
          )}

          {/* Detected Coordinates Box */}
          {detectedCoords && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Coordinates Detected from Device
                </span>
                <span className="text-[11px] font-mono text-zinc-300">
                  {detectedCoords.lat}, {detectedCoords.lng}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Latitude</span>
                  <span className="font-mono text-amber-300 font-bold">{detectedCoords.lat}</span>
                </div>
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Longitude</span>
                  <span className="font-mono text-amber-300 font-bold">{detectedCoords.lng}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  id="btn-confirm-detected-location"
                  type="button"
                  onClick={handleApplyDetectedCoords}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Check size={14} />
                  <span>Confirm Bakery Location</span>
                </button>

                <button
                  type="button"
                  onClick={handleDetectDeviceLocation}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={13} />
                  <span>Recalculate</span>
                </button>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${detectedCoords.lat},${detectedCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ml-auto"
                >
                  <ExternalLink size={13} />
                  <span>Preview on Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Option 2: Manual Location & Address Entry */}
        <form onSubmit={handleManualSaveTrigger} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 size={16} className="text-amber-400" />
            Option 2: Enter Bakery Location Manually
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                Bakery Display Name
              </label>
              <input
                id="input-bakery-name"
                type="text"
                required
                value={bakeryName}
                onChange={(e) => setBakeryName(e.target.value)}
                placeholder="Frosty Bite Bakery"
                className="w-full bg-[#111116] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                Bakery Street Address (Customer Pickup Point)
              </label>
              <textarea
                id="textarea-bakery-address"
                rows={2}
                required
                value={bakeryAddress}
                onChange={(e) => setBakeryAddress(e.target.value)}
                placeholder="Frosty Bite Bakery, Main Road, Buxi Bazaar, Cuttack, Odisha - 753001"
                className="w-full bg-[#111116] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                  Latitude (-90 to 90)
                </label>
                <input
                  id="input-bakery-lat"
                  type="number"
                  step="0.0001"
                  required
                  value={bakeryLat}
                  onChange={(e) => setBakeryLat(e.target.value)}
                  placeholder="20.4625"
                  className="w-full bg-[#111116] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                  Longitude (-180 to 180)
                </label>
                <input
                  id="input-bakery-lng"
                  type="number"
                  step="0.0001"
                  required
                  value={bakeryLng}
                  onChange={(e) => setBakeryLng(e.target.value)}
                  placeholder="85.8828"
                  className="w-full bg-[#111116] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Custom Google Maps Link (Optional)
                </label>
                {previewMapUrl && (
                  <a
                    href={previewMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <ExternalLink size={12} /> Test Directions Link
                  </a>
                )}
              </div>
              <input
                id="input-bakery-map-url"
                type="url"
                value={bakeryMapUrl}
                onChange={(e) => setBakeryMapUrl(e.target.value)}
                placeholder="Leave blank to auto-generate from Latitude & Longitude"
                className="w-full bg-[#111116] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Default format: <code className="text-zinc-400">https://www.google.com/maps/search/?api=1&amp;query=&lt;LAT&gt;,&lt;LNG&gt;</code> (No Google Maps API key needed).
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-save-bakery-location"
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-950/40"
            >
              <Check size={16} />
              <span>Save Bakery Location</span>
            </button>
          </div>
        </form>

        {/* Explicit Confirmation Dialog Overlay */}
        <AnimatePresence>
          {showConfirmDialog && pendingLocationToSave && (
            <div id="bakery-location-confirm-dialog" className="absolute inset-0 z-30 bg-black/95 rounded-3xl p-6 sm:p-8 flex flex-col justify-center items-center text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <ShieldCheck size={32} />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-black text-white tracking-tight">
                  Are you sure?
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  This location will be saved and sent to customers as the official <strong className="text-amber-400">Pickup Location &amp; Map Directions</strong> in WhatsApp notifications.
                </p>
              </div>

              {/* Summary card */}
              <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-4 text-left text-xs space-y-1.5 font-mono">
                <p className="text-white font-bold font-sans text-sm">{pendingLocationToSave.bakeryName}</p>
                <p className="text-zinc-300 text-[11px] font-sans">{pendingLocationToSave.bakeryAddress}</p>
                <p className="text-amber-400 text-[11px] pt-1">
                  Coords: {pendingLocationToSave.bakeryLatitude}, {pendingLocationToSave.bakeryLongitude}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full max-w-md pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  id="btn-execute-confirm-bakery-location"
                  type="button"
                  onClick={handleExecuteSave}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/30"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm Bakery Location</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
