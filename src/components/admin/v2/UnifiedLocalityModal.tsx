import React, { useState } from 'react';
import { ToggleRight, ToggleLeft, Check } from 'lucide-react';
import { V2Locality, V2City, V2Pincode } from './GeofencingV2Manager';
import { AdminLocationAutocomplete } from './AdminLocationAutocomplete';
import { MapLibreBoundaryEditor } from './MapLibreBoundaryEditor';

interface UnifiedLocalityModalProps {
  existingLocality?: V2Locality | null;
  cityId: string;
  pincodeId?: string;
  cityContext: V2City;
  localities: V2Locality[];
  onSave: (data: any) => void;
  onCancel: () => void;
}

export const UnifiedLocalityModal: React.FC<UnifiedLocalityModalProps> = ({
  existingLocality,
  cityId,
  pincodeId,
  cityContext,
  localities,
  onSave,
  onCancel
}) => {
  const [form, setForm] = useState({
    city_id: cityId,
    pincode_id: pincodeId || '',
    name: existingLocality?.name || '',
    is_active: existingLocality ? existingLocality.is_active : true,
    delivery_fee: existingLocality ? existingLocality.delivery_fee : 40,
    minimum_order: existingLocality ? existingLocality.minimum_order : 149,
    estimated_delivery_minutes: existingLocality ? existingLocality.estimated_delivery_minutes : 30,
    boundary: existingLocality?.boundary || null
  });
  
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleAutocompleteSelect = (res: any) => {
    setForm(prev => ({
      ...prev,
      name: res.name,
    }));
    if (res.source === 'external' && res.lng && res.lat) {
      setMapCenter([res.lng, res.lat]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex flex-col md:flex-row p-4 gap-4 items-center justify-center font-sans">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col h-auto max-h-full overflow-y-auto shrink-0">
        <h3 className="text-lg font-black text-stone-900 mb-1">
          {existingLocality ? 'Edit Locality' : 'Add New Locality'}
        </h3>
        <p className="text-xs font-bold text-[#E76A54] mb-4">City: {cityContext.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Search or Enter Locality Name</label>
            <AdminLocationAutocomplete
              type="locality"
              value={form.name}
              onChange={(val) => setForm({ ...form, name: val })}
              onSelect={handleAutocompleteSelect}
              dbRecords={localities}
              cityContext={cityContext}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Fee (₹)</label>
              <input
                type="number"
                min="0"
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                className="w-full bg-stone-50 text-stone-900 placeholder:text-stone-400 rounded-xl px-3 py-2 border border-stone-200 text-xs focus:outline-none focus:border-[#E76A54]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Min Order (₹)</label>
              <input
                type="number"
                min="0"
                value={form.minimum_order}
                onChange={(e) => setForm({ ...form, minimum_order: Number(e.target.value) })}
                className="w-full bg-stone-50 text-stone-900 placeholder:text-stone-400 rounded-xl px-3 py-2 border border-stone-200 text-xs focus:outline-none focus:border-[#E76A54]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">ETA (Minutes)</label>
            <input
              type="number"
              min="1"
              value={form.estimated_delivery_minutes || ''}
              onChange={(e) => setForm({ ...form, estimated_delivery_minutes: Number(e.target.value) })}
              className="w-full bg-stone-50 text-stone-900 placeholder:text-stone-400 rounded-xl px-3 py-2 border border-stone-200 text-xs focus:outline-none focus:border-[#E76A54]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-xs font-bold text-stone-700">Locality Active</span>
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
            Draw the boundary on the map to define the precise locality service area limits.
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
              <Check size={14} /> Save Locality
            </button>
          </div>
        </form>
      </div>
      
      {/* Map Side */}
      <div className="flex flex-1 w-full h-[40vh] md:h-full md:max-h-[80vh] rounded-2xl overflow-hidden border border-stone-200 shadow-xl">
        <MapLibreBoundaryEditor
          title="Locality Boundary"
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