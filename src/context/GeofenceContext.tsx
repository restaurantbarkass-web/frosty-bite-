import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';
import { safeTrim, safeTrimLowerCase } from '../utils/string';

export interface DeliveryZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
}

export interface RecentValidatedLocation {
  id: string;
  name: string;
  city: string;
  pincode?: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export type V2LockState = 'locked' | 'validating' | 'serviceable' | 'unserviceable' | 'serviceability_error';

export interface V2ServiceabilityState {
  status: V2LockState;
  coordinates: { latitude: number; longitude: number } | null;
  city: string | null;
  pincode: string | null;
  locality: string | null;
  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryMinutes: number;
  distanceMeters: number | null;
  reason: string | null;
  selectedLocationName?: string | null;
  hasSelectedLocation?: boolean;
}

const GEOFENCING_V2_ENABLED = import.meta.env.VITE_GEOFENCING_V2_ENABLED !== 'false';

interface GeofenceContextType {
  isCheckingPosition: boolean;
  isAllowed: boolean;
  userCoords: { latitude: number; longitude: number } | null;
  activeZone: { name: string; distance: number; maxRadius: number } | null;
  allowedZonesList: DeliveryZone[];
  errorMessage: string | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
  isMockLocationDetected: boolean;
  recheckLocation: () => Promise<void>;
  submitNotifyRequest: (email: string, phone?: string, city?: string) => Promise<boolean>;
  selectManualCity: (cityZoneId: string) => boolean;
  detectedCity: string | null;
  detectedState: string | null;
  detectedPincode: string | null;
  detectedAddress: string | null;
  isPincodeAllowed: boolean | null;
  checkPincodeAvailability: (pincode: string) => Promise<boolean>;
  manualUnlockWithPincode: (pincode: string) => Promise<boolean>;
  clearLockedState: () => void;

  // V2 Additions & Strict Location Gate
  v2Serviceability: V2ServiceabilityState;
  checkV2Serviceability: (lat: number, lng: number, force?: boolean) => Promise<V2ServiceabilityState>;
  setUserLocationAndCheckV2: (lat: number, lng: number, address?: string) => Promise<V2ServiceabilityState>;
  validateCityAndCheckCoverage: (lat?: number, lng?: number) => Promise<V2ServiceabilityState>;
  setSelectedCandidateLocation: (lat: number, lng: number, addressName?: string, cityName?: string, pincodeVal?: string) => void;

  // Recent Locations
  recentLocations: RecentValidatedLocation[];
  addRecentValidatedLocation: (loc: Omit<RecentValidatedLocation, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  removeRecentLocation: (id: string) => void;
  clearRecentLocations: () => void;
}

const GeofenceContext = createContext<GeofenceContextType | undefined>(undefined);

export const GeofenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAdmin, loading: authLoading } = useAuth();
  const {
    geofencingEnabled,
    geofencingLatitude,
    geofencingLongitude,
    geofencingRadius,
    isLoading: isConfigLoading,
  } = useAppConfig();

