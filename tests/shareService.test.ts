/**
 * Splitwiser Professional Sharing System Test Suite
 *
 * Verifies:
 * 1. Official app constants (Name, Play Store URL, Deep Link Scheme)
 * 2. Group invitation message generation & deep link integrity
 * 3. Friend invitation message generation
 * 4. General app sharing message generation
 * 5. Expense sharing message formatting (amounts, currencies, members)
 * 6. Settlement receipt message formatting (who paid whom, note handling)
 * 7. Payment reminders (individual & group)
 * 8. Edge cases (missing optional fields, undefined dates, zero members)
 */

import {
  APP_NAME,
  PLAY_STORE_URL,
  APP_SCHEME,
  getGroupJoinDeepLink,
  formatShareDate,
  buildGroupInviteMessage,
  buildFriendInviteMessage,
  buildAppShareMessage,
  buildExpenseShareMessage,
  buildSettlementShareMessage,
  buildReminderMessage,
  buildGroupReminderMessage,
} from '../src/services/shareMessageBuilder';

function runTests() {
  console.log('\n========================================================================');
  console.log('   SPLITWISER PROFESSIONAL SHARING SYSTEM TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Official App Constants
  console.log('\n--- 1. Official App Constants ---');
  assert(APP_NAME === 'Tapit', 'App name is Tapit');
  assert(
    PLAY_STORE_URL === 'https://play.google.com/store/apps/details?id=com.prashiln79.splitwiser',
    'Play Store URL matches official target URL'
  );
  assert(APP_SCHEME === 'splitwiser://', 'App scheme is splitwiser://');

  // 2. Deep Link Generation
  console.log('\n--- 2. Deep Link Generation ---');
  const deepLink = getGroupJoinDeepLink('6k9x2m');
  assert(
    deepLink === 'splitwiser://join?code=6K9X2M',
    'Deep link generated correctly with uppercase code'
  );
  assert(
    getGroupJoinDeepLink('  ab12cd  ') === 'splitwiser://join?code=AB12CD',
    'Deep link handles whitespace and uppercase normalization'
  );

  // 3. Date Formatting
  console.log('\n--- 3. Date Formatting ---');
  const testDate = new Date(2026, 10, 23); // 23 Nov 2026
  const formattedDate = formatShareDate(testDate);
  assert(formattedDate.includes('23') && formattedDate.includes('Nov') && formattedDate.includes('2026'), 'Date formats to 23 Nov 2026');
  assert(typeof formatShareDate(undefined) === 'string', 'Date formatting gracefully handles undefined');
  assert(typeof formatShareDate('invalid-date') === 'string', 'Date formatting gracefully handles invalid string');

  // 4. Group Invitation Message
  console.log('\n--- 4. Group Invitation Message ---');
  const groupMsg = buildGroupInviteMessage({
    groupName: 'Goa Trip 2026',
    joinCode: 'GOA123',
    memberCount: 6,
    groupType: 'trip',
  });
  assert(groupMsg.includes("You're invited to join Goa Trip 2026!"), 'Group invite has title with group name');
  assert(groupMsg.includes('🏖️ Group: Goa Trip 2026'), 'Group invite includes type emoji and group name');
  assert(groupMsg.includes('👥 Members: 6'), 'Group invite includes member count');
  assert(groupMsg.includes('🔑 Join Code: GOA123'), 'Group invite includes join code');
  assert(groupMsg.includes('splitwiser://join?code=GOA123'), 'Group invite includes deep link');
  assert(groupMsg.includes(PLAY_STORE_URL), 'Group invite includes Play Store URL');
  assert(groupMsg.includes('Split expenses. Stay organized. Enjoy together!'), 'Group invite includes branding tagline');

  // Group invite with missing optional memberCount
  const groupMsgNoMembers = buildGroupInviteMessage({
    groupName: 'Flatmates',
    joinCode: 'FLAT45',
    groupType: 'home',
  });
  assert(!groupMsgNoMembers.includes('Members:'), 'Group invite omits member count when undefined');
  assert(groupMsgNoMembers.includes('🏠 Group: Flatmates'), 'Group invite applies home emoji');

  // 5. Friend Invitation Message
  console.log('\n--- 5. Friend Invitation Message ---');
  const friendMsg = buildFriendInviteMessage({
    name: 'Prashil',
    uid: 'user_12345',
  });
  assert(friendMsg.includes('👋 Hey!'), 'Friend invite starts with friendly greeting');
  assert(friendMsg.includes('👤 Friend: Prashil'), 'Friend invite includes friend name');
  assert(friendMsg.includes('🔑 Friend ID: user_12345'), 'Friend invite includes friend ID');
  assert(friendMsg.includes(PLAY_STORE_URL), 'Friend invite includes Play Store URL');

  // Friend invite with no params
  const emptyFriendMsg = buildFriendInviteMessage();
  assert(emptyFriendMsg.includes(PLAY_STORE_URL), 'Friend invite without params includes Play Store URL');
  assert(!emptyFriendMsg.includes('Friend ID:'), 'Friend invite without params omits Friend ID');

  // 6. General App Share Message
  console.log('\n--- 6. General App Sharing Message ---');
  const appMsg = buildAppShareMessage();
  assert(appMsg.includes('💚 *Meet Tapit!*'), 'App share has header');
  assert(appMsg.includes('✨ Split expenses with friends and family.'), 'App share lists key features');
  assert(appMsg.includes(PLAY_STORE_URL), 'App share includes Play Store download link');
  assert(appMsg.includes('Share expenses. Stay organized. 💚'), 'App share includes footer');

  // 7. Expense Sharing Message
  console.log('\n--- 7. Expense Sharing Message ---');
  const expMsg = buildExpenseShareMessage({
    groupName: 'Goa Trip 2026',
    description: 'Dinner at Fisherman’s Wharf',
    amount: 2400,
    currency: 'INR',
    paidByName: 'Prashil',
    date: testDate,
    splitCount: 4,
  });
  assert(expMsg.includes('🧾 *Expense Details — Goa Trip 2026*'), 'Expense share has header with group');
  assert(expMsg.includes('🍽️ Description: Dinner at Fisherman’s Wharf'), 'Expense share has description');
  assert(expMsg.includes('2,400') || expMsg.includes('2400'), 'Expense share formats amount');
  assert(expMsg.includes('👤 Paid by: Prashil'), 'Expense share includes payer');
  assert(expMsg.includes('👥 Split between: 4 members'), 'Expense share has split count');
  assert(expMsg.includes(PLAY_STORE_URL), 'Expense share includes Play Store URL');

  // Expense sharing singular member
  const expMsgSingle = buildExpenseShareMessage({
    groupName: 'Personal',
    description: 'Coffee',
    amount: 150,
    currency: 'INR',
    paidByName: 'Alex',
    splitCount: 1,
  });
  assert(expMsgSingle.includes('1 member') && !expMsgSingle.includes('1 members'), 'Singular member split formatted correctly');

  // 8. Settlement Sharing Message
  console.log('\n--- 8. Settlement Receipt Message ---');
  const setMsg = buildSettlementShareMessage({
    fromName: 'Prashil',
    toName: 'Rahul',
    amount: 1200,
    currency: 'INR',
    date: testDate,
    note: 'GPay transfer',
  });
  assert(setMsg.includes('💸 *Payment Receipt — Tapit*'), 'Settlement has header');
  assert(setMsg.includes('✅ Status: Settled'), 'Settlement shows settled status');
  assert(setMsg.includes('👤 Paid by: Prashil'), 'Settlement shows who paid');
  assert(setMsg.includes('🤝 Paid to: Rahul'), 'Settlement shows recipient');
  assert(setMsg.includes('1,200') || setMsg.includes('1200'), 'Settlement formats amount');
  assert(setMsg.includes('📝 Note: GPay transfer'), 'Settlement includes note');
  assert(setMsg.includes(PLAY_STORE_URL), 'Settlement includes Play Store URL');

  // Settlement without note
  const setMsgNoNote = buildSettlementShareMessage({
    fromName: 'Prashil',
    toName: 'Rahul',
    amount: 500,
  });
  assert(!setMsgNoNote.includes('Note:'), 'Settlement omits note when not provided');

  // 9. Payment Reminders (Individual & Group)
  console.log('\n--- 9. Payment Reminders ---');
  const remMsg = buildReminderMessage({
    recipientName: 'Rahul',
    groupName: 'Goa Trip 2026',
    amount: 850,
    currency: 'INR',
    payToName: 'Prashil',
  });
  assert(remMsg.includes('👋 Hey Rahul!'), 'Reminder has personal greeting');
  assert(remMsg.includes('*Goa Trip 2026*'), 'Reminder names the group');
  assert(remMsg.includes('850'), 'Reminder has amount');
  assert(remMsg.includes('👤 Pay to: Prashil'), 'Reminder specifies who to pay');
  assert(remMsg.includes(PLAY_STORE_URL), 'Reminder has Play Store URL');

  const grpRemMsg = buildGroupReminderMessage({ groupName: 'Goa Trip 2026' });
  assert(grpRemMsg.includes('👋 Hey everyone!'), 'Group reminder addresses everyone');
  assert(grpRemMsg.includes('*Goa Trip 2026*'), 'Group reminder names the group');
  assert(grpRemMsg.includes(PLAY_STORE_URL), 'Group reminder has Play Store URL');

  console.log('\n========================================================================');
  console.log(`   TEST RUN SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
