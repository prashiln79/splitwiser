import {
  InAppNotificationType,
  InAppNotification,
  NotificationPreferences,
} from '../types/notifications';

/**
 * Generates a deterministic 32-character hex notification ID based on:
 * type, dedupeKey, and recipientId.
 * Prevents duplicates during retries, multi-device syncing, or offline reconciliations.
 */
export function generateDeterministicNotificationId(
  type: InAppNotificationType,
  dedupeKey: string,
  recipientId: string
): string {
  const input = `${type}:${dedupeKey}:${recipientId}`;
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c64e6d;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }

  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);

  const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((hash1 + hash2) >>> 0).toString(16).padStart(8, '0');

  return `${hex1}${hex2}${hex3}${hex4}`;
}

/**
 * Returns structured translation keys for each notification type
 */
export function getNotificationTranslationKeys(type: InAppNotificationType): {
  titleKey: string;
  bodyKey: string;
} {
  switch (type) {
    case 'expense_created':
      return { titleKey: 'notifications:expenseCreatedTitle', bodyKey: 'notifications:expenseCreatedBody' };
    case 'expense_updated':
      return { titleKey: 'notifications:expenseUpdatedTitle', bodyKey: 'notifications:expenseUpdatedBody' };
    case 'expense_deleted':
      return { titleKey: 'notifications:expenseDeletedTitle', bodyKey: 'notifications:expenseDeletedBody' };
    case 'expense_restored':
      return { titleKey: 'notifications:expenseRestoredTitle', bodyKey: 'notifications:expenseRestoredBody' };
    case 'settlement_created':
      return { titleKey: 'notifications:settlementCreatedTitle', bodyKey: 'notifications:settlementCreatedBody' };
    case 'settlement_updated':
      return { titleKey: 'notifications:settlementUpdatedTitle', bodyKey: 'notifications:settlementUpdatedBody' };
    case 'settlement_deleted':
      return { titleKey: 'notifications:settlementDeletedTitle', bodyKey: 'notifications:settlementDeletedBody' };
    case 'group_invitation':
      return { titleKey: 'notifications:groupInviteTitle', bodyKey: 'notifications:groupInviteBody' };
    case 'member_joined':
      return { titleKey: 'notifications:memberJoinedTitle', bodyKey: 'notifications:memberJoinedBody' };
    case 'member_removed':
      return { titleKey: 'notifications:memberRemovedTitle', bodyKey: 'notifications:memberRemovedBody' };
    case 'group_updated':
      return { titleKey: 'notifications:groupUpdatedTitle', bodyKey: 'notifications:groupUpdatedBody' };
    case 'payment_reminder':
      return { titleKey: 'notifications:paymentReminderTitle', bodyKey: 'notifications:paymentReminderBody' };
    case 'scheduled_reminder':
      return { titleKey: 'notifications:scheduledReminderTitle', bodyKey: 'notifications:scheduledReminderBody' };
    case 'expense_comment':
      return { titleKey: 'notifications:commentTitle', bodyKey: 'notifications:commentBody' };
    case 'member_mention':
      return { titleKey: 'notifications:mentionTitle', bodyKey: 'notifications:mentionBody' };
    default:
      return { titleKey: 'notifications:notifications', bodyKey: 'notifications:newExpense' };
  }
}

/**
 * Filters out the actor and deduplicates recipient IDs
 */
export function filterRecipients(targetUserIds: string[], actorId: string): string[] {
  return Array.from(new Set(targetUserIds.filter((id) => id && id.trim().length > 0 && id !== actorId)));
}

/**
 * Checks whether a notification should be delivered based on recipient preferences
 */
