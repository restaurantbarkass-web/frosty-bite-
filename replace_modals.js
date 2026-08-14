const fs = require('fs');
const content = fs.readFileSync('src/components/admin/v2/GeofencingV2Manager.tsx', 'utf8');

const startCity = content.indexOf('{isCityModalOpen && (');
const deleteConfirmStart = content.indexOf('{/* DELETE CONFIRM MODAL */}');

const before = content.substring(0, startCity);
const after = content.substring(deleteConfirmStart);

const newModals = `
      {isCityModalOpen && (
        <UnifiedCityModal
          existingCity={editingCity}
          cities={cities}
          onSave={handleSaveCity}
          onCancel={() => setIsCityModalOpen(false)}
        />
      )}

      {isPincodeModalOpen && selectedCityData && (
        <UnifiedPincodeModal
          existingPincode={editingPincode}
          cityId={selectedCity}
          cityContext={selectedCityData}
          pincodes={pincodes}
          onSave={handleSavePincode}
          onCancel={() => setIsPincodeModalOpen(false)}
        />
      )}

      {isLocalityModalOpen && selectedCityData && (
        <UnifiedLocalityModal
          existingLocality={editingLocality}
          cityId={selectedCity}
          pincodeId={localityForm.pincode_id}
          cityContext={selectedCityData}
          localities={localities}
          onSave={handleSaveLocality}
          onCancel={() => setIsLocalityModalOpen(false)}
        />
      )}

      `;

fs.writeFileSync('src/components/admin/v2/GeofencingV2Manager.tsx', before + newModals + after);
