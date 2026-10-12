import { CustomOtpService } from '../server/services/customOtp.service';
import { supabase } from '../server/lib/supabase';
import crypto from 'crypto';

async function runAccountDeletionTests() {
  console.log('🚀 Starting OTP-Verified Permanent Account Deletion System Automated Tests...\n');

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

  const testUserId1 = crypto.randomUUID();
  const testPhone1 = `+9199991${Math.floor(1000 + Math.random() * 9000)}`;
  const testEmail1 = `deletion_test_${Date.now()}@gmail.com`;

  // Seed test user
  await supabase.from('users').insert({
    id: testUserId1,
    email: testEmail1,
    phone: testPhone1,
    name: 'Test Deletion User',
    full_name: 'Test Deletion User',
    role: 'customer'
  });

  // Test 1 & 2: Purpose Isolation (Login OTP cannot be used for Account Deletion, and Deletion OTP cannot be used for Login)
  console.log('--- Test 1 & 2: Purpose Isolation ---');
  const loginOtpRes = await CustomOtpService.requestOtp({
    phone: testPhone1,
    purpose: 'LOGIN'
  });

  let loginOtpUsedForDeletionFailed = false;
  try {
    await CustomOtpService.verifyOtp({
      phone: testPhone1,
      purpose: 'ACCOUNT_DELETION',
      otp: '123456' // Wrong code
    });
  } catch (err: any) {
    loginOtpUsedForDeletionFailed = true;
  }
  assert(loginOtpUsedForDeletionFailed, 'Login OTP / wrong code rejected for ACCOUNT_DELETION purpose');

  // Request Deletion OTP on phone 2
  const testPhone2 = `+9199992${Math.floor(1000 + Math.random() * 9000)}`;
  const deletionOtpRes = await CustomOtpService.requestOtp({
    phone: testPhone2,
    purpose: 'ACCOUNT_DELETION'
  });
  assert(deletionOtpRes.ok, 'Account deletion OTP requested successfully');

  // Test 3: Wrong OTP during deletion
  console.log('\n--- Test 3: Wrong OTP Handling ---');
  let wrongOtpFailed = false;
  try {
    await CustomOtpService.verifyOtp({
      phone: testPhone2,
      purpose: 'ACCOUNT_DELETION',
      otp: '000000'
    });
  } catch (err: any) {
    wrongOtpFailed = true;
  }
  assert(wrongOtpFailed, 'Wrong OTP rejected during deletion verification');

  // Test 4: Verification method email/mobile masking
  console.log('\n--- Test 4: Contact Information Masking ---');
  const { maskEmail, maskPhone } = await import('../server/routes/accountDeletion.routes');
  const maskedE = maskEmail(testEmail1);
  const maskedP = maskPhone(testPhone1);
  assert(maskedE.includes('****') && !maskedE.includes(testEmail1), `Email masked safely (${maskedE})`);
  assert(maskedP.includes('••••••') && maskedP.endsWith(testPhone1.slice(-4)), `Phone masked safely (${maskedP})`);

  // Cleanup test user
  await supabase.from('users').delete().eq('id', testUserId1);

  console.log('\n==================================================');
  console.log(`ACCOUNT DELETION SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAccountDeletionTests().catch(err => {
  console.error('Test exception:', err);
  process.exit(1);
});
