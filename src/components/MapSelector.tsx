import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, MapPin, Loader2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { geocode } from '../lib/geocoder';
import { safeTrim } from '../utils/string';

interface MapSelectorProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLocation?: { lat: number; lng: number };
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onLocationSelect, initialLocation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const defaultCenter: [number, number] = initialLocation
    ? [initialLocation.lng, initialLocation.lat]
    : [85.8828, 20.4625]; // Cuttack default

  const [position, setPosition] = useState<[number, number]>(defaultCenter);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  // Search autocomplete states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Perform Nominatim Reverse Geocoding
  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    setIsGeocoding(true);
    try {
      const data = await geocode('', 'reverse', { lat, lon: lng });
      if (data && data.display_name) {
        const formatted = data.display_name;
        setSelectedAddress(formatted);
        onLocationSelect(lat, lng, formatted);
        return;
      }
    } catch (err) {
      console.warn('[MapSelector] Reverse geocode error:', err);
    } finally {
      setIsGeocoding(false);
    }
    const fallback = `Location at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setSelectedAddress(fallback);
    onLocationSelect(lat, lng, fallback);
  }, [onLocationSelect]);

  // Handle position changes from click, drag, or locate
  const handleUpdatePosition = useCallback((lat: number, lng: number) => {
    setPosition([lng, lat]);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    }

    reverseGeocode(lng, lat);
  }, [reverseGeocode]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: position,
        zoom: initialLocation ? 15 : 13,
      });

      mapRef.current = map;

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

      // Create initial draggable marker
      const marker = new maplibregl.Marker({
        draggable: true,
        color: '#FF3366',
      })
        .setLngLat(position)
        .addTo(map);

      markerRef.current = marker;

      // Handle marker drag end
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setPosition([lngLat.lng, lngLat.lat]);
        reverseGeocode(lngLat.lat, lngLat.lng);
      });

      // Handle map click
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        setPosition([lng, lat]);
        reverseGeocode(lat, lng);
      });

      return () => {
        map.remove();
      };
    } catch (err) {
      console.error('[MapSelector] Failed to initialize MapLibre:', err);
    }
  }, []);

  // Handle Locate Me button click
  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        handleUpdatePosition(latitude, longitude);
        toast.success('Centered on your current location!');
      },
      (err) => {
        setIsLocating(false);
        console.warn('[MapSelector] Locate error:', err);
        toast.error('Unable to retrieve location. Please select on the map manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Nominatim Search Geocoding handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = safeTrim(query);
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await geocode(trimmed, 'search');
        const features = data.map((item: any) => ({
          id: item.place_id,
          display_name: item.display_name,
          text: item.name || item.display_name.split(',')[0],
          center: [parseFloat(item.lon), parseFloat(item.lat)],
          address: item.address,
        }));
        setSearchResults(features);
        setShowSearchResults(true);
      } catch (err) {
        console.warn('[MapSelector] Search geocoding error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 750);
  };

  const handleSelectSearchResult = (feature: any) => {
    if (!feature.center) return;
    const [lng, lat] = feature.center;
    const placeName = feature.display_name || feature.text;

    setSearchQuery(placeName);
    setShowSearchResults(false);
    handleUpdatePosition(lat, lng);
  };

  return (
    <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-white/10 group bg-zinc-950 shadow-2xl">
      {/* Search Bar Overlay */}
      <div className="absolute top-3 left-3 right-14 z-20">
        <div className="relative">
          <div className="flex items-center bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-2 shadow-lg">
            <Search size={16} className="text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              placeholder="Search city, area or street..."
              className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            {isSearching && <Loader2 size={14} className="animate-spin text-primary shrink-0 ml-1" />}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="text-zinc-400 hover:text-white ml-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-30 max-h-48 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-start gap-2 transition-colors text-xs text-zinc-200"
                >
                  <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Locate Me Floating Button */}
      <button
        onClick={handleLocateMe}
        type="button"
        className="absolute top-3 right-3 z-20 p-2.5 bg-zinc-900/90 border border-white/10 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-xl backdrop-blur-md"
        title="Locate Me"
      >
        {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
      </button>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Selected Address / Reverse Geocoding Indicator */}
      <div className="absolute bottom-3 left-3 right-12 z-20 pointer-events-none">
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg">
          <MapPin size={14} className="text-primary shrink-0" />
          <span className="text-[10px] font-medium text-zinc-300 truncate">
            {isGeocoding ? 'Reverse geocoding position...' : selectedAddress || 'Drag pin or click map to choose location'}
          </span>
        </div>
      </div>
    </div>
  );
};
