import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  MapPin, 
  Plus, 
  Trash2, 
  Navigation, 
  Activity, 
  Settings, 
  Info,
  ShieldCheck,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Map,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { ServiceZonesRepository, DiagnosticsRepository } from '../../repositories';
import toast from 'react-hot-toast';
import { GeofencingV2Manager } from '../../components/admin/v2/GeofencingV2Manager';
import { safeTrim } from '../../utils/string';

interface ServerServiceZone {
  id: string;
  city_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

interface ServicePincode {
  id: string;
  pincode: string;
  active: boolean;
}

export const ServiceZones: React.FC = () => {
  const { user } = useAuth();
  const [zones, setZones] = useState<ServerServiceZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State for zones
  const [cityName, setCityName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('12000');
  const [isActive, setIsActive] = useState(true);

  // Switchable Tab state
  const [activeTab, setActiveTab] = useState<'v2' | 'zones' | 'pincodes' | 'areas' | 'diagnostics'>('v2');

  // Pincode control states
  const [pincodes, setPincodes] = useState<ServicePincode[]>([]);
  const [isPincodesLoading, setIsPincodesLoading] = useState(true);
  const [isSubmittingPincode, setIsSubmittingPincode] = useState(false);
  const [newPincode, setNewPincode] = useState('');
  const [newPincodeActive, setNewPincodeActive] = useState(true);

  const [updatingPincodeIds, setUpdatingPincodeIds] = useState<string[]>([]);
  const [pincodeToDelete, setPincodeToDelete] = useState<ServicePincode | null>(null);
  const [isDeletingPincode, setIsDeletingPincode] = useState(false);

  // Delivery Areas control states
  interface DeliveryArea {
    id: string;
    area_name: string;
    pincode: string;
    is_deliverable: boolean;
  }
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [isAreasLoading, setIsAreasLoading] = useState(true);
  const [isSubmittingArea, setIsSubmittingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaPincode, setNewAreaPincode] = useState('');
  const [newAreaDeliverable, setNewAreaDeliverable] = useState(true);

  // Diagnostic Log Function for Toggle Lifecycle Tracing
  const logToggleLifecycle = (
    stage: 'START' | 'PAYLOAD' | 'RESPONSE' | 'REVERT' | 'REFRESH',
    context: {
      type: 'Zone' | 'Pincode' | 'Area';
      id: string;
      label?: string;
      initialState: boolean;
      targetState: boolean;
      payload?: any;
      httpStatus?: number;
      responseBody?: any;
      error?: any;
    }
  ) => {
    const timestamp = new Date().toISOString();
    const prefix = `[DIAGNOSTIC LOG][${timestamp}][${context.type} Toggle]`;
    
    switch (stage) {
      case 'START':
        console.group(`%c${prefix} Initiated`, 'color: #3b82f6; font-weight: bold;');
        console.log(`Selected Record ID: %c${context.id}`, 'font-family: monospace; color: #fbbf24;');
        console.log(`Label/Value: "${context.label || 'Unknown'}"`);
        console.log(`Initial State: %c${context.initialState}`, 'font-weight: bold; color: #ef4444;');
        console.log(`Target State: %c${context.targetState}`, 'font-weight: bold; color: #10b981;');
        console.groupEnd();
        break;
      case 'PAYLOAD':
        console.group(`%c${prefix} API Payload Sent`, 'color: #8b5cf6; font-weight: bold;');
        console.log(`API Target URL: %c/api/${context.type === 'Zone' ? 'service-zones' : context.type === 'Pincode' ? 'service-pincodes' : 'delivery-areas'}/${context.id}`, 'font-family: monospace; color: #fbbf24;');
        console.log('Payload Data:', context.payload);
        console.groupEnd();
        break;
      case 'RESPONSE':
        console.group(`%c${prefix} API Response Received`, 'color: #10b981; font-weight: bold;');
        console.log(`HTTP Status: %c${context.httpStatus}`, 'font-weight: bold; color: #3b82f6;');
        console.log('Response Body:', context.responseBody);
        console.groupEnd();
        break;
      case 'REVERT':
        console.group(`%c${prefix} Failure: Reverting Client Optimistic State`, 'color: #ef4444; font-weight: bold;');
        if (context.error) {
          console.error('Error Details:', context.error);
        }
        console.log(`State reverted back to initial value: %c${context.initialState}`, 'font-weight: bold; color: #ef4444;');
        console.groupEnd();
        break;
      case 'REFRESH':
        console.group(`%c${prefix} Success - Triggering State Refresh`, 'color: #06b6d4; font-weight: bold;');
        console.log('State updated successfully in remote database and cache. Calling re-fetch for fresh state refresh...');
        console.groupEnd();
        break;
    }
  };

  // Helper to distinguish network vs database permission (RLS) errors and display clean toasts
  const handleToggleFailureToast = (
    type: 'Zone' | 'Pincode' | 'Area',
    label: string,
    responseBody: any,
    httpStatus: number | null,
    isNetworkError: boolean,
    errorObj?: any
  ) => {
    let title = 'Toggle Status Update Failed';
    let detail = `Failed to update status for ${type.toLowerCase()} "${label}"`;
    let isRlsOrPermission = false;

    if (isNetworkError) {
      title = 'Network Connectivity Error';
      detail = 'The server could not be reached. Please check your internet connection or network status.';
    } else if (responseBody) {
      const msgLower = (responseBody.message || responseBody.error || '').toLowerCase();
      const code = String(responseBody.code || '');
      
      const hasRlsKeywords = 
        msgLower.includes('row-level security') ||
        msgLower.includes('rls') ||
        msgLower.includes('permission denied') ||
        msgLower.includes('policy') ||
        msgLower.includes('forbidden') ||
        code === '42501' ||
        responseBody.isRlsViolation;

      if (httpStatus === 403 || httpStatus === 401 || hasRlsKeywords) {
        isRlsOrPermission = true;
        title = 'Database Permission Denied (Supabase RLS Policy issue)';
        detail = responseBody.message || 'The update was blocked by your database Row Level Security (RLS) policies or administrative permission rules.';
      } else {
        detail = responseBody.message || responseBody.error || 'Server rejected the status update.';
      }
    } else if (errorObj) {
      const msgLower = String(errorObj.message || errorObj).toLowerCase();
      const isRls = msgLower.includes('row-level security') || msgLower.includes('rls') || msgLower.includes('permission') || msgLower.includes('42501');
      
      if (isRls) {
        isRlsOrPermission = true;
        title = 'Database Permission Denied (Supabase RLS Policy issue)';
        detail = errorObj.message || String(errorObj);
      } else {
        detail = errorObj.message || String(errorObj);
      }
    }

    if (isRlsOrPermission) {
      toast.error(
        `${title}: ${detail}`,
        { duration: 7000, icon: '🚫' }
      );
    } else if (isNetworkError) {
      toast.error(
        `${title}: ${detail}`,
        { duration: 5000, icon: '📶' }
      );
    } else {
      toast.error(`${title}: ${detail}`);
    }
  };

  // Load zones (Legacy V1 tab fallback)
  const fetchZones = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ServiceZonesRepository.getServiceZones();
      setZones(data);
    } catch (err) {
      setZones([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load pincodes (Legacy V1 tab fallback)
  const fetchPincodes = useCallback(async () => {
    setIsPincodesLoading(true);
    try {
      const data = await ServiceZonesRepository.getServicePincodes();
      setPincodes(data);
    } catch (err) {
      setPincodes([]);
    } finally {
      setIsPincodesLoading(false);
    }
  }, []);

  // Load delivery areas (Legacy V1 tab fallback)
  const fetchDeliveryAreas = useCallback(async () => {
    setIsAreasLoading(true);
    try {
      const data = await ServiceZonesRepository.getDeliveryAreas();
      setDeliveryAreas(data);
    } catch (err) {
      setDeliveryAreas([]);
    } finally {
      setIsAreasLoading(false);
    }
  }, []);

  // Add delivery area
  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingArea) return;
    const trimmedAreaName = safeTrim(newAreaName);
    const trimmedAreaPincode = safeTrim(newAreaPincode);

    if (!trimmedAreaName || !trimmedAreaPincode) {
      toast.error('Local Area Name and Pincode are required');
      return;
    }
    if (!/^\d{6}$/.test(trimmedAreaPincode)) {
      toast.error('Pincode must be exactly a 6-digit number');
      return;
    }

    setIsSubmittingArea(true);
    try {
      const headers = await getAuthHeaders();
      console.log('REQUEST URL:', '/api/delivery-areas');
      console.log('REQUEST BODY:', {
        area_name: trimmedAreaName,
        pincode: trimmedAreaPincode,
        is_deliverable: newAreaDeliverable
      });
      const response = await fetch('/api/delivery-areas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          area_name: trimmedAreaName,
          pincode: trimmedAreaPincode,
          is_deliverable: newAreaDeliverable
        })
      });

      if (response.ok) {
        toast.success(`Locality "${newAreaName}" added successfully!`);
        setNewAreaName('');
        setNewAreaPincode('');
        setNewAreaDeliverable(true);
        fetchDeliveryAreas();
      } else {
        const errData = await response.json().catch(() => ({ message: 'Server returned error status ' + response.status }));
        toast.error(errData.message || 'Failed to add local area selection');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error submitting local area selection');
    } finally {
      setIsSubmittingArea(false);
    }
  };

