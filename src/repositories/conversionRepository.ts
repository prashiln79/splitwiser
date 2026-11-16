import * as Crypto from 'expo-crypto';
import { getDatabase } from '../db/sqlite';
import { CurrencyConversionRecord, SyncStatus } from '../types';
import { syncQueue } from '../sync/syncQueue';
import { normalizeCurrencyCode } from '../utils/currency';

export interface LocalConversionRow {
  id: string;
  group_id: string;
  created_by: string;
  source_currency: string;
  target_currency: string;
  source_amount_minor: number;
  target_amount_minor: number;
  exchange_rate: number;
  rate_timestamp: number;
  rate_source: string;
  note: string | null;
  created_at: number;
  sync_status: SyncStatus;
  is_deleted: number;
}

function rowToConversion(row: LocalConversionRow): CurrencyConversionRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    sourceCurrency: normalizeCurrencyCode(row.source_currency),
    targetCurrency: normalizeCurrencyCode(row.target_currency),
    sourceAmountMinor: row.source_amount_minor,
    targetAmountMinor: row.target_amount_minor,
    exchangeRate: row.exchange_rate,
    rateTimestamp: row.rate_timestamp,
    rateSource: (row.rate_source as any) || 'live',
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at),
    syncStatus: row.sync_status,
    isDeleted: Boolean(row.is_deleted),
  };
}

/**
 * Records an explicit currency conversion in SQLite and enqueues for Firestore sync.
 */
export async function recordConversionLocal(
  groupId: string,
  createdBy: string,
  sourceCurrency: string,
  targetCurrency: string,
  sourceAmountMinor: number,
  targetAmountMinor: number,
  exchangeRate: number,
  rateTimestamp: number,
  rateSource: 'live' | 'cached' | 'offline',
  note?: string
): Promise<CurrencyConversionRecord> {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const from = normalizeCurrencyCode(sourceCurrency);
  const to = normalizeCurrencyCode(targetCurrency);

  const record: CurrencyConversionRecord = {
    id,
    groupId,
    createdBy,
    sourceCurrency: from,
    targetCurrency: to,
    sourceAmountMinor,
    targetAmountMinor,
    exchangeRate,
    rateTimestamp,
    rateSource,
    note,
    createdAt: new Date(now),
    syncStatus: 'pending',
    isDeleted: false,
  };

  await database.runAsync(
    `INSERT INTO local_currency_conversions (
      id, group_id, created_by, source_currency, target_currency,
      source_amount_minor, target_amount_minor, exchange_rate,
      rate_timestamp, rate_source, note, created_at, sync_status, is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [
      id,
      groupId,
      createdBy,
      from,
      to,
      sourceAmountMinor,
      targetAmountMinor,
      exchangeRate,
      rateTimestamp,
      rateSource,
      note ?? null,
      now,
    ]
  );

  await syncQueue.enqueue('conversion', id, 'RECORD_CONVERSION', {
    id,
    groupId,
    createdBy,
    sourceCurrency: from,
    targetCurrency: to,
    sourceAmountMinor,
    targetAmountMinor,
    exchangeRate,
    rateTimestamp,
    rateSource,
    note: note ?? null,
    createdAt: now,
  });

  return record;
}

/**
 * Retrieves all active conversions for a group.
 */
export async function getGroupConversionsLocal(groupId: string): Promise<CurrencyConversionRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalConversionRow>(
    `SELECT * FROM local_currency_conversions
     WHERE group_id = ? AND is_deleted = 0
     ORDER BY created_at DESC`,
    [groupId]
  );
  return rows.map(rowToConversion);
}

