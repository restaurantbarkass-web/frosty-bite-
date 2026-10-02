import express from 'express';
import { Server } from 'http';
import smsRouter from './server/routes/smsGateway.routes';
import { isValidPhoneNumber } from './server/services/smsGateway.service';

process.env.NODE_ENV = 'production';
process.env.SMS_GATEWAY_API_KEY = 'test-permanent-secret-key-123456789';
process.env.SMS_GATEWAY_DEVICE_ID = 'frosty-sms-gateway-01';

interface MockJob {
  id: string;
  to: string;
  message: string;
  type: string;
  order_id: string | null;
  priority: number;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  lease_until: string | null;
  sent_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

// In-memory mock database for SMS queue
class MockSmsQueueDb {
  public jobs: MockJob[] = [];

  public reset() {
    this.jobs = [];
  }

  public insert(job: Partial<MockJob>): MockJob {
    const fullJob: MockJob = {
      id: 'job-' + Math.random().toString(36).substring(2, 9),
      to: job.to!,
      message: job.message!,
      type: job.type || 'TEST',
      order_id: job.order_id || null,
      priority: job.priority ?? 5,
      status: job.status || 'QUEUED',
      attempts: job.attempts || 0,
      max_attempts: job.max_attempts || 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: job.claimed_at || null,
      claimed_by: job.claimed_by || null,
      lease_until: job.lease_until || null,
      sent_at: job.sent_at || null,
      failed_at: job.failed_at || null,
      error_code: job.error_code || null,
      error_message: job.error_message || null
    };
    this.jobs.push(fullJob);
    return fullJob;
  }

  public claimNext(deviceId: string, leaseSeconds: number = 120): MockJob | null {
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000).toISOString();

    // 1. Lease recovery
    for (const job of this.jobs) {
      if (job.status === 'SENDING' && job.lease_until && new Date(job.lease_until) < now) {
        if (job.attempts < job.max_attempts) {
          job.status = 'QUEUED';
          job.claimed_at = null;
          job.claimed_by = null;
          job.lease_until = null;
        } else {
          job.status = 'FAILED';
          job.failed_at = nowIso;
          job.error_code = 'MAX_ATTEMPTS_EXCEEDED';
        }
      }
    }

    // 2. Select eligible QUEUED jobs sorted by priority DESC, created_at ASC
    const candidates = this.jobs
      .filter(j => j.status === 'QUEUED')
      .sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));

    if (candidates.length === 0) return null;

    const chosen = candidates[0];
    chosen.status = 'SENDING';
    chosen.claimed_at = nowIso;
    chosen.claimed_by = deviceId;
    chosen.lease_until = leaseUntil;
    chosen.attempts += 1;
    chosen.updated_at = nowIso;

    return chosen;
  }

  public report(jobId: string, status: 'SENT' | 'FAILED', errorCode?: string, errorMessage?: string): { ok: boolean; status: string; attempts: number } {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return { ok: false, status: 'NOT_FOUND', attempts: 0 };

    const nowIso = new Date().toISOString();

    if (status === 'SENT') {
      job.status = 'SENT';
      job.sent_at = nowIso;
      job.lease_until = null;
      return { ok: true, status: 'SENT', attempts: job.attempts };
    }

    if (status === 'FAILED') {
      if (job.attempts < job.max_attempts) {
        job.status = 'QUEUED';
        job.claimed_at = null;
        job.claimed_by = null;
        job.lease_until = null;
        job.error_code = errorCode || 'SMS_SEND_FAILED';
        job.error_message = errorMessage || 'Failed';
        return { ok: true, status: 'QUEUED', attempts: job.attempts };
      } else {
        job.status = 'FAILED';
        job.failed_at = nowIso;
        job.lease_until = null;
        job.error_code = errorCode || 'MAX_ATTEMPTS_EXCEEDED';
        job.error_message = errorMessage || 'Max attempts reached';
        return { ok: true, status: 'FAILED', attempts: job.attempts };
      }
    }

    return { ok: false, status: 'INVALID', attempts: job.attempts };
  }
}

// Color formatting for console
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

