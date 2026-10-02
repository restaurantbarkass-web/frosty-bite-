import express from 'express';
import smsGatewayRouter from '../server/routes/smsGateway.routes';
import { SmsGatewayService } from '../server/services/smsGateway.service';

const TEST_API_KEY = "test_perm_gateway_key_998877665544332211";
const TEST_DEVICE_ID = "frosty-sms-gateway-01";

process.env.SMS_GATEWAY_API_KEY = TEST_API_KEY;
process.env.SMS_GATEWAY_DEVICE_ID = TEST_DEVICE_ID;
process.env.NODE_ENV = "production";

const app = express();
app.use(express.json());
app.use('/api/sms-gateway', smsGatewayRouter);

const server = app.listen(0);
const port = (server.address() as any).port;
const baseUrl = `http://127.0.0.1:${port}/api/sms-gateway`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=========================================");
  console.log("SMS GATEWAY AUTHENTICATION TEST SUITE");
  console.log("=========================================\n");

  try {
    // 1. Missing API Key on Test Connection -> 401
    const res1 = await fetch(`${baseUrl}/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-ID': TEST_DEVICE_ID },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID })
    });
    assert(res1.status === 401, "missing API key on test-connection -> 401");

    // 2. Wrong API Key on Test Connection -> 401
    const res2 = await fetch(`${baseUrl}/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrong_api_key_value',
        'X-Device-ID': TEST_DEVICE_ID
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID })
    });
    assert(res2.status === 401, "wrong API key on test-connection -> 401");

    // 3. Correct API Key & Correct Device ID on Test Connection -> 200
    const res3 = await fetch(`${baseUrl}/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
        'X-Device-ID': TEST_DEVICE_ID
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID })
    });
    const body3 = await res3.json();
    assert(res3.status === 200 && body3.ok === true && body3.auth === "PASS", "correct API key & device ID on test-connection -> 200");

    // 4. Correct API Key but Wrong Device ID on Test Connection -> 403
    const res4 = await fetch(`${baseUrl}/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
        'X-Device-ID': 'wrong-device-99'
      },
      body: JSON.stringify({ deviceId: 'wrong-device-99' })
    });
    assert(res4.status === 403, "wrong device ID on test-connection -> 403");

    // 5. Missing API Key on Heartbeat -> 401
    const res5 = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-ID': TEST_DEVICE_ID },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID })
    });
    assert(res5.status === 401, "missing API key on heartbeat -> 401");

    // 6. Wrong API Key on Heartbeat -> 401
    const res6 = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid_secret_key',
        'X-Device-ID': TEST_DEVICE_ID
      },
      body: JSON.stringify({ deviceId: TEST_DEVICE_ID })
    });
    assert(res6.status === 401, "wrong API key on heartbeat -> 401");

    // 7. Correct API Key & Correct Device ID on Heartbeat -> 200
    const res7 = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
        'X-Device-ID': TEST_DEVICE_ID
      },
      body: JSON.stringify({
        deviceId: TEST_DEVICE_ID,
        simStatus: 'READY',
        smsCapability: 'READY',
        permissionStatus: 'REQUIRED',
        batteryLevel: 98,
        networkType: 'WIFI'
      })
    });
    const body7 = await res7.json();
    assert(res7.status === 200 && body7.ok === true && body7.status === "acknowledged", "correct API key & device ID on heartbeat -> 200 acknowledged");

    // 8. Correct API Key but Wrong Device ID on Heartbeat -> 403
    const res8 = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
        'X-Device-ID': 'imposter-device-02'
      },
      body: JSON.stringify({
        deviceId: 'imposter-device-02',
        simStatus: 'READY'
      })
    });
    assert(res8.status === 403, "wrong device ID on heartbeat -> 403");

    // 9. Public Ping Endpoint -> 200 with Safe Diagnostics (never leaking secret)
    const res9 = await fetch(`${baseUrl}/ping`);
    const body9 = await res9.json();
    assert(
      res9.status === 200 &&
      body9.status === "CONNECTED" &&
      body9.diagnostics.serverApiKeyConfigured === "YES" &&
      body9.diagnostics.serverApiKeyLength === TEST_API_KEY.length &&
      !JSON.stringify(body9).includes(TEST_API_KEY),
      "public ping -> 200 with safe diagnostics without secret leakage"
    );

    // 10. Check Admin status updated from heartbeat telemetry
    const statusData = SmsGatewayService.getStatus();
    assert(
      statusData.device?.deviceId === TEST_DEVICE_ID &&
      statusData.device?.simReady === true &&
      statusData.device?.smsReady === true &&
      statusData.gateway === 'ONLINE',
      "admin telemetry received and updated live status from heartbeat"
    );

    console.log(`\nResults: ${passed} PASSED, ${failed} FAILED\n`);
  } finally {
    server.close();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
