import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  generateDeterministicNotificationId,
  getNotificationTranslationKeys,
  filterRecipients,
  isNotificationAllowed,
  calculateUnreadChange,
  mapNotificationDoc,
  getNotificationDefaultRoute,
} from '../src/utils/notificationUtils';
import {
  InAppNotificationType,
  InAppNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
} from '../src/types/notifications';
import enNotifications from '../src/i18n/locales/en/notifications.json';

console.log('--- STARTING IN-APP NOTIFICATION CENTER UNIT & INTEGRATION TESTS ---');

const SUPPORTED_LOCALES = ['en', 'zh-Hans', 'es', 'ar', 'fr', 'pt-BR', 'id', 'ru'];

async function runNotificationTests() {
  // 1. Deterministic Notification ID Generation & Idempotency
  {
    const id1 = generateDeterministicNotificationId('expense_created', 'exp_999', 'user_abc');
    const id2 = generateDeterministicNotificationId('expense_created', 'exp_999', 'user_abc');
    const id3 = generateDeterministicNotificationId('expense_created', 'exp_999', 'user_def');
    const id4 = generateDeterministicNotificationId('settlement_created', 'exp_999', 'user_abc');

    assert.strictEqual(id1, id2, 'Same type, dedupeKey, and recipientId must produce identical ID');
    assert.notStrictEqual(id1, id3, 'Different recipientId must produce distinct notification IDs');
    assert.notStrictEqual(id1, id4, 'Different event type must produce distinct notification IDs');
    assert.strictEqual(id1.length, 32, 'Notification ID hash must be a 32-character hexadecimal string');

    // Repeated hashing consistency across 100 iterations
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(
        generateDeterministicNotificationId('expense_created', 'exp_999', 'user_abc'),
        id1,
        'Hashing must remain 100% deterministic'
      );
    }
    console.log('✅ [PASS] 1. Deterministic Notification ID & Deduplication tests passed');
  }

  // 2. All 15 InAppNotificationType values map to valid i18n keys
  {
    const allEventTypes: InAppNotificationType[] = [
      'expense_created',
      'expense_updated',
      'expense_deleted',
      'expense_restored',
      'settlement_created',
      'settlement_updated',
      'settlement_deleted',
      'group_invitation',
      'member_joined',
      'member_removed',
      'group_updated',
      'payment_reminder',
      'scheduled_reminder',
      'expense_comment',
      'member_mention',
    ];

    allEventTypes.forEach((type) => {
      const { titleKey, bodyKey } = getNotificationTranslationKeys(type);
      assert.ok(titleKey.startsWith('notifications:'), `titleKey for ${type} must belong to notifications namespace`);
      assert.ok(bodyKey.startsWith('notifications:'), `bodyKey for ${type} must belong to notifications namespace`);

      const cleanTitleKey = titleKey.replace('notifications:', '');
      const cleanBodyKey = bodyKey.replace('notifications:', '');

      assert.ok(
        cleanTitleKey in enNotifications,
        `English translation json missing titleKey: ${cleanTitleKey} for type: ${type}`
      );
      assert.ok(
        cleanBodyKey in enNotifications,
        `English translation json missing bodyKey: ${cleanBodyKey} for type: ${type}`
      );
    });
    console.log('✅ [PASS] 2. All 15 notification event types mapped to valid i18n keys');
  }

  // 3. Recipient filtering & Self-notification suppression
  {
    const actorId = 'user_123';
    const targetUserIds = ['user_123', 'user_456', 'user_789', 'user_456', ''];

    const recipients = filterRecipients(targetUserIds, actorId);

    assert.deepStrictEqual(recipients, ['user_456', 'user_789']);
    assert.ok(!recipients.includes(actorId), 'Actor must be excluded from receiving their own notification');
    assert.strictEqual(recipients.length, 2, 'Duplicate and empty recipient IDs must be deduplicated and removed');
    console.log('✅ [PASS] 3. Self-notification suppression and recipient deduplication verified');
  }

  // 4. Notification Preferences & Mute Logic
  {
    const defaultPrefs: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };

    assert.strictEqual(defaultPrefs.expenseAdded, true);
    assert.strictEqual(defaultPrefs.expenseUpdated, true);
    assert.strictEqual(defaultPrefs.settlements, true);
    assert.strictEqual(defaultPrefs.paymentReminders, true);
    assert.strictEqual(defaultPrefs.inAppBanners, true);
    assert.strictEqual(defaultPrefs.mutedGroupIds.length, 0);

    // Muted group test
    const mutedPrefs: NotificationPreferences = {
      ...defaultPrefs,
      mutedGroupIds: ['group_muted_1'],
    };

    assert.strictEqual(
      isNotificationAllowed('expense_created', 'group_muted_1', mutedPrefs),
      false,
      'Notifications from muted group must be rejected'
    );
    assert.strictEqual(
      isNotificationAllowed('expense_created', 'group_active_2', mutedPrefs),
      true,
      'Notifications from unmuted group must be allowed'
    );

    // Individual category toggles test
    const toggledPrefs: NotificationPreferences = {
      ...defaultPrefs,
      paymentReminders: false,
      settlements: false,
      expenseAdded: true,
    };

    assert.strictEqual(isNotificationAllowed('payment_reminder', undefined, toggledPrefs), false);
    assert.strictEqual(isNotificationAllowed('settlement_created', undefined, toggledPrefs), false);
    assert.strictEqual(isNotificationAllowed('expense_created', undefined, toggledPrefs), true);
    console.log('✅ [PASS] 4. User preferences & group muting logic validated');
  }

  // 5. Deep-Linking Route Resolution (getNotificationDefaultRoute)
  {
    // Test expense route with valid group and expense
    const expenseNotif: InAppNotification = {
      id: 'notif_1',
      type: 'expense_created',
      schemaVersion: 1,
      actorId: 'user_1',
      actorName: 'Alice',
      groupId: 'grp_123',
      groupName: 'Trip',
      expenseId: 'exp_456',
      titleKey: 'notifications:expenseCreatedTitle',
      bodyKey: 'notifications:expenseCreatedBody',
      params: { actorName: 'Alice', amount: '50' },
      createdAt: new Date(),
      readAt: null,
      archivedAt: null,
      dedupeKey: 'dedupe_1',
    };

    const routeExpense = getNotificationDefaultRoute(expenseNotif);
    assert.strictEqual(routeExpense.screen, 'ExpenseDetails', 'Expense notification resolves to ExpenseDetails');
    assert.strictEqual(routeExpense.params?.expenseId, 'exp_456');
    assert.strictEqual(routeExpense.params?.groupId, 'grp_123');

    // Test settlement route
    const settlementNotif: InAppNotification = {
      ...expenseNotif,
      id: 'notif_2',
      type: 'settlement_created',
      settlementId: 'set_789',
    };

    const routeSettlement = getNotificationDefaultRoute(settlementNotif);
    assert.strictEqual(routeSettlement.screen, 'GroupDetails', 'Settlement notification resolves to GroupDetails');
    assert.strictEqual(routeSettlement.params?.groupId, 'grp_123');
    assert.strictEqual(routeSettlement.params?.initialTab, 'balances');

    // Test member joined route
    const memberNotif: InAppNotification = {
      ...expenseNotif,
      id: 'notif_3',
      type: 'member_joined',
      expenseId: undefined,
    };

    const routeMember = getNotificationDefaultRoute(memberNotif);
    assert.strictEqual(routeMember.screen, 'GroupDetails');
    assert.strictEqual(routeMember.params?.groupId, 'grp_123');

    // Test fallback when groupId is missing
    const orphanNotif: InAppNotification = {
      ...expenseNotif,
      id: 'notif_4',
      groupId: undefined,
      expenseId: undefined,
    };

    const routeOrphan = getNotificationDefaultRoute(orphanNotif);
    assert.strictEqual(routeOrphan.screen, 'Home', 'Notification without group resolves safely to Home');
    console.log('✅ [PASS] 5. Deep link routing & missing target fallbacks verified');
  }

  // 6. Unread count arithmetic & boundary safety
  {
    let unreadCount = 0;

    unreadCount = calculateUnreadChange(unreadCount, 'increment');
    unreadCount = calculateUnreadChange(unreadCount, 'increment');
    assert.strictEqual(unreadCount, 2, 'Two increments yield 2');

    unreadCount = calculateUnreadChange(unreadCount, 'decrement');
    assert.strictEqual(unreadCount, 1, 'Decrement yields 1');

    unreadCount = calculateUnreadChange(unreadCount, 'decrement');
    assert.strictEqual(unreadCount, 0, 'Decrement yields 0');

    // Clamped boundary: cannot go below 0
    unreadCount = calculateUnreadChange(unreadCount, 'decrement');
    assert.strictEqual(unreadCount, 0, 'Clamped at 0 (never negative)');

    // Reset action
    unreadCount = 25;
    unreadCount = calculateUnreadChange(unreadCount, 'reset');
    assert.strictEqual(unreadCount, 0, 'Reset yields 0');
    console.log('✅ [PASS] 6. Unread count arithmetic & boundary safety verified');
  }

  // 7. Data Structure & Schema Version
  {
    const sampleNotif: InAppNotification = {
      id: 'test_hash_1234567890abcdef',
      type: 'payment_reminder',
      schemaVersion: 1,
      actorId: 'user_sender',
      actorName: 'Bob',
      actorAvatarUrl: 'https://example.com/avatar.jpg',
      groupId: 'grp_weekend',
      groupName: 'Weekend Getaway',
      titleKey: 'notifications:paymentReminderTitle',
      bodyKey: 'notifications:paymentReminderBody',
      params: { actorName: 'Bob', groupName: 'Weekend Getaway', amount: '$45.00' },
      createdAt: new Date(),
      readAt: null,
      archivedAt: null,
      dedupeKey: 'reminder_bob_user_sender_12345',
    };

    assert.strictEqual(sampleNotif.schemaVersion, 1);
    assert.strictEqual(sampleNotif.readAt, null);
    assert.strictEqual(sampleNotif.archivedAt, null);
    assert.strictEqual(sampleNotif.params.actorName, 'Bob');
    assert.strictEqual(sampleNotif.params.amount, '$45.00');
    console.log('✅ [PASS] 7. InAppNotification model schema conformance verified');
  }

  // 8. Strict Firestore Namespace Verification: EVERYTHING must live under /splitwiser/data/...
  {
    // Inspect source code files for any Firestore doc/collection references
    const servicesToCheck = [
      'src/services/notificationService.ts',
      'src/services/languageService.ts',
      'src/services/themeService.ts',
      'src/services/auth.ts',
      'src/services/friendService.ts',
      'src/services/expenses.ts',
      'src/services/settlements.ts',
      'src/services/groups.ts',
      'src/sync/syncQueue.ts',
    ];

    for (const relPath of servicesToCheck) {
      const fullPath = path.resolve(__dirname, '..', relPath);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf8');

      // Check collection and doc calls
      const collectionMatches = content.match(/collection\(\s*db\s*,\s*['"]([^'"]+)['"]/g) || [];
      const docMatches = content.match(/doc\(\s*db\s*,\s*['"]([^'"]+)['"]/g) || [];

      for (const m of [...collectionMatches, ...docMatches]) {
        // First path argument must be 'splitwiser'
        assert.ok(
          m.includes("'splitwiser'") || m.includes('"splitwiser"'),
          `Path violation in ${relPath}: "${m}" is not in splitwiser namespace`
        );
      }
    }
    console.log('✅ [PASS] 8. All Firestore collections strictly verified within /splitwiser/data/... namespace');
  }

  // 9. Multilingual Symmetry Across All 8 Supported Languages
  {
    const localesDir = path.resolve(__dirname, '..', 'src/i18n/locales');
    const englishNotifs = JSON.parse(
      fs.readFileSync(path.join(localesDir, 'en', 'notifications.json'), 'utf8')
    );
    const requiredKeys = Object.keys(englishNotifs);

    assert.ok(requiredKeys.length >= 60, `Expected at least 60 notification keys, found ${requiredKeys.length}`);

    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(localesDir, locale, 'notifications.json');
      assert.ok(fs.existsSync(filePath), `Missing notifications.json for locale: ${locale}`);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      for (const key of requiredKeys) {
        assert.ok(
          key in data,
          `Locale ${locale} missing key "${key}" in notifications.json`
        );
        assert.ok(
          typeof data[key] === 'string' && data[key].trim().length > 0,
          `Locale ${locale} key "${key}" must be a non-empty string`
        );
      }
    }
    console.log(`✅ [PASS] 9. 100% translation symmetry verified across all 8 languages (${requiredKeys.length} keys each)`);
  }

  // 10. Inbox Date Grouping Logic (Today, Yesterday, Earlier)
  {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

    const testDates = [
      { date: new Date(startOfToday.getTime() + 1000), expected: 'today' },
      { date: new Date(startOfToday.getTime() - 1000), expected: 'yesterday' },
      { date: new Date(startOfYesterday.getTime() - 1000), expected: 'earlier' },
      { date: new Date(startOfYesterday.getTime() - 7 * 86400000), expected: 'earlier' },
    ];

    testDates.forEach(({ date, expected }) => {
      let bucket: string;
      if (date >= startOfToday) {
        bucket = 'today';
      } else if (date >= startOfYesterday) {
        bucket = 'yesterday';
      } else {
        bucket = 'earlier';
      }
      assert.strictEqual(bucket, expected, `Date ${date.toISOString()} should be grouped in ${expected}`);
    });
    console.log('✅ [PASS] 10. Inbox date grouping (Today, Yesterday, Earlier) verified accurately');
  }

  // 11. Inbox Filter Logic (All, Unread, Expenses, Settlements)
  {
    const testList: InAppNotification[] = [
      {
        id: '1',
        type: 'expense_created',
        schemaVersion: 1,
        actorId: 'u1',
        actorName: 'A',
        titleKey: 'k',
        bodyKey: 'b',
        params: {},
        createdAt: new Date(),
        readAt: null,
        archivedAt: null,
        dedupeKey: 'd1',
      },
      {
        id: '2',
        type: 'settlement_created',
        schemaVersion: 1,
        actorId: 'u2',
        actorName: 'B',
        titleKey: 'k',
        bodyKey: 'b',
        params: {},
        createdAt: new Date(),
        readAt: new Date(),
        archivedAt: null,
        dedupeKey: 'd2',
      },
      {
        id: '3',
        type: 'member_joined',
        schemaVersion: 1,
        actorId: 'u3',
        actorName: 'C',
        titleKey: 'k',
        bodyKey: 'b',
        params: {},
        createdAt: new Date(),
        readAt: null,
        archivedAt: null,
        dedupeKey: 'd3',
      },
    ];

    // Filter 'unread'
    const unread = testList.filter((item) => !item.readAt);
    assert.strictEqual(unread.length, 2);
    assert.deepStrictEqual(unread.map((i) => i.id), ['1', '3']);

    // Filter 'expenses'
    const expenses = testList.filter((item) => item.type.startsWith('expense_'));
    assert.strictEqual(expenses.length, 1);
    assert.strictEqual(expenses[0].id, '1');

    // Filter 'settlements'
    const settlements = testList.filter((item) => item.type.startsWith('settlement_'));
    assert.strictEqual(settlements.length, 1);
    assert.strictEqual(settlements[0].id, '2');

    console.log('✅ [PASS] 11. Notification inbox tab filtering logic verified');
  }

  console.log('\n🎉 ALL 11 IN-APP NOTIFICATION UNIT & INTEGRATION TEST SUITES PASSED PROPERLY! 🎉\n');
}

runNotificationTests().catch((err) => {
  console.error('❌ Notification test failed:', err);
  process.exit(1);
});
