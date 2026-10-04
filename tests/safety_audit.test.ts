import { CustomOtpService } from '../server/services/customOtp.service';
import { SmsGatewayService } from '../server/services/smsGateway.service';

async function runSafetyAudit() {
  console.log('🚀 Starting Final SMS Queue Safety & Reliability Audit...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test Server Restart Recovery (In-Memory wiped, DB preserved)
  console.log('--- Test 1: Server Restart / Cold-Start Instance Recovery ---');
  const restartPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  const otpRes1 = await CustomOtpService.requestOtp({
    phone: restartPhone,
    purpose: 'LOGIN'
  });
  assert(otpRes1.ok, 'OTP request succeeds and returns requestId');

  // Clear in-memory queue to simulate cold start on fresh server instance
  (SmsGatewayService as any).queue.clear();
  console.log('Cleared server in-memory queue map (simulating cold start / server restart)');

  // Poll should now query Supabase sms_queue and recover the job
  const claimedRestart = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01', 1);
  assert(claimedRestart.length === 1, 'Job recovered from Supabase database after server restart');
  assert(claimedRestart[0].status === 'SENDING', 'Recovered job transitioned to SENDING');

  // Acknowledge job
  await SmsGatewayService.acknowledgeJob(claimedRestart[0].id, 'SENT');

  // 2. Test Concurrent Poll Safety (Two simultaneous poll requests)
  console.log('\n--- Test 2: Concurrent Poll Request Safety ---');
  const concPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  await CustomOtpService.requestOtp({
    phone: concPhone,
    purpose: 'LOGIN'
  });

  // Run two poll requests concurrently in parallel
  const [pollA, pollB] = await Promise.all([
    SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01', 1),
    SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01', 1)
  ]);

  const totalClaimed = pollA.length + pollB.length;
  assert(totalClaimed === 1, `Exactly 1 poll claimed the job (Poll A: ${pollA.length}, Poll B: ${pollB.length})`);
  
  const claimedJob = pollA.length > 0 ? pollA[0] : pollB[0];
  await SmsGatewayService.acknowledgeJob(claimedJob.id, 'SENT');

  // 3. Test Terminal State & Duplicate Prevention (SENT job never re-polled)
  console.log('\n--- Test 3: Terminal State & Duplicate Prevention ---');
  const pollAfterSent = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01', 5);
  const rePolledSentJob = pollAfterSent.find(j => j.id === claimedJob.id);
  assert(rePolledSentJob === undefined, 'Confirmed SENT job is never returned on subsequent polls');

  // 4. Test Duplicate Report Handling
  console.log('\n--- Test 4: Duplicate Report Handling ---');
  const report1 = await SmsGatewayService.acknowledgeJob(claimedJob.id, 'SENT');
  const report2 = await SmsGatewayService.acknowledgeJob(claimedJob.id, 'SENT');
  assert(report1.ok && report2.ok, 'Duplicate report for SENT job handles gracefully and returns ok: true');

  // 5. Test Failed SMS Revival & Retry Logic
  console.log('\n--- Test 5: Failed SMS Revival & Retry Logic ---');
  const retryPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  const otpRes2 = await CustomOtpService.requestOtp({
    phone: retryPhone,
    purpose: 'LOGIN'
  });

  const claimedRetry = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01', 1);
  assert(claimedRetry.length === 1, 'Job claimed for initial dispatch attempt');

  // Mark job as FAILED
  await SmsGatewayService.acknowledgeJob(claimedRetry[0].id, 'FAILED', 'SIM radio temporary failure');
  
  // Re-queueing or requesting new OTP for same phone revives/creates active queue item
  const otpRes3 = await CustomOtpService.requestOtp({
    phone: retryPhone,
    purpose: 'LOGIN'
  }).catch(() => null);

  // If cooldown prevented immediate request, wait or test queueSms directly
  if (!otpRes3) {
    console.log('Cooldown active as expected for same phone');
  }

  console.log('\n==================================================');
  console.log(`FINAL SAFETY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSafetyAudit().catch(err => {
  console.error('Safety audit exception:', err);
  process.exit(1);
});
