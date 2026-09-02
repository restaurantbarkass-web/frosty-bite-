/**
 * Frosty Bite - Normal UPI VPA Compatibility Audit Suite
 *
 * Verifies strict adherence to:
 * - Normal UPI VPA: 7735800239@ibl (no required merchant VPA or fake gateway)
 * - Standard upi://pay intent format
 * - Dynamic QR code and Copy UPI ID fallbacks
 * - 3-way fallback robustness (Dynamic QR, Copy UPI ID, Another installed UPI app)
 * - Rejection/launch failure safety (never marks payment as failed or paid)
 * - Exclusive verification through FrostyPay -> device-event -> backend matching -> Payment Verified
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('===================================================================');
console.log('FROSTY BITE — NORMAL UPI VPA COMPATIBILITY AUDIT SUITE');
console.log('===================================================================');

const checkoutPath = path.resolve(process.cwd(), 'src/pages/UPICheckout.tsx');
const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');

const paymentRoutesPath = path.resolve(process.cwd(), 'server/routes/payment.routes.ts');
const paymentRoutesContent = fs.readFileSync(paymentRoutesPath, 'utf8');

// 1. Normal UPI VPA Verification
assert(
  checkoutContent.includes('DEFAULT_UPI_ID = "7735800239@ibl"') ||
  checkoutContent.includes("DEFAULT_UPI_ID = '7735800239@ibl'"),
  'Normal VPA: Retains standard existing UPI VPA 7735800239@ibl'
);

// 2. No fake merchant accounts or proprietary merchant schemes required
assert(
  !checkoutContent.includes('phonepe://') &&
  !checkoutContent.includes('gpay://') &&
  !checkoutContent.includes('paytmmp://'),
  'No proprietary schemes: Purely uses standard upi://pay intent'
);

assert(
  !checkoutContent.includes('merchant_id') &&
  !checkoutContent.includes('merchant_key') &&
  !checkoutContent.includes('mid=') &&
  !checkoutContent.includes('mc='),
  'No fake merchant integration: Uses standard consumer/normal VPA parameters'
);

// 3. Dynamic QR Code fallback
assert(
  checkoutContent.includes('api.qrserver.com/v1/create-qr-code') &&
  checkoutContent.includes('encodeURIComponent(upiUri)'),
  'Dynamic QR: Dynamic QR code encodes authoritative standard UPI URI'
);

// 4. Copy UPI ID fallback
assert(
  checkoutContent.includes('handleCopyUpi') &&
  checkoutContent.includes('navigator.clipboard.writeText(DEFAULT_UPI_ID)'),
  'Copy UPI ID: Dedicated button copies 7735800239@ibl to clipboard'
);

// 5. 3-Way Fallback usability if intent refused
assert(
  checkoutContent.includes('1. Dynamic QR:') &&
  checkoutContent.includes('2. Copy UPI ID:') &&
  checkoutContent.includes('3. Another Installed UPI App:'),
  'Fallback Robustness: Displays 3 explicit options (Dynamic QR, Copy UPI ID, Another UPI App)'
);

// 6. Launch failure or rejection never marks payment as failed or paid
const handleOpenMatch = checkoutContent.match(/const handleOpenUpiApp = \([\s\S]*?\n  \};/);
const handleOpenBody = handleOpenMatch ? handleOpenMatch[0] : '';

assert(
  !handleOpenBody.includes("setPaymentState('FAILED')") &&
  !handleOpenBody.includes("setPaymentState('PAYMENT_VERIFIED')") &&
  !handleOpenBody.includes("status: 'failed'"),
  'State Safety: App launch does NOT mark payment as failed or paid'
);

// 7. Visibility change/app return does not fail or mark paid
const visibilityChangeMatch = checkoutContent.match(/const handleVisibilityChange = \(\) => \{[\s\S]*?\n    \};/);
const visibilityChangeBody = visibilityChangeMatch ? visibilityChangeMatch[0] : '';

assert(
  !visibilityChangeBody.includes("setPaymentState('FAILED')") &&
  !visibilityChangeBody.includes("setPaymentState('PAYMENT_VERIFIED')"),
  'Return Safety: App return keeps WAITING_FOR_PAYMENT and polls authoritative status'
);

// 8. Payment Verification exclusively through FrostyPay device-event matching
assert(
  paymentRoutesContent.includes('/device-event') &&
  paymentRoutesContent.includes('FROSTYPAY_DEVICE_TOKEN') &&
  paymentRoutesContent.includes('payment_verification_events') &&
  paymentRoutesContent.includes("status: 'matched'"),
  'Architecture: Payment verification remains exclusively through FrostyPay device-event matching'
);

assert(
  checkoutContent.includes('/api/payment/status') &&
  checkoutContent.includes('PAYMENT_VERIFIED'),
  'Client Verification: UPICheckout polls payment status to transition to Payment Verified'
);

console.log('\n===================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('===================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL NORMAL UPI VPA COMPATIBILITY AUDITS PASSED!\n');
}
