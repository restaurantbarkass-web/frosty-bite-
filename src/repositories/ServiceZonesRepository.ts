import { BaseRepository } from './BaseRepository';
import { supabase } from '../supabase';
import { CacheKeys, CacheNamespace } from '../core/cache/CacheKeys';

export interface ServerServiceZone {
  id: string;
  city_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  [key: string]: any;
}

export interface ServicePincode {
  id: string;
  pincode: string;
  active: boolean;
  [key: string]: any;
}

export interface DeliveryArea {
  id: string;
  area_name: string;
  pincode: string;
  is_deliverable: boolean;
  [key: string]: any;
}

class ServiceZonesRepositoryImpl extends BaseRepository {
  /**
   * Fetch service zones with CacheOrchestrator and fallback
   */
  async getServiceZones(): Promise<ServerServiceZone[]> {
    return this.fetchWithCache<ServerServiceZone[]>(
      CacheKeys.SERVICE_ZONES,
      async () => {
        try {
          const response = await fetch('/api/service-zones');
          if (response.ok) {
            return await response.json();
          }
        } catch (_) {}

        const { data, error } = await supabase.from('service_zones').select('*');
        if (error) throw error;
        return (data || []).map((item: any) => ({
          id: item.id,
          city_name: item.city_name || item.name || '',
          latitude: Number(item.latitude || 0),
          longitude: Number(item.longitude || 0),
          radius_meters: Number(item.radius_meters || 12000),
          is_active: Boolean(item.is_active ?? true),
        }));
      },
      {
        namespace: CacheNamespace.GEOFENCE,
        fallbackData: [],
      }
    );
  }

  /**
   * Fetch service pincodes with CacheOrchestrator
   */
  async getServicePincodes(): Promise<ServicePincode[]> {
    return this.fetchWithCache<ServicePincode[]>(
      'service_pincodes',
      async () => {
        try {
          const response = await fetch('/api/service-pincodes');
          if (response.ok) {
            return await response.json();
          }
        } catch (_) {}

        const { data, error } = await supabase.from('service_pincodes').select('*');
        if (error) throw error;
        return (data || []).map((item: any) => ({
          id: item.id,
          pincode: String(item.pincode || ''),
          active: Boolean(item.active ?? item.is_active ?? true),
        }));
      },
      {
        namespace: CacheNamespace.GEOFENCE,
        fallbackData: [],
      }
    );
  }

  /**
   * Fetch delivery areas with CacheOrchestrator
   */
  async getDeliveryAreas(): Promise<DeliveryArea[]> {
    return this.fetchWithCache<DeliveryArea[]>(
      'delivery_areas',
      async () => {
        try {
          const response = await fetch('/api/delivery-areas');
          if (response.ok) {
            return await response.json();
          }
        } catch (_) {}

        const { data, error } = await supabase.from('delivery_areas').select('*');
        if (error) throw error;
        return (data || []).map((item: any) => ({
          id: item.id,
          area_name: item.area_name || item.name || '',
          pincode: String(item.pincode || ''),
          is_deliverable: Boolean(item.is_deliverable ?? item.is_active ?? true),
        }));
      },
      {
        namespace: CacheNamespace.GEOFENCE,
        fallbackData: [],
      }
    );
  }
}

export const ServiceZonesRepository = new ServiceZonesRepositoryImpl();
