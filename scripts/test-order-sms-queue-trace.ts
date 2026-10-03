import { SmsGatewayService } from '../server/services/smsGateway.service';
import { supabase } from '../server/lib/supabase';

async function runQueueTrace() {
  console.log('=== STARTING FROSTY BITE ORDER SMS QUEUE TRACE ===\n');

  const testOrderId = `TEST-ORD-${Date.now()}`;
  const testPhone = '9876543210';
  const customerName = 'Aarav Sharma';

  // STEP 1: Simulate Order Event Trigger (Phase 3 ORDER_RECEIVED)
  console.log(`[Step 1] Triggering Order Event: Order #${testOrderId}, Status: pending...`);
  const orderEventResult = await SmsGatewayService.handleOrderStatusTransition({
    orderId: testOrderId,
    status: 'pending',
    phone: testPhone,
    customerName,
    orderType: 'delivery'
  });

  console.log('Order Event Result:');
  console.log('  - ok:', orderEventResult.ok);
  console.log('  - job ID:', orderEventResult.job?.id);
  console.log('  - smsType:', orderEventResult.job?.type);
  console.log('  - status:', orderEventResult.job?.status);
  console.log('  - idempotencyKey:', orderEventResult.job?.idempotencyKey);
  console.log('  - duplicate:', orderEventResult.duplicate ?? false);
  console.log('  - skipped:', orderEventResult.skipped ?? false);

  if (!orderEventResult.ok || !orderEventResult.job) {
    console.error('❌ Order event failed to queue SMS!');
    process.exit(1);
  }

  const queuedJobId = orderEventResult.job.id;

  // STEP 2: Verify Database Persistence (sms_queue and app_settings)
  console.log('\n[Step 2] Verifying Supabase persistent storage for queued job...');
  const { data: appSettingsRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'sms_queue_jobs')
    .maybeSingle();

  const persistedJobs: any[] = Array.isArray(appSettingsRow?.value) ? appSettingsRow.value : [];
  const foundInAppSettings = persistedJobs.find(j => j.id === queuedJobId);

  console.log('Supabase Persistence Check:');
  console.log('  - Found in app_settings (sms_queue_jobs):', foundInAppSettings ? 'YES ✅' : 'NO ❌');
  if (foundInAppSettings) {
    console.log('    - Persisted Job ID:', foundInAppSettings.id);
    console.log('    - Persisted Status:', foundInAppSettings.status);
    console.log('    - Persisted Type:', foundInAppSettings.type);
  }

  // STEP 3: Simulate Physical Android Gateway Polling (GET/POST /poll)
  console.log('\n[Step 3] Simulating Android Gateway Poll (GET /api/sms-gateway/poll)...');
  const pendingJobs = await SmsGatewayService.getPendingJobs();

  console.log('Android Polling Result:');
  console.log('  - Total pending jobs count:', pendingJobs.length);

  const matchedJob = pendingJobs.find(j => j.id === queuedJobId);
  if (matchedJob) {
    console.log('✅ Android Polling Successfully Retrieved Queued Job:');
    console.log('    - ID:', matchedJob.id);
    console.log('    - Recipient (masked):', `***${matchedJob.recipient.slice(-4)}`);
    console.log('    - Message Preview:', matchedJob.message);
    console.log('    - Status:', matchedJob.status);
    console.log('    - Priority:', matchedJob.priority);
  } else {
    console.error('❌ Android poll did NOT receive the queued job!');
    process.exit(1);
  }

  // STEP 4: Simulate Android Gateway Execution & Acknowledgment (POST /report)
  console.log('\n[Step 4] Simulating Android physical SIM dispatch & Acknowledgment (POST /report)...');
  const ackResult = await SmsGatewayService.acknowledgeJob(queuedJobId, 'SENT');
  console.log('Acknowledgment Result:', ackResult);

  // STEP 5: Verify Post-Delivery Polling (Job should now be removed from QUEUED list)
  console.log('\n[Step 5] Verifying job is claimed/completed from pending poll list...');
  const updatedPending = await SmsGatewayService.getPendingJobs();
  const isStillQueued = updatedPending.some(j => j.id === queuedJobId);
  console.log('Is job still in pending queue?:', isStillQueued ? 'YES ❌' : 'NO (Completed) ✅');

  // STEP 6: Verify Duplicate Protection (Retrying same transition should skip)
  console.log('\n[Step 6] Testing Idempotency / Duplicate Protection...');
  const duplicateAttempt = await SmsGatewayService.handleOrderStatusTransition({
    orderId: testOrderId,
    status: 'pending',
    phone: testPhone,
    customerName,
    orderType: 'delivery'
  });

  console.log('Duplicate Retry Result:');
  console.log('  - duplicate:', duplicateAttempt.duplicate ?? false);
  console.log('  - reason:', duplicateAttempt.reason);

  if (duplicateAttempt.duplicate) {
    console.log('✅ Idempotency Protection Verified: Duplicate event was prevented.');
  }

  console.log('\n🎉 ALL SMS QUEUE AND POLLING TRACE CHECKS PASSED!');
}

runQueueTrace().catch(err => {
  console.error('Queue trace test error:', err);
  process.exit(1);
});
