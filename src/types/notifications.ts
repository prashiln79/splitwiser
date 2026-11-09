import { Timestamp } from 'firebase/firestore';

export type InAppNotificationType =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'expense_restored'
  | 'settlement_created'
  | 'settlement_updated'
  | 'settlement_deleted'
  | 'group_invitation'
  | 'member_joined'
  | 'member_removed'
  | 'group_updated'
  | 'payment_reminder'
  | 'scheduled_reminder'
  | 'expense_comment'
  | 'member_mention';

export interface NotificationParams {
  actorName: string;
  expenseDescription?: string;
  amountMinor?: number;
  amountFormatted?: string;
  currency?: string;
  groupName?: string;
  note?: string;
  [key: string]: any;
}

export interface InAppNotification {
  id: string;
  type: InAppNotificationType;
  schemaVersion: number;
  actorId: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  groupId?: string;
  groupName?: string;
  expenseId?: string;
  settlementId?: string;
  titleKey: string;
  bodyKey: string;
  params: NotificationParams;
  createdAt: Date | Timestamp | string;
  readAt: Date | Timestamp | null;
  archivedAt: Date | Timestamp | null;
  dedupeKey: string;
}

export interface NotificationSummary {
  unreadCount: number;
  lastNotificationAt?: Date | Timestamp | null;
  updatedAt: Date | Timestamp;
}

export interface NotificationPreferences {
  expenseAdded: boolean;
  expenseUpdated: boolean;
  expenseDeleted: boolean;
  settlements: boolean;
  groupInvites: boolean;
  paymentReminders: boolean;
  comments: boolean;
  memberActivity: boolean;
  inAppBanners: boolean;
  mutedGroupIds: string[];
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  expenseAdded: true,
  expenseUpdated: true,
  expenseDeleted: true,
  settlements: true,
  groupInvites: true,
  paymentReminders: true,
  comments: true,
  memberActivity: true,
  inAppBanners: true,
  mutedGroupIds: [],
};

export interface NotificationEventInput {
  type: InAppNotificationType;
  actor: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  groupId?: string;
  groupName?: string;
  expenseId?: string;
  settlementId?: string;
  targetUserIds: string[]; // List of potential recipient user IDs
  params: NotificationParams;
  dedupeKey: string;
}

