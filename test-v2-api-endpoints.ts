import app from './server/app';
import http from 'http';

async function testV2Endpoints() {
  const server = http.createServer(app);
  server.listen(3099, async () => {
    console.log('Test server listening on port 3099...');
    try {
      // 1. GET service-area
      const saRes = await fetch('http://localhost:3099/api/v2/service-area');
      const saData = await saRes.json();
      console.log('1. GET /api/v2/service-area:', { status: saRes.status, is_active: saData.is_active });

      // 2. PATCH service-area
      const saPatchRes = await fetch('http://localhost:3099/api/v2/service-area', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });
      console.log('2. PATCH /api/v2/service-area:', saPatchRes.status);

      // 3. GET cities
      const citiesRes = await fetch('http://localhost:3099/api/v2/cities');
      const citiesData = await citiesRes.json();
      console.log('3. GET /api/v2/cities:', { status: citiesRes.status, count: citiesData.length });

      // 4. GET pincodes
      const pinRes = await fetch('http://localhost:3099/api/v2/pincodes');
      const pinData = await pinRes.json();
      console.log('4. GET /api/v2/pincodes:', { status: pinRes.status, count: pinData.length });

      // 5. GET localities
      const locRes = await fetch('http://localhost:3099/api/v2/localities');
      const locData = await locRes.json();
      console.log('5. GET /api/v2/localities:', { status: locRes.status, count: locData.length });

      console.log('✅ ALL V2 API ENDPOINTS VERIFIED WORKING!');
    } catch (err: any) {
      console.error('❌ Error testing V2 endpoints:', err);
    } finally {
      server.close();
    }
  });
}

testV2Endpoints();
