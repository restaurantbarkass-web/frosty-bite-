import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { V2GeofencingService } from './server/services/v2Geofencing.service';

async function runTests() {
  console.log('================================================================');
  console.log('GEOFENCING V2 — POSTGIS SERVICEABILITY ENGINE TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: any = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - detail:`, typeof detail === 'object' ? JSON.stringify(detail) : detail);
      failed++;
    }
  }

  // Sample Coordinates:
  // Jobra (Active Locality in Cuttack 753001): Lat 20.4625, Lng 85.8828
  // Buxi Bazaar (Active Locality in Cuttack 753001): Lat 20.4550, Lng 85.8600
  // Badambadi (Inactive Locality in Cuttack 753012): Lat 20.4250, Lng 85.8350
  // Outside Cuttack City (still in Odisha): Lat 20.2961, Lng 85.8245
  // Outside Global Area (e.g., London): Lat 51.5074, Lng -0.1278

  // 1. Invalid Coordinates Tests
  console.log('\n--- 1. Input Validation Tests ---');
  const inv1 = await V2GeofencingService.checkServiceability({ latitude: NaN, longitude: 85.8828 });
  assert(inv1.status === 400 && inv1.data.reason === 'INVALID_COORDINATES', 'NaN Latitude rejected with 400');

  const inv2 = await V2GeofencingService.checkServiceability({ latitude: 20.4625, longitude: Infinity });
  assert(inv2.status === 400 && inv2.data.reason === 'INVALID_COORDINATES', 'Infinity Longitude rejected with 400');

  const inv3 = await V2GeofencingService.checkServiceability({ latitude: 120, longitude: 85.8828 });
  assert(inv3.status === 400 && inv3.data.reason === 'INVALID_COORDINATES', 'Latitude > 90 rejected with 400');

  const inv4 = await V2GeofencingService.checkServiceability({} as any);
  assert(inv4.status === 400 && inv4.data.reason === 'INVALID_COORDINATES', 'Missing coordinates rejected with 400');

  // 2. Active Serviceable Locality (Jobra)
  console.log('\n--- 2. Active Locality & Delivery Rules Test (Jobra) ---');
  const jobraRes = await V2GeofencingService.checkServiceability({ latitude: 20.4625, longitude: 85.8828 });
  assert(jobraRes.data.serviceable === true, 'Jobra coordinate is serviceable');
  assert(jobraRes.data.city?.name === 'Cuttack', 'City is Cuttack');
  assert(jobraRes.data.pincode?.pincode === '753001', 'Pincode is 753001');
  assert(jobraRes.data.locality?.name === 'Jobra', 'Locality is Jobra');
  assert(jobraRes.data.deliveryFee === 40, 'Delivery fee is 40');
  assert(jobraRes.data.minimumOrder === 149, 'Minimum order is 149');
  assert(jobraRes.data.estimatedDeliveryMinutes === 30, 'ETA is 30 minutes');
  assert(typeof jobraRes.data.distanceMeters === 'number' && jobraRes.data.distanceMeters >= 0, 'Distance in meters returned');

  // 3. Active Serviceable Locality (Buxi Bazaar)
  console.log('\n--- 3. Active Locality & Delivery Rules Test (Buxi Bazaar) ---');
  const buxiRes = await V2GeofencingService.checkServiceability({ latitude: 20.4550, longitude: 85.8600 });
  assert(buxiRes.data.serviceable === true, 'Buxi Bazaar coordinate is serviceable');
  assert(buxiRes.data.locality?.name === 'Buxi Bazaar', 'Locality is Buxi Bazaar');
  assert(buxiRes.data.deliveryFee === 50, 'Delivery fee is 50');
  assert(buxiRes.data.minimumOrder === 199, 'Minimum order is 199');
  assert(buxiRes.data.estimatedDeliveryMinutes === 35, 'ETA is 35 minutes');

  // 4. Inactive Locality Test (Badambadi)
  console.log('\n--- 4. Inactive Locality Test (Badambadi) ---');
  const badambadiRes = await V2GeofencingService.checkServiceability({ latitude: 20.4250, longitude: 85.8350 });
  assert(badambadiRes.data.serviceable === false, 'Badambadi is not serviceable');
  assert(badambadiRes.data.reason === 'LOCALITY_INACTIVE', 'Reason is LOCALITY_INACTIVE');

  // 5. Outside Locality Test (Inside Cuttack city & pincode, but no matching locality polygon)
  console.log('\n--- 5. Outside Locality Test ---');
  const outsideLocRes = await V2GeofencingService.checkServiceability({ latitude: 20.4900, longitude: 85.9100 });
  assert(outsideLocRes.data.serviceable === false, 'Outside locality point is not serviceable');
  assert(outsideLocRes.data.reason === 'OUTSIDE_LOCALITY', 'Reason is OUTSIDE_LOCALITY');

  // 6. Outside City Test
  console.log('\n--- 6. Outside City Test ---');
  const outsideCityRes = await V2GeofencingService.checkServiceability({ latitude: 20.2961, longitude: 85.8245 });
  assert(outsideCityRes.data.serviceable === false, 'Outside city point is not serviceable');
  assert(outsideCityRes.data.reason === 'OUTSIDE_CITY', 'Reason is OUTSIDE_CITY');

  // 7. Outside Global Service Area Test
  console.log('\n--- 7. Outside Global Service Area Test ---');
  const outsideGlobalRes = await V2GeofencingService.checkServiceability({ latitude: 51.5074, longitude: -0.1278 });
  assert(outsideGlobalRes.data.serviceable === false, 'London point is outside global service area');
  assert(outsideGlobalRes.data.reason === 'OUTSIDE_GLOBAL_SERVICE_AREA', 'Reason is OUTSIDE_GLOBAL_SERVICE_AREA');

  // 8. Polygon Boundary Point Test (Point directly on boundary of Jobra locality [85.8700, 20.4500])
  console.log('\n--- 8. Polygon Boundary Point Test ---');
  const boundaryRes = await V2GeofencingService.checkServiceability({ latitude: 20.4500, longitude: 85.8700 });
  assert(boundaryRes.data.serviceable === true, 'Boundary point counts as covered (ST_Covers)', boundaryRes.data);
  assert(boundaryRes.data.locality?.name === 'Jobra', 'Matched Jobra on boundary', boundaryRes.data);

  // 9. Inactive Pincode Test
  console.log('\n--- 9. Inactive Pincode Test ---');
  // Temporarily set pincode 753001 to inactive to test
  const pincodes = await V2GeofencingService.getPincodes();
  const pinObj = pincodes.find(p => p.pincode === '753001');
  if (pinObj) {
    await V2GeofencingService.updatePincode(pinObj.id, { is_active: false });
    const inactPinRes = await V2GeofencingService.checkServiceability({ latitude: 20.4625, longitude: 85.8828 });
    assert(inactPinRes.data.serviceable === false, 'Inactive pincode point rejected');
    assert(inactPinRes.data.reason === 'PINCODE_INACTIVE', 'Reason is PINCODE_INACTIVE');
    // Re-enable pincode 753001
    await V2GeofencingService.updatePincode(pinObj.id, { is_active: true });
  }

  // 10. Performance Benchmark
  console.log('\n--- 10. Performance & Spatial Benchmark ---');
  const iterations = 50;
  const startBenchmark = Date.now();
  for (let i = 0; i < iterations; i++) {
    await V2GeofencingService.checkServiceability({ latitude: 20.4625, longitude: 85.8828 });
  }
  const totalDuration = Date.now() - startBenchmark;
  const avgDuration = (totalDuration / iterations).toFixed(2);
  console.log(`Benchmark completed: ${iterations} queries in ${totalDuration}ms (Avg ${avgDuration}ms per query)`);
  assert(Number(avgDuration) < 20, `Average query execution time (${avgDuration}ms) is under 20ms`);

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
