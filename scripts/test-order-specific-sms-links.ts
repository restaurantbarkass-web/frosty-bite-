import dotenv from 'dotenv';
dotenv.config();
import { SmsGatewayService, SmsJob } from '../server/services/smsGateway.service';
import { supabase } from '../server/lib/supabase';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 FROSTY BITE — ORDER-SPECIFIC ORDER HISTORY LINK TEST SUITE');
  console.log('================================================================\n');

  // Clean up any test rows
  try {
    await supabase.from('sms_queue').delete().neq('status', 'SENT');
    await supabase.from('app_settings').upsert({ id: 'sms_queue_jobs', value: [] }, { onConflict: 'id' });
  } catch (_) {}

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      if (details) console.log(`   ${details}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   ${details}`);
      failedTests++;
    }
  }

  const sampleOrderCode = 'FB-RX9WU';
  const expectedUrl = `https://frosty-bite.vercel.app/orders/${sampleOrderCode}`;
  const testPhone = '9876543210';

  console.log(`Testing with target order code: ${sampleOrderCode}`);
  console.log(`Expected order-specific URL: ${expectedUrl}\n`);

  // 1. ORDER_RECEIVED
  console.log('--- TEST 1: ORDER_RECEIVED status ---');
  const resReceived = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'pending',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resReceived.ok === true && !!resReceived.job, 'ORDER_RECEIVED job created');
  assert(resReceived.job?.message.includes(`#${sampleOrderCode}`) === true, 'Contains #FB-RX9WU in message text');
  assert(resReceived.job?.message.includes(expectedUrl) === true, 'Contains exact order-specific URL', resReceived.job?.message);

  // 2. ORDER_ACCEPTED
  console.log('\n--- TEST 2: ORDER_ACCEPTED status ---');
  const resAccepted = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'confirmed',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resAccepted.ok === true && !!resAccepted.job, 'ORDER_ACCEPTED job created');
  assert(resAccepted.job?.message.includes(`#${sampleOrderCode}`) === true, 'Contains #FB-RX9WU in message text');
  assert(resAccepted.job?.message.includes(expectedUrl) === true, 'Contains exact order-specific URL', resAccepted.job?.message);

  // 3. ORDER_PREPARING
  console.log('\n--- TEST 3: ORDER_PREPARING status ---');
  const resPreparing = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'preparing',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resPreparing.ok === true && !!resPreparing.job, 'ORDER_PREPARING job created');
  assert(resPreparing.job?.message.includes(`#${sampleOrderCode}`) === true, 'Contains #FB-RX9WU in message text');
  assert(resPreparing.job?.message.includes(expectedUrl) === true, 'Contains exact order-specific URL', resPreparing.job?.message);

  // 4. OUT_FOR_DELIVERY (Delivery)
  console.log('\n--- TEST 4: OUT_FOR_DELIVERY status (Delivery) ---');
  const resDelivery = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'out_for_delivery',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resDelivery.ok === true && !!resDelivery.job, 'OUT_FOR_DELIVERY job created');
  assert(resDelivery.job?.message.includes('out for delivery') === true, 'Message specifies out for delivery');
  assert(resDelivery.job?.message.includes(expectedUrl) === true, 'Contains exact order-specific URL', resDelivery.job?.message);

  // 5. READY FOR PICKUP (Pickup)
  console.log('\n--- TEST 5: READY FOR PICKUP status (Pickup) ---');
  const pickupOrderId = 'FB-PICKUP-01';
  const pickupUrl = `https://frosty-bite.vercel.app/orders/${pickupOrderId}`;
  const resPickup = await SmsGatewayService.handleOrderStatusTransition({
    orderId: pickupOrderId,
    status: 'ready',
    phone: testPhone,
    orderType: 'pickup'
  });
  assert(resPickup.ok === true && !!resPickup.job, 'READY FOR PICKUP job created');
  assert(resPickup.job?.message.includes('ready for pickup') === true, 'Message specifies ready for pickup');
  assert(resPickup.job?.message.includes(pickupUrl) === true, 'Contains pickup order-specific URL', resPickup.job?.message);

  // 6. ORDER_DELIVERED (Delivery)
  console.log('\n--- TEST 6: ORDER_DELIVERED status (Delivery) ---');
  const resDelivered = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'delivered',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resDelivered.ok === true && !!resDelivered.job, 'ORDER_DELIVERED job created');
  assert(resDelivered.job?.message.includes('has been delivered') === true, 'Message specifies has been delivered');
  assert(resDelivered.job?.message.includes(expectedUrl) === true, 'Contains exact order-specific URL', resDelivered.job?.message);

  // 7. ORDER_DELIVERED (Pickup Completed)
  console.log('\n--- TEST 7: ORDER_DELIVERED status (Pickup completed) ---');
  const resPickupDelivered = await SmsGatewayService.handleOrderStatusTransition({
    orderId: pickupOrderId,
    status: 'delivered',
    phone: testPhone,
    orderType: 'pickup'
  });
  assert(resPickupDelivered.ok === true && !!resPickupDelivered.job, 'ORDER_DELIVERED (Pickup) job created');
  assert(resPickupDelivered.job?.message.includes('picked up successfully') === true, 'Message specifies picked up successfully');
  assert(resPickupDelivered.job?.message.includes(pickupUrl) === true, 'Contains pickup order-specific URL', resPickupDelivered.job?.message);

  // 8. ORDER_CANCELLED
  console.log('\n--- TEST 8: ORDER_CANCELLED status ---');
  const cancelOrderId = 'FB-CANCEL-01';
  const cancelUrl = `https://frosty-bite.vercel.app/orders/${cancelOrderId}`;
  const resCancelled = await SmsGatewayService.handleOrderStatusTransition({
    orderId: cancelOrderId,
    status: 'cancelled',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resCancelled.ok === true && !!resCancelled.job, 'ORDER_CANCELLED job created');
  assert(resCancelled.job?.message.includes('has been cancelled successfully') === true, 'Message specifies has been cancelled');
  assert(resCancelled.job?.message.includes(cancelUrl) === true, 'Contains exact order-specific URL', resCancelled.job?.message);

  // 9. Deduplication check: Retrying the same status must NOT create new job
  console.log('\n--- TEST 9: Deduplication preservation ---');
  const resDuplicate = await SmsGatewayService.handleOrderStatusTransition({
    orderId: sampleOrderCode,
    status: 'pending',
    phone: testPhone,
    orderType: 'delivery'
  });
  assert(resDuplicate.duplicate === true || resDuplicate.skipped === true, 'Duplicate transition correctly skipped / marked duplicate');

  // 10. Polling atomic claim
  console.log('\n--- TEST 10: Polling atomic claim ---');
  const claimedJobs = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
  assert(claimedJobs.length > 0, `Successfully claimed batch of ${claimedJobs.length} jobs`);
  assert(claimedJobs.every(j => j.status === 'SENDING'), 'All claimed jobs transitioned to SENDING');

  // 11. Subsequent poll returns 0 instances of in-flight jobs
  console.log('\n--- TEST 11: In-flight lock on subsequent poll ---');
  const secondPoll = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
  const inFlightOverlap = secondPoll.filter(j => claimedJobs.some(cj => cj.id === j.id));
  assert(inFlightOverlap.length === 0, 'No overlapping in-flight jobs returned on immediate second poll');

  // 12. Acknowledge and terminal SENT exclusion
  console.log('\n--- TEST 12: Acknowledge SENT and verify exclusion ---');
  const firstClaimed = claimedJobs[0];
  await SmsGatewayService.acknowledgeJob(firstClaimed.id, 'SENT');
  const thirdPoll = await SmsGatewayService.claimPendingJobs('frosty-sms-gateway-01');
  const sentInPoll = thirdPoll.find(j => j.id === firstClaimed.id);
  assert(!sentInPoll, 'SENT job is terminal and never returned on subsequent polls');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
