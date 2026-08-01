import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';

export interface DeliveryZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
}

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
}

const GeofenceContext = createContext<GeofenceContextType | undefined>(undefined);

// Haversine formula to calculate distance in km between two coordinate points
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const GeofenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const {
    geofencingEnabled,
    geofencingLatitude,
    geofencingLongitude,
    geofencingRadius,
    geofencingZones,
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
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeZone, setActiveZone] = useState<{ name: string; distance: number; maxRadius: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isMockLocationDetected, setIsMockLocationDetected] = useState(false);
  const [allowedZonesList, setAllowedZonesList] = useState<DeliveryZone[]>([]);

  // Reverse geocoding states and manual pincode unlock override state
  const [unlockedPincode, setUnlockedPincode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('frostybite_unlocked_pincode') || '753001';
    } catch {
      return '753001';
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

  // Helper system to check if database has active record for pincode
  const checkPincodeAvailability = useCallback(async (pincode: string): Promise<boolean> => {
    const cleanPin = pincode.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      return false;
    }
    try {
      console.log(`[Geofence] Checking availability of pincode ${cleanPin} via backend API...`);
      const response = await fetch(`/api/validate-address/check-pincode/${cleanPin}`);
      if (response.ok) {
        const result = await response.json();
        console.log(`[Geofence] Backend pincode check result:`, result);
        return !!result.allowed;
      }
    } catch (err) {
      console.warn('[Geofence] Error checking pincode availability via backend, trying direct client-side fallback:', err);
    }

    // Direct client-side fallback in case of backend api fetch issue
    try {
      console.log(`[Geofence] Frontend fallback: checking pincode ${cleanPin} in Supabase directly...`);
      if (cleanPin.startsWith('753')) {
        return true;
      }

      const { data, error } = await supabase
        .from('delivery_pincodes')
        .select('*')
        .eq('pincode', cleanPin)
        .eq('is_active', true);

      if (!error && data && data.length > 0) {
        console.log('[Geofence] Pincode found active in delivery_pincodes!');
        return true;
      }

      const { data: pins, error: pinErr } = await supabase
        .from('service_pincodes')
        .select('*')
        .eq('pincode', cleanPin)
        .eq('active', true);

      if (!pinErr && pins && pins.length > 0) {
        console.log('[Geofence] Pincode found active in service_pincodes!');
        return true;
      }
    } catch (fallbackErr) {
      console.warn('[Geofence] direct client-side Supabase fallback query skipped/failed:', fallbackErr);
    }

    return false;
  }, []);

  const manualUnlockWithPincode = useCallback(async (pincode: string): Promise<boolean> => {
    const isAvailable = await checkPincodeAvailability(pincode);
    if (isAvailable) {
      setUnlockedPincode(pincode.trim());
      try {
        localStorage.setItem('frostybite_unlocked_pincode', pincode.trim());
      } catch (e) {}
      return true;
    }
    return false;
  }, [checkPincodeAvailability]);

  const clearLockedState = useCallback(() => {
    try {
      localStorage.removeItem('frostybite_unlocked_pincode');
      localStorage.removeItem('frostybite_selected_city_id');
      localStorage.removeItem('frostybite_detected_pincode');
      localStorage.removeItem('frostybite_detected_city');
      localStorage.removeItem('frostybite_detected_state');
      localStorage.removeItem('frostybite_detected_address');
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
  }, []);

  // Caching reverse geocoder fetch wrapper
  const fetchReverseGeocode = useCallback(async (lat: number, lon: number) => {
    const cacheKey = `osm_geocode_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.log('[Geofence] Found cached address geocoding result');
        return JSON.parse(cached);
      }
    } catch (e) {}

    try {
      console.log('[Geofence] Fetching reverse geocode from Nominatim...');
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
        headers: {
          'User-Agent': 'FrostyBiteServiceAvailability/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const state = address.state || '';
        const city = address.city || address.town || address.village || address.city_district || '';
        const pincode = address.postcode ? address.postcode.replace(/[^0-9]/g, '').slice(0, 6) : '';
        const fullAddress = data.display_name || '';

        const result = { city, state, pincode, fullAddress };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {}
        return result;
      }
    } catch (err) {
      console.error('[Geofence] Reverse geocoding failed:', err);
    }
    return null;
  }, []);

  // Parse and fetch custom dynamic service zones from backend API
  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch('/api/service-zones');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapped: DeliveryZone[] = data.map((z: any) => ({
            id: z.id || z.city_name,
            name: z.city_name,
            latitude: Number(z.latitude),
            longitude: Number(z.longitude),
            radius: Number(z.radius_meters) / 1000, // API returns meters, we map to km
            enabled: Boolean(z.is_active)
          }));
          setAllowedZonesList(mapped);
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

    // Attempt to query existing permission state if browser API supports it
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'granted') {
          setPermissionState('granted');
        } else if (status.state === 'denied') {
          setPermissionState('denied');
        } else {
          setPermissionState('prompt');
        }

        // Setup listener for permission changes
        status.onchange = () => {
          if (status.state === 'granted') setPermissionState('granted');
          else if (status.state === 'denied') setPermissionState('denied');
          else setPermissionState('prompt');
        };
      } catch (e) {
        // Suppress if browser does not support permission queries
      }
    }

    const options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 2500,
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

      // Safety timer so loading screen never hangs
      const safetyTimer = setTimeout(safeResolve, 1500);

      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(safetyTimer);
            setPermissionState('granted');
            const { latitude, longitude, accuracy } = position.coords;
            setUserCoords({ latitude, longitude });

            const isSuspicious = accuracy <= 0.01;
            setIsMockLocationDetected(isSuspicious);

            safeResolve();

            // Reverse geocoding in background
            fetchReverseGeocode(latitude, longitude).then(async (geo) => {
              if (geo) {
                setDetectedCity(geo.city || null);
                setDetectedState(geo.state || null);
                setDetectedPincode(geo.pincode || null);
                setDetectedAddress(geo.fullAddress || null);
                
                try {
                  localStorage.setItem('frostybite_detected_city', geo.city || '');
                  localStorage.setItem('frostybite_detected_state', geo.state || '');
                  localStorage.setItem('frostybite_detected_pincode', geo.pincode || '');
                  localStorage.setItem('frostybite_detected_address', geo.fullAddress || '');
                } catch (e) {}

                if (geo.pincode) {
                  const isAvailable = await checkPincodeAvailability(geo.pincode);
                  setIsPincodeAllowed(isAvailable);
                  if (isAvailable) {
                    setUnlockedPincode(geo.pincode);
                    try {
                      localStorage.setItem('frostybite_unlocked_pincode', geo.pincode);
                    } catch (e) {}
                  } else {
                    setUnlockedPincode(null);
                    try {
                      localStorage.removeItem('frostybite_unlocked_pincode');
                    } catch (e) {}
                  }
                }
              }
            }).catch((err) => {
              console.error('[Geofence] Reverse geocode error inside geolocation callback:', err);
            });
          },
          (error) => {
            clearTimeout(safetyTimer);
            console.warn('[GeofenceProvider] Geolocation query failed:', error);
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionState('denied');
              setErrorMessage('Location permission was denied. We require location access to verify service coverage.');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              setErrorMessage('Your precise location is currently unavailable. Please check your system GPS settings.');
            } else if (error.code === error.TIMEOUT) {
              setErrorMessage('Location request timed out. Please check signal strength or retry.');
            } else {
              setErrorMessage('An unexpected error occurred while verifying location coordinates.');
            }
            safeResolve();
          },
          options
        );
      } catch (err: any) {
        clearTimeout(safetyTimer);
        console.warn('[GeofenceProvider] Synchronous error calling getCurrentPosition (possibly blocked by iframe feature policy):', err);
        setPermissionState('unsupported');
        setErrorMessage('Geolocation access is restricted or unsupported in this view.');
        safeResolve();
      }
    });
  }, [fetchReverseGeocode, checkPincodeAvailability]);

  useEffect(() => {
    fetchZones();

    const channelZones = supabase
      .channel('realtime_geofence_zones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_zones' }, () => {
        console.log('[GeofenceProvider] Realtime service_zones update, re-fetching...');
        fetchZones();
      })
      .subscribe();

    const channelPincodes = supabase
      .channel('realtime_geofence_pincodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_pincodes' }, () => {
        console.log('[GeofenceProvider] Realtime service_pincodes update, triggering re-evaluation...');
        verifyLocation();
      })
      .subscribe();

    const channelDeliveryPincodes = supabase
      .channel('realtime_geofence_delivery_pincodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_pincodes' }, () => {
        console.log('[GeofenceProvider] Realtime delivery_pincodes update, triggering re-evaluation...');
        verifyLocation();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelZones);
      supabase.removeChannel(channelPincodes);
      supabase.removeChannel(channelDeliveryPincodes);
    };
  }, [fetchZones, verifyLocation]);

  // Synchronize geofencing state, user coordinates, and active zone safely on input/state modifications
  useEffect(() => {
    if (isConfigLoading || authLoading) return;

    if (!geofencingEnabled) {
      setActiveZone((prev) => {
        if (!prev || prev.name !== 'Global Service Boundary (Bypassed)') {
          return { name: 'Global Service Boundary (Bypassed)', distance: 0, maxRadius: Infinity };
        }
        return prev;
      });
      setIsCheckingPosition(false);
      return;
    }

    if (isAdmin) {
      setActiveZone((prev) => {
        if (!prev || prev.name !== 'Admin Operations Bypass') {
          return { name: 'Admin Operations Bypass', distance: 0, maxRadius: Infinity };
        }
        return prev;
      });
      setIsCheckingPosition(false);
      return;
    }

    if (selectedManualCityId) {
      const selected = allowedZonesList.find(z => z.id === selectedManualCityId);
      if (selected && selected.enabled) {
        setUserCoords((prev) => {
          if (!prev || prev.latitude !== selected.latitude || prev.longitude !== selected.longitude) {
            return { latitude: selected.latitude, longitude: selected.longitude };
          }
          return prev;
        });
        setActiveZone((prev) => {
          if (!prev || prev.name !== selected.name || prev.maxRadius !== selected.radius) {
            return { name: selected.name, distance: 0, maxRadius: selected.radius };
          }
          return prev;
        });
        setIsCheckingPosition(false);
        return;
      }
    }

    if (!userCoords) {
      setActiveZone((prev) => {
        if (prev !== null) return null;
        return prev;
      });
      setIsCheckingPosition(false);
      return;
    }

    const { latitude: uLat, longitude: uLon } = userCoords;

    // 1. Check Primary Zone: Cuttack center
    const centralLat = geofencingLatitude ?? 20.4625;
    const centralLon = geofencingLongitude ?? 85.8828;
    const centralRadius = geofencingRadius ?? 12;

    const distanceToPrimary = calculateHaversineDistance(uLat, uLon, centralLat, centralLon);
    console.log(`[Geofence] Measured distance to Cuttack Central is ${distanceToPrimary.toFixed(2)} km (Max: ${centralRadius} km)`);

    if (distanceToPrimary <= centralRadius) {
      setActiveZone((prev) => {
        if (!prev || prev.name !== 'Cuttack' || prev.distance !== distanceToPrimary) {
          return { name: 'Cuttack', distance: distanceToPrimary, maxRadius: centralRadius };
        }
        return prev;
      });
      setIsCheckingPosition(false);
      return;
    }

    // 2. Check future secondary service areas defined under config
    if (allowedZonesList && allowedZonesList.length > 0) {
      for (const zone of allowedZonesList) {
        if (!zone.enabled) continue;
        const dist = calculateHaversineDistance(uLat, uLon, zone.latitude, zone.longitude);
        console.log(`[Geofence] Measured distance to ${zone.name} is ${dist.toFixed(2)} km (Max: ${zone.radius} km)`);
        if (dist <= zone.radius) {
          setActiveZone((prev) => {
            if (!prev || prev.name !== zone.name || prev.distance !== dist) {
              return { name: zone.name, distance: dist, maxRadius: zone.radius };
            }
            return prev;
          });
          setIsCheckingPosition(false);
          return;
        }
      }
    }

    // No matches -> Locked!
    setActiveZone((prev) => {
      if (prev !== null) return null;
      return prev;
    });
    setIsCheckingPosition(false);
  }, [
    isConfigLoading,
    authLoading,
    geofencingEnabled,
    isAdmin,
    selectedManualCityId,
    allowedZonesList,
    userCoords,
    geofencingLatitude,
    geofencingLongitude,
    geofencingRadius
  ]);

  // Handle initialization and periodic auto-polling checks
  useEffect(() => {
    if (isConfigLoading || authLoading) return;

    // Run custom location check initially on mount if manual city choice doesn't exist
    if (geofencingEnabled && !isAdmin && !selectedManualCityId && !userCoords) {
      verifyLocation();
    }

    // Revalidate location periodically every 60 seconds (1 minute) while open to prevent drift
    const interval = setInterval(async () => {
      if (geofencingEnabled && !isAdmin && !selectedManualCityId) {
        console.log('[GeofenceProvider] Periodically revalidating position to prevent drift...');
        await verifyLocation();
      }
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [isConfigLoading, authLoading, geofencingEnabled, isAdmin, verifyLocation, selectedManualCityId]);

  // Execute manual re-check request from UI retry action
  const recheckLocation = useCallback(async () => {
    // Force clear manual selection to run raw GPS check again
    try {
      localStorage.removeItem('frostybite_selected_city_id');
    } catch {}
    setSelectedManualCityId(null);
    await fetchZones();
    await verifyLocation();
  }, [fetchZones, verifyLocation]);

  // Save "Notify Me" request in Supabase/Server backup (completely removing Firebase)
  const submitNotifyRequest = useCallback(async (email: string, phone?: string, city?: string): Promise<boolean> => {
    try {
      const emailTrimmed = email.trim().toLowerCase();
      if (!emailTrimmed) return false;

      const response = await fetch('/api/validate-address/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailTrimmed,
          phone: phone ? phone.trim() : '',
          city: city ? city.trim() : '',
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
      } catch (err) {
        console.warn('Could not save selected city to localStorage:', err);
      }
      setSelectedManualCityId(cityZoneId);
      setUserCoords({ latitude: selected.latitude, longitude: selected.longitude });
      setActiveZone({ name: selected.name, distance: 0, maxRadius: selected.radius });
      setIsCheckingPosition(false);
      return true;
    }
    return false;
  }, [allowedZonesList]);

  function emailIdSanitize(email: string): string {
    return email.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // Combined evaluates: User is allowed if geofencing is off, they are an admin, OR they are verified inside a zone OR manually unlocked with an active pincode
  const isAllowed = !geofencingEnabled || isAdmin || activeZone !== null || unlockedPincode !== null;

  return (
    <GeofenceContext.Provider
      value={{
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
      }}
    >
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