export function isNotificationAllowed(
  type: InAppNotificationType,
  groupId: string | undefined,
  prefs: NotificationPreferences
): boolean {
  if (groupId && prefs.mutedGroupIds.includes(groupId)) {
    return false;
  }

  switch (type) {
    case 'expense_created':
      return prefs.expenseAdded;
    case 'expense_updated':
      return prefs.expenseUpdated;
    case 'expense_deleted':
      return prefs.expenseDeleted;
    case 'settlement_created':
    case 'settlement_updated':
    case 'settlement_deleted':
      return prefs.settlements;
    case 'group_invitation':
      return prefs.groupInvites;
    case 'payment_reminder':
    case 'scheduled_reminder':
      return prefs.paymentReminders;
    case 'expense_comment':
    case 'member_mention':
      return prefs.comments;
    case 'member_joined':
    case 'member_removed':
    case 'group_updated':
      return prefs.memberActivity;
    default:
      return true;
  }
}

/**
 * Safe unread count arithmetic clamped at >= 0
 */
export function calculateUnreadChange(
  current: number,
  action: 'increment' | 'decrement' | 'reset'
): number {
  if (action === 'reset') return 0;
  if (action === 'increment') return current + 1;
  return Math.max(0, current - 1);
}

/**
 * Maps raw data to typed InAppNotification
 */
export function mapNotificationDoc(id: string, data: Record<string, any>): InAppNotification {
  return {
    id,
    type: data.type,
    schemaVersion: data.schemaVersion ?? 1,
    actorId: data.actorId,
    actorName: data.actorName || 'Group member',
    actorAvatarUrl: data.actorAvatarUrl ?? null,
    groupId: data.groupId ?? undefined,
    groupName: data.groupName ?? undefined,
    expenseId: data.expenseId ?? undefined,
    settlementId: data.settlementId ?? undefined,
    titleKey: data.titleKey,
    bodyKey: data.bodyKey,
    params: data.params ?? {},
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
    readAt: data.readAt?.toDate ? data.readAt.toDate() : (data.readAt || null),
    archivedAt: data.archivedAt?.toDate ? data.archivedAt.toDate() : (data.archivedAt || null),
    dedupeKey: data.dedupeKey ?? id,
  };
}

/**
 * Resolves notification target screen without requiring network calls
 */
export function getNotificationDefaultRoute(notif: InAppNotification): {
  screen: string;
  params?: Record<string, any>;
} {
  if (
    (notif.type === 'expense_created' || notif.type === 'expense_updated' || notif.type === 'expense_comment') &&
    notif.expenseId &&
    notif.groupId
  ) {
    return {
      screen: 'ExpenseDetails',
      params: { expenseId: notif.expenseId, groupId: notif.groupId },
    };
  }

  if (notif.type === 'settlement_created' || notif.type === 'settlement_updated') {
    if (notif.groupId) {
      return {
        screen: 'GroupDetails',
        params: { groupId: notif.groupId, initialTab: 'balances' },
      };
    }
  }

  if (notif.groupId) {
    return {
      screen: 'GroupDetails',
      params: { groupId: notif.groupId },
    };
  }

  return { screen: 'Home' };
}

// ─── In-memory Cache for User IDs -> Member Names ──────────────────────────────
export const globalMemberNameCache = new Map<string, string>();

export function updateMemberNameCache(
  entries: Array<{ userId: string; userName: string }> | Map<string, string> | Record<string, string>
) {
  if (entries instanceof Map) {
    entries.forEach((name, id) => {
      if (name && !/^[a-zA-Z0-9_-]{20,}$/.test(name.trim())) {
        globalMemberNameCache.set(id, name.trim());
      }
    });
  } else if (Array.isArray(entries)) {
    entries.forEach((e) => {
      if (e.userId && e.userName && !/^[a-zA-Z0-9_-]{20,}$/.test(e.userName.trim())) {
        globalMemberNameCache.set(e.userId, e.userName.trim());
      }
    });
  } else if (typeof entries === 'object' && entries !== null) {
    Object.entries(entries).forEach(([id, name]) => {
      if (name && typeof name === 'string' && !/^[a-zA-Z0-9_-]{20,}$/.test(name.trim())) {
        globalMemberNameCache.set(id, name.trim());
      }
    });
  }
}

/**
 * Resolves title and body display text for any notification, ensuring human member names
 * and cleanly formatted amounts are shown.
 */
