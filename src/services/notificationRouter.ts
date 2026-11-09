import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { InAppNotification } from '../types/notifications';
import { networkMonitor } from '../sync/networkMonitor';

export interface RouteTarget {
  screen: string;
  params: Record<string, any>;
  unavailableNotice?: string;
}

/**
 * Resolves a notification to a safe navigation target after validating
 * document existence and avoiding broken navigation states.
 */
export async function resolveNotificationRoute(
  notification: InAppNotification,
  currentUserId?: string
): Promise<RouteTarget> {
  const { type, groupId, groupName, expenseId, settlementId } = notification;

  // 1. Check if group still exists
  let isGroupAvailable = true;
  if (groupId && networkMonitor.isCurrentlyOnline()) {
    try {
      const gSnap = await getDoc(doc(db, 'splitwiser', 'data', 'groups', groupId));
      isGroupAvailable = gSnap.exists();
    } catch {
      // Offline fallback: assume available
      isGroupAvailable = true;
    }
  }

  if (groupId && !isGroupAvailable) {
    return {
      screen: 'Home',
      params: {},
      unavailableNotice: 'The group associated with this notification has been deleted.',
    };
  }

  // 2. Check if expense still exists when needed
  let isExpenseAvailable = true;
  if (groupId && expenseId && networkMonitor.isCurrentlyOnline()) {
    try {
      const eSnap = await getDoc(
        doc(db, 'splitwiser', 'data', 'groups', groupId, 'expenses', expenseId)
      );
      isExpenseAvailable = eSnap.exists();
    } catch {
      isExpenseAvailable = true;
    }
  }

  // 3. Match notification type to navigation route
  switch (type) {
    case 'expense_created':
    case 'expense_updated':
    case 'expense_comment':
    case 'member_mention':
      if (groupId) {
        return {
          screen: 'GroupDetails',
          params: {
            groupId,
            groupName: groupName || 'Group',
            highlightExpenseId: isExpenseAvailable ? expenseId : undefined,
          },
          unavailableNotice: !isExpenseAvailable
            ? 'The expense has been deleted by another member.'
            : undefined,
        };
      }
      return { screen: 'Home', params: {} };

    case 'expense_deleted':
      return {
        screen: 'GroupDetails',
        params: {
          groupId,
          groupName: groupName || 'Group',
          initialTab: 0, // Expenses tab
        },
      };

    case 'settlement_created':
    case 'settlement_updated':
    case 'settlement_deleted':
      return {
        screen: 'GroupDetails',
        params: {
          groupId,
          groupName: groupName || 'Group',
          initialTab: 2, // Balances tab
        },
      };

    case 'group_invitation':
      return {
        screen: groupId ? 'GroupDetails' : 'JoinGroup',
        params: groupId ? { groupId, groupName: groupName || 'Group' } : {},
      };

    case 'member_joined':
    case 'member_removed':
    case 'group_updated':
      return {
        screen: 'GroupDetails',
        params: {
          groupId,
          groupName: groupName || 'Group',
        },
      };

    case 'payment_reminder':
    case 'scheduled_reminder':
      return {
        screen: 'GroupDetails',
        params: {
          groupId,
          groupName: groupName || 'Group',
          initialTab: 2, // Balances tab
        },
      };

    default:
      return {
        screen: 'Home',
        params: {},
      };
  }
}

