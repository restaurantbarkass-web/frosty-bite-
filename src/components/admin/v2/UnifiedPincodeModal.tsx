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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col md:flex-row p-4 gap-4 items-center justify-center">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col h-auto max-h-full overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white">
            {existingPincode ? 'Edit Pincode' : 'Add New Pincode'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-orange-400 mb-4 font-mono font-bold">
          City: {cityContext?.name || 'Selected City'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Search or Enter Pincode</label>
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
            <p className="text-[10px] text-zinc-500 mt-1 font-mono">Must be strictly 6 numeric digits (e.g. 753001).</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-white/5">
            <span className="text-xs font-bold text-zinc-300">Pincode Active</span>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
            >
              {form.is_active ? (
                <ToggleRight size={28} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={28} className="text-zinc-600" />
              )}
            </button>
          </div>
          
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Draw the boundary on the map if you want to restrict service to specific areas within this pincode.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isPincodeValid || isSubmitting}
              className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save Pincode
            </button>
          </div>
        </form>
      </div>
      
      {/* Map Side */}
      <div className="flex flex-1 w-full h-[40vh] md:h-full md:max-h-[80vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
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
