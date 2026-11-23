import { formatCurrency } from '../utils/currency';

// ── Official App Constants ──────────────────────────────────────────────────
export const APP_NAME = 'Splitwiser';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.prashiln79.splitwiser';
export const APP_SCHEME = 'splitwiser://';

/**
 * Generates the deep link URL for joining a group with a 6-character join code.
 */
export function getGroupJoinDeepLink(joinCode: string): string {
  const code = (joinCode || '').trim().toUpperCase();
  return `${APP_SCHEME}join?code=${encodeURIComponent(code)}`;
}

/**
 * Safely formats a date for share messages in 'DD Mon YYYY' format (e.g., '23 Nov 2026').
 */
export function formatShareDate(date?: Date | string | number | null): string {
  if (!date) {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Helper to select an appropriate emoji for a group type or fallback.
 */
export function getGroupTypeEmoji(type?: string): string {
  const normalized = (type || '').toLowerCase();
  switch (normalized) {
    case 'trip':
      return '🏖️';
    case 'home':
      return '🏠';
    case 'couple':
      return '❤️';
    case 'work':
      return '💼';
    case 'event':
      return '🎉';
    default:
      return '👥';
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface GroupInviteParams {
  groupName: string;
  joinCode: string;
  memberCount?: number;
  groupType?: string;
}

export interface FriendInviteParams {
  name?: string;
  uid?: string;
}

export interface ExpenseShareParams {
  groupName: string;
  description: string;
  amount: number;
  currency?: string;
  paidByName: string;
  date?: Date | string | number;
  splitCount: number;
}

export interface SettlementShareParams {
  fromName: string;
  toName: string;
  amount: number;
  currency?: string;
  date?: Date | string | number;
  note?: string;
}

export interface ReminderParams {
  recipientName: string;
  groupName: string;
  amount: number;
  currency?: string;
  payToName: string;
}

// ── Message Builders ────────────────────────────────────────────────────────

/**
 * 1. Group invitation message
 */
export function buildGroupInviteMessage({
  groupName,
  joinCode,
  memberCount,
  groupType,
}: GroupInviteParams): string {
  const safeName = (groupName || 'Group').trim();
  const safeCode = (joinCode || '').trim().toUpperCase();
  const deepLink = getGroupJoinDeepLink(safeCode);
  const icon = getGroupTypeEmoji(groupType);

  const lines = [
    `👋 *You're invited to join ${safeName}!*`,
    '',
    `Let's manage our shared expenses together with *${APP_NAME}*.`,
    '',
    `${icon} Group: ${safeName}`,
  ];

  if (typeof memberCount === 'number' && memberCount > 0) {
    lines.push(`👥 Members: ${memberCount}`);
  }

  lines.push(`🔑 Join Code: ${safeCode}`);
  lines.push('');
  lines.push('🔗 *Join the group:*');
  lines.push(deepLink);
  lines.push('');
  lines.push(`📲 *Don't have ${APP_NAME} yet?*`);
  lines.push('Download the app:');
  lines.push(PLAY_STORE_URL);
  lines.push('');
  lines.push('💚 Split expenses. Stay organized. Enjoy together!');

  return lines.join('\n');
}

/**
 * 2. Friend invitation message
 */
export function buildFriendInviteMessage({ name, uid }: FriendInviteParams = {}): string {
  const lines = [
    '👋 Hey!',
    '',
    `Let's connect on *${APP_NAME}* and easily manage shared expenses.`,
    '',
    '💸 Track who paid, split expenses and settle balances without manual calculations.',
  ];

  if (name || uid) {
    lines.push('');
    if (name) {
      lines.push(`👤 Friend: ${name.trim()}`);
    }
    if (uid) {
      lines.push(`🔑 Friend ID: ${uid.trim()}`);
    }
  }

  lines.push('');
  lines.push(`📲 Download ${APP_NAME}:`);
  lines.push(PLAY_STORE_URL);
  lines.push('');
  lines.push("💚 Let's make sharing expenses easier!");

  return lines.join('\n');
}

/**
 * 3. General app sharing message
 */
export function buildAppShareMessage(): string {
  const lines = [
    `💚 *Meet ${APP_NAME}!*`,
    '',
    'Managing shared expenses has never been easier.',
    '',
    '✨ Split expenses with friends and family.',
    '👥 Manage groups and shared bills.',
    '💰 Track balances and settlements.',
    '📊 Understand your spending.',
    '🌍 Support multiple currencies.',
    '',
    `📲 *Download ${APP_NAME} for free:*`,
    PLAY_STORE_URL,
    '',
    'Share expenses. Stay organized. 💚',
  ];

  return lines.join('\n');
}

/**
 * 4. Expense sharing message
 */
export function buildExpenseShareMessage({
  groupName,
  description,
  amount,
  currency,
  paidByName,
  date,
  splitCount,
}: ExpenseShareParams): string {
  const safeGroup = (groupName || 'Group').trim();
  const safeDesc = (description || 'Expense').trim();
  const formattedAmt = formatCurrency(Number(amount) || 0, currency);
  const formattedDate = formatShareDate(date);
  const safePayer = (paidByName || 'A member').trim();
  const memberText = splitCount === 1 ? '1 member' : `${Math.max(1, splitCount)} members`;

  const lines = [
    `🧾 *Expense Details — ${safeGroup}*`,
    '',
    `🍽️ Description: ${safeDesc}`,
    `💰 Amount: ${formattedAmt}`,
    `👤 Paid by: ${safePayer}`,
    `📅 Date: ${formattedDate}`,
    `👥 Split between: ${memberText}`,
    '',
    `Shared using *${APP_NAME}* 💚`,
    '',
    '📲 Get the app:',
    PLAY_STORE_URL,
  ];

  return lines.join('\n');
}

/**
 * 5. Settlement / Payment receipt sharing message
 */
export function buildSettlementShareMessage({
  fromName,
  toName,
  amount,
  currency,
  date,
  note,
}: SettlementShareParams): string {
  const formattedAmt = formatCurrency(Number(amount) || 0, currency);
  const formattedDate = formatShareDate(date);
  const safeFrom = (fromName || 'Someone').trim();
  const safeTo = (toName || 'Someone').trim();

  const lines = [
    `💸 *Payment Receipt — ${APP_NAME}*`,
    '',
    '✅ Status: Settled',
    `👤 Paid by: ${safeFrom}`,
    `🤝 Paid to: ${safeTo}`,
    `💰 Amount: ${formattedAmt}`,
    `📅 Date: ${formattedDate}`,
  ];

  if (note && note.trim()) {
    lines.push(`📝 Note: ${note.trim()}`);
  }

  lines.push('');
  lines.push(`Track and settle group expenses easily with *${APP_NAME}* 💚`);
  lines.push('');
  lines.push('📲 Download the app:');
  lines.push(PLAY_STORE_URL);

  return lines.join('\n');
}

/**
 * 6. Balance / Payment Reminder (Individual)
 */
export function buildReminderMessage({
  recipientName,
  groupName,
  amount,
  currency,
  payToName,
}: ReminderParams): string {
  const safeRecipient = (recipientName || 'there').trim();
  const safeGroup = (groupName || 'our group').trim();
  const formattedAmt = formatCurrency(Number(amount) || 0, currency);
  const safePayTo = (payToName || 'me').trim();

  const lines = [
    `👋 Hey ${safeRecipient}!`,
    '',
    `Just a friendly reminder from our group *${safeGroup}* on *${APP_NAME}*.`,
    '',
    `💰 Outstanding balance: ${formattedAmt}`,
    `👤 Pay to: ${safePayTo}`,
    '',
    "Let's settle up whenever you have a moment! 👍",
    '',
    `📲 Manage expenses on ${APP_NAME}:`,
    PLAY_STORE_URL,
  ];

  return lines.join('\n');
}

/**
 * 7. Group Balance Reminder (Remind all)
 */
export function buildGroupReminderMessage({ groupName }: { groupName: string }): string {
  const safeGroup = (groupName || 'our group').trim();

  const lines = [
    '👋 Hey everyone!',
    '',
    `Friendly balance check for our group *${safeGroup}* on *${APP_NAME}*.`,
    '',
    'Please review your pending balances and settle up when convenient. Thanks! 👍',
    '',
    `📲 Open ${APP_NAME}:`,
    PLAY_STORE_URL,
  ];

  return lines.join('\n');
}

