// ─── Sync Status ─────────────────────────────────────────────────────────────
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

// ─── User ────────────────────────────────────────────────────────────────────
export type ProfilePhotoSource = 'custom' | 'google' | 'none';

export interface AppUser {
  uid: string;
  name: string;
  createdAt: Date;
  isAnonymous: boolean;
  imageUrl?: string;
  customPhotoUrl?: string;
  googlePhotoUrl?: string;
  photoSource?: ProfilePhotoSource;
  email?: string;
  photoURL?: string;
  authProvider?: string;
  updatedAt?: Date;
  accountLinkedAt?: Date;
  phone?: string;
  currency?: string;
  timezone?: string;
  language?: string;
}

// ─── Group ───────────────────────────────────────────────────────────────────
export type MemberRole = 'admin' | 'member';

export type GroupType = 'home' | 'trip' | 'couple' | 'family' | 'friends' | 'office' | 'other';

export interface GroupSettings {
  simplifyDebts?: boolean;
  defaultSplitType?: SplitType;
  defaultParticipants?: 'all' | 'custom' | 'last';
  memberPermissions?: 'anyone' | 'admin_only';
}

export interface GroupUserPreferences {
  hideUninvolvedExpenses: boolean;
  muted: boolean;
  notifications: {
    newExpenses: boolean;
    expenseUpdates: boolean;
    settlements: boolean;
    comments: boolean;
    reminders: boolean;
  };
}

export const DEFAULT_GROUP_PREFERENCES: GroupUserPreferences = {
  hideUninvolvedExpenses: false,
  muted: false,
  notifications: {
    newExpenses: true,
    expenseUpdates: true,
    settlements: true,
    comments: true,
    reminders: true,
  },
};

export interface GroupActivity {
  id: string;
  groupId: string;
  actorId: string;
  actorName: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface GroupMember {
  userId: string;
  userName: string;
  role: MemberRole;
  joinedAt: Date;
  imageUrl?: string;
}

export interface GroupCoverPhoto {
  type: 'preset' | 'custom';
  imageUrl: string;
  storagePath?: string;
  presetId?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Group {
  id: string;
  name: string;
  type?: GroupType;
  description?: string;
  currency: string;
  joinCode: string;
  createdBy: string;
  createdAt: Date;
  imageUrl?: string;
  bannerUrl?: string;
  coverPhoto?: GroupCoverPhoto;
  icon?: string;
  memberIds: string[];
  settings?: GroupSettings;
  isArchived?: boolean;
  status?: 'active' | 'archived' | 'deleted';
  updatedAt?: Date;
  syncStatus?: SyncStatus;
  isDeleted?: boolean;
}

// ─── Expense ─────────────────────────────────────────────────────────────────
export type SplitType = 'equal' | 'unequal' | 'percentage' | 'shares' | 'adjustment' | 'itemized';

export interface ExpenseSplit {
  userId: string;
  amount: number;
  type: SplitType;
}

export interface Expense {
  id: string;
  groupId: string;
  createdBy: string;
  paidBy: string;
  description: string;
  amount: number;
  splits: ExpenseSplit[];
  splitType: SplitType;
  currency: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: SyncStatus;
  isDeleted?: boolean;
}

export interface ExpenseCreateInput {
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: ExpenseSplit[];
  tags?: string[];
  createdAt?: Date | number;
}

// ─── Settlement ───────────────────────────────────────────────────────────────
export type SettlementStatus = 'pending' | 'completed';

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  amount: number;
  status: SettlementStatus;
  createdAt: Date;
  note?: string;
  syncStatus?: SyncStatus;
  isDeleted?: boolean;
}

// Optimized settlement (computed client-side, not stored)
export interface OptimizedSettlement {
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  amount: number;
}

// ─── Friends / Balance ────────────────────────────────────────────────────────
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'removed';

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  friendName: string;
  friendEmail?: string;
  friendPhotoUrl?: string;
  status: FriendshipStatus;
  initiatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: SyncStatus;
}

export interface GroupBalance {
  groupId: string;
  groupName: string;
  balance: number;
}

export interface FriendBalance {
  userId: string;
  userName: string;
  userEmail?: string;
  userPhotoUrl?: string;
  netBalance: number;
  groups: GroupBalance[];
  directBalance?: number;
  friendshipId?: string;
  status?: FriendshipStatus;
}

export interface FriendTransactionItem {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  paidBy: string;
  payerName: string;
  date: Date;
  groupId: string | null;
  groupName?: string;
  balanceImpact: number; // positive = increased what friend owes me, negative = decreased
}

export * from './notifications';
