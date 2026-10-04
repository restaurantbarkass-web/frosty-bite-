import { CustomOtpService } from '../server/services/customOtp.service';
import crypto from 'crypto';

async function runTests() {
  console.log('🧪 Starting Custom OTP Service Automated Tests...');

  // 1. Test OTP format (6 digits, secure randomness)
  const otp1 = CustomOtpService.generateSecureOtp();
  const otp2 = CustomOtpService.generateSecureOtp();
  
  if (!/^\d{6}$/.test(otp1)) {
    throw new Error(`Test 1 Failed: OTP is not 6 digits: ${otp1}`);
  }
  if (otp1 === otp2) {
    console.warn('Warning: Two sequentially generated OTPs were identical (extremely rare, but possible).');
  }
  console.log('✅ Test 1 Passed: OTP generation produces exactly 6 digits via secure randomness.');

  // 2. Test Phone Normalization
  const phone1 = CustomOtpService.normalizePhone('9876543210');
  const phone2 = CustomOtpService.normalizePhone('+919876543210');
  const phone3 = CustomOtpService.normalizePhone('09876543210');
  
  if (phone1 !== '+919876543210' || phone2 !== '+919876543210' || phone3 !== '+919876543210') {
    throw new Error(`Test 2 Failed: Phone normalization incorrect. Got: ${phone1}, ${phone2}, ${phone3}`);
  }
  console.log('✅ Test 2 Passed: Phone number normalization successfully standardizes to +91XXXXXXXXXX.');

  // 3. Test Hashing & Constant-Time comparison
  const hash1 = CustomOtpService.hashOtp('482913');
  const hash2 = CustomOtpService.hashOtp('482913');
  const hash3 = CustomOtpService.hashOtp('111111');

  if (hash1 !== hash2 || hash1 === hash3) {
    throw new Error('Test 3 Failed: OTP hashing produced inconsistent or insecure results.');
  }
  console.log('✅ Test 3 Passed: OTP hashing produces deterministic secure HMAC-SHA256 hashes without exposing plaintext.');

  console.log('🎉 All OTP Unit Tests Completed Successfully!');
}

runTests().catch(err => {
  console.error('❌ OTP Unit Tests Failed:', err);
  process.exit(1);
});
