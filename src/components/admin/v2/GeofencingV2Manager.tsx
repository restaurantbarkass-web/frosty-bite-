import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Building2,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  IndianRupee,
  Clock,
  ChevronDown,
  ChevronUp,
  Map,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { MapLibreBoundaryEditor } from './MapLibreBoundaryEditor';
import toast from 'react-hot-toast';
import { UnifiedCityModal } from './UnifiedCityModal';
import { UnifiedPincodeModal } from './UnifiedPincodeModal';
import { UnifiedLocalityModal } from './UnifiedLocalityModal';
import { safeTrim, safeTrimLowerCase } from '../../../utils/string';

export interface V2ServiceArea {
  id: string;
  name: string;
  is_active: boolean;
  boundary?: any;
  created_at?: string;
  updated_at?: string;
}

export interface V2City {
  id: string;
  name: string;
  slug: string;
  state?: string;
  country: string;
  is_active: boolean;
  boundary?: any;
  created_at?: string;
  updated_at?: string;
}

export interface V2Pincode {
  id: string;
  city_id: string;
  pincode: string;
  is_active: boolean;
  boundary?: any;
  created_at?: string;
  updated_at?: string;
}

export interface V2Locality {
  id: string;
  city_id: string;
  pincode_id?: string | null;
  name: string;
  slug: string;
  is_active: boolean;
  delivery_fee: number;
  minimum_order: number;
  estimated_delivery_minutes?: number | null;
  boundary?: any;
  created_at?: string;
  updated_at?: string;
}

