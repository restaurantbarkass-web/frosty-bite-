import dotenv from 'dotenv';
dotenv.config();
import { SmsGatewayService, SmsJob } from '../server/services/smsGateway.service';
import { supabase } from '../server/lib/supabase';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 FROSTY BITE SMS GATEWAY DEDUPLICATION & CLAIM SUITE');
  console.log('====================================================\n');

  // Clean up any stale QUEUED or SENDING test jobs from database
  try {
    await supabase.from('sms_queue').delete().neq('status', 'SENT');
    await supabase.from('app_settings').upsert({ id: 'sms_queue_jobs', value: [] }, { onConflict: 'id' });
  } catch (_) {}

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failedTests++;
    }
  }

  const testOrderId = `FB-TEST-${Date.now()}`;
  const testPhone = '9876543210';

  console.log(`[Test Setup] Testing with simulated order ID: ${testOrderId}`);

  // Test 1: First ORDER_RECEIVED trigger creates exactly 1 job
  console.log('\n--- TEST 1: First ORDER_RECEIVED order event ---');
  const res1 = await SmsGatewayService.handleOrderStatusTransition({
    orderId: testOrderId,
    status: 'pending',
    phone: testPhone,
    customerName: 'Test Customer',
    orderType: 'delivery'
  });

  assert(res1.ok === true && !!res1.job, 'First order-event successfully creates a job');
  assert(res1.duplicate !== true, 'First order-event is not marked duplicate');
  const createdJobId = res1.job?.id;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdJobId || '');
  assert(isUuid === true, 'Job ID is deterministic RFC 4122 UUID matching PostgreSQL UUID PRIMARY KEY');

  // Test 2: Rapid concurrent / duplicate ORDER_RECEIVED triggers for same order
  console.log('\n--- TEST 2: Concurrent duplicate ORDER_RECEIVED events ---');
  const parallelPromises = [
    SmsGatewayService.handleOrderStatusTransition({
      orderId: testOrderId,
      status: 'pending',
      phone: testPhone,
      customerName: 'Test Customer',
      orderType: 'delivery'
    }),
    SmsGatewayService.handleOrderStatusTransition({
      orderId: testOrderId,
      status: 'pending',
      phone: testPhone,
      customerName: 'Test Customer',
      orderType: 'delivery'
    }),
    SmsGatewayService.handleOrderStatusTransition({
      orderId: testOrderId,
      status: 'pending',
      phone: testPhone,
      customerName: 'Test Customer',
      orderType: 'delivery'
    })
  ];

  const parallelResults = await Promise.all(parallelPromises);
  const allDuplicates = parallelResults.every(r => r.duplicate === true || r.skipped === true);
  assert(allDuplicates, 'All subsequent concurrent order events are caught by duplicate/transition guards');

  // Test 3: Polling atomically claims the job
  console.log('\n--- TEST 3: Atomic polling & claiming ---');
  const claimedJobsFirstPoll = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
  const ourClaimedJob = claimedJobsFirstPoll.find(j => j.orderId === testOrderId);

  assert(!!ourClaimedJob, 'First poll claims the pending ORDER_RECEIVED job');
  assert(ourClaimedJob?.status === 'SENDING', "Claimed job status transitioned to 'SENDING'");
  assert(ourClaimedJob?.attempts === 1, 'Claimed job attempts count is 1');
  assert(ourClaimedJob?.claimedBy === 'frosty-sms-gateway-01', "Claimed job deviceId is recorded");

  // Test 4: Second poll immediately after must NOT return the claimed job
  console.log('\n--- TEST 4: Immediate second poll returns 0 instances of the claimed job ---');
  const claimedJobsSecondPoll = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
  const duplicateInSecondPoll = claimedJobsSecondPoll.find(j => j.orderId === testOrderId);

  assert(!duplicateInSecondPoll, 'Second poll returns 0 instances of in-flight SENDING job (NO DUPLICATE DISPATCH)');

  // Test 5: Two simultaneous polls cannot claim the same job
  console.log('\n--- TEST 5: Simultaneous polls concurrency safety ---');
  const testOrderId2 = `FB-TEST2-${Date.now()}`;
  await SmsGatewayService.handleOrderStatusTransition({
    orderId: testOrderId2,
    status: 'pending',
    phone: testPhone,
    customerName: 'Test Customer 2',
    orderType: 'delivery'
  });

  const [simulPoll1, simulPoll2] = await Promise.all([
    SmsGatewayService.claimPendingJobs('device-A'),
    SmsGatewayService.claimPendingJobs('device-B')
  ]);

  const claimedBy1 = simulPoll1.filter(j => j.orderId === testOrderId2);
  const claimedBy2 = simulPoll2.filter(j => j.orderId === testOrderId2);
  const totalClaims = claimedBy1.length + claimedBy2.length;

  assert(totalClaims === 1, `Exactly ONE device claims the job during simultaneous polling (Total claims: ${totalClaims})`);

  // Test 6: Acknowledge job as SENT
  console.log('\n--- TEST 6: Acknowledge job as SENT ---');
  if (ourClaimedJob) {
    const ackRes = await SmsGatewayService.acknowledgeJob(ourClaimedJob.id, 'SENT');
    assert(ackRes.ok === true, 'Acknowledge SENT succeeds');

    // Test 7: Polling after SENT never returns the job
    const pollAfterSent = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
    const sentJobInPoll = pollAfterSent.find(j => j.id === ourClaimedJob.id);
    assert(!sentJobInPoll, 'SENT job is permanently terminal and NEVER returned on subsequent polls');

    // Test 8: Duplicate ACK is idempotent
    const duplicateAck = await SmsGatewayService.acknowledgeJob(ourClaimedJob.id, 'SENT');
    assert(duplicateAck.ok === true, 'Duplicate ACK for SENT job is safely idempotent');
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
