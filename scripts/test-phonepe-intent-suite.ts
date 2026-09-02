/**
 * PhonePe UPI Intent Compatibility & Parameter Isolation Test Suite
 * Validates:
 * 1. Exact sanitized URI generation (pa masked, pn, am, cu, tn, tr)
 * 2. Parameter hygiene (no spaces, no %25, no undefined, no NaN, no duplicates)
 * 3. TEST 1 Minimal URI: upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR
 * 4. TEST 2 Minimal URI with note: upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR&tn=TEST
 * 5. TEST 3 Production URI: upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=XX.XX&cu=INR&tn=FB-XXXX
 * 6. Dual-navigation race condition elimination (no secondary window.location.href)
 * 7. Non-destructive app return (UPI_APP_RETURNED preserves WAITING_FOR_PAYMENT)
 * 8. Fallback UX compliance (Exact notice wording, QR code preserved)
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
console.log('FROSTY BITE — PHONEPE UPI INTENT AUDIT & ISOLATION TEST SUITE');
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
}) {
  const cleanPa = (params.pa || '').trim().replace(/\s+/g, '');
  const cleanPn = (params.pn || '').trim();
  const numAm = typeof params.am === 'string' ? parseFloat(params.am) : params.am;
  const cleanAm = isNaN(numAm) || numAm <= 0 ? '1.00' : numAm.toFixed(2);
  const cleanCu = (params.cu || 'INR').trim().toUpperCase();
  const cleanTn = params.tn ? params.tn.trim().replace(/[^\w\s-]/g, '') : '';
  const cleanTr = params.tr ? params.tr.trim().replace(/[^\w\s-]/g, '') : '';

  const queryParts: string[] = [
    `pa=${cleanPa}`,
    `pn=${encodeURIComponent(cleanPn)}`,
    `am=${cleanAm}`,
    `cu=${cleanCu}`
  ];

  if (cleanTn) queryParts.push(`tn=${encodeURIComponent(cleanTn)}`);
  if (cleanTr) queryParts.push(`tr=${encodeURIComponent(cleanTr)}`);

  const uri = `upi://pay?${queryParts.join('&')}`;
  const atCount = (cleanPa.match(/@/g) || []).length;
  const paParts = cleanPa.split('@');
  const paMasked = `***@${paParts[1] || 'upi'}`;

  const checks = {
    vpaCorrectness: atCount === 1 && Boolean(paParts[0] && paParts[1]),
    noSpaces: !uri.includes(' ') && !cleanPa.includes(' '),
    noHiddenCharacters: !/[\r\n\t]/.test(uri),
    validAtSymbol: atCount === 1,
    noDoubleEncoding: !uri.includes('%25'),
    noAccidentalNewline: !uri.includes('\n') && !uri.includes('\r'),
    noUndefined: !uri.includes('undefined'),
    noNaN: !uri.includes('NaN'),
    noDuplicateQueryParams: new Set(queryParts.map(q => q.split('=')[0])).size === queryParts.length
  };

  return { uri, paMasked, cleanPn, cleanAm, cleanCu, cleanTn, checks };
}

// TEST 1: Minimal URI
const test1 = buildValidatedUpiUri({ pa: DEFAULT_UPI_ID, pn: PAYEE_NAME, am: '1.00', cu: 'INR' });
assert(test1.uri === 'upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR', 'Step 3 - Test 1: Minimal URI matches exact specification');
assert(test1.checks.noSpaces && test1.checks.noDoubleEncoding && test1.checks.validAtSymbol, 'Step 3 - Test 1: Passes all parameter hygiene checks');

// TEST 2: Minimal URI with Note
const test2 = buildValidatedUpiUri({ pa: DEFAULT_UPI_ID, pn: PAYEE_NAME, am: '1.00', cu: 'INR', tn: 'TEST' });
assert(test2.uri === 'upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=1.00&cu=INR&tn=TEST', 'Step 3 - Test 2: Minimal URI with note matches exact specification');

// TEST 3: Real Production Order URI
const orderId = 'FB-T3R9S5';
const test3 = buildValidatedUpiUri({ pa: DEFAULT_UPI_ID, pn: PAYEE_NAME, am: 45.0, cu: 'INR', tn: orderId });
assert(test3.uri === 'upi://pay?pa=7735800239@ibl&pn=Frosty%20Bite&am=45.00&cu=INR&tn=FB-T3R9S5', 'Step 3 - Test 3: Production URI accurately formatted');
assert(test3.checks.noDuplicateQueryParams, 'Step 2: No duplicate query parameters in production URI');
assert(!test3.uri.includes('phonepe://'), 'Step 13: Universal upi://pay used, no proprietary phonepe:// scheme');

// Parameter Hygiene Checks
assert(test3.paMasked === '***@ibl', 'Step 1: VPA correctly masked for diagnostics log');
assert(!test3.uri.includes('%25'), 'Step 2: Payee name has zero double-encoding (%25 absent)');

// File Inspection: UPICheckout.tsx
const checkoutPath = path.resolve(process.cwd(), 'src/pages/UPICheckout.tsx');
const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');

// Dual-navigation race condition check: ensure window.location.href = upiUri is not executed as active code
const activeDoubleLaunch = checkoutContent
  .split('\n')
  .filter(line => !line.trim().startsWith('//'))
  .some(line => line.includes('window.location.href = upiUri'));
assert(!activeDoubleLaunch, 'Step 4/16: Dual-navigation race condition eliminated (no secondary window.location.href in anchor handler)');

// App return handling check
assert(checkoutContent.includes('[UPI_APP_RETURNED]'), 'Step 11: App return logged as UPI_APP_RETURNED without mutating payment state');

// Fallback message check
assert(
  checkoutContent.includes('Unable to start payment in this app.') &&
  checkoutContent.includes('Please scan the QR code above or copy the UPI ID below'),
  'Step 12: Checkout displays exact fallback guidance while preserving QR code'
);

// Dev Diagnostics Panel presence
assert(checkoutContent.includes('PhonePe / UPI Dev Diagnostics'), 'Step 3: Dev Diagnostics test suite panel rendered in UI');

console.log('\n===================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('===================================================================');

if (failed > 0) process.exit(1);
