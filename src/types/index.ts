// ─── User ────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  name: string;
  createdAt: Date;
  isAnonymous: boolean;
  imageUrl?: string;
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
  icon?: string;
  memberIds: string[];
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
export interface GroupBalance {
  groupId: string;
  groupName: string;
  balance: number;
}

export interface FriendBalance {
  userId: string;
  userName: string;
  netBalance: number;
  groups: GroupBalance[];
}
