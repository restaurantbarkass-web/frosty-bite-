import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../supabase';

interface GooglePlacesAutocompleteProps {
  onAddressSelect: (data: {
    houseNumber: string;
    streetName: string;
    landmark: string;
    city: string;
    pincode: string;
    lat?: number;
    lng?: number;
    formattedAddress: string;
  }) => void;
  currentAddressValue?: string;
  onManualStreetChange?: (value: string) => void;
  isInvalid?: boolean;
  shakeKey?: number;
}

// Pre-seeded Cuttack local areas fallback
const DEFAULT_LOCAL_AREAS = [
  { id: 'area_1', area_name: 'Madhupatna', pincode: '753010', is_deliverable: true },
  { id: 'area_2', area_name: 'Badambadi', pincode: '753012', is_deliverable: true },
  { id: 'area_3', area_name: 'College Square', pincode: '753003', is_deliverable: true },
  { id: 'area_4', area_name: 'CDA Sector 6', pincode: '753014', is_deliverable: false },
  { id: 'area_5', area_name: 'CDA Sector 7', pincode: '753014', is_deliverable: false },
  { id: 'area_6', area_name: 'Buxi Bazaar', pincode: '753001', is_deliverable: true },
  { id: 'area_7', area_name: 'Choudhury Bazar', pincode: '753002', is_deliverable: true },
  { id: 'area_8', area_name: 'CDA Sector 9', pincode: '753014', is_deliverable: false }
];

