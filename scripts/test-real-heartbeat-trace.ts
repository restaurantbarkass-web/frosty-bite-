import { SmsGatewayService } from '../server/services/smsGateway.service';
import { supabase } from '../server/lib/supabase';

async function runHeartbeatTrace() {
  console.log('=== STARTING REAL ANDROID HEARTBEAT TRACE TEST ===\n');

  // Step 1: Prepare authentic Android Gateway heartbeat payload
  const incomingAndroidPayload = {
    deviceId: 'frosty-sms-gateway-01',
    status: 'READY',
    simReady: true,
    smsReady: true,
    permissionGranted: true,
    batteryLevel: 88,
    networkType: 'LTE / 4G (Airtel)',
    signalStrength: 'Excellent (-75 dBm)',
    simOperator: 'Airtel Active SIM',
    appVersion: '1.2.0'
  };

  const incomingHeaders = {
    'x-device-id': 'frosty-sms-gateway-01',
    'x-api-key': process.env.SMS_GATEWAY_API_KEY || 'default-dev-key'
  };

  console.log('[Android Phone Simulation] 🚀 Dispatching Foreground Service Heartbeat...');
  console.log('Endpoint: POST /api/sms-gateway/heartbeat');
  console.log('Device ID:', incomingAndroidPayload.deviceId);

  // Step 2: Process heartbeat on server
  const clientIp = '49.36.120.45'; // Simulated physical device IP
  const heartbeatResult = await SmsGatewayService.processHeartbeat(
    incomingAndroidPayload,
    clientIp,
    incomingHeaders
  );

  console.log('\n[Server Response Received by Android]:', heartbeatResult);

  if (!heartbeatResult.ok) {
    console.error('❌ Heartbeat processing failed!');
    process.exit(1);
  }

  // Step 3: Test persistent database storage (app_settings and sms_gateway_state)
  console.log('\n[Database Verification] Checking Supabase persistent store...');
  const { data: settingRow, error: settingErr } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'sms_gateway_state')
    .maybeSingle();

  if (settingErr) {
    console.warn('Note: app_settings query notice:', settingErr.message);
  } else if (settingRow?.value) {
    console.log('✅ Persisted to Supabase app_settings table successfully:');
    console.log('  - deviceId:', settingRow.value.deviceId);
    console.log('  - gatewayStatus:', settingRow.value.gatewayStatus);
    console.log('  - lastHeartbeat:', settingRow.value.lastHeartbeat);
    console.log('  - batteryLevel:', settingRow.value.batteryLevel);
  }

  // Step 4: Simulate a fresh Serverless instance calling getStatus()
  console.log('\n[Admin Status Verification] Hydrating getStatus() on serverless endpoint...');
  const adminStatus = await SmsGatewayService.getStatus();

  console.log('Admin Status Result:');
  console.log('  - Server Status:', adminStatus.server);
  console.log('  - Gateway Status:', adminStatus.gateway);
  console.log('  - Last Heartbeat:', adminStatus.lastHeartbeat);
  console.log('  - Age Seconds:', adminStatus.lastHeartbeatAgeSeconds, 'sec');
  console.log('  - Heartbeat Count:', adminStatus.heartbeatCount);
  console.log('  - Device Telemetry:', adminStatus.device?.deviceId, `(SIM: ${adminStatus.device?.simReady ? 'READY' : 'ERROR'})`);

  if (adminStatus.gateway === 'ONLINE' && adminStatus.lastHeartbeat !== null) {
    console.log('\n🎉 ALL HEARTBEAT CHECKS PASSED: Gateway evaluates to ONLINE with real timestamp!');
  } else {
    console.error('❌ Gateway status did not evaluate to ONLINE.');
    process.exit(1);
  }
}

runHeartbeatTrace().catch(err => {
  console.error('Trace error:', err);
  process.exit(1);
});