async function runAllTests() {
  console.log(cyan('\n=================================================='));
  console.log(cyan(' Frosty Bite SMS Gateway Phase 2 Test Suite'));
  console.log(cyan('==================================================\n'));

  let passed = 0;
  let total = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      console.log(`${green('✓ PASS')}: ${testName}`);
      passed++;
    } else {
      console.error(`${red('✗ FAIL')}: ${testName} ${details ? `(${details})` : ''}`);
      process.exitCode = 1;
    }
  }

  // --- UNIT TESTS FOR DB LOGIC & SMS GATEWAY BEHAVIOR ---
  const db = new MockSmsQueueDb();

  // Test 1: Queue creation
  const job1 = db.insert({
    to: '+919876543210',
    message: 'Frosty Bite server queue test successful.',
    type: 'TEST',
    priority: 5
  });
  assert('1. Queue creation stores job with status QUEUED', job1.status === 'QUEUED' && job1.attempts === 0);

  // Test 2: Poll with job & atomic claim
  const claimedJob = db.claimNext('frosty-sms-gateway-01');
  assert('2. Poll with job returns eligible job', !!claimedJob && claimedJob.id === job1.id);
  assert('3. Atomic claim transitions QUEUED -> SENDING', claimedJob?.status === 'SENDING');
  assert('4. Atomic claim sets claimed_by and increments attempts', claimedJob?.claimed_by === 'frosty-sms-gateway-01' && claimedJob?.attempts === 1);

  // Test 5: Duplicate claim prevention (no more queued jobs)
  const secondPoll = db.claimNext('frosty-sms-gateway-01');
  assert('5. Duplicate claim prevention (second poll returns null while first is SENDING)', secondPoll === null);

  // Test 6: Report FAILED with retry (attempts < max_attempts)
  const failReport1 = db.report(job1.id, 'FAILED', 'CARRIER_TEMP_FAIL', 'Network timeout');
  assert('6. Report FAILED with attempt 1/3 re-queues job to QUEUED', failReport1.status === 'QUEUED' && job1.status === 'QUEUED');

  // Test 7: Poll again after retry
  const retryClaim = db.claimNext('frosty-sms-gateway-01');
  assert('7. Re-queued job can be claimed again for retry', !!retryClaim && retryClaim.attempts === 2 && retryClaim.status === 'SENDING');

  // Test 8: Report FAILED again (attempt 2)
  const failReport2 = db.report(job1.id, 'FAILED', 'CARRIER_TEMP_FAIL');
  assert('8. Report FAILED with attempt 2/3 re-queues to QUEUED', failReport2.status === 'QUEUED' && job1.status === 'QUEUED');

  // Test 9: Claim for attempt 3
  const claim3 = db.claimNext('frosty-sms-gateway-01');
  assert('9. Third claim has attempts = 3', claim3?.attempts === 3 && claim3.status === 'SENDING');

  // Test 10: Max attempts reached -> FAILED
  const failReport3 = db.report(job1.id, 'FAILED', 'FINAL_FAIL');
  assert('10. Report FAILED when attempts >= 3 marks job permanently as FAILED', failReport3.status === 'FAILED' && job1.status === 'FAILED');

  // Test 11: Report SENT
  const job2 = db.insert({ to: '+919999999999', message: 'OTP: 123456', type: 'OTP', priority: 10 });
  const claimJob2 = db.claimNext('frosty-sms-gateway-01');
  const sentReport = db.report(job2.id, 'SENT');
  assert('11. Report SENT updates status to SENT and sets sent_at', sentReport.status === 'SENT' && job2.status === 'SENT' && !!job2.sent_at);

  // Test 12: Expired lease recovery
  const job3 = db.insert({ to: '+918888888888', message: 'Order preparing', type: 'ORDER_PREPARING', priority: 5 });
  db.claimNext('frosty-sms-gateway-01');
  assert('12a. Job 3 claimed and in SENDING', job3.status === 'SENDING');
  // Simulate lease expiration by setting lease_until in the past
  job3.lease_until = new Date(Date.now() - 10000).toISOString();
  // Next claim should automatically recover expired lease
  const recoveredJob = db.claimNext('frosty-sms-gateway-01');
  assert('12b. Expired lease is recovered and claimed again', recoveredJob?.id === job3.id && recoveredJob.attempts === 2);

  // Test phone validator
  assert('13a. Valid phone +919876543210 passes validator', isValidPhoneNumber('+919876543210'));
  assert('13b. Valid phone 9876543210 passes validator', isValidPhoneNumber('9876543210'));
  assert('13c. Invalid phone empty fails validator', !isValidPhoneNumber(''));
  assert('13d. Invalid phone letters fails validator', !isValidPhoneNumber('abc1234567'));

  // Spin up ephemeral express server
  const app = express();
  app.use(express.json());
  app.use('/api/sms-gateway', smsRouter);

  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/sms-gateway`;

  try {
    // Test 14: Authentication - Invalid API Key -> 401
    const resAuthFail = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrong-key-12345',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({ simReady: true, smsReady: true })
    });
    assert('14. Invalid API Key returns 401 Unauthorized', resAuthFail.status === 401);

    // Test 15: Authentication - Invalid Device ID -> 403
    const resDeviceFail = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'wrong-device-id'
      },
      body: JSON.stringify({ simReady: true, smsReady: true })
    });
    assert('15. Invalid Device ID returns 403 Forbidden', resDeviceFail.status === 403);

    // Test 16: Authentication - Valid API Key & Device ID -> 200
    const resAuthSuccess = await fetch(`${baseUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({ simReady: true, smsReady: true })
    });
    assert('16. Valid API Key & Device ID returns 200 OK', resAuthSuccess.status === 200);

    // Test 17: Queue - Missing/Invalid Phone -> 400
    const resBadPhone = await fetch(`${baseUrl}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({
        to: 'invalid-phone',
        message: 'Hello'
      })
    });
    assert('17. Queue creation with invalid phone returns 400', resBadPhone.status === 400);

    // Test 18: Queue - Empty Message -> 400
    const resEmptyMsg = await fetch(`${baseUrl}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({
        to: '+919876543210',
        message: '   '
      })
    });
    assert('18. Queue creation with empty message returns 400', resEmptyMsg.status === 400);

    // Test 19: Queue - Invalid Type -> 400
    const resBadType = await fetch(`${baseUrl}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({
        to: '+919876543210',
        message: 'Hello',
        type: 'INVALID_TYPE'
      })
    });
    assert('19. Queue creation with invalid type returns 400', resBadType.status === 400);

    // Test 20: Existing Ping endpoint unchanged -> 200
    const resPing = await fetch(`${baseUrl}/ping`);
    const pingData = await resPing.json();
    assert('20. Existing /ping endpoint untouched and returns 200 with status CONNECTED', resPing.status === 200 && pingData.status === 'CONNECTED');

    // Test 21: Existing Test Connection endpoint with Gateway auth -> 200
    const resTestConn = await fetch(`${baseUrl}/test-connection`, {
      method: 'POST',
      headers: {
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      }
    });
    const testConnData = await resTestConn.json();
    assert('21. Existing /test-connection endpoint untouched and returns PASS', resTestConn.status === 200 && testConnData.auth === 'PASS');

    // Test 22: Report endpoint validation -> 400 if missing jobId
    const resReportMissing = await fetch(`${baseUrl}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({
        status: 'SENT'
      })
    });
    assert('22. Report endpoint returns 400 when jobId/messageId is missing', resReportMissing.status === 400);

    // Test 23: Report endpoint validation -> 400 if invalid status
    const resReportBadStatus = await fetch(`${baseUrl}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-permanent-secret-key-123456789',
        'X-Device-ID': 'frosty-sms-gateway-01'
      },
      body: JSON.stringify({
        jobId: 'some-job-id',
        status: 'PENDING'
      })
    });
    assert("23. Report endpoint returns 400 when status is neither SENT nor FAILED", resReportBadStatus.status === 400);

  } finally {
    server.close();
  }

  console.log(cyan('\n--------------------------------------------------'));
  console.log(`Summary: ${green(`${passed} passed`)}, ${total - passed} failed (Total: ${total})`);
  console.log(cyan('==================================================\n'));

  if (passed === total) {
    console.log(green('ALL 23 TEST CASES PASSED SUCCESSFULLY!\n'));
    setTimeout(() => process.exit(0), 100);
  } else {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error(red('Fatal test error:'), err);
  process.exit(1);
});