export function resolveNotificationDisplay(
  notif: InAppNotification,
  memberMap?: Map<string, string>
): {
  title: string;
  body: string;
} {
  const params: Record<string, any> = { ...notif.params };

  // 1. Resolve human actor name
  const candidateActorId =
    notif.actorId ||
    (params as any)?.actorId ||
    (params as any)?.createdBy ||
    (params as any)?.paidBy;

  let resolvedActorName = params.actorName || notif.actorName;

  // Try candidate ID lookup in provided memberMap or global cache
  if (candidateActorId) {
    const fromMap = memberMap?.get(candidateActorId) || globalMemberNameCache.get(candidateActorId);
    if (fromMap) {
      resolvedActorName = fromMap;
    }
  }

  // Check if current resolvedActorName is a raw Firebase UID (length >= 20 without spaces and only alphanumeric)
  if (resolvedActorName && typeof resolvedActorName === 'string') {
    const raw = resolvedActorName.trim();
    if (raw.length >= 20 && !raw.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(raw)) {
      // The raw name is a UID string. Check if that UID itself is in member name map
      const fromCache = memberMap?.get(raw) || globalMemberNameCache.get(raw);
      if (fromCache) {
        resolvedActorName = fromCache;
      } else if (
        notif.actorName &&
        notif.actorName !== raw &&
        !/^[a-zA-Z0-9_-]{20,}$/.test(notif.actorName.trim())
      ) {
        resolvedActorName = notif.actorName.trim();
      } else {
        resolvedActorName = 'A member';
      }
    }
  }

  if (!resolvedActorName || resolvedActorName.trim() === '') {
    resolvedActorName = 'A member';
  }
  params.actorName = resolvedActorName;

  // 2. Format amount if missing or raw
  if (!params.amountFormatted) {
    if (params.amount !== undefined && params.amount !== null && params.amount !== '') {
      const num = Number(params.amount) || 0;
      const currency = params.currency || 'INR';
      const symbol =
        currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₹';
      params.amountFormatted = `${symbol}${num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }

  let title = notif.titleKey || 'New Expense';
  let body = notif.bodyKey || 'Expense added';

  // Translate using i18n if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const i18n = require('../i18n').default;
    if (i18n && typeof i18n.t === 'function') {
      title = String(i18n.t(notif.titleKey || 'notifications:newExpense', params));
      body = String(i18n.t(notif.bodyKey || 'notifications:newExpense', params));
    }
  } catch {
    // If i18n unavailable in test environment, use fallback templates
    if (notif.type === 'expense_created') {
      title = 'New Expense';
      body = `${resolvedActorName} added "${params.expenseDescription || 'Expense'}" ({{amountFormatted}})`;
    } else if (notif.type === 'expense_updated') {
      title = 'Expense Updated';
      body = `${resolvedActorName} updated "${params.expenseDescription || 'Expense'}"`;
    } else if (notif.type === 'settlement_created') {
      title = 'Payment Recorded';
      body = `${resolvedActorName} paid {{amountFormatted}}`;
    }
  }

  // 3. Fallback cleanup: replace any remaining literal template interpolations
  if (params.amountFormatted) {
    body = body.replace(/\{\{amountFormatted\}\}/g, params.amountFormatted);
  } else {
    // If amount is not available, remove the ({{amountFormatted}}) bracket cleanly
    body = body.replace(/\s*\(\{\{amountFormatted\}\}\)/g, '');
    body = body.replace(/\{\{amountFormatted\}\}/g, '');
    body = body.replace(/\s*\(\s*\)/g, '');
  }

  if (body.includes('{{actorName}}')) {
    body = body.replace(/\{\{actorName\}\}/g, resolvedActorName);
  }
  if (body.includes('{{expenseDescription}}')) {
    body = body.replace(/\{\{expenseDescription\}\}/g, params.expenseDescription || 'Expense');
  }
  if (body.includes('{{groupName}}')) {
    body = body.replace(/\{\{groupName\}\}/g, params.groupName || notif.groupName || 'group');
  }

  return { title, body };
}