  // Toggle delivery area is_deliverable status
  const handleToggleAreaDeliverable = async (area: DeliveryArea) => {
    const updatedStatus = !area.is_deliverable;
    const type = 'Area';

    logToggleLifecycle('START', {
      type,
      id: area.id,
      label: area.area_name,
      initialState: area.is_deliverable,
      targetState: updatedStatus
    });

    const payload = { is_deliverable: updatedStatus };
    logToggleLifecycle('PAYLOAD', {
      type,
      id: area.id,
      initialState: area.is_deliverable,
      targetState: updatedStatus,
      payload
    });

    try {
      const headers = await getAuthHeaders();
      
      // Optimistic update
      setDeliveryAreas(prev => prev.map(a => a.id === area.id ? { ...a, is_deliverable: updatedStatus } : a));

      const response = await fetch(`/api/delivery-areas/${area.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (_) {}

      logToggleLifecycle('RESPONSE', {
        type,
        id: area.id,
        initialState: area.is_deliverable,
        targetState: updatedStatus,
        httpStatus: response.status,
        responseBody
      });

      if (response.ok) {
        toast.success(`Updated status for "${area.area_name}"`);
        logToggleLifecycle('REFRESH', {
          type,
          id: area.id,
          initialState: area.is_deliverable,
          targetState: updatedStatus
        });
        fetchDeliveryAreas();
      } else {
        logToggleLifecycle('REVERT', {
          type,
          id: area.id,
          initialState: area.is_deliverable,
          targetState: updatedStatus,
          error: responseBody
        });
        // Revert optimistic update
        setDeliveryAreas(prev => prev.map(a => a.id === area.id ? { ...a, is_deliverable: !updatedStatus } : a));
        handleToggleFailureToast(type, area.area_name, responseBody, response.status, false);
      }
    } catch (err) {
      logToggleLifecycle('REVERT', {
        type,
        id: area.id,
        initialState: area.is_deliverable,
        targetState: updatedStatus,
        error: err
      });
      // Revert optimistic update
      setDeliveryAreas(prev => prev.map(a => a.id === area.id ? { ...a, is_deliverable: !updatedStatus } : a));
      handleToggleFailureToast(type, area.area_name, null, null, true, err);
    }
  };

  // Delete delivery area
  const handleDeleteArea = async (area: DeliveryArea) => {
    if (!window.confirm(`Are you absolutely sure you want to remove "${area.area_name}" from the served list?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      console.log('REQUEST URL:', `/api/delivery-areas/${area.id}`);
      console.log('REQUEST METHOD: DELETE');
      const response = await fetch(`/api/delivery-areas/${area.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        toast.success(`Removed locality "${area.area_name}"`);
        fetchDeliveryAreas();
      } else {
        toast.error('Failed to delete locality');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting locality from backend');
    }
  };

  useEffect(() => {
    if (activeTab === 'zones') {
      fetchZones();
    } else if (activeTab === 'pincodes') {
      fetchPincodes();
    } else if (activeTab === 'areas') {
      fetchDeliveryAreas();
    }
  }, [activeTab, fetchZones, fetchPincodes, fetchDeliveryAreas]);

  // Auth Header Helper
  const getAuthHeaders = async () => {
    try {
      let token: string | null = null;

      if (user && typeof user.getIdToken === 'function') {
        token = await user.getIdToken();

        console.log('Firebase User:', user.email);
        console.log('Token Length:', token?.length);
      }

      if (!token) {
        token = localStorage.getItem('latest_admin_auth_token');
        console.log('Using localStorage token');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log('Headers:', headers);

      return headers;
    } catch (error) {
      console.error('Auth Header Error:', error);

      return {
        'Content-Type': 'application/json',
      };
    }
  };

  // Submit new zone
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCityName = safeTrim(cityName);
    if (!trimmedCityName) {
      toast.error('Please specify a valid City Name');
      return;
    }

    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    const radVal = parseInt(radiusMeters, 10);

    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
      toast.error('Latitude must be a valid number between -90 and 90');
      return;
    }
    if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      toast.error('Longitude must be a valid number between -180 and 180');
      return;
    }
    if (isNaN(radVal) || radVal <= 0) {
      toast.error('Radius must be a positive integer in meters');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      console.log('REQUEST URL:', '/api/service-zones');
      console.log('REQUEST BODY:', {
        city_name: trimmedCityName,
        latitude: latVal,
        longitude: lngVal,
        radius_meters: radVal,
        is_active: isActive
      });
      const response = await fetch('/api/service-zones', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          city_name: trimmedCityName,
          latitude: latVal,
          longitude: lngVal,
          radius_meters: radVal,
          is_active: isActive
        })
      });

      if (response.ok) {
        toast.success(`Successfully added delivery zone: ${cityName}`);
        setCityName('');
        setLatitude('');
        setLongitude('');
        setRadiusMeters('12000');
        setIsActive(true);
        fetchZones();
      } else {
        const errJson = await response.json().catch(() => ({ message: 'Server returned error status ' + response.status }));
        toast.error(errJson.message || 'Server rejected request');
      }
    } catch (err) {
      toast.error('Network failure adding service zone');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle dynamic active status for zone
  const handleToggleActive = async (zone: ServerServiceZone) => {
    const updatedStatus = !zone.is_active;
    const type = 'Zone';

    logToggleLifecycle('START', {
      type,
      id: zone.id,
      label: zone.city_name,
      initialState: zone.is_active,
      targetState: updatedStatus
    });

    const payload = { is_active: updatedStatus };
    logToggleLifecycle('PAYLOAD', {
      type,
      id: zone.id,
      initialState: zone.is_active,
      targetState: updatedStatus,
      payload
    });

    try {
      const headers = await getAuthHeaders();

      // Optimistic update
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: updatedStatus } : z));

      const response = await fetch(`/api/service-zones/${zone.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (_) {}

      logToggleLifecycle('RESPONSE', {
        type,
        id: zone.id,
        initialState: zone.is_active,
        targetState: updatedStatus,
        httpStatus: response.status,
        responseBody
      });

      if (response.ok) {
        toast.success(`Zone "${zone.city_name}" set to ${updatedStatus ? 'Active' : 'Inactive'}`);
        logToggleLifecycle('REFRESH', {
          type,
          id: zone.id,
          initialState: zone.is_active,
          targetState: updatedStatus
        });
        fetchZones();
      } else {
        logToggleLifecycle('REVERT', {
          type,
          id: zone.id,
          initialState: zone.is_active,
          targetState: updatedStatus,
          error: responseBody
        });
        // Revert optimistic update
        setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: !updatedStatus } : z));
        handleToggleFailureToast(type, zone.city_name, responseBody, response.status, false);
      }
    } catch (err) {
      logToggleLifecycle('REVERT', {
        type,
        id: zone.id,
        initialState: zone.is_active,
        targetState: updatedStatus,
        error: err
      });
      // Revert optimistic update
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: !updatedStatus } : z));
      handleToggleFailureToast(type, zone.city_name, null, null, true, err);
    }
  };

  // Delete service zone
  const handleDeleteZone = async (zone: ServerServiceZone) => {
    if (!window.confirm(`Are you absolutely sure you want to remove the delivery zone for "${zone.city_name}"?`)) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      console.log('REQUEST URL:', `/api/service-zones/${zone.id}`);
      console.log('REQUEST METHOD: DELETE');
      const response = await fetch(`/api/service-zones/${zone.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        toast.success(`Deleted service zone for ${zone.city_name}`);
        fetchZones();
      } else {
        toast.error('Could not delete service zone');
      }
    } catch (err) {
      toast.error('Network failure deleting service zone');
    }
  };

  // Submit new pincode
  const handleAddPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = safeTrim(newPincode);
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error('Pincode must be exactly a 6-digit number!');
      return;
    }

    setIsSubmittingPincode(true);
    try {
      const headers = await getAuthHeaders();
      console.log('REQUEST URL:', '/api/service-pincodes');
      console.log('REQUEST BODY:', {
        pincode: trimmed,
        active: newPincodeActive
      });
      const response = await fetch('/api/service-pincodes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pincode: trimmed,
          active: newPincodeActive
        })
      });

      if (response.ok) {
        toast.success(`Successfully added deliverable pincode: ${trimmed}!`, { icon: '📮' });
        setNewPincode('');
        setNewPincodeActive(true);
        fetchPincodes();
      } else {
        const errJson = await response.json().catch(() => ({ message: 'Server returned error status ' + response.status }));
        toast.error(errJson.message || 'Server rejected request');
      }
    } catch (err) {
      toast.error('Network failure adding deliverable pincode');
    } finally {
      setIsSubmittingPincode(false);
    }
  };

  // Toggle pincode active state
  const handleTogglePincodeActive = async (pin: ServicePincode) => {
    if (updatingPincodeIds.includes(pin.id)) return;

    const type = 'Pincode';
    const updatedStatus = !pin.active;

    logToggleLifecycle('START', {
      type,
      id: pin.id,
      label: pin.pincode,
      initialState: pin.active,
      targetState: updatedStatus
    });

    const payload = { active: updatedStatus };
    logToggleLifecycle('PAYLOAD', {
      type,
      id: pin.id,
      initialState: pin.active,
      targetState: updatedStatus,
      payload
    });

    // Put item in updating state to disable further clicks/visually spin
    setUpdatingPincodeIds(prev => [...prev, pin.id]);

    // Immediately update UI state optimistically
    setPincodes(prev => prev.map(p => p.id === pin.id ? { ...p, active: updatedStatus } : p));

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/service-pincodes/${pin.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (_) {}

      logToggleLifecycle('RESPONSE', {
        type,
        id: pin.id,
        initialState: pin.active,
        targetState: updatedStatus,
        httpStatus: response.status,
        responseBody
      });

      if (response.ok) {
        toast.success(`Pincode "${pin.pincode}" set to ${updatedStatus ? 'Active' : 'Inactive'}`, { icon: '📮' });
        logToggleLifecycle('REFRESH', {
          type,
          id: pin.id,
          initialState: pin.active,
          targetState: updatedStatus
        });
        fetchPincodes(); // Auto-refresh in background
      } else {
        logToggleLifecycle('REVERT', {
          type,
          id: pin.id,
          initialState: pin.active,
          targetState: updatedStatus,
          error: responseBody
        });
        // Revert UI if database update fails
        setPincodes(prev => prev.map(p => p.id === pin.id ? { ...p, active: !updatedStatus } : p));
        handleToggleFailureToast(type, pin.pincode, responseBody, response.status, false);
      }
    } catch (err) {
      logToggleLifecycle('REVERT', {
        type,
        id: pin.id,
        initialState: pin.active,
        targetState: updatedStatus,
        error: err
      });
      // Revert UI if database update fails
      setPincodes(prev => prev.map(p => p.id === pin.id ? { ...p, active: !updatedStatus } : p));
      handleToggleFailureToast(type, pin.pincode, null, null, true, err);
    } finally {
      setUpdatingPincodeIds(prev => prev.filter(id => id !== pin.id));
    }
  };

  // Delete deliverable pincode (triggers custom beautiful modal instead of window.confirm)
  const handleDeletePincode = (pin: ServicePincode) => {
    setPincodeToDelete(pin);
  };

  // Performs actual delete operation on Supabase and Firestore
  const performDeletePincode = async () => {
    if (!pincodeToDelete) return;
    const pin = pincodeToDelete;
    setIsDeletingPincode(true);

    // Optimistically update UI state by removing the record instantly
    setPincodes(prev => prev.filter(p => p.id !== pin.id));

    try {
      const headers = await getAuthHeaders();
      console.log('[Dashboard] Deleting pincode:', pin.pincode);

      const response = await fetch(`/api/service-pincodes/${pin.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        toast.success(`Deleted deliverable pincode ${pin.pincode}`, { icon: '🗑️' });
        setPincodeToDelete(null); // Close modal
        fetchPincodes(); // Hot sync
      } else {
        // Restore UI state if database update fails
        setPincodes(prev => [...prev, pin]);
        toast.error('Failed to delete pincode from database');
      }
    } catch (err) {
      console.error('[Dashboard] Delete error:', err);
      // Restore UI state if database update fails
      setPincodes(prev => [...prev, pin]);
      toast.error('Network failure deleting pincode');
    } finally {
      setIsDeletingPincode(false);
    }
  };

  // Autofill presets
  const autofillPreset = (city: string) => {
    if (city === 'cuttack') {
      setCityName('Cuttack');
      setLatitude('20.4625');
      setLongitude('85.8828');
      setRadiusMeters('12000');
    } else if (city === 'bhubaneswar') {
      setCityName('Bhubaneswar');
      setLatitude('20.2961');
      setLongitude('85.8245');
      setRadiusMeters('15000');
    } else if (city === 'puri') {
      setCityName('Puri');
      setLatitude('19.8134');
      setLongitude('85.8312');
      setRadiusMeters('10000');
    }
    toast.success(`Autofilled coordinates for ${city.toUpperCase()}`);
  };

  const activeZonesCount = zones.filter(z => z.is_active).length;
  const activePincodesCount = pincodes.filter(p => p.active).length;
  const activeAreasCount = deliveryAreas.filter(a => a.is_deliverable).length;

  return (
    <div className="space-y-8 pb-12 fn-[admin-service-zones]">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-primary/30 to-purple-600/30 rounded-2xl border border-white/10 text-primary">
              <Globe size={28} className="animate-spin" style={{ animationDuration: '10s' }} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                Service <span className="text-primary italic">Boundaries</span>
              </h1>
              <p className="text-gray-500 font-medium">Configure delivery zones, checkout boundaries, and active pincodes dynamically.</p>
            </div>
          </div>
        </div>

        {/* Tab switchers switcher */}
        <div className="flex flex-wrap border border-white/5 p-1 bg-[#0a0a0c] rounded-2xl gap-1 w-fit">
          <button
            onClick={() => setActiveTab('v2')}
            className={`px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 ${
              activeTab === 'v2'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={12} className="text-orange-400" />
            Geofencing V2 Manager
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 ${
              activeTab === 'diagnostics'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                : 'text-[#e11d48]/70 hover:text-red-400'
            }`}
          >
            <ShieldCheck size={12} />
            DB & RLS Diagnostics
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      {activeTab !== 'v2' && activeTab !== 'diagnostics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0c0c10] border border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block text-left">
                {activeTab === 'zones' ? 'Total Zones' : activeTab === 'pincodes' ? 'Total Pincodes' : 'Total Localities'}
              </span>
              <span className="text-3xl font-black text-white mt-1 block text-left">
                {activeTab === 'zones' ? (isLoading ? '...' : zones.length) : activeTab === 'pincodes' ? (isPincodesLoading ? '...' : pincodes.length) : (isAreasLoading ? '...' : deliveryAreas.length)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-primary font-bold">
              {activeTab === 'zones' ? <Map size={22} /> : activeTab === 'pincodes' ? <MapPin size={22} /> : <Sparkles size={22} />}
            </div>
          </div>

          <div className="bg-[#0c0c10] border border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest block text-left">
                Operational Active
              </span>
              <span className="text-3xl font-black text-white mt-1 block text-left">
                {activeTab === 'zones' ? (isLoading ? '...' : activeZonesCount) : activeTab === 'pincodes' ? (isPincodesLoading ? '...' : activePincodesCount) : (isAreasLoading ? '...' : activeAreasCount)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Activity size={22} className="animate-pulse" />
            </div>
          </div>

          <div className="bg-[#0c0c10] border border-white/5 p-6 rounded-3xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block text-left">
                Inactive / Excluded
              </span>
              <span className="text-3xl font-black text-white mt-1 block text-left">
                {activeTab === 'zones' 
                  ? (isLoading ? '...' : (zones.length - activeZonesCount)) 
                  : activeTab === 'pincodes'
                    ? (isPincodesLoading ? '...' : (pincodes.length - activePincodesCount))
                    : (isAreasLoading ? '...' : (deliveryAreas.length - activeAreasCount))}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Settings size={22} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column depending on active tab */}
        <div className="lg:col-span-8 bg-[#0a0a0c] border border-white/5 rounded-[32px] p-6 sm:p-8 space-y-6">
          {activeTab === 'v2' ? (
            <GeofencingV2Manager />
          ) : activeTab === 'zones' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-left">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <CheckCircle size={18} className="text-primary" />
                    Operational Delivery Coverage
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium font-sans">Zones are loaded dynamically by client apps on launch.</p>
                </div>
                <button 
                  onClick={fetchZones}
                  className="text-xs font-bold text-primary hover:underline hover:text-primary-hover transition-all"
                >
                  Force Refresh
                </button>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-500 text-xs">Accessing cloud firestore backend...</p>
                </div>
              ) : zones.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <MapPin size={48} className="text-zinc-700 mx-auto animate-bounce" />
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto">
                    No custom delivery zones created. Client apps are currently using default fallback parameters.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {zones.map((zone) => (
                    <div 
                      key={zone.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all gap-4"
                    >
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${zone.is_active ? 'bg-primary animate-pulse' : 'bg-[#27272a]'}`} />
                          <h4 className="text-md font-bold text-white uppercase tracking-wide">{zone.city_name}</h4>
                          <span className="text-[9px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">{zone.id}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 font-medium font-mono">
                          <span className="flex items-center gap-1"><Navigation size={12} className="text-zinc-650" /> Lat: {zone.latitude.toFixed(4)}°</span>
                          <span className="flex items-center gap-1"><Navigation size={12} className="text-zinc-650" /> Lng: {zone.longitude.toFixed(4)}°</span>
                          <span className="flex items-center gap-1 text-primary"><Sparkles size={12} /> Limit: {(zone.radius_meters / 1000).toFixed(1)} km</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 self-end sm:self-center">
                        {/* Active Toggle Switch */}
                        <button
                          onClick={() => handleToggleActive(zone)}
                          title={zone.is_active ? "Set Inactive" : "Set Active"}
                          className="text-zinc-400 hover:text-white transition-all flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5"
                        >
                          {zone.is_active ? (
                            <div className="flex items-center gap-1 text-primary">
                              <span className="text-[10px] font-black tracking-widest uppercase">Active</span>
                              <ToggleRight size={28} className="text-primary" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-zinc-500">
                              <span className="text-[10px] font-bold tracking-widest uppercase">Disabled</span>
                              <ToggleLeft size={28} className="text-zinc-500" />
                            </div>
                          )}
                        </button>

                        <div className="w-[1px] h-6 bg-white/10" />

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteZone(zone)}
                          className="p-2 text-zinc-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-all"
                          title="Remove Zone"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'pincodes' ? (
            <>
              {/* Pincodes Tab List */}
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-left">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <MapPin size={18} className="text-primary" />
                    Operational Checkout Pincodes
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium font-sans">These active 6-digit postal codes are matched during checkout to verify delivery availability.</p>
                </div>
                <button 
                  onClick={fetchPincodes}
                  className="text-xs font-bold text-primary hover:underline hover:text-primary-hover transition-all font-sans"
                >
                  Force Refresh
                </button>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {isPincodesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-500 text-xs text-sans">Accessing cloud firestore backend...</p>
                </div>
              ) : pincodes.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <MapPin size={48} className="text-zinc-700 mx-auto animate-pulse" />
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto font-sans">
                    No custom checkout pincodes found. System is currently running on original default presets.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pincodes.map((pin) => (
                      <div 
                        key={pin.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all gap-4 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${pin.active ? 'bg-primary animate-pulse' : 'bg-zinc-700'}`} />
                            <span className="text-lg font-black text-white font-mono tracking-widest">{pin.pincode}</span>
                          </div>
                          <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-wider">Cuttack Area ({pin.id})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePincodeActive(pin)}
                            disabled={updatingPincodeIds.includes(pin.id)}
                            title={pin.active ? "Toggle Inactive" : "Toggle Active"}
                            className="text-zinc-400 hover:text-white transition-all flex items-center p-1 rounded-lg hover:bg-white/5 disabled:opacity-75 disabled:pointer-events-none"
                          >
                            {updatingPincodeIds.includes(pin.id) ? (
                              <div className="flex items-center gap-1.5 text-primary">
                                <span className="text-[8px] font-black tracking-widest uppercase animate-pulse">Updating</span>
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                              </div>
                            ) : pin.active ? (
                              <div className="flex items-center gap-1 text-primary">
                                <span className="text-[8px] font-black tracking-widest uppercase">Active</span>
                                <ToggleRight size={26} className="text-primary" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-zinc-500">
                                <span className="text-[8px] font-bold tracking-widest uppercase font-sans">Disabled</span>
                                <ToggleLeft size={26} className="text-zinc-500" />
                              </div>
                            )}
                          </button>
                          <div className="w-[1px] h-5 bg-white/10" />
                          <button
                            onClick={() => handleDeletePincode(pin)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                            title="Remove Pincode"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'areas' ? (
            <>
              {/* Served Localities Areas Tab List */}
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-left">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-primary" />
                    Operational Served Localities (Cuttack)
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium font-sans">These localized areas are suggested as users type their delivery address.</p>
                </div>
                <button 
                  onClick={fetchDeliveryAreas}
                  className="text-xs font-bold text-primary hover:underline hover:text-primary-hover transition-all font-sans"
                >
                  Force Refresh
                </button>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {isAreasLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-500 text-xs text-sans">Accessing cloud firestore backend...</p>
                </div>
              ) : deliveryAreas.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <Sparkles size={48} className="text-zinc-700 mx-auto animate-pulse" />
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto font-sans">
                    No custom delivery areas found. System is currently running on original default presets.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {deliveryAreas.map((area) => (
                      <div 
                        key={area.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all gap-4 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${area.is_deliverable ? 'bg-[#ff6b00]' : 'bg-[#e11d48]'}`} />
                            <span className="text-md font-bold text-white tracking-tight">{area.area_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-wider">Cuttack Area, PIN: {area.pincode} ({area.id})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAreaDeliverable(area)}
                            title={area.is_deliverable ? "Mark Undeliverable" : "Mark Deliverable"}
                            className="text-zinc-400 hover:text-white transition-all flex items-center p-1 rounded-lg hover:bg-white/5"
                          >
                            {area.is_deliverable ? (
                              <div className="flex items-center gap-1 text-primary">
                                <span className="text-[8px] font-black tracking-widest uppercase">Served</span>
                                <ToggleRight size={26} className="text-primary" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-red-500">
                                <span className="text-[8px] font-bold tracking-widest uppercase font-sans">No Service</span>
                                <ToggleLeft size={26} className="text-red-500" />
                              </div>
                            )}
                          </button>
                          <div className="w-[1px] h-5 bg-white/10" />
                          <button
                            onClick={() => handleDeleteArea(area)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
                            title="Remove Locality"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <RlsDiagnosticsPanel />
          )}
        </div>

        {/* Right column: Create / Edit Form (4 spans) */}
        <div className="lg:col-span-4 bg-[#0a0a0c] border border-white/5 rounded-[32px] p-6 sm:p-8 space-y-6">
          {activeTab === 'zones' ? (
            <>
              <div className="space-y-1 text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  Add Delivery Zone
                </h2>
                <p className="text-xs text-zinc-500 font-medium">Establish a brand new coordinates central geofence.</p>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {/* Quick presets helper */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">🗺️ Autofill Odisha Presets</span>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => autofillPreset('cuttack')}
                    className="px-2.5 py-1.5 text-[10px] font-bold bg-[#0d0d12]/80 hover:bg-primary hover:text-white text-zinc-300 rounded-xl border border-white/5 transition-all uppercase tracking-wider"
                  >
                    Cuttack
                  </button>
                  <button 
                    onClick={() => autofillPreset('bhubaneswar')}
                    className="px-2.5 py-1.5 text-[10px] font-bold bg-[#0d0d12]/80 hover:bg-primary hover:text-white text-zinc-300 rounded-xl border border-white/5 transition-all uppercase tracking-wider"
                  >
                    Bhubaneswar
                  </button>
                  <button 
                    onClick={() => autofillPreset('puri')}
                    className="px-2.5 py-1.5 text-[10px] font-bold bg-[#0d0d12]/80 hover:bg-primary hover:text-white text-zinc-300 rounded-xl border border-white/5 transition-all uppercase tracking-wider"
                  >
                    Puri
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddZone} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono">City Name</label>
                  <input
                    type="text"
                    required
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    placeholder="e.g. Cuttack Central"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono">Center Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 20.4624"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono">Center Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 85.8828"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono">Radius (Meters)</label>
                  <input
                    type="number"
                    required
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    placeholder="e.g. 12000 (12 km)"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 font-bold tracking-wide italic block font-sans">
                    {(parseInt(radiusMeters, 10) || 0) / 1000} km of operational delivery boundary cover
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-black uppercase text-zinc-300 tracking-widest font-mono">Active Status</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className="text-primary hover:scale-105 transition-transform"
                  >
                    {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-zinc-500" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      Add Service Zone
                    </>
                  )}
                </button>
              </form>

              {/* Quick Info Box */}
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-start gap-3 text-left">
                <Info size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
                  Clients periodically refresh geographic locations. When a service zone is Disabled (Inactive), it behaves as a fallback that is barred from active delivery matches. Ensure accurate central lat/lng markers.
                </p>
              </div>
            </>
          ) : activeTab === 'pincodes' ? (
            <>
              {/* Dynamic Pincode Add Form */}
              <div className="space-y-1 text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  Add Service Pincode
                </h2>
                <p className="text-xs text-zinc-500 font-medium">Register a valid 6-digit local postal dispatch area code.</p>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              <form onSubmit={handleAddPincode} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono">Postal Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 753001"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono tracking-widest text-sm font-bold"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-black uppercase text-zinc-300 tracking-widest font-mono font-sans">Active Status</span>
                  <button
                    type="button"
                    onClick={() => setNewPincodeActive(!newPincodeActive)}
                    className="text-primary hover:scale-105 transition-transform"
                  >
                    {newPincodeActive ? <ToggleRight size={32} className="text-primary" /> : <ToggleLeft size={32} className="text-zinc-500" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPincode}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmittingPincode ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      CREATE PINCODE BOUND
                    </>
                  )}
                </button>
              </form>

              {/* Quick Info Box */}
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-start gap-3 text-left">
                <Info size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
                  This pincode list serves as a reliable checkout gate. When customers fill out their address during billing, the system verifies Cuttack as the city and parses this exact register. Feel free to toggle or add anytime.
                </p>
              </div>
            </>
          ) : activeTab === 'areas' ? (
            <>
              {/* Served Locality Add Form */}
              <div className="space-y-1 text-left">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  Add Served Locality
                </h2>
                <p className="text-xs text-zinc-500 font-medium">Add served area names for checkout autocomplete suggestions.</p>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              <form onSubmit={handleAddArea} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono font-sans font-black">Area / Locality Name</label>
                  <input
                    type="text"
                    required
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="e.g. CDA Sector 9"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-bold tracking-wide"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block font-mono font-sans font-black">Matching Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newAreaPincode}
                    onChange={(e) => setNewAreaPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 753014"
                    className="w-full h-12 px-4 rounded-xl bg-[#0d0d12] border border-white/5 text-white placeholder-zinc-700 text-xs focus:outline-none focus:border-primary/50 transition-all font-mono tracking-widest text-sm font-bold"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-black uppercase text-zinc-300 tracking-widest font-mono font-sans font-bold font-black">Served Status</span>
                  <button
                    type="button"
                    onClick={() => setNewAreaDeliverable(!newAreaDeliverable)}
                    className="text-primary hover:scale-105 transition-transform"
                  >
                    {newAreaDeliverable ? <ToggleRight size={32} className="text-primary" /> : <ToggleLeft size={32} className="text-zinc-500" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingArea}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmittingArea ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      SAVE SERVED LOCALITY
                    </>
                  )}
                </button>
              </form>

              {/* Quick Info Box */}
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-start gap-3 text-left">
                <Info size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
                  This collection feeds the high-velocity address autocomplete on checkout. When users search for deliveries, they are immediately shown if Frosty Bite serves their neighborhood. Ensure matching pincodes are activated in the Active Pincodes tab for smooth processing.
                </p>
              </div>
            </>
          ) : (
            <RlsRightDiagnosticsPanel />
          )}
        </div>
      </div>

      {/* Dynamic Pincode Deletion Confirmation Modal */}
      <AnimatePresence>
        {pincodeToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isDeletingPincode) setPincodeToDelete(null); }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d12]/95 p-6 shadow-2xl text-left z-10"
            >
              <div className="flex items-center gap-3 text-red-400 mb-3">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <ShieldAlert size={20} className="stroke-2 text-[#FF4D6D]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Remove Pincode?</h3>
                  <p className="text-[9px] text-[#FF4D6D] font-black uppercase tracking-wider">Destructive Operation</p>
                </div>
              </div>
              
              <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                Are you sure you want to delete the operational pincode <span className="text-white font-mono font-black text-sm tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/10">{pincodeToDelete.pincode}</span>? Users in this area will immediately lose geofenced access. This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingPincode}
                  onClick={() => setPincodeToDelete(null)}
                  className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingPincode}
                  onClick={performDeletePincode}
                  className="flex-1 h-10 rounded-xl bg-[#FF4D6D] hover:bg-[#FF4D6D]/95 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDeletingPincode ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// 🛡️ SUBCOMPONENT: DB & RLS DIAGNOSTICS MAIN PANEL
// ============================================================================
const RlsDiagnosticsPanel: React.FC = () => {
  interface TestResult {
    table: string;
    select: string;
    insert: string;
    status: 'ok' | 'blocked' | 'error' | 'missing';
  }

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'bypass' | 'rules' | 'rpc'>('rules');
  const [copiedText, setCopiedText] = useState(false);

  const runDbScan = async () => {
    setIsTesting(true);
    const tables = [
      'users',
      'products',
      'orders',
      'riders',
      'wishlist',
      'coupons',
      'banners',
      'banner_clicks',
      'admins',
      'reviews',
      'otps',
      'cancellation_logs',
      'cities',
      'pincodes',
      'localities'
    ];

    const results: TestResult[] = [];

    for (const table of tables) {
      let selectType: any = 'ok';
      let insertType: any = 'ok';
      let selectStr = '✅ Allowed';
      let insertStr = '✅ Allowed';

      // 1. SELECT test
      const selectRes = await DiagnosticsRepository.testTableSelect(table);
      selectStr = selectRes.selectStr;
      selectType = selectRes.selectType;

      // 2. INSERT test
      const insertRes = await DiagnosticsRepository.testTableInsert(table);
      insertStr = insertRes.insertStr;
      insertType = insertRes.insertType;

      const overallStatus = 
        selectType === 'missing' || insertType === 'missing' ? 'missing' :
        selectType === 'blocked' || insertType === 'blocked' ? 'blocked' :
        selectType === 'error' || insertType === 'error' ? 'error' : 'ok';

      results.push({
        table,
        select: selectStr,
        insert: insertStr,
        status: overallStatus
      });
    }

    setTestResults(results);
    setIsTesting(false);
  };

  useEffect(() => {
    runDbScan();
  }, []);

  const copySqlToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    toast.success('SQL Command copied successfully!');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const sqlSnippets = {
    bypass: `-- FIX: Toggle Row Level Security off for active tables to permit rapid front-end tests
ALTER TABLE public.cities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities DISABLE ROW LEVEL SECURITY;`,
    rules: `-- FIX: Create fully permissive Row Level Security policies for Dev/Preview testing
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissive_all_cities" ON public.cities;
CREATE POLICY "permissive_all_cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_pincodes" ON public.pincodes;
CREATE POLICY "permissive_all_pincodes" ON public.pincodes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_localities" ON public.localities;
CREATE POLICY "permissive_all_localities" ON public.localities FOR ALL USING (true) WITH CHECK (true);`,
    rpc: `-- SQL views & RPC helpers to dynamically inspect PostgreSQL system policies
CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
    schemaname text,
    tablename text,
    rls_enabled boolean,
    policyname text,
    permissive text,
    roles text[],
    cmd text,
    qual text,
    with_check text
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.schemaname::text,
        c.tablename::text,
        COALESCE(cls.relrowsecurity, false) AS rls_enabled,
        p.policyname::text,
        p.permissive::text,
        p.roles::text[],
        p.cmd::text,
        p.qual::text,
        p.with_check::text
    FROM pg_catalog.pg_tables c
    JOIN pg_catalog.pg_class cls ON cls.relname = c.tablename AND cls.relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = c.schemaname)
    LEFT JOIN pg_catalog.pg_policies p ON p.tablename = c.tablename AND p.schemaname = c.schemaname
    WHERE c.schemaname = 'public';
END;
$$ LANGUAGE plpgsql;`
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-red-500" />
            Security & Row Level Security (RLS) Diagnostics
          </h2>
          <p className="text-xs text-zinc-500 font-medium font-sans">
            Instantly trace permission levels and execution limits directly from active user connections.
          </p>
        </div>
        <button
          onClick={runDbScan}
          disabled={isTesting}
          className="px-4 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider border border-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isTesting ? (
            <>
              <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              <span>Scanning Permissions...</span>
            </>
          ) : (
            <span>Run Permission Scan</span>
          )}
        </button>
      </div>

      <div className="w-full h-[1px] bg-white/5" />

      {/* Grid status matrix */}
      <div className="bg-[#0e0e12] border border-white/5 rounded-2xl overflow-hidden">
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">Database Table Name</th>
                <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">SELECT (Read Access)</th>
                <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">INSERT (Write Access)</th>
                <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">Security State</th>
              </tr>
            </thead>
            <tbody>
              {testResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-500 text-xs">
                    Initializing assessment scan...
                  </td>
                </tr>
              ) : (
                testResults.map((res) => (
                  <tr key={res.table} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 font-mono text-xs font-bold text-white">{res.table}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        res.select.includes('✅') 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                          : res.select.includes('❓')
                            ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/10'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {res.select}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        res.insert.includes('✅') 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                          : res.insert.includes('❓')
                            ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/10'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {res.insert}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        res.status === 'ok' 
                          ? 'text-emerald-400' 
                          : res.status === 'missing'
                            ? 'text-zinc-500'
                            : 'text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          res.status === 'ok' 
                            ? 'bg-emerald-400' 
                            : res.status === 'missing'
                              ? 'bg-zinc-500'
                              : 'bg-red-500'
                        }`} />
                        {res.status === 'ok' 
                          ? 'Access Permissive' 
                          : res.status === 'missing'
                            ? 'Missing in DB'
                            : 'RLS Constrained'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Remedy Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">🛠️ SQL Recovery Terminal Remedies</h3>
          <p className="text-[11px] text-zinc-500">
            If any table fails testing, toggle its security options or deploy active permissive policies using your Supabase SQL Editor.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border border-white/5 space-x-1 p-1 bg-[#121218] rounded-xl w-fit">
          <button
            onClick={() => setActiveSqlTab('rules')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all ${
              activeSqlTab === 'rules' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
            }`}
          >
            Deploy RLS Rules
          </button>
          <button
            onClick={() => setActiveSqlTab('bypass')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all ${
              activeSqlTab === 'bypass' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
            }`}
          >
            Bypass / Disable RLS
          </button>
          <button
            onClick={() => setActiveSqlTab('rpc')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all ${
              activeSqlTab === 'rpc' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
            }`}
          >
            Policy Checker SQL View
          </button>
        </div>

        <div className="relative bg-[#07070a] border border-white/5 rounded-2xl p-4 font-mono text-[10px] leading-relaxed text-zinc-400 overflow-x-auto text-left">
          <pre className="whitespace-pre overflow-x-auto max-h-[160px] custom-scrollbar selection:bg-primary/30">
            <code>{sqlSnippets[activeSqlTab]}</code>
          </pre>
          <button
            onClick={() => copySqlToClipboard(sqlSnippets[activeSqlTab])}
            className="absolute top-3 right-3 px-2.5 py-1.5 h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-xs text-white border border-white/10 font-sans font-bold flex items-center justify-center gap-1 cursor-pointer transition-all uppercase tracking-widest text-[9px]"
          >
            {copiedText ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 🛡️ SUBCOMPONENT: DB & RLS RIGHT PANEL
// ============================================================================
const RlsRightDiagnosticsPanel: React.FC = () => {
  return (
    <div className="space-y-6 text-left">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Info size={18} className="text-red-500" />
          Insight Overview
        </h2>
        <p className="text-xs text-zinc-500 font-medium">Why do DB toggle updates fail?</p>
      </div>

      <div className="w-full h-[1px] bg-white/5" />

      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
          <span className="text-[9px] font-black uppercase text-rose-400 tracking-wider block font-mono">1. Client-Side Operations (Direct)</span>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">
            By default, when you use the Supabase JS Library from the frontend, requests carry your <span className="text-white font-mono font-bold bg-white/10 px-1 rounded">Anon Key</span>. Operations must be explicitly permitted by your Row Level Security (RLS) rules, otherwise Postgres throws a <span className="text-red-400 font-mono">42501 Permission Error</span>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider block font-mono">2. Server Proxy Operations (REST APIs)</span>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">
            When you invoke endpoints like <span className="text-zinc-300 font-mono">PATCH /api/service-pincodes/*</span>, the request is processed in the secure Node.js backend. The server accesses Supabase using its <span className="text-white font-mono font-bold bg-white/10 px-1 rounded">Service Role Key</span>, completely bypassing RLS checks to ensure robust transactions!
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider block font-mono">3. Firebase Dual Persistence</span>
          <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">
            The system synchronizes all boundaries with Google Firestore alongside Supabase. If you encounter GCP or Firebase permission errors, ensure that database service credentials or firestore rules allow access.
          </p>
        </div>
      </div>
    </div>
  );
};

