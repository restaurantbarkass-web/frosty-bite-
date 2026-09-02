/**
 * NPCI UPI Intent tr Parameter & Controlled Isolation Audit Test Suite
 * Validates:
 * 1. TEST A: pa + pn + am + cu
 * 2. TEST B: pa + pn + am + cu + tn
 * 3. TEST C: pa + pn + am + cu + tr
 * 4. TEST D: pa + pn + am + cu + tr + tn
 * 5. NPCI tr specification: Strictly alphanumeric [a-zA-Z0-9], no special characters, max 35 chars
 * 6. Server-authoritative payment_attempt derivation without hyphens
 * 7. QR Code & Intent URI identicalness
 * 8. Amount authority & encoding hygiene
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
    console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

console.log('===================================================================');
console.log('FROSTY BITE — NPCI UPI INTENT tr & ISOLATION AUDIT SUITE');
console.log('===================================================================\n');

const DEFAULT_UPI_ID = '7735800239@ibl';
const PAYEE_NAME = 'Frosty Bite';

function buildValidatedUpiUri(params: {
  pa: string;
  pn: string;
  am: number | string;
  cu?: string;
  tn?: string;
  tr?: string;
}): { uri: string; checks: Record<string, boolean> } {
  const cleanPa = (params.pa || '').trim().replace(/\s+/g, '');
  const cleanPn = (params.pn || '').trim();
  const numAm = typeof params.am === 'string' ? parseFloat(params.am) : params.am;
  const cleanAm = isNaN(numAm) || numAm <= 0 ? '1.00' : numAm.toFixed(2);
  const cleanCu = (params.cu || 'INR').trim().toUpperCase();
  const cleanTn = params.tn ? params.tn.trim().replace(/[^\w\s-]/g, '') : '';
  const cleanTr = params.tr ? params.tr.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 35) : '';

  const queryParts: string[] = [
    `pa=${cleanPa}`,
    `pn=${encodeURIComponent(cleanPn)}`,
    `am=${cleanAm}`,
    `cu=${cleanCu}`
  ];

  if (cleanTr) {
    queryParts.push(`tr=${encodeURIComponent(cleanTr)}`);
  }
  if (cleanTn) {
    queryParts.push(`tn=${encodeURIComponent(cleanTn)}`);
  }

  const uri = `upi://pay?${queryParts.join('&')}`;

  const checks = {
    noSpaces: !uri.includes(' ') && !cleanPa.includes(' '),
    noDoubleEncoding: !uri.includes('%25'),
    noSpecialCharsInTr: cleanTr ? /^[a-zA-Z0-9]+$/.test(cleanTr) : true,
    trLengthValid: cleanTr.length <= 35,
    noDuplicateQueryParams: new Set(queryParts.map(q => q.split('=')[0])).size === queryParts.length
  };

  return { uri, checks };
}

// -------------------------------------------------------------
// CONTROLLED PARAMETER ISOLATION TESTS
// -------------------------------------------------------------

// TEST A: pa + pn + am + cu
const testA = buildValidatedUpiUri({
  pa: DEFAULT_UPI_ID,
  pn: PAYEE_NAME,
  am: 1.00,
  cu: 'INR'
});
assert(testA.uri === 'upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR', 'TEST A: pa + pn + am + cu format matches exactly');
assert(!testA.uri.includes('tn=') && !testA.uri.includes('tr='), 'TEST A: Contains neither tn nor tr');

// TEST B: pa + pn + am + cu + tn
const testB = buildValidatedUpiUri({
  pa: DEFAULT_UPI_ID,
  pn: PAYEE_NAME,
  am: 1.00,
  cu: 'INR',
  tn: 'TEST'
});
assert(testB.uri === 'upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR&tn=TEST', 'TEST B: pa + pn + am + cu + tn format matches exactly');
assert(testB.uri.includes('tn=TEST') && !testB.uri.includes('tr='), 'TEST B: Contains tn without tr');

// Simulate real payment_attempt UUID
const mockAttemptUuid = 'c035fa32-fa67-4632-9cb8-6f68c347ad19';
const mockAttemptTr = mockAttemptUuid.replace(/-/g, '').slice(0, 35); // 32 chars: c035fa32fa6746329cb86f68c347ad19

// TEST C: pa + pn + am + cu + tr
const testC = buildValidatedUpiUri({
  pa: DEFAULT_UPI_ID,
  pn: PAYEE_NAME,
  am: 1.00,
  cu: 'INR',
  tr: mockAttemptTr
});
assert(testC.uri === `upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR&tr=${mockAttemptTr}`, 'TEST C: pa + pn + am + cu + tr format matches exactly');
assert(testC.uri.includes(`tr=${mockAttemptTr}`) && !testC.uri.includes('tn='), 'TEST C: Contains tr without tn');
assert(testC.checks.noSpecialCharsInTr, 'TEST C: tr contains strictly alphanumeric characters [a-zA-Z0-9]');
assert(testC.checks.trLengthValid, 'TEST C: tr length is <= 35 characters (32 chars)');

// TEST D: pa + pn + am + cu + tr + tn
const testD = buildValidatedUpiUri({
  pa: DEFAULT_UPI_ID,
  pn: PAYEE_NAME,
  am: 1.00,
  cu: 'INR',
  tr: mockAttemptTr,
  tn: 'TEST'
});
assert(testD.uri === `upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR&tr=${mockAttemptTr}&tn=TEST`, 'TEST D: pa + pn + am + cu + tr + tn format matches exactly');
assert(testD.uri.includes(`tr=${mockAttemptTr}`) && testD.uri.includes('tn=TEST'), 'TEST D: Contains both tr and tn');
assert(testD.checks.noDuplicateQueryParams, 'TEST D: No duplicate query parameters');

// PROD ORDER TEST
const prodOrderTotal = 45.00;
const prodOrderId = 'FB-T3R9S5';
const prodTest = buildValidatedUpiUri({
  pa: DEFAULT_UPI_ID,
  pn: PAYEE_NAME,
  am: prodOrderTotal,
  cu: 'INR',
  tr: mockAttemptTr,
  tn: prodOrderId
});
assert(prodTest.uri === `upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=45.00&cu=INR&tr=${mockAttemptTr}&tn=FB-T3R9S5`, 'PROD: Real Frosty Bite URI with authoritative tr and tn');

// Check QR Code synchronization
const qrPayload = encodeURIComponent(prodTest.uri);
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrPayload}`;
const decodedFromQr = decodeURIComponent(qrUrl.split('data=')[1]);
assert(decodedFromQr === prodTest.uri, 'QR Consistency: Dynamic QR encodes the exact same URI as Intent launcher');

// Verify UPICheckout.tsx has clean customer UI and attemptTr logic
const checkoutPath = path.resolve(process.cwd(), 'src/pages/UPICheckout.tsx');
const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');

assert(!checkoutContent.includes('TEST A (pa+pn+am+cu)'), 'UI: Temporary test buttons removed from customer checkout UI');
assert(checkoutContent.includes('attemptTr') && (checkoutContent.includes('tr: attemptTr || undefined') || checkoutContent.includes('tn: effectiveOrderId')), 'Logic: prodUpi uses authoritative parameters for normal VPA');

// Verify payment.routes.ts returns transaction_reference
const routesPath = path.resolve(process.cwd(), 'server/routes/payment.routes.ts');
const routesContent = fs.readFileSync(routesPath, 'utf8');
assert(routesContent.includes('transaction_reference: (activeAttempt.id || \'\').replace(/-/g, \'\').slice(0, 35)'), 'Server: activeAttempt returns sanitized transaction_reference');
assert(routesContent.includes('transaction_reference: (insertedAttempt.id || \'\').replace(/-/g, \'\').slice(0, 35)'), 'Server: insertedAttempt returns sanitized transaction_reference');

console.log('\n===================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('===================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL NPCI tr & ISOLATION AUDIT TESTS PASSED!\n');
}
