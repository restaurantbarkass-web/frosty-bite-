import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Database, Globe, Loader2 } from 'lucide-react';
import { V2City, V2Pincode, V2Locality } from './GeofencingV2Manager';

interface AutocompleteResult {
  source: 'db' | 'external';
  id: string;
  name: string;
  subtext: string;
  lat?: number;
  lng?: number;
  state?: string;
  country?: string;
  pincode?: string;
  originalDbRecord?: any;
}

interface AdminLocationAutocompleteProps {
  type: 'city' | 'pincode' | 'locality';
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AutocompleteResult) => void;
  dbRecords: any[]; // The array of cities, pincodes, or localities
  cityContext?: V2City; // Useful for locality/pincode to scope search
}

export const AdminLocationAutocomplete: React.FC<AdminLocationAutocompleteProps> = ({
  type,
  value,
  onChange,
  onSelect,
  dbRecords,
  cityContext
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);

      const newResults: AutocompleteResult[] = [];

      // 1. Search Database First
      const q = query.toLowerCase();
      let dbMatches = [];
      
      if (type === 'city') {
        dbMatches = (dbRecords as V2City[]).filter(c => c.name.toLowerCase().includes(q));
        newResults.push(...dbMatches.map(c => ({
          source: 'db' as const,
          id: `db-${c.id}`,
          name: c.name,
          subtext: `${c.state || ''}, ${c.country || ''}`.trim().replace(/^,|,$/g, ''),
          state: c.state,
          country: c.country,
          originalDbRecord: c
        })));
      } else if (type === 'pincode') {
        dbMatches = (dbRecords as V2Pincode[]).filter(p => p.pincode.includes(q));
        newResults.push(...dbMatches.map(p => {
          const city = cityContext || (p as any).city;
          return {
            source: 'db' as const,
            id: `db-${p.id}`,
            name: p.pincode,
            subtext: city ? city.name : '',
            originalDbRecord: p
          };
        }));
      } else if (type === 'locality') {
        dbMatches = (dbRecords as V2Locality[]).filter(l => l.name.toLowerCase().includes(q));
        newResults.push(...dbMatches.map(l => {
          const city = cityContext || (l as any).city;
          return {
            source: 'db' as const,
            id: `db-${l.id}`,
            name: l.name,
            subtext: city ? city.name : '',
            originalDbRecord: l
          };
        }));
      }

      // 2. Search External Nominatim if useful matches are few
      if (newResults.length < 3) {
        try {
          let externalQuery = query;
          if (type === 'locality' && cityContext) {
            externalQuery = `${query}, ${cityContext.name}`;
          }
          
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(externalQuery)}&format=json&addressdetails=1&countrycodes=in`, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'FrostyBiteApp/1.0',
              'Accept-Language': 'en-US,en'
            }
          });
          
          if (res.ok) {
            const extData = await res.json();
            const extMatches = extData.map((item: any) => {
              const address = item.address || {};
              let name = query;
              let state = address.state;
              let country = address.country;
              let pincode = address.postcode;
              let subtext = item.display_name;
              
              if (type === 'city') {
                name = address.city || address.town || address.village || address.county || item.name;
              } else if (type === 'pincode') {
                name = address.postcode || query;
              } else if (type === 'locality') {
                name = address.suburb || address.neighbourhood || address.residential || address.village || item.name;
              }

              return {
                source: 'external' as const,
                id: `ext-${item.place_id}`,
                name: name,
                subtext: subtext,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                state,
                country,
                pincode
              };
            });
            
            const uniqueExt = extMatches.filter((ext: any) => 
              !newResults.some(dbRes => dbRes.name.toLowerCase() === ext.name.toLowerCase())
            );
            
            newResults.push(...uniqueExt);
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('[AdminLocationAutocomplete] External search error:', err);
          }
        }
      }

      if (isMounted && !controller.signal.aborted) {
        setResults(newResults);
        setIsSearching(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(searchTimeout);
    };
  }, [query, type, dbRecords, cityContext]);

  const handleSelect = (res: AutocompleteResult) => {
    setQuery(res.name);
    onChange(res.name);
    onSelect(res);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            if (!val) setShowDropdown(false);
          }}
          onFocus={() => {
            if (query.length >= 2) setShowDropdown(true);
          }}
          placeholder={`Search ${type}...`}
          className="w-full bg-zinc-950 text-white rounded-xl pl-10 pr-4 py-2 border border-white/10 text-xs focus:outline-none focus:border-orange-500 transition-colors"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 animate-spin" size={14} />
        )}
      </div>

      {showDropdown && (query.length >= 2) && (
        <div className="absolute z-[100] w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {results.length > 0 ? (
              <div className="py-1">
                {results.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleSelect(res)}
                    className="w-full text-left px-4 py-2 hover:bg-zinc-700/50 flex flex-col gap-0.5 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {res.source === 'db' ? (
                        <Database size={12} className="text-emerald-400 flex-none" />
                      ) : (
                        <Globe size={12} className="text-blue-400 flex-none" />
                      )}
                      <span className="text-sm font-semibold text-white line-clamp-1">{res.name}</span>
                    </div>
                    {res.subtext && (
                      <span className="text-[10px] text-zinc-400 line-clamp-1 ml-5">
                        {res.subtext}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              !isSearching && (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-zinc-400">No useful matches found.</p>
                </div>
              )
            )}
          </div>
          <div className="bg-zinc-900 px-3 py-1.5 border-t border-white/10 flex items-center justify-between">
             <span className="text-[9px] text-zinc-500 font-medium">Search Priority: Database &rarr; External API</span>
          </div>
        </div>
      )}
    </div>
  );
};
