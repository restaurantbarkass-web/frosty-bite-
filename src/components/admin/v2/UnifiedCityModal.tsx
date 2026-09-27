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
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex flex-col md:flex-row p-0 md:p-4 gap-4 items-center justify-center font-sans">
      <div className="bg-white border border-stone-200 rounded-none md:rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col h-full md:h-auto overflow-y-auto">
        <h3 className="text-lg font-black text-stone-900 mb-4">
          {existingCity ? 'Edit City' : 'Add New City'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Search or Enter City</label>
            <AdminLocationAutocomplete
              type="city"
              value={form.name}
              onChange={(val) => setForm({ ...form, name: val })}
              onSelect={handleAutocompleteSelect}
              dbRecords={cities}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">State</label>
            <input
              type="text"
              placeholder="e.g. Odisha"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full bg-stone-50 text-stone-900 placeholder:text-stone-400 rounded-xl px-3 py-2 border border-stone-200 text-xs focus:outline-none focus:border-[#E76A54]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Country</label>
            <input
              type="text"
              placeholder="e.g. India"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full bg-stone-50 text-stone-900 placeholder:text-stone-400 rounded-xl px-3 py-2 border border-stone-200 text-xs focus:outline-none focus:border-[#E76A54]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-xs font-bold text-stone-700">City Service Active</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className="cursor-pointer"
            >
              {form.is_active ? (
                <ToggleRight size={28} className="text-[#E76A54]" />
              ) : (
                <ToggleLeft size={28} className="text-stone-400" />
              )}
            </button>
          </div>
          
          <p className="text-[10px] text-stone-500">
            Draw the boundary on the map to define the precise service area limits for this city. This step is optional but recommended.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200 mt-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer border border-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#E76A54] hover:bg-[#d65b45] text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-[#E76A54]/20"
            >
              <Check size={14} /> Save City
            </button>
          </div>
        </form>
      </div>
      
      {/* Map Side */}
      <div className="flex flex-1 w-full h-[40vh] md:h-full md:max-h-[80vh] rounded-2xl overflow-hidden border border-stone-200 shadow-xl mt-4 md:mt-0">
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
