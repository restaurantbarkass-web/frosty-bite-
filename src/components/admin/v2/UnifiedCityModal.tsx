import React, { useState } from 'react';
import { ToggleRight, ToggleLeft, Check } from 'lucide-react';
import { V2City } from './GeofencingV2Manager';
import { AdminLocationAutocomplete } from './AdminLocationAutocomplete';
import { MapLibreBoundaryEditor } from './MapLibreBoundaryEditor';

interface UnifiedCityModalProps {
  existingCity?: V2City | null;
  cities: V2City[];
  onSave: (cityData: any) => void;
  onCancel: () => void;
}

export const UnifiedCityModal: React.FC<UnifiedCityModalProps> = ({
  existingCity,
  cities,
  onSave,
  onCancel
}) => {
  const [form, setForm] = useState({
    name: existingCity?.name || '',
    state: existingCity?.state || 'Odisha',
    country: existingCity?.country || 'India',
    is_active: existingCity ? existingCity.is_active : true,
    boundary: existingCity?.boundary || null
  });
  
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleAutocompleteSelect = (res: any) => {
    if (res.source === 'external') {
      setForm(prev => ({
        ...prev,
        name: res.name,
        state: res.state || prev.state,
        country: res.country || prev.country
      }));
      if (res.lng && res.lat) {
        setMapCenter([res.lng, res.lat]);
      }
    } else {
      // It's a DB match, we can still set the name and center if we know it
      setForm(prev => ({
        ...prev,
        name: res.name,
      }));
      if (res.originalDbRecord?.boundary) {
        // We could extract the center from the boundary if we wanted to
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col md:flex-row p-0 md:p-4 gap-4 items-center justify-center">
      <div className="bg-zinc-900 border border-white/10 rounded-none md:rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col h-full md:h-auto overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">
          {existingCity ? 'Edit City' : 'Add New City'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Search or Enter City</label>
            <AdminLocationAutocomplete
              type="city"
              value={form.name}
              onChange={(val) => setForm({ ...form, name: val })}
              onSelect={handleAutocompleteSelect}
              dbRecords={cities}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">State</label>
            <input
              type="text"
              placeholder="e.g. Odisha"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full bg-zinc-950 text-white rounded-xl px-3 py-2 border border-white/10 text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Country</label>
            <input
              type="text"
              placeholder="e.g. India"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full bg-zinc-950 text-white rounded-xl px-3 py-2 border border-white/10 text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-white/5">
            <span className="text-xs font-bold text-zinc-300">City Service Active</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
            >
              {form.is_active ? (
                <ToggleRight size={28} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={28} className="text-zinc-600" />
              )}
            </button>
          </div>
          
          <p className="text-[10px] text-zinc-500">
            Draw the boundary on the map to define the precise service area limits for this city. This step is optional but recommended.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold flex items-center gap-1"
            >
              <Check size={14} /> Save City
            </button>
          </div>
        </form>
      </div>
      
      {/* Map Side */}
      <div className="flex flex-1 w-full h-[40vh] md:h-full md:max-h-[80vh] rounded-2xl overflow-hidden border border-white/10 mt-4 md:mt-0">
        <MapLibreBoundaryEditor
          title="City Boundary"
          hideHeader={true}
          hideSearch={true}
          centerOverride={mapCenter}
          initialBoundary={form.boundary}
          onChangeBoundary={(b) => setForm(prev => ({ ...prev, boundary: b }))}
        />
      </div>
    </div>
  );
};
