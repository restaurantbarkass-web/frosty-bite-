import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Sparkles, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../supabase';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

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
}

// Global script loading state to handle fast mounting / multiple renders safely
let isScriptLoaded = false;
let isScriptLoading = false;
let scriptLoadingPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  
  const google = (window as any).google;
  if (google?.maps?.places) {
    isScriptLoaded = true;
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const scriptId = 'google-maps-places';
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      const interval = setInterval(() => {
        if ((window as any).google?.maps?.places) {
          clearInterval(interval);
          isScriptLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    isScriptLoading = true;
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsAutocomplete`;
    script.async = true;
    script.defer = true;

    (window as any).initGoogleMapsAutocomplete = () => {
      isScriptLoading = false;
      isScriptLoaded = true;
      resolve();
    };

    script.onerror = (err) => {
      isScriptLoading = false;
      reject(err);
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
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
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [autocompleteService, setAutocompleteService] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<any>(null);

  const [query, setQuery] = useState(currentAddressValue || '');
  const [googlePredictions, setGooglePredictions] = useState<any[]>([]);
  const [localAreas, setLocalAreas] = useState<any[]>(DEFAULT_LOCAL_AREAS);
  const [localSuggestions, setLocalSuggestions] = useState<any[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
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
        console.log('[GooglePlacesAutocomplete] Realtime update to delivery_areas, re-fetching...');
        fetchLocalAreas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load Google Maps Script (if key has been provided)
  useEffect(() => {
    if (!hasValidKey) return;

    loadGoogleMapsScript(API_KEY)
      .then(() => {
        const google = (window as any).google;
        if (google?.maps?.places) {
          setIsLoaded(true);
          setAutocompleteService(new google.maps.places.AutocompleteService());
          setSessionToken(new google.maps.places.AutocompleteSessionToken());
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load Google Maps script:', err);
        setLoadError(true);
      });
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

  // Search handler (Local filtering + Google fetching)
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

    // 2. Fetch Google Predictions
    if (!isLoaded || !autocompleteService || !query || query.length < 3) {
      setGooglePredictions([]);
      if (searchVal.length >= 1) {
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        {
          input: query,
          sessionToken: sessionToken || undefined,
          componentRestrictions: { country: 'in' },
        },
        (results: any, status: any) => {
          setIsSearching(false);
          const google = (window as any).google;
          if (status === google?.maps?.places?.PlacesServiceStatus?.OK && results) {
            setGooglePredictions(results);
            setShowDropdown(true);
          } else {
            setGooglePredictions([]);
          }
        }
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, isLoaded, autocompleteService, sessionToken, localAreas]);

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

  // Handle Google place selection
  const handleSelectGooglePrediction = (prediction: any) => {
    const google = (window as any).google;
    if (!google?.maps?.places) return;

    setIsSelecting(true);
    setShowDropdown(false);
    setQuery(prediction.description);
    if (onManualStreetChange) {
      onManualStreetChange(prediction.description);
    }

    const dummyDiv = document.createElement('div');
    const placesService = new google.maps.places.PlacesService(dummyDiv);

    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'geometry', 'formatted_address'],
        sessionToken: sessionToken || undefined,
      },
      (place: any, status: any) => {
        setIsSelecting(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          const formattedAddress = place.formatted_address || '';

          let houseNumber = '';
          let streetName = '';
          let landmark = '';
          let city = 'Cuttack';
          let pincode = '';

          if (place.address_components) {
            for (const comp of place.address_components) {
              const types = comp.types;
              if (types.includes('street_number')) {
                houseNumber = comp.long_name;
              } else if (
                types.includes('sublocality') ||
                types.includes('sublocality_level_1') ||
                types.includes('route')
              ) {
                if (streetName) streetName += ', ' + comp.long_name;
                else streetName = comp.long_name;
              } else if (types.includes('sublocality_level_2')) {
                landmark = comp.long_name;
              } else if (types.includes('locality')) {
                city = comp.long_name;
              } else if (types.includes('postal_code')) {
                pincode = comp.long_name;
              }
            }
          }

          if (!streetName && prediction.structured_formatting) {
            streetName = prediction.structured_formatting.main_text;
          }

          if (!pincode) {
            const pinMatch = formattedAddress.match(/\b\d{6}\b/);
            if (pinMatch) pincode = pinMatch[0];
          }

          onAddressSelect({
            houseNumber,
            streetName: streetName || prediction.description,
            landmark,
            city,
            pincode,
            lat,
            lng,
            formattedAddress,
          });

          // Refresh token for next session flow
          setSessionToken(new google.maps.places.AutocompleteSessionToken());
        }
      }
    );
  };

  const hasSuggestions = localSuggestions.length > 0 || googlePredictions.length > 0;

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-1">
          <Sparkles size={11} className="text-primary animate-pulse" />
          Street / Area (Cuttack Local Autocomplete) *
        </label>
        <div className="relative">
          <input
            type="text"
            required
            placeholder="Type local area name (e.g. Madhupatna, Badambadi...)"
            className="w-full h-12 pl-11 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-650 text-xs focus:outline-none focus:border-primary/50 transition-all font-semibold"
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
                setGooglePredictions([]);
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
          {/* 1. Local Cuttack Sugessions */}
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

          {/* 2. Google Predictions */}
          {googlePredictions.length > 0 && (
            <div>
              <div className="px-4 py-1.5 bg-black/60 text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                Google Maps Suggestions
              </div>
              <div className="py-1">
                {googlePredictions.map((p: any) => (
                  <button
                    key={p.place_id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all duration-150 flex items-start gap-3 border-b border-white/[0.03] last:border-0"
                    onClick={() => handleSelectGooglePrediction(p)}
                  >
                    <MapPin size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">
                        {p.structured_formatting?.main_text || p.description}
                      </p>
                      <p className="text-[10px] font-medium text-zinc-500 mt-0.5 leading-snug">
                        {p.structured_formatting?.secondary_text || ''}
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

      {isSelecting && (
        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-50 backdrop-blur-[1px]">
          <div className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl">
            <Loader2 size={14} className="animate-spin text-primary" />
            <span className="text-[9px] font-black text-white uppercase tracking-widest">Pinpointing Location Coordinates...</span>
          </div>
        </div>
      )}
    </div>
  );
};
