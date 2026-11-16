import {
  toMinorUnit,
  fromMinorUnit,
  getCurrencyDecimals,
  isValidFinancialAmount,
  normalizeCurrencyCode,
  formatCurrency,
  getCurrencySymbol,
  getCurrencyName,
  SUPPORTED_CURRENCIES,
} from '../src/utils/currency';
import {
  computeNetBalances,
  computeNetBalancesByCurrency,
  calculateGroupSettlementsByCurrency,
  getUserCurrencyBalances,
  optimizeSettlements,
} from '../src/utils/balanceCalculator';
import { Expense, GroupMember, Settlement, CurrencyConversionRecord } from '../src/types';

function runMultiCurrencyTests() {
  console.log('--- STARTING SPLITWISE-STYLE MULTI-CURRENCY TESTS ---');
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

  // ─── 1. Currency Precision & Minor Units ───────────────────────────
  console.log('\n[1] Testing ISO Currency Precisions & Minor Units...');
  {
    // JPY (0 decimals)
    assert(getCurrencyDecimals('JPY') === 0, 'JPY has 0 decimal precision');
    assert(toMinorUnit(1500, 'JPY') === 1500, 'toMinorUnit(1500 JPY) === 1500');
    assert(fromMinorUnit(1500, 'JPY') === 1500, 'fromMinorUnit(1500 JPY) === 1500');
    assert(!isValidFinancialAmount(1500.5, 'JPY').isValid, 'JPY rejects fractional decimals');
    assert(isValidFinancialAmount(1500, 'JPY').isValid, 'JPY accepts integer amount');

    // KWD (3 decimals)
    assert(getCurrencyDecimals('KWD') === 3, 'KWD has 3 decimal precision');
    assert(toMinorUnit(12.345, 'KWD') === 12345, 'toMinorUnit(12.345 KWD) === 12345');
    assert(fromMinorUnit(12345, 'KWD') === 12.345, 'fromMinorUnit(12345 KWD) === 12.345');
    assert(isValidFinancialAmount(12.345, 'KWD').isValid, 'KWD accepts 3 decimal places');
    assert(!isValidFinancialAmount(12.3456, 'KWD').isValid, 'KWD rejects 4 decimal places');

    // USD, EUR, INR, THB (2 decimals)
    assert(getCurrencyDecimals('USD') === 2, 'USD has 2 decimal precision');
    assert(getCurrencyDecimals('THB') === 2, 'THB has 2 decimal precision');
    assert(toMinorUnit(2000, 'THB') === 200000, 'toMinorUnit(2000 THB) === 200000 cents');
    assert(fromMinorUnit(200000, 'THB') === 2000, 'fromMinorUnit(200000 THB) === 2000');
    assert(isValidFinancialAmount(2000, 'THB').isValid, 'THB accepts integer amount');
    assert(isValidFinancialAmount(2000.5, 'THB').isValid, 'THB accepts 2 decimal places');
    assert(!isValidFinancialAmount(2000.555, 'THB').isValid, 'THB rejects 3 decimal places');

    // Code normalization
    assert(normalizeCurrencyCode('thb') === 'THB', 'Normalizes lowercase thb to THB');
    assert(normalizeCurrencyCode(' inr ') === 'INR', 'Trims and uppercase inr to INR');
    assert(normalizeCurrencyCode('') === 'INR', 'Falls back to INR for empty currency code');
  }

  // ─── 2. Scenario 1: Thailand Trip Hotel Booking (User Request Section 4) ───
  console.log('\n[2] Testing Thai Trip Hotel Booking (2,000 THB split 4 ways)...');
  {
    const members: GroupMember[] = [
      { userId: 'u_alice', userName: 'Alice', role: 'admin', joinedAt: new Date() },
      { userId: 'u_bob', userName: 'Bob', role: 'member', joinedAt: new Date() },
      { userId: 'u_charlie', userName: 'Charlie', role: 'member', joinedAt: new Date() },
      { userId: 'u_david', userName: 'David', role: 'member', joinedAt: new Date() },
    ];

    const expenseTHB: Expense = {
      id: 'exp_hotel_thb',
      groupId: 'grp_thailand',
      createdBy: 'u_alice',
      paidBy: 'u_alice',
      description: 'Hotel booking',
      amount: 2000,
      currency: 'THB',
      splitType: 'equal',
      splits: [
        { userId: 'u_alice', amount: 500, type: 'equal' },
        { userId: 'u_bob', amount: 500, type: 'equal' },
        { userId: 'u_charlie', amount: 500, type: 'equal' },
        { userId: 'u_david', amount: 500, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const byCurrency = computeNetBalancesByCurrency([expenseTHB], members, []);
    assert(byCurrency.has('THB'), 'Balances map contains THB key');
    assert(!byCurrency.has('INR'), 'Balances map does NOT contain INR (no automatic conversion)');

    const thbMap = byCurrency.get('THB')!;
    assert(thbMap.get('u_alice') === 1500, 'Alice is owed 1,500 THB');
    assert(thbMap.get('u_bob') === -500, 'Bob owes 500 THB');
    assert(thbMap.get('u_charlie') === -500, 'Charlie owes 500 THB');
    assert(thbMap.get('u_david') === -500, 'David owes 500 THB');

    // Check sum of net balances is zero
    let sumTHB = 0;
    thbMap.forEach((val) => { sumTHB += val; });
    assert(Math.abs(sumTHB) < 0.001, 'Net THB balances sum exactly to 0');

    // Check settlements generated
    const settlementsMap = calculateGroupSettlementsByCurrency([expenseTHB], members, [], true);
    const thbSettlements = settlementsMap.get('THB') || [];
    assert(thbSettlements.length === 3, '3 settlements needed in THB');
    assert(
      thbSettlements.every((s) => s.currency === 'THB' && s.toUserId === 'u_alice' && s.amount === 500),
      'All 3 settlements are in THB paying Alice 500 THB each'
    );
  }

  // ─── 3. Scenario 2: Multiple Currencies in Same Group (User Request Section 6) ───
  console.log('\n[3] Testing Multiple Currencies Simultaneously (THB, INR, USD)...');
  {
    const members: GroupMember[] = [
      { userId: 'u_you', userName: 'You', role: 'admin', joinedAt: new Date() },
      { userId: 'u_bob', userName: 'Bob', role: 'member', joinedAt: new Date() },
      { userId: 'u_charlie', userName: 'Charlie', role: 'member', joinedAt: new Date() },
      { userId: 'u_david', userName: 'David', role: 'member', joinedAt: new Date() },
    ];

    // Expense 1: Hotel 2,000 THB paid by You, split 4 ways (500 each)
    const eHotel: Expense = {
      id: 'e1',
      groupId: 'g1',
      createdBy: 'u_you',
      paidBy: 'u_you',
      description: 'Hotel',
      amount: 2000,
      currency: 'THB',
      splitType: 'equal',
      splits: [
        { userId: 'u_you', amount: 500, type: 'equal' },
        { userId: 'u_bob', amount: 500, type: 'equal' },
        { userId: 'u_charlie', amount: 500, type: 'equal' },
        { userId: 'u_david', amount: 500, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Expense 2: Dinner 800 THB paid by Bob, split 4 ways (200 each)
    const eDinner: Expense = {
      id: 'e2',
      groupId: 'g1',
      createdBy: 'u_bob',
      paidBy: 'u_bob',
      description: 'Dinner',
      amount: 800,
      currency: 'THB',
      splitType: 'equal',
      splits: [
        { userId: 'u_you', amount: 200, type: 'equal' },
        { userId: 'u_bob', amount: 200, type: 'equal' },
        { userId: 'u_charlie', amount: 200, type: 'equal' },
        { userId: 'u_david', amount: 200, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Expense 3: Shopping 1,500 INR paid by Charlie, split between You, Bob, Charlie (500 each)
    const eShopping: Expense = {
      id: 'e3',
      groupId: 'g1',
      createdBy: 'u_charlie',
      paidBy: 'u_charlie',
      description: 'Shopping',
      amount: 1500,
      currency: 'INR',
      splitType: 'equal',
      splits: [
        { userId: 'u_you', amount: 500, type: 'equal' },
        { userId: 'u_bob', amount: 500, type: 'equal' },
        { userId: 'u_charlie', amount: 500, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Expense 4: Taxi 30 USD paid by You, split between You and David (15 each)
    const eTaxi: Expense = {
      id: 'e4',
      groupId: 'g1',
      createdBy: 'u_you',
      paidBy: 'u_you',
      description: 'Taxi',
      amount: 30,
      currency: 'USD',
      splitType: 'equal',
      splits: [
        { userId: 'u_you', amount: 15, type: 'equal' },
        { userId: 'u_david', amount: 15, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const expenses = [eHotel, eDinner, eShopping, eTaxi];
    const multiBalances = computeNetBalancesByCurrency(expenses, members, []);

    // Check 3 separate currencies exist in results
    assert(multiBalances.has('THB'), 'Contains THB balances');
    assert(multiBalances.has('INR'), 'Contains INR balances');
    assert(multiBalances.has('USD'), 'Contains USD balances');

    // Verify THB balances:
    // You: paid 2000, owes 500 + 200 = 700 -> net +1300 THB
    // Bob: paid 800, owes 500 + 200 = 700 -> net +100 THB
    // Charlie: owes 500 + 200 = 700 -> net -700 THB
    // David: owes 500 + 200 = 700 -> net -700 THB
    const thbMap = multiBalances.get('THB')!;
    assert(thbMap.get('u_you') === 1300, 'THB: You have +1300 THB');
    assert(thbMap.get('u_bob') === 100, 'THB: Bob has +100 THB');
    assert(thbMap.get('u_charlie') === -700, 'THB: Charlie owes 700 THB');
    assert(thbMap.get('u_david') === -700, 'THB: David owes 700 THB');

    // Verify INR balances:
    // Charlie: paid 1500, owes 500 -> net +1000 INR
    // You: owes 500 -> net -500 INR
    // Bob: owes 500 -> net -500 INR
    // David: uninvolved -> 0
    const inrMap = multiBalances.get('INR')!;
    assert(inrMap.get('u_charlie') === 1000, 'INR: Charlie is owed 1,000 INR');
    assert(inrMap.get('u_you') === -500, 'INR: You owe 500 INR');
    assert(inrMap.get('u_bob') === -500, 'INR: Bob owes 500 INR');
    assert((inrMap.get('u_david') || 0) === 0, 'INR: David is uninvolved (0 INR)');

    // Verify USD balances:
    // You: paid 30, owes 15 -> net +15 USD
    // David: owes 15 -> net -15 USD
    const usdMap = multiBalances.get('USD')!;
    assert(usdMap.get('u_you') === 15, 'USD: You are owed 15 USD');
    assert(usdMap.get('u_david') === -15, 'USD: David owes 15 USD');

    // Verify getUserCurrencyBalances for 'u_you'
    const youBalances = getUserCurrencyBalances(expenses, members, [], 'u_you');
    assert(youBalances.length === 3, 'You have 3 separate currency balances');
    const youTHB = youBalances.find((b) => b.currency === 'THB');
    const youINR = youBalances.find((b) => b.currency === 'INR');
    const youUSD = youBalances.find((b) => b.currency === 'USD');
    assert(youTHB?.balance === 1300, 'You are owed 1,300 THB');
    assert(youINR?.balance === -500, 'You owe 500 INR');
    assert(youUSD?.balance === 15, 'You are owed 15 USD');

    // Ensure zero cross-currency offsetting: no 1300 THB offset against -500 INR!
    assert(
      youTHB !== undefined && youINR !== undefined && youUSD !== undefined,
      'Currencies remain strictly isolated with independent balances'
    );
  }

  // ─── 4. Scenario 3: Settlement Isolation (User Request Section 7) ─────────
  console.log('\n[4] Testing Settlement Currency Isolation & Partial Settlements...');
  {
    const members: GroupMember[] = [
      { userId: 'u_you', userName: 'You', role: 'admin', joinedAt: new Date() },
      { userId: 'u_bob', userName: 'Bob', role: 'member', joinedAt: new Date() },
      { userId: 'u_charlie', userName: 'Charlie', role: 'member', joinedAt: new Date() },
    ];

    // Bob owes You 1,000 THB
    const expTHB: Expense = {
      id: 'e_thb',
      groupId: 'g_settle',
      createdBy: 'u_you',
      paidBy: 'u_you',
      description: 'Activity in Bangkok',
      amount: 1000,
      currency: 'THB',
      splitType: 'equal',
      splits: [
        { userId: 'u_bob', amount: 1000, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Charlie owes You 2,000 INR
    const expINR: Expense = {
      id: 'e_inr',
      groupId: 'g_settle',
      createdBy: 'u_you',
      paidBy: 'u_you',
      description: 'Lunch in Delhi',
      amount: 2000,
      currency: 'INR',
      splitType: 'equal',
      splits: [
        { userId: 'u_charlie', amount: 2000, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Partial settlement: Bob pays You 500 THB
    const settleBob: Settlement = {
      id: 's_bob',
      groupId: 'g_settle',
      fromUserId: 'u_bob',
      toUserId: 'u_you',
      fromUserName: 'Bob',
      toUserName: 'You',
      amount: 500,
      currency: 'THB',
      status: 'completed',
      createdAt: new Date(),
    };

    const balances = computeNetBalancesByCurrency([expTHB, expINR], members, [settleBob]);

    const thbMap = balances.get('THB')!;
    const inrMap = balances.get('INR')!;

    // Bob THB debt reduced to 500 THB
    assert(thbMap.get('u_bob') === -500, 'Bob THB debt reduced from 1,000 to 500 THB');
    assert(thbMap.get('u_you') === 500, 'You are owed 500 THB after partial payment');

    // Charlie INR debt remains exactly 2,000 INR!
    assert(inrMap.get('u_charlie') === -2000, 'Charlie INR debt remains untouched at 2,000 INR');
    assert(inrMap.get('u_you') === 2000, 'You are still owed 2,000 INR');

    // Verify Bob paying in THB did not change INR debt
    assert(inrMap.get('u_bob') === 0 || inrMap.get('u_bob') === undefined, 'Bob has 0 INR debt');
  }

  // ─── 5. Scenario 4: Explicit Currency Conversion (User Request Section 8) ─
  console.log('\n[5] Testing Explicit Currency Conversion...');
  {
    const members: GroupMember[] = [
      { userId: 'u_you', userName: 'You', role: 'admin', joinedAt: new Date() },
      { userId: 'u_bob', userName: 'Bob', role: 'member', joinedAt: new Date() },
    ];

    // Bob owes You 2,000 THB
    const exp: Expense = {
      id: 'e_thb_conv',
      groupId: 'g_conv',
      createdBy: 'u_you',
      paidBy: 'u_you',
      description: 'Flight tickets',
      amount: 2000,
      currency: 'THB',
      splitType: 'equal',
      splits: [
        { userId: 'u_bob', amount: 2000, type: 'equal' },
      ],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // User explicitly records a conversion: converts 2,000 THB to 5,000 INR at rate 2.5
    // In minor units: 2,000 THB = 200,000 cents, 5,000 INR = 500,000 paise
    const conversionRecord: CurrencyConversionRecord = {
      id: 'conv_1',
      groupId: 'g_conv',
      createdBy: 'u_bob',
      sourceCurrency: 'THB',
      targetCurrency: 'INR',
      sourceAmountMinor: 200000, // 2000 THB
      targetAmountMinor: 500000, // 5000 INR
      exchangeRate: 2.5,
      rateTimestamp: Date.now(),
      rateSource: 'live',
      note: 'Converted debt from THB to INR via bank transfer rate',
      createdAt: new Date(),
    };

    const balances = computeNetBalancesByCurrency([exp], members, [], [conversionRecord]);

    const thbMap = balances.get('THB')!;
    const inrMap = balances.get('INR')!;

    // In THB: Bob converted out 2,000 THB, so Bob's THB balance is 0 (settled)
    assert(thbMap.get('u_bob') === 0, 'Bob THB balance is 0 after explicit conversion');

    // In INR: Bob converted to 5,000 INR, so Bob now owes 5,000 INR
    assert(inrMap.get('u_bob') === -5000, 'Bob now owes 5,000 INR in target currency');

    // Original expense is completely untouched
    assert(exp.currency === 'THB', 'Original expense maintains its THB currency');
    assert(exp.amount === 2000, 'Original expense maintains its 2,000 amount');
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiCurrencyTests();