export const GeofencingV2Manager: React.FC = () => {
  // Data States
  const [serviceArea, setServiceArea] = useState<V2ServiceArea | null>(null);
  const [cities, setCities] = useState<V2City[]>([]);
  const [pincodes, setPincodes] = useState<V2Pincode[]>([]);
  const [localities, setLocalities] = useState<V2Locality[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter Search
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCityIds, setExpandedCityIds] = useState<string[]>([]);

  // Modals & Active Editors
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<V2City | null>(null);
  const [cityForm, setCityForm] = useState({ name: '', state: 'Odisha', country: 'India', is_active: true });

  const [isPincodeModalOpen, setIsPincodeModalOpen] = useState(false);
  const [editingPincode, setEditingPincode] = useState<V2Pincode | null>(null);
  const [pincodeForm, setPincodeForm] = useState({ city_id: '', pincode: '', is_active: true });

  const [isLocalityModalOpen, setIsLocalityModalOpen] = useState(false);
  const [editingLocality, setEditingLocality] = useState<V2Locality | null>(null);
  const [localityForm, setLocalityForm] = useState({
    city_id: '',
    pincode_id: '',
    name: '',
    is_active: true,
    delivery_fee: 40,
    minimum_order: 149,
    estimated_delivery_minutes: 30
  });

  // Map Boundary Drawer Modal
  const [boundaryEditorTarget, setBoundaryEditorTarget] = useState<{
    type: 'city' | 'pincode' | 'locality';
    item: V2City | V2Pincode | V2Locality;
  } | null>(null);

  // Delete Confirmations
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'city' | 'pincode' | 'locality';
    id: string;
    title: string;
  } | null>(null);

  // --------------------------------------------------------------------------
  // FETCH ALL DATA
  // --------------------------------------------------------------------------
  const loadV2Data = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const [saRes, cRes, pRes, lRes] = await Promise.all([
        fetch('/api/v2/service-area'),
        fetch('/api/v2/cities'),
        fetch('/api/v2/pincodes'),
        fetch('/api/v2/localities')
      ]);

      if (saRes.ok) {
        const saData = await saRes.json();
        if (saData && typeof saData.is_active === 'boolean') {
          setServiceArea(saData);
        } else {
          setServiceArea({
            id: 'sa-00000000-0000-0000-0000-000000000001',
            name: 'Frosty Bite Odisha Service Region',
            is_active: true
          });
        }
      } else {
        setServiceArea({
          id: 'sa-00000000-0000-0000-0000-000000000001',
          name: 'Frosty Bite Odisha Service Region',
          is_active: true
        });
      }

      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) {
          setCities(cData);
          setExpandedCityIds((prev) => (prev.length === 0 ? [cData[0].id] : prev));
        }
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPincodes(pData);
      }
      if (lRes.ok) {
        const lData = await lRes.json();
        setLocalities(lData);
      }
    } catch (err: any) {
      console.error('[GeofencingV2Manager] Failed to load V2 data:', err);
      toast.error('Failed to load Geofencing V2 data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadV2Data();
  }, []);

  // --------------------------------------------------------------------------
  // SUPABASE REALTIME SUBSCRIPTIONS
  // --------------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('v2_geofencing_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, () => loadV2Data(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pincodes' }, () => loadV2Data(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localities' }, () => loadV2Data(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_areas' }, () => loadV2Data(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadV2Data]);

  // --------------------------------------------------------------------------
  // TOGGLE HANDLERS (OPTIMISTIC UI WITH ROLLBACK)
  // --------------------------------------------------------------------------
  const handleToggleGlobalServiceArea = async () => {
    if (!serviceArea) return;
    const oldState = serviceArea.is_active;
    const newState = !oldState;

    // Optimistic
    setServiceArea({ ...serviceArea, is_active: newState });

    try {
      const res = await fetch('/api/v2/service-area', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState })
      });
      if (!res.ok) throw new Error('Server returned error');
      toast.success(`Global Service Area ${newState ? 'ENABLED' : 'DISABLED'}`);
    } catch (err) {
      // Rollback
      setServiceArea({ ...serviceArea, is_active: oldState });
      toast.error('Failed to update Global Service Area status.');
    }
  };

  const handleToggleCity = async (city: V2City) => {
    const oldState = city.is_active;
    const newState = !oldState;

    setCities(prev => prev.map(c => c.id === city.id ? { ...c, is_active: newState } : c));

    try {
      const res = await fetch(`/api/v2/cities/${city.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState })
      });
      if (!res.ok) throw new Error('Server error');
      toast.success(`City ${city.name} ${newState ? 'ACTIVATED' : 'DEACTIVATED'}`);
    } catch (err) {
      setCities(prev => prev.map(c => c.id === city.id ? { ...c, is_active: oldState } : c));
      toast.error(`Failed to update ${city.name} status.`);
    }
  };

  const handleTogglePincode = async (pin: V2Pincode) => {
    const oldState = pin.is_active;
    const newState = !oldState;

    setPincodes(prev => prev.map(p => p.id === pin.id ? { ...p, is_active: newState } : p));

    try {
      const res = await fetch(`/api/v2/pincodes/${pin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState })
      });
      if (!res.ok) throw new Error('Server error');
      toast.success(`Pincode ${pin.pincode} ${newState ? 'ACTIVATED' : 'DEACTIVATED'}`);
    } catch (err) {
      setPincodes(prev => prev.map(p => p.id === pin.id ? { ...p, is_active: oldState } : p));
      toast.error(`Failed to update pincode ${pin.pincode}.`);
    }
  };

  const handleToggleLocality = async (loc: V2Locality) => {
    const oldState = loc.is_active;
    const newState = !oldState;

    setLocalities(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: newState } : l));

    try {
      const res = await fetch(`/api/v2/localities/${loc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState })
      });
      if (!res.ok) throw new Error('Server error');
      toast.success(`Locality ${loc.name} ${newState ? 'ACTIVATED' : 'DEACTIVATED'}`);
    } catch (err) {
      setLocalities(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: oldState } : l));
      toast.error(`Failed to update locality ${loc.name}.`);
    }
  };

  // --------------------------------------------------------------------------
  // CITY CRUD
  // --------------------------------------------------------------------------
  const openAddCity = () => {
    setEditingCity(null);
    setCityForm({ name: '', state: 'Odisha', country: 'India', is_active: true });
    setIsCityModalOpen(true);
  };

  const openEditCity = (city: V2City) => {
    setEditingCity(city);
    setCityForm({ name: city.name, state: city.state || 'Odisha', country: city.country || 'India', is_active: city.is_active });
    setIsCityModalOpen(true);
  };

  const handleSaveCity = async (formDataOrEvent: any) => {
    let formData = formDataOrEvent;
    if (formDataOrEvent && typeof formDataOrEvent.preventDefault === 'function') {
      formDataOrEvent.preventDefault();
      formData = cityForm;
    }
    const trimmedName = safeTrim(formData?.name);
    if (!trimmedName) {
      toast.error('City name is required');
      return;
    }

    if (!editingCity) {
      const exists = cities.some(c => safeTrimLowerCase(c.name) === trimmedName.toLowerCase());
      if (exists) {
        toast.error('This city already exists.');
        return;
      }
    }

    try {
      if (editingCity) {
        const res = await fetch(`/api/v2/cities/${editingCity.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to update city');
        toast.success(`City ${formData.name} updated successfully!`);
      } else {
        const res = await fetch('/api/v2/cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to create city');
        toast.success(`City ${formData.name} created successfully!`);
      }
      setIsCityModalOpen(false);
      loadV2Data(true);
    } catch (err: any) {
      toast.error(err.message || 'Error saving city');
    }
  };

  // --------------------------------------------------------------------------
  // PINCODE CRUD
  // --------------------------------------------------------------------------
  const openAddPincode = (cityId: string) => {
    setEditingPincode(null);
    setPincodeForm({ city_id: cityId, pincode: '', is_active: true });
    setIsPincodeModalOpen(true);
  };

  const openEditPincode = (pin: V2Pincode) => {
    setEditingPincode(pin);
    setPincodeForm({ city_id: pin.city_id, pincode: pin.pincode, is_active: pin.is_active });
    setIsPincodeModalOpen(true);
  };

  const handleSavePincode = async (formDataOrEvent: any) => {
    let formData = formDataOrEvent;
    if (formDataOrEvent && typeof formDataOrEvent.preventDefault === 'function') {
      formDataOrEvent.preventDefault();
      formData = pincodeForm;
    }
    const trimmedPincode = safeTrim(formData?.pincode);
    if (!/^[0-9]{6}$/.test(trimmedPincode)) {
      toast.error('Pincode must be strictly 6 numeric digits (e.g. 753001)');
      return;
    }

    if (!editingPincode) {
      const exists = pincodes.some(p => safeTrim(p.pincode) === trimmedPincode && p.city_id === formData.city_id);
      if (exists) {
        toast.error('This pincode already exists in this city.');
        return;
      }
    }

    try {
      if (editingPincode) {
        const res = await fetch(`/api/v2/pincodes/${editingPincode.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pincode: formData.pincode, is_active: formData.is_active, boundary: formData.boundary })
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Failed to update pincode');
        }
        toast.success(`Pincode ${formData.pincode} updated!`);
      } else {
        const res = await fetch('/api/v2/pincodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Failed to create pincode');
        }
        toast.success(`Pincode ${formData.pincode} added!`);
      }
      setIsPincodeModalOpen(false);
      loadV2Data(true);
    } catch (err: any) {
      toast.error(err.message || 'Error saving pincode');
    }
  };

  // --------------------------------------------------------------------------
  // LOCALITY CRUD
  // --------------------------------------------------------------------------
  const openAddLocality = (cityId: string, pincodeId?: string) => {
    setEditingLocality(null);
    setLocalityForm({
      city_id: cityId,
      pincode_id: pincodeId || '',
      name: '',
      is_active: true,
      delivery_fee: 40,
      minimum_order: 149,
      estimated_delivery_minutes: 30
    });
    setIsLocalityModalOpen(true);
  };

  const openEditLocality = (loc: V2Locality) => {
    setEditingLocality(loc);
    setLocalityForm({
      city_id: loc.city_id,
      pincode_id: loc.pincode_id || '',
      name: loc.name,
      is_active: loc.is_active,
      delivery_fee: loc.delivery_fee,
      minimum_order: loc.minimum_order,
      estimated_delivery_minutes: loc.estimated_delivery_minutes || 30
    });
    setIsLocalityModalOpen(true);
  };

  const handleSaveLocality = async (formDataOrEvent: any) => {
    let formData = formDataOrEvent;
    if (formDataOrEvent && typeof formDataOrEvent.preventDefault === 'function') {
      formDataOrEvent.preventDefault();
      formData = localityForm;
    }
    const trimmedName = safeTrim(formData?.name);
    if (!trimmedName) {
      toast.error('Locality name is required');
      return;
    }

    if (!editingLocality) {
      const exists = localities.some(l => safeTrimLowerCase(l.name) === trimmedName.toLowerCase() && l.city_id === formData.city_id);
      if (exists) {
        toast.error('This locality already exists in this city.');
        return;
      }
    }

    try {
      if (editingLocality) {
        const res = await fetch(`/api/v2/localities/${editingLocality.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to update locality');
        toast.success(`Locality ${formData.name} updated!`);
      } else {
        const res = await fetch('/api/v2/localities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Failed to create locality');
        toast.success(`Locality ${formData.name} created!`);
      }
      setIsLocalityModalOpen(false);
      loadV2Data(true);
    } catch (err: any) {
      toast.error(err.message || 'Error saving locality');
    }
  };

  // --------------------------------------------------------------------------
  // DELETE HANDLER
  // --------------------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, title } = deleteConfirm;

    try {
      let endpoint = '';
      if (type === 'city') endpoint = `/api/v2/cities/${id}`;
      else if (type === 'pincode') endpoint = `/api/v2/pincodes/${id}`;
      else if (type === 'locality') endpoint = `/api/v2/localities/${id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete operation failed');

      toast.success(`${title} deleted successfully.`);
      setDeleteConfirm(null);
      loadV2Data(true);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // SAVE BOUNDARY FROM MAPLIBRE EDITOR
  // --------------------------------------------------------------------------
  const handleSaveBoundaryFromMap = async (boundaryGeoJSON: any) => {
    if (!boundaryEditorTarget) return;
    const { type, item } = boundaryEditorTarget;

    try {
      let endpoint = '';
      if (type === 'city') endpoint = `/api/v2/cities/${item.id}`;
      else if (type === 'pincode') endpoint = `/api/v2/pincodes/${item.id}`;
      else if (type === 'locality') endpoint = `/api/v2/localities/${item.id}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boundary: boundaryGeoJSON })
      });

      if (!res.ok) throw new Error('Failed to update boundary geometry');

      toast.success(`Updated ${type} boundary geometry successfully!`);
      setBoundaryEditorTarget(null);
      loadV2Data(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save polygon boundary');
    }
  };

  const toggleExpandCity = (cityId: string) => {
    setExpandedCityIds(prev =>
      prev.includes(cityId) ? prev.filter(id => id !== cityId) : [...prev, cityId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400 space-y-3">
        <RefreshCw size={28} className="animate-spin text-orange-500" />
        <p className="text-xs font-semibold uppercase tracking-wider">Loading Geofencing V2 Manager...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* MAP BOUNDARY MODAL */}
      {boundaryEditorTarget && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          <div className="w-full sm:max-w-5xl bg-zinc-900 sm:rounded-2xl h-[90vh] sm:h-auto max-h-screen flex flex-col shadow-2xl overflow-hidden">
            <MapLibreBoundaryEditor
              title={`Edit ${boundaryEditorTarget.type.toUpperCase()} Boundary: ${
                (boundaryEditorTarget.item as any).name || (boundaryEditorTarget.item as any).pincode
              }`}
              initialBoundary={boundaryEditorTarget.item.boundary}
              onSaveBoundary={handleSaveBoundaryFromMap}
              onCancel={() => setBoundaryEditorTarget(null)}
            />
          </div>
        </div>
      )}

      {/* HEADER & GLOBAL STATUS BAR */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-black rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-orange-500" size={24} />
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Geofencing V2 Admin</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-widest">
                PostGIS & MapLibre GL
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Manage global service boundaries, cities, pincodes, and locality-specific delivery fees & ETAs.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => loadV2Data()}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-orange-500' : ''} />
              Refresh
            </button>

            {/* GLOBAL SERVICE AREA TOGGLE */}
            <div className="bg-zinc-950 p-3 rounded-2xl border border-white/10 flex items-center gap-4 shadow-inner">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Global Service Status</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      serviceArea?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <p className="text-xs font-black text-white uppercase">
                    {serviceArea?.is_active ? 'ONLINE (ACTIVE)' : 'OFFLINE (DISABLED)'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleGlobalServiceArea}
                className="text-zinc-300 hover:text-white transition-transform active:scale-95"
              >
                {serviceArea?.is_active ? (
                  <ToggleRight size={36} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={36} className="text-zinc-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search city, pincode, locality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 text-white placeholder-zinc-500 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-white/10 focus:outline-none focus:border-orange-500"
          />
        </div>

        <button
          onClick={openAddCity}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={16} /> Add City
        </button>
      </div>

      {/* CITIES & HIERARCHY LIST */}
      <div className="space-y-4">
        {cities.length === 0 ? (
          <div className="bg-zinc-900 rounded-2xl p-8 border border-white/5 text-center space-y-3">
            <Building2 size={32} className="mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-400">No cities configured in Geofencing V2 yet.</p>
            <button
              onClick={openAddCity}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold inline-flex items-center gap-2"
            >
              <Plus size={14} /> Add First City
            </button>
          </div>
        ) : (
          cities
            .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(city => {
              const isExpanded = expandedCityIds.includes(city.id);
              const cityPincodes = pincodes.filter(p => p.city_id === city.id);
              const cityLocalities = localities.filter(l => l.city_id === city.id);

              return (
                <div
                  key={city.id}
                  className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-xl transition-all"
                >
                  {/* CITY BAR */}
                  <div className="p-4 bg-zinc-950/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpandCity(city.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <Building2 className="text-orange-500" size={20} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-white">{city.name}</h2>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              city.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-500 border-white/5'
                            }`}
                          >
                            {city.is_active ? 'CITY ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {city.state}, {city.country} • {cityPincodes.length} Pincodes • {cityLocalities.length} Localities
                        </p>
                      </div>
                    </div>

                    {/* CITY CONTROLS */}
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                      <button
                        type="button"
                        onClick={() => setBoundaryEditorTarget({ type: 'city', item: city })}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-orange-400 text-xs font-semibold flex items-center gap-1.5 border border-orange-500/20 flex-1 sm:flex-none justify-center"
                      >
                        <Map size={14} /> Map Boundary
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCity(city)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex-none"
                        title="Edit City"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleCity(city)}
                        className="text-zinc-300 hover:text-white flex-none ml-auto sm:ml-0"
                        title="Toggle Active Status"
                      >
                        {city.is_active ? (
                          <ToggleRight size={28} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={28} className="text-zinc-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ type: 'city', id: city.id, title: `City ${city.name}` })}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors flex-none"
                        title="Delete City"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED CONTENT: PINCODES & LOCALITIES */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-6 space-y-6 bg-zinc-900/40"
                      >
                        {/* SECTION 1: PINCODES */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                              <MapPin size={14} className="text-orange-500" />
                              Pincodes ({cityPincodes.length})
                            </h3>

                            <button
                              type="button"
                              onClick={() => openAddPincode(city.id)}
                              className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-orange-400 text-xs font-bold flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Pincode
                            </button>
                          </div>

                          {cityPincodes.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">No pincodes added for {city.name} yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {cityPincodes.map(pin => (
                                <div
                                  key={pin.id}
                                  className="bg-zinc-950 p-3 rounded-xl border border-white/5 flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-white font-mono">{pin.pincode}</p>
                                    <span
                                      className={`text-[9px] font-bold ${
                                        pin.is_active ? 'text-emerald-400' : 'text-zinc-600'
                                      }`}
                                    >
                                      {pin.is_active ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePincode(pin)}
                                      className="text-zinc-400 hover:text-white"
                                    >
                                      {pin.is_active ? (
                                        <ToggleRight size={22} className="text-emerald-500" />
                                      ) : (
                                        <ToggleLeft size={22} className="text-zinc-600" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditPincode(pin)}
                                      className="text-zinc-500 hover:text-zinc-300 p-1"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirm({ type: 'pincode', id: pin.id, title: `Pincode ${pin.pincode}` })}
                                      className="text-zinc-500 hover:text-red-400 p-1"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SECTION 2: LOCALITIES */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                              <Globe size={14} className="text-orange-500" />
                              Localities / Sub-zones ({cityLocalities.length})
                            </h3>

                            <button
                              type="button"
                              onClick={() => openAddLocality(city.id)}
                              className="px-3 py-1 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center gap-1 border border-orange-500/20"
                            >
                              <Plus size={12} /> Add Locality
                            </button>
                          </div>

                          {cityLocalities.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">No localities added for {city.name} yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {cityLocalities.map(loc => {
                                const parentPin = pincodes.find(p => p.id === loc.pincode_id);
                                return (
                                  <div
                                    key={loc.id}
                                    className={`p-4 rounded-2xl border transition-all ${
                                      loc.is_active
                                        ? 'bg-zinc-950 border-white/10 hover:border-orange-500/30'
                                        : 'bg-zinc-950/50 border-white/5 opacity-70'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="text-sm font-bold text-white">{loc.name}</h4>
                                          <span
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                              loc.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                                            }`}
                                          >
                                            {loc.is_active ? 'ON' : 'OFF'}
                                          </span>
                                        </div>
                                        {parentPin && (
                                          <p className="text-[10px] text-zinc-400 font-mono">Pincode: {parentPin.pincode}</p>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleLocality(loc)}
                                        className="text-zinc-400 hover:text-white"
                                      >
                                        {loc.is_active ? (
                                          <ToggleRight size={26} className="text-emerald-500" />
                                        ) : (
                                          <ToggleLeft size={26} className="text-zinc-600" />
                                        )}
                                      </button>
                                    </div>

                                    {/* LOCALITY FEES & TIME METRICS */}
                                    <div className="grid grid-cols-3 gap-2 bg-zinc-900/60 p-2 rounded-xl text-center border border-white/5 my-3">
                                      <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-semibold">Delivery Fee</p>
                                        <p className="text-xs font-bold text-orange-400">₹{loc.delivery_fee}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-semibold">Min Order</p>
                                        <p className="text-xs font-bold text-zinc-300">₹{loc.minimum_order}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-zinc-500 uppercase font-semibold">ETA</p>
                                        <p className="text-xs font-bold text-zinc-300">{loc.estimated_delivery_minutes || 30}m</p>
                                      </div>
                                    </div>

                                    {/* ACTION BUTTONS */}
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                      <button
                                        type="button"
                                        onClick={() => setBoundaryEditorTarget({ type: 'locality', item: loc })}
                                        className="text-[11px] font-semibold text-orange-400 hover:underline flex items-center gap-1"
                                      >
                                        <Map size={12} /> {loc.boundary ? 'Edit Boundary' : '+ Draw Boundary'}
                                      </button>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openEditLocality(loc)}
                                          className="text-zinc-400 hover:text-white p-1"
                                          title="Edit Locality"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDeleteConfirm({ type: 'locality', id: loc.id, title: `Locality ${loc.name}` })}
                                          className="text-zinc-500 hover:text-red-400 p-1"
                                          title="Delete Locality"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
        )}
      </div>

      {/* CITY MODAL */}
      {isCityModalOpen && (
        <UnifiedCityModal
          existingCity={editingCity}
          cities={cities}
          onSave={handleSaveCity}
          onCancel={() => {
            setIsCityModalOpen(false);
            setEditingCity(null);
          }}
        />
      )}

      {/* PINCODE MODAL */}
      {isPincodeModalOpen && (
        <UnifiedPincodeModal
          existingPincode={editingPincode}
          cityId={pincodeForm.city_id}
          cityContext={cities.find(c => c.id === pincodeForm.city_id) || cities[0]}
          pincodes={pincodes}
          onSave={handleSavePincode}
          onCancel={() => {
            setIsPincodeModalOpen(false);
            setEditingPincode(null);
          }}
        />
      )}

      {/* LOCALITY MODAL */}
      {isLocalityModalOpen && (
        <UnifiedLocalityModal
          existingLocality={editingLocality}
          cityId={localityForm.city_id}
          pincodeId={localityForm.pincode_id}
          cityContext={cities.find(c => c.id === localityForm.city_id) || cities[0]}
          localities={localities}
          onSave={handleSaveLocality}
          onCancel={() => {
            setIsLocalityModalOpen(false);
            setEditingLocality(null);
          }}
        />
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <AlertTriangle size={36} className="mx-auto text-red-500" />
            <h3 className="text-base font-bold text-white">Delete Confirmation</h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to delete <span className="font-bold text-white">{deleteConfirm.title}</span>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
