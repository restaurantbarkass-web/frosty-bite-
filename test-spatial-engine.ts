import * as turf from '@turf/turf';

// Store Central Hub: Cuttack [lng, lat]
const STORE_HUB: [number, number] = [85.8828, 20.4625];

/**
 * Spatial Coverage check ST_Covers(geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
 * Setting ignoreBoundary: false ensures points directly ON the polygon boundary are covered.
 */
export function isPointCoveredByGeometry(geometry: any, longitude: number, latitude: number): boolean {
  if (!geometry) return false;

  try {
    const pt = turf.point([longitude, latitude]);
    let featureGeom = geometry;

    if (geometry.type === 'Feature' && geometry.geometry) {
      featureGeom = geometry.geometry;
    }

    if (featureGeom.type === 'Polygon' || featureGeom.type === 'MultiPolygon') {
      return turf.booleanPointInPolygon(pt, featureGeom, { ignoreBoundary: false });
    }
  } catch (err) {
    console.warn('[SpatialEngine] Invalid geometry encountered:', err);
  }

  return false;
}

/**
 * Calculate spatial distance in meters: ST_Distance(storePt::geography, pt::geography)
 */
export function calculateSpatialDistanceMeters(longitude: number, latitude: number, hubLngLat: [number, number] = STORE_HUB): number {
  try {
    const from = turf.point(hubLngLat);
    const to = turf.point([longitude, latitude]);
    return Math.round(turf.distance(from, to, { units: 'meters' }));
  } catch (err) {
    return 0;
  }
}

console.log('Testing spatial functions...');
const testPoly = {
  type: 'Polygon',
  coordinates: [
    [
      [85.8000, 20.4000],
      [85.9000, 20.4000],
      [85.9000, 20.5000],
      [85.8000, 20.5000],
      [85.8000, 20.4000]
    ]
  ]
};

// Test point inside
console.log('1. Inside point:', isPointCoveredByGeometry(testPoly, 85.85, 20.45)); // should be true
// Test point outside
console.log('2. Outside point:', isPointCoveredByGeometry(testPoly, 85.70, 20.45)); // should be false
// Test point on boundary
console.log('3. Boundary point:', isPointCoveredByGeometry(testPoly, 85.80, 20.45)); // should be true
// Test distance
console.log('4. Distance meters:', calculateSpatialDistanceMeters(85.85, 20.45));
