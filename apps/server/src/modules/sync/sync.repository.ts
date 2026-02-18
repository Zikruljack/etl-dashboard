import { eq, desc, and, sql } from 'drizzle-orm';
import { datasetSyncs } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';

/** Sync run record type */
export type SyncRecord = typeof datasetSyncs.$inferSelect;

/** Sync run insert type */
export type SyncInsert = typeof datasetSyncs.$inferInsert;

/**
 * Repository for dataset sync run records.
 * Each row tracks stats and status of a single sync execution.
 */
class SyncRepository extends BaseRepository<typeof datasetSyncs, SyncRecord, SyncInsert> {
  constructor() {
    super(datasetSyncs, 'dataset_syncs');
  }

  /**
   * Get all sync runs for a dataset, newest first.
   *
   * @param datasetId - UUID of the parent dataset
   * @param limit - Max number of records to return (default 50)
   * @returns Array of sync records
   */
  async findByDataset(datasetId: string, limit = 50): Promise<SyncRecord[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(datasetSyncs.datasetId, datasetId))
      .orderBy(desc(datasetSyncs.syncedAt))
      .limit(limit) as unknown as SyncRecord[];
  }

  /**
   * Get the most recent successful sync for a dataset.
   *
   * @param datasetId - UUID of the dataset
   * @returns Latest successful sync or null
   */
  async findLatestSuccess(datasetId: string): Promise<SyncRecord | null> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(and(
        eq(datasetSyncs.datasetId, datasetId),
        eq(datasetSyncs.status, 'success'),
      ))
      .orderBy(desc(datasetSyncs.syncedAt))
      .limit(1);
    return (row as SyncRecord) ?? null;
  }

  /**
   * Mark a sync run as failed with an error message.
   *
   * @param id - UUID of the sync run
   * @param errorLog - Error message or stack trace
   * @param durationMs - Total duration in ms
   * @returns Updated sync record
   */
  async markFailed(id: string, errorLog: string, durationMs: number): Promise<SyncRecord | null> {
    return this.update(id, { status: 'failed', errorLog, durationMs } as Partial<SyncInsert>);
  }

  /**
   * Mark a sync run as successful with final stats.
   *
   * @param id - UUID of the sync run
   * @param stats - Row count stats from diff
   * @param durationMs - Total duration in ms
   * @returns Updated sync record
   */
  async markSuccess(
    id: string,
    stats: {
      rowsTotal: number;
      rowsNew: number;
      rowsChanged: number;
      rowsDeleted: number;
      rowsUnchanged: number;
    },
    durationMs: number,
  ): Promise<SyncRecord | null> {
    return this.update(id, { status: 'success', ...stats, durationMs } as Partial<SyncInsert>);
  }

  /**
   * Count total sync runs for a dataset.
   *
   * @param datasetId - UUID of the dataset
   * @returns Count of all sync records
   */
  async countByDataset(datasetId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(eq(datasetSyncs.datasetId, datasetId));
    return Number(count);
  }
}

/** Singleton instance */
export const syncRepository = new SyncRepository();
