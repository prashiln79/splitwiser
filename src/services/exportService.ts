import { Group, GroupMember, Expense, Settlement } from '../types';
import { formatCurrency } from '../utils/currency';
import { APP_LIMITS } from '../constants/limits';

export type ExportDateRange = 'all' | 'this_month' | 'prev_month' | 'this_year';
export type ExportFormat = 'csv' | 'summary';

export interface ExportDataOptions {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  format: ExportFormat;
  dateRange: ExportDateRange;
}

export function filterItemsByDateRange<T extends { createdAt: Date | string }>(
  items: T[],
  range: ExportDateRange
): T[] {
  const now = new Date();
  if (range === 'all') return items;

  return items.filter((item) => {
    const d = new Date(item.createdAt);
    if (isNaN(d.getTime())) return true;

    if (range === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (range === 'prev_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    }
    if (range === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });
}

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  // Formula Injection Prevention: Prefix dangerous characters with single quote
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr}"`;
}

export function generateGroupCsv({
  group,
  members,
  expenses,
  settlements,
  dateRange,
}: {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  dateRange: ExportDateRange;
}): string {
  const memberNameMap = new Map(members.map((m) => [m.userId, m.userName]));
  const boundedExpenses = filterItemsByDateRange(expenses, dateRange).slice(
    0,
    APP_LIMITS.EXPORT.MAX_EXPORT_ROWS
  );
  const boundedSettlements = filterItemsByDateRange(settlements, dateRange).slice(
    0,
    APP_LIMITS.EXPORT.MAX_EXPORT_ROWS
  );

  const lines: string[] = [];

  // 1. Group Header
  lines.push(`"SPLITWISER GROUP FINANCIAL EXPORT"`);
  lines.push(`"Group Name",${escapeCsvField(group.name)}`);
  lines.push(`"Group Type",${escapeCsvField(group.type || 'Standard')}`);
  lines.push(`"Currency",${escapeCsvField(group.currency || 'INR')}`);
  lines.push(`"Date Range",${escapeCsvField(dateRange.toUpperCase())}`);
  lines.push(`"Export Generated",${escapeCsvField(new Date().toLocaleString())}`);
  lines.push(`"Total Members",${members.length}`);
  lines.push('');

  // 2. Members Summary
  lines.push(`"--- GROUP MEMBERS ---"`);
  lines.push(`"Member Name","Role","Joined Date"`);
  members.forEach((m) => {
    const joined = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '';
    lines.push(`${escapeCsvField(m.userName)},${escapeCsvField(m.role)},${escapeCsvField(joined)}`);
  });
  lines.push('');

  // 3. Expenses Table
  lines.push(`"--- EXPENSES (${boundedExpenses.length}) ---"`);
  lines.push(
    `"Date","Description","Category","Paid By","Total Amount (${group.currency || 'INR'})","Split Type","Participants Count"`
  );
  boundedExpenses.forEach((e) => {
    const dateStr = new Date(e.createdAt).toLocaleDateString();
    const payerName = memberNameMap.get(e.paidBy) || e.paidBy;
    const splitCount = e.splits?.length || 0;
    lines.push(
      [
        escapeCsvField(dateStr),
        escapeCsvField(e.description),
        escapeCsvField(e.tags?.[0] || 'General'),
        escapeCsvField(payerName),
        escapeCsvField(e.amount.toFixed(2)),
        escapeCsvField(e.splitType),
        escapeCsvField(splitCount),
      ].join(',')
    );
  });
  lines.push('');

  // 4. Settlements Table
  lines.push(`"--- RECORDED SETTLEMENTS (${boundedSettlements.length}) ---"`);
  lines.push(`"Date","From Member","To Member","Amount (${group.currency || 'INR'})"`);
  boundedSettlements.forEach((s) => {
    const dateStr = new Date(s.createdAt).toLocaleDateString();
    const fromName = memberNameMap.get(s.fromUserId) || s.fromUserId;
    const toName = memberNameMap.get(s.toUserId) || s.toUserId;
    lines.push(
      [
        escapeCsvField(dateStr),
        escapeCsvField(fromName),
        escapeCsvField(toName),
        escapeCsvField(s.amount.toFixed(2)),
      ].join(',')
    );
  });

  return lines.join('\n');
}

export function generateGroupSummary({
  group,
  members,
  expenses,
  settlements,
  dateRange,
}: {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  dateRange: ExportDateRange;
}): string {
  const memberNameMap = new Map(members.map((m) => [m.userId, m.userName]));
  const filteredExpenses = filterItemsByDateRange(expenses, dateRange);
  const filteredSettlements = filterItemsByDateRange(settlements, dateRange);

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSettledAmount = filteredSettlements.reduce((sum, s) => sum + (s.amount || 0), 0);

  const lines: string[] = [
    `📊 ${group.name.toUpperCase()} — FINANCIAL REPORT`,
    `Date Range: ${dateRange === 'all' ? 'All time' : dateRange.replace('_', ' ')}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    `----------------------------------------`,
    `Total Expenses: ${formatCurrency(totalExpenseAmount, group.currency)} (${filteredExpenses.length} transactions)`,
    `Total Settled: ${formatCurrency(totalSettledAmount, group.currency)} (${filteredSettlements.length} payments)`,
    `Members (${members.length}): ${members.map((m) => m.userName).join(', ')}`,
    `----------------------------------------`,
    `Recent Expenses:`,
  ];

  filteredExpenses.slice(0, 10).forEach((e) => {
    const payer = memberNameMap.get(e.paidBy) || e.paidBy;
    const date = new Date(e.createdAt).toLocaleDateString();
    lines.push(`• ${date} — ${e.description}: ${formatCurrency(e.amount, group.currency)} (Paid by ${payer})`);
  });

  if (filteredExpenses.length > 10) {
    lines.push(`... and ${filteredExpenses.length - 10} more expenses.`);
  }

  return lines.join('\n');
}

export async function shareGroupExport(
  options: ExportDataOptions,
  customShare?: (content: { title: string; message: string }) => Promise<any>
): Promise<void> {
  const content =
    options.format === 'csv'
      ? generateGroupCsv(options)
      : generateGroupSummary(options);

  const title = `${options.group.name}_financial_export.${options.format === 'csv' ? 'csv' : 'txt'}`;

  if (customShare) {
    await customShare({ title, message: content });
  }
}
