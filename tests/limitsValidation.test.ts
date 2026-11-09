import assert from 'assert';
import { APP_LIMITS } from '../src/constants/limits';
import {
  formatCurrency,
  getCurrencyDecimals,
  getCurrencySymbol,
  isValidFinancialAmount,
  isSafeMinorUnit,
} from '../src/utils/currency';
import {
  toCents,
  fromCents,
  formatCents,
  distributeCentsByShares,
} from '../src/utils/splitMath';

console.log('--- STARTING APPLICATION LIMITS, OVERFLOW & BOUNDARY UNIT TESTS ---');

// 1. Amount Boundary: Zero & Negative Amounts
{
  assert.strictEqual(isValidFinancialAmount(0).isValid, false, 'Zero amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(-50).isValid, false, 'Negative amount must be rejected');
  assert.strictEqual(isValidFinancialAmount('-10.50').isValid, false, 'Negative string amount must be rejected');
  assert.strictEqual(isValidFinancialAmount('').isValid, false, 'Empty string must be rejected');
  assert.strictEqual(isValidFinancialAmount(null).isValid, false, 'Null amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(undefined).isValid, false, 'Undefined amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(NaN).isValid, false, 'NaN amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(Infinity).isValid, false, 'Infinity amount must be rejected');
  assert.strictEqual(isValidFinancialAmount(-Infinity).isValid, false, '-Infinity amount must be rejected');
  console.log('✅ [PASS] 1. Zero, negative, empty, NaN, and Infinity amounts safely rejected');
}

// 2. Amount Boundary: Maximum Allowed Financial Amount (1 Billion)
{
  assert.strictEqual(isValidFinancialAmount(1_000_000_000).isValid, true, '1 Billion is valid maximum');
  assert.strictEqual(isValidFinancialAmount(1_000_000_001).isValid, false, 'Exceeding 1 Billion must be rejected');
  assert.strictEqual(isValidFinancialAmount(1e12).isValid, false, '1 Trillion must be rejected');
  console.log('✅ [PASS] 2. Maximum financial amount boundary (1 Billion) enforced');
}

// 3. Currency Decimal Precision Boundaries (0, 2, 3 decimals)
{
  // JPY / KRW: 0 decimals
  assert.strictEqual(getCurrencyDecimals('JPY'), 0, 'JPY uses 0 decimals');
  assert.strictEqual(getCurrencyDecimals('KRW'), 0, 'KRW uses 0 decimals');
  assert.strictEqual(isValidFinancialAmount(100, 'JPY').isValid, true, 'Whole JPY is valid');
  assert.strictEqual(isValidFinancialAmount('100.5', 'JPY').isValid, false, 'Fractional JPY must be rejected');

  // INR / USD / EUR / GBP / AUD / CAD / SGD: 2 decimals
  assert.strictEqual(getCurrencyDecimals('INR'), 2, 'INR uses 2 decimals');
  assert.strictEqual(getCurrencyDecimals('USD'), 2, 'USD uses 2 decimals');
  assert.strictEqual(isValidFinancialAmount('100.50', 'INR').isValid, true, '2-decimal INR is valid');
  assert.strictEqual(isValidFinancialAmount('100.555', 'INR').isValid, false, '3-decimal INR must be rejected');

  // KWD / BHD / OMR: 3 decimals
  assert.strictEqual(getCurrencyDecimals('KWD'), 3, 'KWD uses 3 decimals');
  assert.strictEqual(getCurrencyDecimals('BHD'), 3, 'BHD uses 3 decimals');
  assert.strictEqual(isValidFinancialAmount('100.125', 'KWD').isValid, true, '3-decimal KWD is valid');
  assert.strictEqual(isValidFinancialAmount('100.1234', 'KWD').isValid, false, '4-decimal KWD must be rejected');
  console.log('✅ [PASS] 3. Currency-specific decimal precision rules enforced (0, 2, 3 decimals)');
}

// 4. Safe Financial Integer Bounds (minor currency units)
{
  assert.strictEqual(isSafeMinorUnit(10000), true, 'Standard cents are safe');
  assert.strictEqual(isSafeMinorUnit(100_000_000_000), true, '1 Billion in cents (10^11) is safe');
  assert.strictEqual(isSafeMinorUnit(Number.MAX_SAFE_INTEGER), true, 'MAX_SAFE_INTEGER is boundary safe');
  assert.strictEqual(isSafeMinorUnit(Number.MAX_SAFE_INTEGER + 1), false, 'Exceeding MAX_SAFE_INTEGER is unsafe');
  console.log('✅ [PASS] 4. JavaScript safe integer boundaries verified for minor units');
}

// 5. Currency Symbol Lookup & Fallback
{
  assert.strictEqual(getCurrencySymbol('INR'), '₹');
  assert.strictEqual(getCurrencySymbol('USD'), '$');
  assert.strictEqual(getCurrencySymbol('EUR'), '€');
  assert.strictEqual(getCurrencySymbol('GBP'), '£');
  assert.strictEqual(getCurrencySymbol('AUD'), 'A$');
  assert.strictEqual(getCurrencySymbol('CAD'), 'C$');
  assert.strictEqual(getCurrencySymbol('SGD'), 'S$');
  assert.strictEqual(getCurrencySymbol('JPY'), '¥');
  assert.strictEqual(getCurrencySymbol('KRW'), '₩');
  assert.strictEqual(getCurrencySymbol('XYZ'), 'XYZ', 'Unknown currency falls back to code');
  console.log('✅ [PASS] 5. Currency symbol mapping and fallback verified');
}

// 6. Safe Currency Formatting (Zero NaN crash guarantee)
{
  assert.strictEqual(formatCurrency(1234.5, 'INR'), '₹1234.50');
  assert.strictEqual(formatCurrency(1234, 'JPY'), '¥1234');
  assert.strictEqual(formatCurrency(12.345, 'KWD'), 'KWD12.345');
  assert.strictEqual(formatCurrency(NaN, 'INR'), '₹0.00', 'NaN formats to 0.00 without crash');
  assert.strictEqual(formatCurrency(Infinity, 'INR'), '₹0.00', 'Infinity formats to 0.00 without crash');
  console.log('✅ [PASS] 6. formatCurrency handles all precisions and non-finite numbers safely');
}

// 7. Shares Split Boundary: Extreme Shares Bounding
{
  const totalCents = 10000; // ₹100.00
  const participants = [
    { id: 'u1', shares: 999_999_999 }, // Extreme value
    { id: 'u2', shares: 1 },
  ];
  // distributeCentsByShares bounds shares to APP_LIMITS.SPLIT.MAX_SHARES_PER_PERSON (100,000)
  const result = distributeCentsByShares(totalCents, participants);
  const sum = result.reduce((acc, r) => acc + r.cents, 0);
  assert.strictEqual(sum, totalCents, 'Shares sum must reconcile to exact total even with extreme shares');
  assert.strictEqual(result[0].cents > result[1].cents, true, 'u1 gets majority of shares');
  console.log('✅ [PASS] 7. Extreme share counts bounded safely without integer overflow');
}

// 8. Application Character Limits Integrity
{
  assert.strictEqual(APP_LIMITS.EXPENSE.MAX_DESCRIPTION_LENGTH, 255);
  assert.strictEqual(APP_LIMITS.EXPENSE.MAX_NOTES_LENGTH, 1000);
  assert.strictEqual(APP_LIMITS.GROUP.MAX_NAME_LENGTH, 50);
  assert.strictEqual(APP_LIMITS.USER.MAX_NAME_LENGTH, 70);
  assert.strictEqual(APP_LIMITS.USER.MAX_EMAIL_LENGTH, 254);
  assert.strictEqual(APP_LIMITS.USER.MAX_PHONE_LENGTH, 25);
  assert.strictEqual(APP_LIMITS.GROUP.JOIN_CODE_LENGTH, 6);
  assert.strictEqual(APP_LIMITS.EXPORT.MAX_EXPORT_ROWS, 5000);
  console.log('✅ [PASS] 8. Application limits constants match platform and UI specifications');
}

console.log('--- ALL LIMITS, OVERFLOW & BOUNDARY TESTS PASSED ---');

