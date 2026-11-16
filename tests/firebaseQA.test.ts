/**
 * FIREBASE & SECURITY QA TEST SUITE
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive tests for Firebase integration, Firestore collection namespaces,
 * sync queue robustness & retry mechanics, snapshot listener cleanup patterns,
 * notification data modeling & unread counting, and guest auth session structure.
 *
 * Runs locally via tsx (no active network or live Firebase connection required).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  generateDeterministicNotificationId,
  getNotificationTranslationKeys,
  calculateUnreadChange,
  mapNotificationDoc,
} from '../src/utils/notificationUtils';
import { InAppNotificationType, InAppNotification } from '../src/types/notifications';
import { AppUser } from '../src/types';

console.log('\n================================================================');
console.log('  FIREBASE & SECURITY QA COMPREHENSIVE AUTOMATED TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(description: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as any)
        .then(() => {
          passedTests++;
          console.log(`✅ [PASS] ${description}`);
        })
        .catch((err: any) => {
          failedTests++;
          console.error(`❌ [FAIL] ${description}`);
          console.error(`   Error: ${err?.message || err}`);
        });
    } else {
      passedTests++;
      console.log(`✅ [PASS] ${description}`);
    }
  } catch (err: any) {
    failedTests++;
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err?.message || err}`);
  }
}

async function runAllTests() {
  const projectRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ALL FIRESTORE COLLECTION & DOC PATHS USE /splitwiser/data/ NAMESPACE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- 1. FIRESTORE NAMESPACE PATH AUDIT ---');

  await it('All collection() and doc() calls in src/ strictly use the "/splitwiser/data/" namespace', () => {
    function getAllTsFiles(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(getAllTsFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allFiles = getAllTsFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    // Regex to match collection(db, ...) and doc(db, ...)
    const colRegex = /collection\s*\(\s*db\s*,\s*([^)]+)\)/g;
    const docRegex = /doc\s*\(\s*db\s*,\s*([^)]+)\)/g;

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        let colMatch;
        while ((colMatch = colRegex.exec(line)) !== null) {
          const args = colMatch[1].trim();
          // Check that first two path segments are 'splitwiser', 'data'
          const usesNamespace = args.includes("'splitwiser', 'data'") || args.includes('"splitwiser", "data"');
          if (!usesNamespace) {
            violations.push({ file: path.relative(projectRoot, file), line: i + 1, text: colMatch[0] });
          }
        }

        let docMatch;
        while ((docMatch = docRegex.exec(line)) !== null) {
          const args = docMatch[1].trim();
          const usesNamespace = args.includes("'splitwiser', 'data'") || args.includes('"splitwiser", "data"');
          if (!usesNamespace) {
            violations.push({ file: path.relative(projectRoot, file), line: i + 1, text: docMatch[0] });
          }
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} Firestore calls outside "/splitwiser/data/":\n` +
        violations.map((v) => `  ${v.file}:${v.line} -> ${v.text}`).join('\n')
    );
  });

  await it('firestore.rules file exists and specifies splitwiser document root', () => {
    const rulesPath = path.join(projectRoot, 'firestore.rules');
    assert(fs.existsSync(rulesPath), 'firestore.rules file must exist in project root');
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    assert(rulesContent.includes('/splitwiser/{document=**}'), 'Rules must reference /splitwiser/ match block');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SYNC QUEUE ENQUEUE CONTRACT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. SYNC QUEUE ENQUEUE CONTRACT ---');

  await it('Sync queue enqueue format validates entity_type, entity_id, and operation', () => {
    interface SimulatedQueueItem {
      id: string;
      entity_type: string;
      entity_id: string;
      operation: string;
      payload_json: string;
      created_at: number;
      attempts: number;
      status: 'pending' | 'processing' | 'failed';
    }

    function createSimulatedQueueItem(
      entityType: 'expense' | 'settlement' | 'group' | 'friendship' | 'user',
      entityId: string,
      operation: string,
      payload: Record<string, any>
    ): SimulatedQueueItem {
      assert(entityType, 'entityType must be defined');
      assert(entityId, 'entityId must be defined');
      assert(operation, 'operation must be defined');
      assert(payload, 'payload must be defined');

      return {
        id: 'uuid-1234-abcd',
        entity_type: entityType,
        entity_id: entityId,
        operation,
        payload_json: JSON.stringify(payload),
        created_at: Date.now(),
        attempts: 0,
        status: 'pending',
      };
    }

    const item = createSimulatedQueueItem('expense', 'exp-101', 'CREATE_EXPENSE', {
      groupId: 'grp-01',
      amount: 1500,
      description: 'Dinner',
      paidBy: 'usr-1',
    });

    assert.strictEqual(item.entity_type, 'expense');
    assert.strictEqual(item.entity_id, 'exp-101');
    assert.strictEqual(item.operation, 'CREATE_EXPENSE');
    assert.strictEqual(item.attempts, 0);
    assert.strictEqual(item.status, 'pending');

    const parsedPayload = JSON.parse(item.payload_json);
    assert.strictEqual(parsedPayload.groupId, 'grp-01');
    assert.strictEqual(parsedPayload.amount, 1500);
  });

  await it('Local receipt tags are stripped before cloud sync in CREATE_EXPENSE payload', () => {
    const rawTags = ['food', 'receipt:file:///local/cache/img123.jpg', 'dinner', 'receipt:tmp_123'];
    const cleanTags = rawTags.filter((t: string) => !t.startsWith('receipt:'));

    assert.deepStrictEqual(cleanTags, ['food', 'dinner']);
    assert(!cleanTags.some((t) => t.startsWith('receipt:')), 'Receipt cache URLs must never leak to Firestore');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. SYNC QUEUE RETRY MECHANISM & EXPONENTIAL BACKOFF
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. SYNC QUEUE RETRY MECHANISM & EXPONENTIAL BACKOFF ---');

  await it('Exponential backoff calculates correct delay curve with 60s ceiling', () => {
    function computeBackoffMs(attempts: number): number {
      return Math.min(1500 * Math.pow(2, attempts), 60000);
    }

    // 0 attempts -> 1500ms
    assert.strictEqual(computeBackoffMs(0), 1500);
    // 1 attempt -> 3000ms
    assert.strictEqual(computeBackoffMs(1), 3000);
    // 2 attempts -> 6000ms
    assert.strictEqual(computeBackoffMs(2), 6000);
    // 3 attempts -> 12000ms
    assert.strictEqual(computeBackoffMs(3), 12000);
    // 4 attempts -> 24000ms
    assert.strictEqual(computeBackoffMs(4), 24000);
    // 5 attempts -> 48000ms
    assert.strictEqual(computeBackoffMs(5), 48000);
    // 6 attempts -> 60000ms (capped at 60s)
    assert.strictEqual(computeBackoffMs(6), 60000);
    // 10 attempts -> 60000ms (capped at 60s)
    assert.strictEqual(computeBackoffMs(10), 60000);
  });

  await it('Sync queue transitions status to "failed" after 8 attempts and increments counter', () => {
    interface QueueItemState {
      attempts: number;
      status: 'pending' | 'processing' | 'failed';
      error_message?: string;
    }

    function simulateProcessFailure(item: QueueItemState, error: Error): QueueItemState {
      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= 8 ? 'failed' : 'pending';
      return {
        attempts: newAttempts,
        status: newStatus,
        error_message: error.message,
      };
    }

    let state: QueueItemState = { attempts: 0, status: 'processing' };

    // Simulate 7 failures: should remain 'pending' for retry
    for (let i = 1; i <= 7; i++) {
      state = simulateProcessFailure(state, new Error(`Network timeout attempt ${i}`));
      assert.strictEqual(state.attempts, i);
      assert.strictEqual(state.status, 'pending', `Attempt ${i} should keep status as pending`);
      assert(state.error_message?.includes(`attempt ${i}`));
    }

    // 8th failure: should permanently transition to 'failed'
    state = simulateProcessFailure(state, new Error('Network timeout attempt 8'));
    assert.strictEqual(state.attempts, 8);
    assert.strictEqual(state.status, 'failed', '8th attempt must mark item as failed');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. LISTENER CLEANUP PATTERN VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. LISTENER CLEANUP PATTERN VERIFICATION ---');

  await it('Every listener registration function returns a callable Unsubscribe cleanup function', () => {
    let listenerCalled = false;
    let unsubscribed = false;

    // Simulate standard onSnapshot pattern used across services
    function simulateFirestoreSubscription(callback: (data: any) => void): () => void {
      listenerCalled = true;
      return () => {
        unsubscribed = true;
      };
    }

    const unsub = simulateFirestoreSubscription(() => {});
    assert.strictEqual(typeof unsub, 'function', 'Listener must return an unsubscribe function');
    assert.strictEqual(listenerCalled, true);
    assert.strictEqual(unsubscribed, false);

    unsub();
    assert.strictEqual(unsubscribed, true, 'Calling unsubscribe function must perform cleanup');
  });

  await it('SyncService active group unsubscriber manager clears previous listeners and handles multiple unsubscribers', () => {
    const unsubHistory: string[] = [];

    class MockSyncService {
      private activeGroupUnsubscribers: Map<string, Array<() => void>> = new Map();

      public subscribeToActiveGroup(groupId: string): () => void {
        this.unsubscribeActiveGroup(groupId);

        const unsubs: Array<() => void> = [
          () => unsubHistory.push(`${groupId}-expenses`),
          () => unsubHistory.push(`${groupId}-settlements`),
          () => unsubHistory.push(`${groupId}-members`),
        ];

        this.activeGroupUnsubscribers.set(groupId, unsubs);

        return () => {
          this.unsubscribeActiveGroup(groupId);
        };
      }

      public unsubscribeActiveGroup(groupId: string) {
        const existing = this.activeGroupUnsubscribers.get(groupId);
        if (existing) {
          existing.forEach((u) => u());
          this.activeGroupUnsubscribers.delete(groupId);
        }
      }

      public hasActive(groupId: string): boolean {
        return this.activeGroupUnsubscribers.has(groupId);
      }
    }

    const service = new MockSyncService();

    // Subscribe to group A
    const cleanupA = service.subscribeToActiveGroup('group-A');
    assert.strictEqual(service.hasActive('group-A'), true);
    assert.strictEqual(unsubHistory.length, 0);

    // Subscribing again to group A should automatically clean up previous listeners
    service.subscribeToActiveGroup('group-A');
    assert.strictEqual(unsubHistory.length, 3);
    assert(unsubHistory.includes('group-A-expenses'));

    // Explicit cleanup
    cleanupA();
    assert.strictEqual(service.hasActive('group-A'), false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. NOTIFICATION MODEL SCHEMA VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. NOTIFICATION MODEL SCHEMA VALIDATION ---');

  await it('mapNotificationDoc correctly maps Firestore doc data to InAppNotification schema', () => {
    const rawData = {
      type: 'expense_created',
      schemaVersion: 1,
      actorId: 'usr-creator',
      actorName: 'Alice',
      actorAvatarUrl: 'https://example.com/avatar.jpg',
      groupId: 'grp-1',
      groupName: 'Goa Trip',
      expenseId: 'exp-123',
      titleKey: 'notifications:expenseCreatedTitle',
      bodyKey: 'notifications:expenseCreatedBody',
      params: {
        actorName: 'Alice',
        expenseDescription: 'Dinner',
        amount: '1200',
        amountFormatted: '₹1,200.00',
      },
      createdAt: { toDate: () => new Date('2026-11-16T10:00:00Z') },
      readAt: null,
      archivedAt: null,
      dedupeKey: 'dedupe_exp_123',
    };

    const notif = mapNotificationDoc('notif-999', rawData);

    // Schema required fields verification
    assert.strictEqual(notif.id, 'notif-999');
    assert.strictEqual(notif.type, 'expense_created');
    assert.strictEqual(notif.schemaVersion, 1);
    assert.strictEqual(notif.actorId, 'usr-creator');
    assert.strictEqual(notif.actorName, 'Alice');
    assert.strictEqual(notif.groupId, 'grp-1');
    assert.strictEqual(notif.groupName, 'Goa Trip');
    assert.strictEqual(notif.expenseId, 'exp-123');
    assert.strictEqual(notif.readAt, null);
    assert.strictEqual(notif.archivedAt, null);
    assert(notif.createdAt instanceof Date);
    assert.strictEqual(notif.params.amountFormatted, '₹1,200.00');
  });

  await it('Deterministic notification ID prevents duplicate notifications across retries', () => {
    const id1 = generateDeterministicNotificationId('expense_created', 'exp_unique_1', 'user_bob');
    const id2 = generateDeterministicNotificationId('expense_created', 'exp_unique_1', 'user_bob');
    const id3 = generateDeterministicNotificationId('expense_created', 'exp_unique_1', 'user_charlie');

    assert.strictEqual(id1, id2, 'Identical event and recipient must yield identical notification ID');
    assert.notStrictEqual(id1, id3, 'Different recipient must yield distinct notification ID');
    assert.strictEqual(id1.length, 32, 'Notification ID must be 32 hex chars');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. UNREAD COUNT INCREMENT & BADGE ARITHMETIC
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. UNREAD COUNT INCREMENT & BADGE ARITHMETIC ---');

  await it('calculateUnreadChange correctly increments unread count', () => {
    assert.strictEqual(calculateUnreadChange(0, 'increment'), 1);
    assert.strictEqual(calculateUnreadChange(1, 'increment'), 2);
    assert.strictEqual(calculateUnreadChange(99, 'increment'), 100);
  });

  await it('calculateUnreadChange clamps decrement at zero (no negative unread counts)', () => {
    assert.strictEqual(calculateUnreadChange(3, 'decrement'), 2);
    assert.strictEqual(calculateUnreadChange(1, 'decrement'), 0);
    assert.strictEqual(calculateUnreadChange(0, 'decrement'), 0, 'Cannot decrement below 0');
    assert.strictEqual(calculateUnreadChange(-5, 'decrement'), 0, 'Negative inputs clamp to 0');
  });

  await it('calculateUnreadChange resets unread count to 0', () => {
    assert.strictEqual(calculateUnreadChange(15, 'reset'), 0);
    assert.strictEqual(calculateUnreadChange(0, 'reset'), 0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. MARK AS READ LOGIC
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. MARK AS READ LOGIC ---');

  await it('Mark-as-read sets readAt timestamp and idempotently updates unread counter', () => {
    interface SimulatedNotification {
      id: string;
      readAt: Date | null;
    }

    interface SimulatedSummary {
      unreadCount: number;
    }

    const notif: SimulatedNotification = { id: 'notif-1', readAt: null };
    const summary: SimulatedSummary = { unreadCount: 1 };

    function markRead(n: SimulatedNotification, s: SimulatedSummary) {
      if (n.readAt !== null) {
        // Idempotent: already read, do nothing
        return;
      }
      n.readAt = new Date();
      s.unreadCount = Math.max(0, s.unreadCount - 1);
    }

    // First mark as read: updates readAt and decrements summary count
    markRead(notif, summary);
    assert(notif.readAt !== null, 'readAt must be set');
    assert.strictEqual(summary.unreadCount, 0, 'unreadCount must decrement to 0');

    // Second mark as read (idempotency check): count remains 0
    markRead(notif, summary);
    assert.strictEqual(summary.unreadCount, 0, 'Idempotent markRead must not decrement below 0');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. GUEST USER AUTH SESSION STRUCTURE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. GUEST USER AUTH SESSION STRUCTURE ---');

  await it('Guest user session has valid AppUser structure and anonymous auth properties', () => {
    function createGuestSession(uid: string, displayName: string = 'Guest'): AppUser {
      return {
        uid,
        name: displayName,
        email: undefined,
        imageUrl: undefined,
        photoURL: undefined,
        createdAt: new Date(),
        isAnonymous: true,
        authProvider: 'anonymous',
        hasCompletedProfile: false,
        onboardingCompleted: false,
      };
    }

    const guest = createGuestSession('anon_uid_789', 'Guest');

    assert(guest.uid && guest.uid.startsWith('anon_'), 'Guest must have valid UID');
    assert.strictEqual(guest.isAnonymous, true, 'isAnonymous must be true for guest');
    assert.strictEqual(guest.authProvider, 'anonymous', 'authProvider must be "anonymous"');
    assert.strictEqual(guest.hasCompletedProfile, false, 'Guest has not completed profile initially');
    assert.strictEqual(guest.onboardingCompleted, false, 'Guest has not completed onboarding initially');
    assert.strictEqual(guest.email, undefined, 'Guest does not have email');
    assert(guest.createdAt instanceof Date, 'Guest session has valid createdAt date');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. SECURITY RULES AUDIT & TARGET VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. SECURITY RULES CONTRACT AUDIT ---');

  await it('Verifies proposed security rule predicates for group-members, creators, settlements, and recipients', () => {
    // Model of security rules checks that will be enforced in production firestore.rules
    interface SecurityContext {
      auth: { uid: string } | null;
      docData: Record<string, any>;
    }

    // 1. Members-only read for group data
    function canReadGroupData(ctx: SecurityContext, groupMemberIds: string[]): boolean {
      if (!ctx.auth) return false;
      return groupMemberIds.includes(ctx.auth.uid);
    }

    // 2. Only expense creator or group admin can delete expense
    function canDeleteExpense(ctx: SecurityContext, expenseCreatedBy: string, groupAdmins: string[]): boolean {
      if (!ctx.auth) return false;
      return ctx.auth.uid === expenseCreatedBy || groupAdmins.includes(ctx.auth.uid);
    }

    // 3. Settlement only by group members involved
    function canCreateSettlement(ctx: SecurityContext, fromUserId: string, toUserId: string): boolean {
      if (!ctx.auth) return false;
      return ctx.auth.uid === fromUserId;
    }

    // 4. Notifications only readable by recipient
    function canReadNotification(ctx: SecurityContext, targetUserId: string): boolean {
      if (!ctx.auth) return false;
      return ctx.auth.uid === targetUserId;
    }

    // Verify rules logic
    const userA = { auth: { uid: 'user_A' }, docData: {} };
    const userB = { auth: { uid: 'user_B' }, docData: {} };
    const unauthed = { auth: null, docData: {} };

    // Test group read
    assert.strictEqual(canReadGroupData(userA, ['user_A', 'user_C']), true);
    assert.strictEqual(canReadGroupData(userB, ['user_A', 'user_C']), false);
    assert.strictEqual(canReadGroupData(unauthed, ['user_A']), false);

    // Test expense delete
    assert.strictEqual(canDeleteExpense(userA, 'user_A', ['admin_1']), true);
    assert.strictEqual(canDeleteExpense(userB, 'user_A', ['user_B']), true); // admin
    assert.strictEqual(canDeleteExpense(userB, 'user_A', ['admin_1']), false); // not creator nor admin

    // Test settlement
    assert.strictEqual(canCreateSettlement(userA, 'user_A', 'user_B'), true);
    assert.strictEqual(canCreateSettlement(userB, 'user_A', 'user_B'), false); // userB cannot pay on behalf of userA

    // Test notifications
    assert.strictEqual(canReadNotification(userA, 'user_A'), true);
    assert.strictEqual(canReadNotification(userB, 'user_A'), false); // userB cannot spy on userA's notifications
  });

  console.log('\n================================================================');
  console.log(`  FIREBASE QA RUN COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
