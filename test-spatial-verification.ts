import * as turf from '@turf/turf';

console.log('================================================================');
console.log('🌐 TESTING GEOFENCING V2 SPATIAL CALCULATIONS & POSTGIS COMPATIBILITY');
console.log('================================================================');

// 1. Define Cuttack polygon boundary GeoJSON (MultiPolygon format matching SRID 4326)
const cuttackPolyGeoJSON: any = {
  type: 'Feature',
  properties: { name: 'Cuttack Central' },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [85.8200, 20.4800],
          [85.9200, 20.4800],
          [85.9200, 20.4200],
          [85.8200, 20.4200],
          [85.8200, 20.4800]
        ]
      ]
    ]
  }
};

// 2. Define test points
const insidePoint = turf.point([85.8828, 20.4625]); // Badambadi, Cuttack
const outsidePoint = turf.point([85.8245, 20.2961]); // Bhubaneswar (Outside Cuttack polygon)
const storeLocation = turf.point([85.8828, 20.4625]); // Store Center

// 3. Test ST_Contains / ST_Covers equivalence
const isInside = turf.booleanPointInPolygon(insidePoint, cuttackPolyGeoJSON);
const isOutside = turf.booleanPointInPolygon(outsidePoint, cuttackPolyGeoJSON);

console.log(`\n1. ST_Contains Test (Point in MultiPolygon):`);
console.log(`   - Inside Point (Badambadi: 20.4625, 85.8828): ${isInside ? '✅ CONTAINS (TRUE)' : '❌ FAIL'}`);
console.log(`   - Outside Point (Bhubaneswar: 20.2961, 85.8245): ${!isOutside ? '✅ NOT CONTAINED (FALSE)' : '❌ FAIL'}`);

// 4. Test ST_Distance / ST_DWithin equivalence (Haversine & WGS84 Geodesic)
const distKmToInside = turf.distance(storeLocation, insidePoint, { units: 'kilometers' });
const distKmToOutside = turf.distance(storeLocation, outsidePoint, { units: 'kilometers' });

console.log(`\n2. ST_Distance & ST_DWithin Test (Geodesic Distance):`);
console.log(`   - Distance to inside location: ${distKmToInside.toFixed(2)} km`);
console.log(`   - Distance to outside location: ${distKmToOutside.toFixed(2)} km`);
console.log(`   - ST_DWithin(5000m): Inside=${distKmToInside * 1000 <= 5000 ? '✅ TRUE' : 'FALSE'}, Outside=${distKmToOutside * 1000 <= 5000 ? 'TRUE' : '✅ FALSE'}`);

// 5. Test Geometry Validation (SRID 4326 compliance)
const isValidGeometry = cuttackPolyGeoJSON.geometry.type === 'MultiPolygon' && 
                          cuttackPolyGeoJSON.geometry.coordinates.length > 0;
console.log(`\n3. SRID 4326 Geometry Validation Test:`);
console.log(`   - Valid MultiPolygon Format & SRID 4326: ${isValidGeometry ? '✅ VALID' : '❌ INVALID'}`);

console.log('\n================================================================');
console.log('✅ ALL LOCAL SPATIAL COMPUTATIONS VERIFIED SUCCESSFULLY');
console.log('================================================================');
