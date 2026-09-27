import React, { useState } from 'react';
import { ToggleRight, ToggleLeft, Check, Loader2, X } from 'lucide-react';
import { V2Pincode, V2City } from './GeofencingV2Manager';
import { AdminLocationAutocomplete } from './AdminLocationAutocomplete';
import { MapLibreBoundaryEditor } from './MapLibreBoundaryEditor';

interface UnifiedPincodeModalProps {
  existingPincode?: V2Pincode | null;
  cityId: string;
  cityContext: V2City;
  pincodes: V2Pincode[];
  onSave: (data: any) => Promise<void> | void;
  onCancel: () => void;
}

export const UnifiedPincodeModal: React.FC<UnifiedPincodeModalProps> = ({
  existingPincode,
  cityId,
  cityContext,
  pincodes,
  onSave,
  onCancel
}) => {
  const [form, setForm] = useState({
    city_id: cityId,
    pincode: existingPincode?.pincode || '',
    is_active: existingPincode ? existingPincode.is_active : true,
    boundary: existingPincode?.boundary || null
  });

  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutocompleteSelect = (res: any) => {
    const cleanPin = (res.pincode || res.name || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanPin) {
      setForm(prev => ({
        ...prev,
        pincode: cleanPin
      }));
    }
    if (res.source === 'external' && res.lng && res.lat) {
      setMapCenter([res.lng, res.lat]);
    }
  };

  const isPincodeValid = form.pincode.length === 6;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex flex-col md:flex-row p-4 gap-4 items-center justify-center font-sans">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col h-auto max-h-full overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-black text-stone-900">
            {existingPincode ? 'Edit Pincode' : 'Add New Pincode'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-700 transition-colors p-1 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[#E76A54] mb-4 font-mono font-bold">
          City: {cityContext?.name || 'Selected City'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Search or Enter Pincode</label>
            <AdminLocationAutocomplete
              type="pincode"
              value={form.pincode}
              onChange={(val) => {
                const clean = val.replace(/[^0-9]/g, '').slice(0, 6);
                setForm(prev => ({ ...prev, pincode: clean }));
              }}
              onSelect={handleAutocompleteSelect}
              dbRecords={pincodes}
              cityContext={cityContext}
            />
            <p className="text-[10px] text-stone-500 mt-1 font-mono">Must be strictly 6 numeric digits (e.g. 753001).</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-xs font-bold text-stone-700">Pincode Active</span>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className="cursor-pointer"
            >
              {form.is_active ? (
                <ToggleRight size={28} className="text-[#E76A54]" />
              ) : (
                <ToggleLeft size={28} className="text-stone-400" />
              )}
            </button>
          </div>
          
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Draw the boundary on the map if you want to restrict service to specific areas within this pincode.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200 mt-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer border border-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isPincodeValid || isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#E76A54] hover:bg-[#d65b45] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#E76A54]/20"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save Pincode
            </button>
          </div>
        </form>
      </div>
      
      {/* Map Side */}
      <div className="flex flex-1 w-full h-[40vh] md:h-full md:max-h-[80vh] rounded-2xl overflow-hidden border border-stone-200 shadow-xl">
        <MapLibreBoundaryEditor
          title="Pincode Boundary"
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
