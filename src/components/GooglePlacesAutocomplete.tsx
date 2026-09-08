import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { geocode } from '../lib/geocoder';
import { safeTrim } from '../utils/string';

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

export const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  onAddressSelect,
  currentAddressValue,
  onManualStreetChange,
  isInvalid,
  shakeKey = 0,
}) => {
  const [query, setQuery] = useState(currentAddressValue || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentAddressValue !== undefined && currentAddressValue !== queryRef.current) {
      setQuery(currentAddressValue);
    }
  }, [currentAddressValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // OSM Nominatim Geocoding Search
  useEffect(() => {
    const trimmed = safeTrim(query);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await geocode(trimmed, 'search');
        const formattedSuggestions = data.map((item: any) => ({
          id: item.place_id,
          text: item.name || item.display_name.split(',')[0],
          place_name: item.display_name,
          center: [parseFloat(item.lon), parseFloat(item.lat)],
          address: item.address,
        }));
        setSuggestions(formattedSuggestions);
        setShowDropdown(true);
      } catch (err) {
        console.warn('[NominatimAutocomplete] Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 750);

    return () => clearTimeout(debounceTimerRef.current);
  }, [query]);

  const handleSelect = (feature: any) => {
    const lng = feature.center ? feature.center[0] : undefined;
    const lat = feature.center ? feature.center[1] : undefined;
    const formattedAddress = feature.place_name || feature.text || '';

    // Extract context details from Nominatim response
    const addr = feature.address || {};
    let city = addr.city || addr.town || addr.village || addr.municipality || 'Cuttack';
    let pincode = addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '';
    let streetName = addr.road || addr.suburb || addr.neighbourhood || feature.text || '';

    setQuery(formattedAddress);
    setShowDropdown(false);

    if (onManualStreetChange) {
      onManualStreetChange(formattedAddress);
    }

    onAddressSelect({
      houseNumber: '',
      streetName: streetName || formattedAddress,
      landmark: '',
      city: city || 'Cuttack',
      pincode: pincode || '753001',
      lat,
      lng,
      formattedAddress,
    });
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onManualStreetChange) onManualStreetChange(e.target.value);
          }}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search location, area, or street (powered by MapLibre & OSM)..."
          className={`w-full bg-zinc-900/90 border ${
            isInvalid ? 'border-red-500/80 bg-red-950/10' : 'border-white/10'
          } rounded-2xl px-4 py-3.5 pl-11 pr-10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 transition-all shadow-inner`}
        />
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />

        {isSearching ? (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowDropdown(false);
              if (onManualStreetChange) onManualStreetChange('');
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Nominatim Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-[1050] max-h-60 overflow-y-auto divide-y divide-white/5">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-start gap-3 group"
            >
              <MapPin size={16} className="text-primary mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-primary transition-colors">
                  {item.text}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">{item.place_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
