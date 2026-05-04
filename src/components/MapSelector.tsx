import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLocation?: { lat: number; lng: number };
}

function LocateButton({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 16);
        onLocate(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        console.error("Geolocation error:", error);
        
        switch (error.code) {
          case 1:
            toast.error("Permission denied. Please allow location access.");
            break;
          case 2:
            toast.error("Location unavailable. Check your GPS or internet.");
            break;
          case 3:
            toast.error("Location request timed out.");
            break;
          default:
            toast.error("Error getting location. Please enter manually.");
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        handleLocate();
      }}
      className="absolute top-4 right-4 z-[1000] p-3 bg-zinc-900 border border-white/10 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-xl backdrop-blur-md group"
      title="Locate Me"
    >
      {isLocating ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <Crosshair size={20} className="group-hover:scale-110 transition-transform" />
      )}
    </button>
  );
}

function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ onLocationSelect, initialLocation }) => {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : null
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Default to Bhubaneswar or passed initial location
  const defaultCenter: [number, number] = [20.2961, 85.8245];

  const handleLocationUpdate = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    setIsReverseGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      const address = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      onLocationSelect(lat, lng, address);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      onLocationSelect(lat, lng, `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  return (
    <div className="relative w-full h-[300px] rounded-3xl overflow-hidden border border-white/10 group">
      <MapContainer
        center={position || defaultCenter}
        zoom={position ? 16 : 13}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {position && <Marker position={position} />}
        
        <LocateButton onLocate={handleLocationUpdate} />
        <LocationPicker onSelect={handleLocationUpdate} />
      </MapContainer>

      {isReverseGeocoding && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[1001] flex items-center justify-center">
            <div className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Pinpointing Address...</span>
            </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none">
        <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <MapPin size={12} className="text-primary" />
            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">Click on map to pick location</span>
        </div>
      </div>
    </div>
  );
};
