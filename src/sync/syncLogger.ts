export interface SyncDiagnostic {
  syncType: 'incremental' | 'full' | 'snapshot';
  entity: 'groups' | 'expenses' | 'settlements' | 'members' | 'friendships';
  recordsFetched: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  durationMs?: number;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Diagnostic logger for sync cycles (enabled only in DEV mode).
 */
export function logSyncDiagnostic(diag: SyncDiagnostic): void {
  if (__DEV__) {
    const parts = [
      `[SyncDiagnostic][${diag.entity}]`,
      `${diag.syncType} sync ${diag.status.toUpperCase()}`,
      `fetched=${diag.recordsFetched}`,
    ];
    if (diag.recordsSkipped !== undefined) parts.push(`skipped=${diag.recordsSkipped}`);
    if (diag.durationMs !== undefined) parts.push(`${diag.durationMs}ms`);
    if (diag.error) parts.push(`error="${diag.error}"`);
    console.log(parts.join(' '));
  }
}

