import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Search, MapPin, Check, Trash2, Maximize2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { geocode } from '../../../lib/geocoder';

interface MapLibreBoundaryEditorProps {
  title?: string;
  initialBoundary?: any;
  defaultCenter?: [number, number]; // [lng, lat]
  centerOverride?: [number, number];
  defaultZoom?: number;
  readOnly?: boolean;
  hideHeader?: boolean;
  hideSearch?: boolean;
  onChangeBoundary?: (boundaryGeoJSON: any) => void;
  onSaveBoundary?: (boundaryGeoJSON: any) => void;
  onCancel?: () => void;
}

export const MapLibreBoundaryEditor: React.FC<MapLibreBoundaryEditorProps> = ({
  title,
  initialBoundary,
  defaultCenter = [85.8828, 20.4625], // Cuttack [lng, lat]
  centerOverride,
  defaultZoom = 12,
  readOnly = false,
  hideHeader = false,
  hideSearch = false,
  onChangeBoundary,
  onSaveBoundary,
  onCancel
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<any | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasDrawnShape, setHasDrawnShape] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle programmatic center flyTo
  const centerKey = centerOverride ? `${centerOverride[0]},${centerOverride[1]}` : '';
  useEffect(() => {
    if (centerOverride && mapRef.current) {
      mapRef.current.flyTo({ center: centerOverride, zoom: 14 });
    }
  }, [centerKey]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: defaultCenter,
        zoom: defaultZoom
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      const drawInstance = new MapboxDraw({
        displayControlsDefault: false,
        controls: readOnly ? {} : {
          polygon: true,
          trash: true
        },
        defaultMode: 'simple_select'
      });

      map.addControl(drawInstance as any, 'top-left');
      mapRef.current = map;
      drawRef.current = drawInstance;

      map.on('load', () => {
        // If initial boundary exists, set feature into draw
        if (initialBoundary) {
          try {
            let feature: any = initialBoundary;
            if (initialBoundary.type === 'MultiPolygon') {
              feature = {
                type: 'Feature',
                properties: {},
                geometry: initialBoundary
              };
            } else if (initialBoundary.type === 'Polygon') {
              feature = {
                type: 'Feature',
                properties: {},
                geometry: initialBoundary
              };
            }

            const featureIds = drawInstance.add(feature);
            if (featureIds && featureIds.length > 0) {
              setHasDrawnShape(true);
            }

            // Fit bounds
            fitMapToBounds(initialBoundary);
          } catch (err) {
            console.warn('[MapLibreBoundaryEditor] Error adding initial boundary:', err);
          }
        }
      });

      const updateDrawStatus = () => {
        const data = drawInstance.getAll();
        setHasDrawnShape(data.features.length > 0);
        if (onChangeBoundary) {
          onChangeBoundary(data.features.length > 0 ? data : null);
        }
      };

      map.on('draw.create' as any, updateDrawStatus);
      map.on('draw.update' as any, updateDrawStatus);
      map.on('draw.delete' as any, updateDrawStatus);

      return () => {
        map.remove();
      };
    } catch (err: any) {
      console.error('[MapLibreBoundaryEditor] Failed to initialize map:', err);
      toast.error('Failed to initialize MapLibre GL.');
    }
  }, []);

  const fitMapToBounds = (boundary: any) => {
    if (!mapRef.current || !boundary) return;
    try {
      let coords: [number, number][] = [];
      if (boundary.type === 'MultiPolygon') {
        boundary.coordinates.forEach((poly: any) => {
          poly.forEach((ring: any) => {
            ring.forEach((pt: any) => coords.push(pt as [number, number]));
          });
        });
      } else if (boundary.type === 'Polygon') {
        boundary.coordinates.forEach((ring: any) => {
          ring.forEach((pt: any) => coords.push(pt as [number, number]));
        });
      }

      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, coord) => b.extend(coord as [number, number]),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 15 });
      }
    } catch (err) {
      console.warn('[MapLibreBoundaryEditor] Error fitting bounds:', err);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await geocode(query.trim(), 'search');
        const features = data.map((item: any) => ({
          id: item.place_id,
          display_name: item.display_name,
          text: item.name || item.display_name.split(',')[0],
          center: [parseFloat(item.lon), parseFloat(item.lat)],
        }));
        setSearchResults(features);
      } catch (err) {
        console.error('[MapLibreBoundaryEditor] Search error:', err);
        toast.error('Search failed.');
      } finally {
        setIsSearching(false);
      }
    }, 750);
  };

  const handleSelectSearchResult = (feature: any) => {
    if (!mapRef.current) return;
    const [lng, lat] = feature.center;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
    setSearchResults([]);
    toast.success(`Centered on ${feature.text}`);
  };

  const handleClear = () => {
    if (drawRef.current) {
      drawRef.current.deleteAll();
      setHasDrawnShape(false);
      toast.success('Boundary cleared.');
    }
  };

  const handleFit = () => {
    if (drawRef.current) {
      const all = drawRef.current.getAll();
      if (all.features.length > 0) {
        fitMapToBounds(all.features[0].geometry);
      } else if (initialBoundary) {
        fitMapToBounds(initialBoundary);
      }
    }
  };

  const handleSave = () => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();

    if (data.features.length === 0) {
      toast.error('Please draw a polygon boundary on the map first.');
      return;
    }

    const feature = data.features[0];
    let multiPolygonGeoJSON: any = null;

    if (feature.geometry.type === 'Polygon') {
      multiPolygonGeoJSON = {
        type: 'MultiPolygon',
        coordinates: [feature.geometry.coordinates]
      };
    } else if (feature.geometry.type === 'MultiPolygon') {
      multiPolygonGeoJSON = feature.geometry;
    } else {
      toast.error('Only Polygon or MultiPolygon boundaries are allowed.');
      return;
    }

    onSaveBoundary(multiPolygonGeoJSON);
  };

  return (
    <div className="bg-zinc-900 border-none sm:border-solid sm:border-white/10 sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full sm:h-[600px] w-full">
      {/* Top Header */}
      {!hideHeader && (
      <div className="p-4 bg-zinc-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="text-orange-500" size={20} />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-semibold border border-orange-500/20">
            MapLibre GL JS & Draw
          </span>
        </div>

        {/* Search Bar */}
        {!hideSearch && (
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search city, locality, address..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full bg-zinc-900 text-white placeholder-zinc-500 text-xs rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-orange-500 pr-8"
          />
          <div
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </div>

          {/* Autocomplete Results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl max-h-48 overflow-y-auto">
              {searchResults.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectSearchResult(f)}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-orange-500/10 hover:text-orange-400 border-b border-white/5 last:border-0"
                >
                  <p className="font-semibold text-white">{f.text}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{f.display_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition-colors flex-1 sm:flex-none justify-center"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleFit}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-colors flex-1 sm:flex-none justify-center"
          >
            <Maximize2 size={12} /> Fit
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-semibold flex-1 sm:flex-none justify-center"
            >
              Cancel
            </button>
          )}
          {!readOnly && onSaveBoundary && (
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition-all w-full sm:w-auto justify-center sm:flex-none"
            >
              <Check size={14} /> Save Boundary
            </button>
          )}
        </div>
      </div>
      )}

      {/* Map Canvas Container */}
      <div className="relative flex-1 w-full h-full bg-black">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Helper Overlay Instructions */}
        {!readOnly && (
          <div className="hidden sm:block absolute bottom-4 left-4 bg-zinc-950/90 border border-white/10 rounded-xl p-3 text-xs text-zinc-300 backdrop-blur-md max-w-xs shadow-xl pointer-events-none">
            <p className="font-bold text-orange-400 flex items-center gap-1 mb-1">
              <MapPin size={12} /> How to Draw Boundary:
            </p>
            <p className="text-[11px] text-zinc-400">
              Click the <span className="text-white font-semibold">Polygon Tool</span> on top-left of the map, click points on map to create vertices, and click double to close the shape.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
