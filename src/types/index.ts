// ─── Sync Status ─────────────────────────────────────────────────────────────
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

// ─── User ────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  name: string;
  createdAt: Date;
  isAnonymous: boolean;
  imageUrl?: string;
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

export interface GroupMember {
  userId: string;
  userName: string;
  role: MemberRole;
  joinedAt: Date;
  imageUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  currency: string;
  joinCode: string;
  createdBy: string;
  createdAt: Date;
  imageUrl?: string;
  bannerUrl?: string;
  icon?: string;
  memberIds: string[];
  updatedAt?: Date;
  syncStatus?: SyncStatus;
  isDeleted?: boolean;
}

// ─── Expense ─────────────────────────────────────────────────────────────────
export type SplitType = 'equal' | 'unequal' | 'percentage';

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