export const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  onAddressSelect,
  currentAddressValue,
  onManualStreetChange,
  isInvalid,
  shakeKey = 0,
}) => {
  const [query, setQuery] = useState(currentAddressValue || '');
  const [osmPredictions, setOsmPredictions] = useState<any[]>([]);
  const [localAreas, setLocalAreas] = useState<any[]>(DEFAULT_LOCAL_AREAS);
  const [localSuggestions, setLocalSuggestions] = useState<any[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // Sync internal input state with currentAddressValue if updated by parent
  useEffect(() => {
    if (currentAddressValue !== undefined && currentAddressValue !== queryRef.current) {
      setQuery(currentAddressValue);
    }
  }, [currentAddressValue]);

  // Fetch Delivery Areas on mount & Subscribe to Realtime Updates
  useEffect(() => {
    const fetchLocalAreas = async () => {
      try {
        const res = await fetch('/api/delivery-areas');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setLocalAreas(data);
          }
        }
      } catch (err) {
        console.warn('Failed to load dynamic delivery areas, using presets:', err);
      }
    };

    fetchLocalAreas();

    const channel = supabase
      .channel('realtime_autocomplete_areas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_areas' }, () => {
        console.log('[OSMAutocomplete] Realtime update to delivery_areas, re-fetching...');
        fetchLocalAreas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Click outside to hide suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search handler (Local filtering + OpenStreetMap fetching)
  useEffect(() => {
    const searchVal = query.trim().toLowerCase();
    
    // 1. Filter local areas
    if (searchVal.length >= 1) {
      const filtered = localAreas.filter(area => 
        area.area_name.toLowerCase().includes(searchVal) ||
        area.pincode.includes(searchVal)
      );
      setLocalSuggestions(filtered);
    } else {
      setLocalSuggestions([]);
    }

    // 2. Fetch OpenStreetMap Nominatim Predictions
    if (!query || query.length < 3) {
      setOsmPredictions([]);
      if (searchVal.length >= 1) {
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`
        );
        if (response.ok) {
          const results = await response.json();
          if (Array.isArray(results)) {
            setOsmPredictions(results);
            setShowDropdown(true);
          } else {
            setOsmPredictions([]);
          }
        }
      } catch (err) {
        console.error('OSM Nominatim search failed:', err);
        setOsmPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, localAreas]);

  // Handle local suggestion selection
  const handleSelectLocalArea = (area: any) => {
    setShowDropdown(false);
    setQuery(area.area_name);
    if (onManualStreetChange) {
      onManualStreetChange(area.area_name);
    }

    onAddressSelect({
      houseNumber: '',
      streetName: area.area_name,
      landmark: '',
      city: 'Cuttack',
      pincode: area.pincode,
      formattedAddress: `${area.area_name}, Cuttack, Odisha - ${area.pincode}`
    });
  };

  // Handle OSM place selection
  const handleSelectOsmPrediction = (prediction: any) => {
    setShowDropdown(false);
    
    // Shorten the display text or keep description
    const displayName = prediction.display_name;
    setQuery(displayName);
    if (onManualStreetChange) {
      onManualStreetChange(displayName);
    }

    const addr = prediction.address || {};
    
    const lat = parseFloat(prediction.lat);
    const lng = parseFloat(prediction.lon);

    const houseNumber = addr.house_number || '';
    const streetName = addr.road || addr.suburb || addr.neighbourhood || addr.sublocality || '';
    const landmark = addr.amenity || addr.shop || addr.landmark || '';
    const city = addr.city || addr.town || addr.village || 'Cuttack';
    const pincode = addr.postcode || '';

    onAddressSelect({
      houseNumber,
      streetName: streetName || displayName.split(',')[0],
      landmark,
      city,
      pincode,
      lat,
      lng,
      formattedAddress: displayName,
    });
  };

  const hasSuggestions = localSuggestions.length > 0 || osmPredictions.length > 0;

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1">
          <Sparkles size={11} className="text-primary animate-pulse" />
          Street / Area (Cuttack Local Autocomplete) *
        </label>
        <div className="relative">
          <input
            key={`street-${shakeKey}`}
            type="text"
            required
            placeholder="Type local area name (e.g. Madhupatna, Badambadi...)"
            className={`w-full h-12 pl-11 pr-11 rounded-xl bg-white/5 border text-white placeholder-zinc-650 text-xs focus:outline-none focus:border-primary/50 transition-all font-semibold ${
              isInvalid
                ? 'border-red-500 ring-2 ring-red-500/30 animate-shake'
                : 'border-white/10'
            }`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (onManualStreetChange) onManualStreetChange(e.target.value);
            }}
            onFocus={() => {
              setShowDropdown(true);
            }}
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            {isSearching ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : (
              <Search size={16} />
            )}
          </div>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setOsmPredictions([]);
                setLocalSuggestions([]);
                setShowDropdown(false);
                if (onManualStreetChange) onManualStreetChange('');
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {showDropdown && hasSuggestions && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full z-150 bg-[#121214] border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
          {/* 1. Local Cuttack Suggestions */}
          {localSuggestions.length > 0 && (
            <div className="border-b border-white/5 last:border-0">
              <div className="px-4 py-1.5 bg-black/60 text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} className="text-primary animate-pulse" />
                Frosty Bite Local Served Areas
              </div>
              <div className="py-1">
                {localSuggestions.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all duration-150 flex items-center justify-between border-b border-white/[0.03] last:border-0"
                    onClick={() => handleSelectLocalArea(area)}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className={area.is_deliverable ? "text-primary shrink-0 mt-0.5" : "text-zinc-650 shrink-0 mt-0.5"} />
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">
                          {area.area_name}
                        </p>
                        <p className="text-[10px] font-medium text-zinc-500 mt-0.5 leading-snug">
                          Cuttack, PIN: {area.pincode}
                        </p>
                      </div>
                    </div>
                    <div>
                      {area.is_deliverable ? (
                        <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={9} /> Served
                        </span>
                      ) : (
                        <span className="text-[8px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={9} /> Outside Area
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. OpenStreetMap Predictions */}
          {osmPredictions.length > 0 && (
            <div>
              <div className="px-4 py-1.5 bg-black/60 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                OpenStreetMap Suggestions
              </div>
              <div className="py-1">
                {osmPredictions.map((p: any) => (
                  <button
                    key={p.place_id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all duration-150 flex items-start gap-3 border-b border-white/[0.03] last:border-0"
                    onClick={() => handleSelectOsmPrediction(p)}
                  >
                    <MapPin size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {p.address?.road || p.address?.suburb || p.address?.neighbourhood || p.display_name.split(',')[0]}
                      </p>
                      <p className="text-[10px] font-medium text-zinc-500 mt-0.5 truncate leading-snug">
                        {p.display_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-1.5 bg-[#09090b] border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Served Areas of Cuttack</span>
            <span className="text-primary/70">Tap a locality for 1-click fill</span>
          </div>
        </div>
      )}
    </div>
  );
};