  const [selectedManualCityId, setSelectedManualCityId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_selected_city_id');
    } catch {
      return null;
    }
  });

  const [isCheckingPosition, setIsCheckingPosition] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(() => {
    try {
      const savedLat = localStorage.getItem('frostybite_user_lat');
      const savedLng = localStorage.getItem('frostybite_user_lng');
      if (savedLat && savedLng) {
        const lat = parseFloat(savedLat);
        const lng = parseFloat(savedLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    } catch {}
    return null;
  });

  const [activeZone, setActiveZone] = useState<{ name: string; distance: number; maxRadius: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isMockLocationDetected, setIsMockLocationDetected] = useState(false);
  const [allowedZonesList, setAllowedZonesList] = useState<DeliveryZone[]>([]);

  // Reverse geocoding states and manual pincode unlock override state
  const [unlockedPincode, setUnlockedPincode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_unlocked_pincode') || null;
    } catch {
      return null;
    }
  });

  const [detectedCity, setDetectedCity] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_detected_city') || 'Cuttack';
    } catch {
      return 'Cuttack';
    }
  });

  const [detectedState, setDetectedState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_detected_state');
    } catch {
      return null;
    }
  });

  const [detectedPincode, setDetectedPincode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_detected_pincode');
    } catch {
      return null;
    }
  });

  const [detectedAddress, setDetectedAddress] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_detected_address');
    } catch {
      return null;
    }
  });

  const [isPincodeAllowed, setIsPincodeAllowed] = useState<boolean | null>(null);

  // Recent Validated Locations state (persisted in localStorage, max 5)
  const [recentLocations, setRecentLocations] = useState<RecentValidatedLocation[]>(() => {
    try {
      const raw = localStorage.getItem('frostybite_recent_validated_locations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 5);
        }
      }
      // If none, check if there was a previously confirmed location to initialize with
      const confLat = localStorage.getItem('frostybite_confirmed_lat');
      const confLng = localStorage.getItem('frostybite_confirmed_lng');
      const confCity = localStorage.getItem('frostybite_detected_city');
      const confPin = localStorage.getItem('frostybite_detected_pincode');
      const confAddr = localStorage.getItem('frostybite_detected_address');
      const confTime = localStorage.getItem('frostybite_confirmed_time');

      if (confLat && confLng && confCity) {
        const initialLoc: RecentValidatedLocation = {
          id: `${parseFloat(confLat).toFixed(4)}_${parseFloat(confLng).toFixed(4)}_${confPin || confCity}`,
          name: confAddr || `${confCity}${confPin ? ` (${confPin})` : ''}`,
          city: confCity,
          pincode: confPin || null,
          locality: confAddr || null,
          latitude: parseFloat(confLat),
          longitude: parseFloat(confLng),
          timestamp: confTime ? parseInt(confTime, 10) : Date.now(),
        };
        return [initialLoc];
      }
    } catch (e) {
      console.warn('[GeofenceContext] Error reading recent locations from localStorage:', e);
    }
    return [];
  });

  const addRecentValidatedLocation = useCallback((loc: Omit<RecentValidatedLocation, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => {
    setRecentLocations((prev) => {
      const newEntry: RecentValidatedLocation = {
        id: loc.id || `${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}_${loc.pincode || loc.city}`,
        name: loc.name || loc.locality || `${loc.city}${loc.pincode ? ` (${loc.pincode})` : ''}`,
        city: loc.city,
        pincode: loc.pincode || null,
        locality: loc.locality || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp || Date.now(),
      };

      // Filter out existing duplicates based on coordinates (proximity) or same pincode+city
      const filtered = prev.filter((item) => {
        const sameCoords = Math.abs(item.latitude - loc.latitude) < 0.001 && Math.abs(item.longitude - loc.longitude) < 0.001;
        const samePinCity = item.pincode && loc.pincode && item.pincode === loc.pincode && item.city.toLowerCase() === loc.city.toLowerCase();
        const sameName = item.name.toLowerCase() === newEntry.name.toLowerCase() && item.city.toLowerCase() === loc.city.toLowerCase();
        return !sameCoords && !samePinCity && !sameName;
      });

      const updated = [newEntry, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('frostybite_recent_validated_locations', JSON.stringify(updated));
      } catch (err) {
        console.warn('[GeofenceContext] Error saving recent locations:', err);
      }
      return updated;
    });
  }, []);

  const removeRecentLocation = useCallback((id: string) => {
    setRecentLocations((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('frostybite_recent_validated_locations', JSON.stringify(updated));
      } catch (err) {
        console.warn('[GeofenceContext] Error removing recent location:', err);
      }
      return updated;
    });
  }, []);

  const clearRecentLocations = useCallback(() => {
    setRecentLocations([]);
    try {
      localStorage.removeItem('frostybite_recent_validated_locations');
    } catch (err) {
      console.warn('[GeofenceContext] Error clearing recent locations:', err);
    }
  }, []);

  // V2 Serviceability State
  const [v2Serviceability, setV2Serviceability] = useState<V2ServiceabilityState>({
    status: 'locked',
    coordinates: userCoords,
    city: detectedCity,
    pincode: detectedPincode,
    locality: detectedAddress,
    deliveryFee: 40,
    minimumOrder: 149,
    estimatedDeliveryMinutes: 30,
    distanceMeters: null,
    reason: null,
    selectedLocationName: detectedAddress || detectedCity || 'Cuttack',
    hasSelectedLocation: !!userCoords || !!detectedCity
  });

  // Request deduplication cache ref
  const lastCheckRef = useRef<{ lat: number; lng: number; time: number; state: V2ServiceabilityState } | null>(null);
  const userCoordsRef = useRef(userCoords);
  const v2ServiceabilityRef = useRef(v2Serviceability);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  useEffect(() => {
    v2ServiceabilityRef.current = v2Serviceability;
  }, [v2Serviceability]);

  // Set candidate location without authorizing or unlocking
  const setSelectedCandidateLocation = useCallback((
    lat: number,
    lng: number,
    addressName?: string,
    cityName?: string,
    pincodeVal?: string
  ) => {
    const coords = { latitude: lat, longitude: lng };
    setUserCoords(coords);
    if (cityName) setDetectedCity(cityName);
    if (pincodeVal) setDetectedPincode(pincodeVal);
    if (addressName) setDetectedAddress(addressName);

    try {
      localStorage.setItem('frostybite_user_lat', lat.toString());
      localStorage.setItem('frostybite_user_lng', lng.toString());
      if (cityName) localStorage.setItem('frostybite_detected_city', cityName);
      if (pincodeVal) localStorage.setItem('frostybite_detected_pincode', pincodeVal);
      if (addressName) localStorage.setItem('frostybite_detected_address', addressName);
    } catch {}

    setV2Serviceability((prev) => ({
      ...prev,
      status: 'locked', // STRICTLY REMAINS LOCKED!
      coordinates: coords,
      city: cityName || prev.city || 'Cuttack',
      pincode: pincodeVal || prev.pincode || null,
      locality: addressName || null,
      reason: null,
      selectedLocationName: addressName || cityName || 'Selected Location',
      hasSelectedLocation: true
    }));
  }, []);

  // Primary Authoritative Gate Validation: "VALIDATE CITY"
  const validateCityAndCheckCoverage = useCallback(async (
    lat?: number,
    lng?: number
  ): Promise<V2ServiceabilityState> => {
    const targetLat = lat ?? userCoordsRef.current?.latitude ?? 20.4625;
    const targetLng = lng ?? userCoordsRef.current?.longitude ?? 85.8828;

    setIsCheckingPosition(true);
    setV2Serviceability((prev) => ({
      ...prev,
      status: 'validating',
      coordinates: { latitude: targetLat, longitude: targetLng }
    }));

    try {
      console.log(`[V2 Gate] Authoritative PostGIS check for coords (${targetLat}, ${targetLng})...`);
      const res = await fetch('/api/v2/geofencing/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: targetLat, longitude: targetLng }),
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           throw new Error("Received non-JSON response from server");
        }
        const data = await res.json();
        console.log('[V2 Gate] PostGIS response:', data);

        if (data.serviceable) {
          const newState: V2ServiceabilityState = {
            status: 'serviceable',
            coordinates: { latitude: targetLat, longitude: targetLng },
            city: data.city?.name || 'Cuttack',
            pincode: data.pincode?.pincode || '753001',
            locality: data.locality?.name || null,
            deliveryFee: data.deliveryFee ?? 40,
            minimumOrder: data.minimumOrder ?? 149,
            estimatedDeliveryMinutes: data.estimatedDeliveryMinutes ?? 30,
            distanceMeters: data.distanceMeters ?? 0,
            reason: null,
            selectedLocationName: data.locality?.name || data.city?.name || 'Validated Area',
            hasSelectedLocation: true
          };

          setV2Serviceability(newState);
          setDetectedCity(newState.city);
          setDetectedPincode(newState.pincode);
          setDetectedAddress(newState.locality ? `${newState.locality}, ${newState.city}` : newState.city);
          setActiveZone({ name: newState.locality || newState.city || 'Service Zone', distance: (newState.distanceMeters || 0) / 1000, maxRadius: 20 });
          setErrorMessage(null);

          // Add to Recent Locations
          addRecentValidatedLocation({
            name: newState.locality ? `${newState.locality}, ${newState.city}` : (newState.city || 'Delivery Location'),
            city: newState.city || 'Cuttack',
            pincode: newState.pincode,
            locality: newState.locality,
            latitude: targetLat,
            longitude: targetLng,
          });

          try {
            localStorage.setItem('frostybite_confirmed_lat', targetLat.toString());
            localStorage.setItem('frostybite_confirmed_lng', targetLng.toString());
            localStorage.setItem('frostybite_confirmed_time', Date.now().toString());
            if (newState.city) localStorage.setItem('frostybite_detected_city', newState.city);
            if (newState.pincode) localStorage.setItem('frostybite_detected_pincode', newState.pincode);
            if (newState.locality) localStorage.setItem('frostybite_detected_address', `${newState.locality}, ${newState.city}`);
          } catch {}

          lastCheckRef.current = { lat: targetLat, lng: targetLng, time: Date.now(), state: newState };
          setIsCheckingPosition(false);
          return newState;
        } else {
          const newState: V2ServiceabilityState = {
            status: 'unserviceable',
            coordinates: { latitude: targetLat, longitude: targetLng },
            city: data.city?.name || null,
            pincode: data.pincode?.pincode || null,
            locality: data.locality?.name || null,
            deliveryFee: 0,
            minimumOrder: 0,
            estimatedDeliveryMinutes: 0,
            distanceMeters: null,
            reason: data.reason || 'OUTSIDE_GLOBAL_SERVICE_AREA',
            selectedLocationName: data.locality?.name || data.city?.name || 'Selected Area',
            hasSelectedLocation: true
          };

          setV2Serviceability(newState);
          setActiveZone(null);

          try {
            localStorage.removeItem('frostybite_confirmed_lat');
            localStorage.removeItem('frostybite_confirmed_lng');
          } catch {}

          lastCheckRef.current = { lat: targetLat, lng: targetLng, time: Date.now(), state: newState };
          setIsCheckingPosition(false);
          return newState;
        }
      } else {
        const errorState: V2ServiceabilityState = {
          status: 'serviceability_error',
          coordinates: { latitude: targetLat, longitude: targetLng },
          city: null,
          pincode: null,
          locality: null,
          deliveryFee: 0,
          minimumOrder: 0,
          estimatedDeliveryMinutes: 0,
          distanceMeters: null,
          reason: 'SERVICEABILITY_UNAVAILABLE',
          selectedLocationName: null,
          hasSelectedLocation: true
        };

        setV2Serviceability(errorState);
        setErrorMessage("We couldn't verify your delivery area.");
        setIsCheckingPosition(false);
        return errorState;
      }
    } catch (err) {
      console.error('[V2 Gate] Fetch error during PostGIS check:', err);
      const errorState: V2ServiceabilityState = {
        status: 'serviceability_error',
        coordinates: { latitude: targetLat, longitude: targetLng },
        city: null,
        pincode: null,
        locality: null,
        deliveryFee: 0,
        minimumOrder: 0,
        estimatedDeliveryMinutes: 0,
        distanceMeters: null,
        reason: 'SERVICEABILITY_UNAVAILABLE',
        selectedLocationName: null,
        hasSelectedLocation: true
      };

      setV2Serviceability(errorState);
      setErrorMessage("We couldn't verify your delivery area.");
      setIsCheckingPosition(false);
      return errorState;
    }
  }, []);

  const checkV2Serviceability = useCallback(async (
    lat: number,
    lng: number,
    force = false
  ): Promise<V2ServiceabilityState> => {
    return validateCityAndCheckCoverage(lat, lng);
  }, [validateCityAndCheckCoverage]);

  const setUserLocationAndCheckV2 = useCallback(async (
    lat: number,
    lng: number,
    address?: string
  ): Promise<V2ServiceabilityState> => {
    setSelectedCandidateLocation(lat, lng, address);
    return {
      status: 'locked',
      coordinates: { latitude: lat, longitude: lng },
      city: detectedCity,
      pincode: detectedPincode,
      locality: address || null,
      deliveryFee: 40,
      minimumOrder: 149,
      estimatedDeliveryMinutes: 30,
      distanceMeters: null,
      reason: null,
      selectedLocationName: address || 'Selected Location',
      hasSelectedLocation: true
    };
  }, [setSelectedCandidateLocation, detectedCity, detectedPincode]);

  // Helper system to check if database has active record for pincode
  const checkPincodeAvailability = useCallback(async (pincode: string): Promise<boolean> => {
    if (!pincode) return false;
    const cleanPin = safeTrim(pincode).replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      return false;
    }
    try {
      const response = await fetch(`/api/validate-address/check-pincode/${cleanPin}`);
      if (response.ok) {
        const result = await response.json();
        return !!result.allowed;
      }
    } catch (err) {
      console.warn('[Geofence] Error checking pincode availability via backend:', err);
    }
    return false;
  }, []);

  const manualUnlockWithPincode = useCallback(async (pincode: string): Promise<boolean> => {
    if (!pincode) return false;
    const cleanPin = safeTrim(pincode).replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanPin)) return false;

    setDetectedPincode(cleanPin);
    const targetLat = userCoords?.latitude || 20.4625;
    const targetLng = userCoords?.longitude || 85.8828;
    setSelectedCandidateLocation(targetLat, targetLng, `Pincode ${cleanPin}`, detectedCity || 'Cuttack', cleanPin);
    return true;
  }, [userCoords, detectedCity, setSelectedCandidateLocation]);

  const clearLockedState = useCallback(() => {
    try {
      localStorage.removeItem('frostybite_unlocked_pincode');
      localStorage.removeItem('frostybite_selected_city_id');
      localStorage.removeItem('frostybite_detected_pincode');
      localStorage.removeItem('frostybite_detected_city');
      localStorage.removeItem('frostybite_detected_state');
      localStorage.removeItem('frostybite_detected_address');
      localStorage.removeItem('frostybite_user_lat');
      localStorage.removeItem('frostybite_user_lng');
      localStorage.removeItem('frostybite_confirmed_lat');
      localStorage.removeItem('frostybite_confirmed_lng');
      localStorage.removeItem('frostybite_confirmed_time');
    } catch {}
    setUnlockedPincode(null);
    setSelectedManualCityId(null);
    setUserCoords(null);
    setActiveZone(null);
    setDetectedPincode(null);
    setDetectedCity(null);
    setDetectedState(null);
    setDetectedAddress(null);
    setIsPincodeAllowed(null);
    setV2Serviceability({
      status: 'locked',
      coordinates: null,
      city: null,
      pincode: null,
      locality: null,
      deliveryFee: 0,
      minimumOrder: 0,
      estimatedDeliveryMinutes: 0,
      distanceMeters: null,
      reason: null,
      selectedLocationName: null,
      hasSelectedLocation: false
    });
  }, []);

  // Fetch dynamic service zones for UI fallbacks
  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/cities');
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const mapped: DeliveryZone[] = data.map((z: any) => {
            let lat = 20.4625;
            let lng = 85.8828;
            const lowerName = String(z.name).toLowerCase();
            if (lowerName.includes('cuttack')) {
              lat = 20.4625;
              lng = 85.8828;
            } else if (lowerName.includes('bhubaneswar')) {
              lat = 20.2961;
              lng = 85.8245;
            } else if (lowerName.includes('puri')) {
              lat = 19.8134;
              lng = 85.8312;
            } else {
              try {
                if (z.boundary && z.boundary.type === 'Polygon' && Array.isArray(z.boundary.coordinates?.[0])) {
                  const coords = z.boundary.coordinates[0];
                  let sumLat = 0;
                  let sumLng = 0;
                  for (const p of coords) {
                    sumLng += p[0];
                    sumLat += p[1];
                  }
                  lat = sumLat / coords.length;
                  lng = sumLng / coords.length;
                }
              } catch (e) {}
            }

            return {
              id: z.id,
              name: z.name,
              latitude: lat,
              longitude: lng,
              radius: 15, // fallback 15km
              enabled: Boolean(z.is_active)
            };
          });
          setAllowedZonesList(mapped);
          }
        }
      }
    } catch (e) {
      console.warn('[GeofenceProvider] Error fetching dynamic service zones API:', e);
    }
  }, []);

  const verifyLocation = useCallback(async (): Promise<void> => {
    setIsCheckingPosition(true);
    setErrorMessage(null);
    setIsMockLocationDetected(false);

    if (!navigator.geolocation) {
      setPermissionState('unsupported');
      setErrorMessage('Geolocation is not supported by your current browser.');
      setIsCheckingPosition(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'granted') setPermissionState('granted');
        else if (status.state === 'denied') setPermissionState('denied');
        else setPermissionState('prompt');

        status.onchange = () => {
          if (status.state === 'granted') setPermissionState('granted');
          else if (status.state === 'denied') setPermissionState('denied');
          else setPermissionState('prompt');
        };
      } catch (e) {}
    }

    const options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000,
    };

    return new Promise<void>((resolve) => {
      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          setIsCheckingPosition(false);
          resolve();
        }
      };

      const safetyTimer = setTimeout(safeResolve, 2000);

      try {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            clearTimeout(safetyTimer);
            setPermissionState('granted');
            const { latitude, longitude, accuracy } = position.coords;
            setUserCoords({ latitude, longitude });
            setIsMockLocationDetected(accuracy <= 0.01);

            try {
              localStorage.setItem('frostybite_user_lat', latitude.toString());
              localStorage.setItem('frostybite_user_lng', longitude.toString());
            } catch {}

            if (GEOFENCING_V2_ENABLED) {
              setSelectedCandidateLocation(latitude, longitude);
            }

            safeResolve();
          },
          (error) => {
            clearTimeout(safetyTimer);
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionState('denied');
              setErrorMessage('Location permission was denied. We require location access to verify service coverage.');
            } else {
              setErrorMessage('Location request timed out or unavailable. You can select your city on the map.');
            }
            safeResolve();
          },
          options
        );
      } catch (err: any) {
        clearTimeout(safetyTimer);
        setPermissionState('unsupported');
        setErrorMessage('Geolocation access is restricted or unsupported in this view.');
        safeResolve();
      }
    });
  }, [setSelectedCandidateLocation]);

  // Realtime Subscriptions for V2 PostGIS Tables (cities, pincodes, localities, service_areas)
  useEffect(() => {
    fetchZones();

    const handleRealtimeChange = () => {
      // ONLY re-verify if customer is currently UNLOCKED ('serviceable')
      if (v2ServiceabilityRef.current?.status === 'serviceable' && userCoordsRef.current) {
        console.log('[GeofenceProvider] Realtime database update! Re-verifying active customer serviceability...');
        validateCityAndCheckCoverage(userCoordsRef.current.latitude, userCoordsRef.current.longitude);
      }
    };

    const channelV2Cities = supabase
      .channel('realtime_v2_cities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, handleRealtimeChange)
      .subscribe();

    const channelV2Pincodes = supabase
      .channel('realtime_v2_pincodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pincodes' }, handleRealtimeChange)
      .subscribe();

    const channelV2Localities = supabase
      .channel('realtime_v2_localities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localities' }, handleRealtimeChange)
      .subscribe();

    const channelV2ServiceAreas = supabase
      .channel('realtime_v2_service_areas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_areas' }, handleRealtimeChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channelV2Cities);
      supabase.removeChannel(channelV2Pincodes);
      supabase.removeChannel(channelV2Localities);
      supabase.removeChannel(channelV2ServiceAreas);
    };
  }, [fetchZones, validateCityAndCheckCoverage]);

  const initialMountCheckDoneRef = useRef(false);

  // Handle initial verification on mount
  useEffect(() => {
    if (isConfigLoading || authLoading) return;
    if (initialMountCheckDoneRef.current) return;
    initialMountCheckDoneRef.current = true;

    try {
      const savedConfirmedLat = localStorage.getItem('frostybite_confirmed_lat');
      const savedConfirmedLng = localStorage.getItem('frostybite_confirmed_lng');
      if (savedConfirmedLat && savedConfirmedLng) {
        const lat = parseFloat(savedConfirmedLat);
        const lng = parseFloat(savedConfirmedLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          validateCityAndCheckCoverage(lat, lng);
          return;
        }
      }
    } catch {}

    setV2Serviceability(prev => ({ ...prev, status: 'locked' }));
  }, [isConfigLoading, authLoading, validateCityAndCheckCoverage]);

  // Execute manual re-check request from UI retry action
  const recheckLocation = useCallback(async () => {
    try {
      localStorage.removeItem('frostybite_selected_city_id');
      localStorage.removeItem('frostybite_confirmed_lat');
      localStorage.removeItem('frostybite_confirmed_lng');
    } catch {}
    setSelectedManualCityId(null);
    await fetchZones();
    if (userCoords && GEOFENCING_V2_ENABLED) {
      await validateCityAndCheckCoverage(userCoords.latitude, userCoords.longitude);
    } else {
      await verifyLocation();
    }
  }, [fetchZones, verifyLocation, validateCityAndCheckCoverage, userCoords]);

  const submitNotifyRequest = useCallback(async (email: string, phone?: string, city?: string): Promise<boolean> => {
    try {
      if (!email || typeof email !== 'string') return false;
      const emailTrimmed = safeTrimLowerCase(email);
      if (!emailTrimmed) return false;

      const response = await fetch('/api/validate-address/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTrimmed,
          phone: phone ? safeTrim(phone) : '',
          city: city ? safeTrim(city) : '',
          coords: userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude } : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return !!data.success;
      }
      return false;
    } catch (e) {
      console.error('[GeofenceProvider] Failed to log notify request:', e);
      return false;
    }
  }, [userCoords]);

  const selectManualCity = useCallback((cityZoneId: string): boolean => {
    const selected = allowedZonesList.find(z => z.id === cityZoneId);
    if (selected && selected.enabled) {
      try {
        localStorage.setItem('frostybite_selected_city_id', cityZoneId);
      } catch (err) {}
      setSelectedManualCityId(cityZoneId);
      setSelectedCandidateLocation(selected.latitude, selected.longitude, selected.name, selected.name);
      return true;
    }
    return false;
  }, [allowedZonesList, setSelectedCandidateLocation]);

  // Serviceability Decision:
  // Allowed ONLY if geofencing disabled, admin user, OR V2 status is serviceable
  const isAllowed = !geofencingEnabled || 
                    isAdmin || 
                    (GEOFENCING_V2_ENABLED ? v2Serviceability.status === 'serviceable' : activeZone !== null);

  const value = useMemo(() => ({
    isCheckingPosition,
    isAllowed,
    userCoords,
    activeZone,
    allowedZonesList,
    errorMessage,
    permissionState,
    isMockLocationDetected,
    recheckLocation,
    submitNotifyRequest,
    selectManualCity,
    detectedCity,
    detectedState,
    detectedPincode,
    detectedAddress,
    isPincodeAllowed,
    checkPincodeAvailability,
    manualUnlockWithPincode,
    clearLockedState,

    // V2 Expose
    v2Serviceability,
    checkV2Serviceability,
    setUserLocationAndCheckV2,
    validateCityAndCheckCoverage,
    setSelectedCandidateLocation,

    // Recent Locations
    recentLocations,
    addRecentValidatedLocation,
    removeRecentLocation,
    clearRecentLocations,
  }), [
    isCheckingPosition,
    isAllowed,
    userCoords,
    activeZone,
    allowedZonesList,
    errorMessage,
    permissionState,
    isMockLocationDetected,
    recheckLocation,
    submitNotifyRequest,
    selectManualCity,
    detectedCity,
    detectedState,
    detectedPincode,
    detectedAddress,
    isPincodeAllowed,
    checkPincodeAvailability,
    manualUnlockWithPincode,
    clearLockedState,
    v2Serviceability,
    checkV2Serviceability,
    setUserLocationAndCheckV2,
    validateCityAndCheckCoverage,
    setSelectedCandidateLocation,
    recentLocations,
    addRecentValidatedLocation,
    removeRecentLocation,
    clearRecentLocations,
  ]);

  return (
    <GeofenceContext.Provider value={value}>
      {children}
    </GeofenceContext.Provider>
  );
};

export const useGeofence = () => {
  const context = useContext(GeofenceContext);
  if (context === undefined) {
    throw new Error('useGeofence must be used within a GeofenceProvider');
  }
  return context;
};
