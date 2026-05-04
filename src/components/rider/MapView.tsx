import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Custom Icons from User Request
const sendIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/CliffCloud/Leaflet.LocationShare/master/dist/images/IconMapSend.png",
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -30]
});

const receiveIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/CliffCloud/Leaflet.LocationShare/master/dist/images/IconMapReceive.png",
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -30]
});

interface MapViewProps {
  riderLocation: { lat: number; lng: number } | null;
  customerLocation: { lat: number; lng: number } | null;
}

// Component to handle map centering and URL parsing
const MapController = ({ 
  riderLocation, 
  customerLocation 
}: { 
  riderLocation: { lat: number; lng: number } | null;
  customerLocation: { lat: number; lng: number } | null;
}) => {
  const map = useMap();
  const [receivedLocation, setReceivedLocation] = useState<{ lat: number; lng: number; message: string } | null>(null);

  useEffect(() => {
    // Parse URL for received location
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat') || '');
    const lng = parseFloat(params.get('lng') || '');
    const message = params.get('M') || '';

    if (!isNaN(lat) && !isNaN(lng)) {
      setReceivedLocation({ lat, lng, message: decodeURIComponent(message) });
      map.setView([lat, lng], 16);
    } else if (riderLocation) {
      map.setView([riderLocation.lat, riderLocation.lng], 15);
    } else if (customerLocation) {
      map.setView([customerLocation.lat, customerLocation.lng], 15);
    }
  }, [riderLocation, customerLocation, map]);

  return (
    <>
      {receivedLocation && (
        <Marker position={[receivedLocation.lat, receivedLocation.lng]} icon={receiveIcon}>
          <Popup>
            <div className="p-2">
              <p className="font-bold text-primary mb-1 text-xs uppercase tracking-widest">Shared Location</p>
              <p className="text-sm text-white">{receivedLocation.message || 'No message'}</p>
              <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-zinc-500">
                Lat: {receivedLocation.lat.toFixed(4)}, Lng: {receivedLocation.lng.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

// Custom Control for Sharing Location
const ShareLocationControl = () => {
  const map = useMap();
  const [sharingMarker, setSharingMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState('');

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const center = map.getCenter();
    setSharingMarker({ lat: center.lat, lng: center.lng });
  };

  const getShareUrl = () => {
    if (!sharingMarker) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      lat: sharingMarker.lat.toString(),
      lng: sharingMarker.lng.toString(),
      M: encodeURIComponent(message)
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const copyUrl = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url);
    alert('Location URL copied to clipboard!');
  };

  return (
    <>
      <div className="leaflet-top leaflet-left mt-20 ml-2">
        <div className="leaflet-control leaflet-bar border-none shadow-none">
          <button
            onClick={handleShareClick}
            className="w-10 h-10 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center hover:bg-primary transition-colors group"
            title="Share Location"
          >
            <img 
              src="https://raw.githubusercontent.com/CliffCloud/Leaflet.LocationShare/master/dist/images/IconLocShare.png" 
              alt="Share" 
              className="w-6 h-6 group-hover:brightness-0 group-hover:invert transition-all"
            />
          </button>
        </div>
      </div>

      {sharingMarker && (
        <Marker 
          position={[sharingMarker.lat, sharingMarker.lng]} 
          icon={sendIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              setSharingMarker({ lat: position.lat, lng: position.lng });
            },
          }}
        >
          <Popup minWidth={250}>
            <div className="p-4 bg-zinc-900 rounded-2xl">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-3">Share your location</p>
              <input 
                type="text" 
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary mb-4"
              />
              <button 
                onClick={copyUrl}
                className="w-full py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all"
              >
                Get Share URL
              </button>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

export const MapView: React.FC<MapViewProps> = ({ riderLocation, customerLocation }) => {
  const defaultCenter: [number, number] = [17.3850, 78.4867]; // Hyderabad

  return (
    <div className="w-full h-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl relative">
      <MapContainer 
        center={defaultCenter} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark"
        />
        
        {riderLocation && (
          <Marker position={[riderLocation.lat, riderLocation.lng]}>
            <Popup>
              <div className="text-xs font-bold">You are here</div>
            </Popup>
          </Marker>
        )}

        {customerLocation && (
          <Marker position={[customerLocation.lat, customerLocation.lng]}>
            <Popup>
              <div className="text-xs font-bold">Customer Location</div>
            </Popup>
          </Marker>
        )}

        <MapController riderLocation={riderLocation} customerLocation={customerLocation} />
        <ShareLocationControl />
      </MapContainer>

      {/* Overlay for dark mode feel */}
      <div className="absolute inset-0 pointer-events-none bg-primary/5 mix-blend-overlay z-10" />
    </div>
  );
};
