import { eq, and, desc, sql } from 'drizzle-orm';
import { datasetChanges } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';
import type { ChangeType } from '@etl-dashboard/shared';

/** Change record type */
export type ChangeRecord = typeof datasetChanges.$inferSelect;

/** Change record insert type */
export type ChangeInsert = typeof datasetChanges.$inferInsert;

/**
 * Repository for cell-level change records.
 * Each row represents a detected change (new/changed/deleted) per column per sync.
 */
class ChangeRepository extends BaseRepository<typeof datasetChanges, ChangeRecord, ChangeInsert> {
  constructor() {
    super(datasetChanges, 'dataset_changes');
  }

  /**
   * Get paginated changes for a dataset, with optional filters.
   *
   * @param datasetId - UUID of the parent dataset
   * @param options - Filter + pagination options
   * @returns Paginated change records (newest first)
   */
  async findByDataset(
    datasetId: string,
    options: {
      limit: number;
      offset: number;
      syncId?: string;
      changeType?: ChangeType;
    },
  ): Promise<{ data: ChangeRecord[]; total: number }> {
    const conditions = [eq(datasetChanges.datasetId, datasetId)];

    if (options.syncId) {
      conditions.push(eq(datasetChanges.syncId, options.syncId));
    }
    if (options.changeType) {
      conditions.push(eq(datasetChanges.changeType, options.changeType));
    }

    const where = and(...conditions)!;

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.table)
      .where(where);

    const data = await this.db
      .select()
      .from(this.table)
      .where(where)
      .orderBy(desc(datasetChanges.changedAt))
      .limit(options.limit)
      .offset(options.offset);

    return { data: data as ChangeRecord[], total: Number(count) };
  }

  /**
   * Get all changes for a specific row key (per-row history).
   * Returns changes across all syncs, newest first.
   *
   * @param datasetId - UUID of the parent dataset
   * @param rowKey - Stringified key column values identifying the row
   * @returns Array of changes for that row
   */
  async findByRowKey(datasetId: string, rowKey: string): Promise<ChangeRecord[]> {
    return this.db
      .select()
      .from(this.table)
      .where(and(
        eq(datasetChanges.datasetId, datasetId),
        eq(datasetChanges.rowKey, rowKey),
      ))
      .orderBy(desc(datasetChanges.changedAt)) as unknown as ChangeRecord[];
  }

  /**
   * Get changes grouped by sync for a dataset.
   * Returns summary counts per sync run.
   *
   * @param datasetId - UUID of the parent dataset
   * @returns Array of {syncId, total count} ordered by newest sync
   */
  async countBySync(datasetId: string): Promise<Array<{ syncId: string; count: number }>> {
    const rows = await this.db
      .select({
        syncId: datasetChanges.syncId,
        count: sql<number>`count(*)`,
      })
      .from(this.table)
      .where(eq(datasetChanges.datasetId, datasetId))
      .groupBy(datasetChanges.syncId);
    return rows.map((r) => ({ syncId: r.syncId, count: Number(r.count) }));
  }

  /**
   * Bulk insert change records for a sync run.
   * Uses createMany from base for efficiency.
   *
   * @param changes - Array of change records to insert
   * @returns Inserted records
   */
  async insertBatch(changes: ChangeInsert[]): Promise<ChangeRecord[]> {
    return this.createMany(changes);
  }

  /**
   * Delete all changes for a dataset (e.g. on dataset deletion).
   *
   * @param datasetId - UUID of the dataset
   */
  async deleteByDataset(datasetId: string): Promise<void> {
    await this.deleteWhere(eq(datasetChanges.datasetId, datasetId));
  }
}

/** Singleton instance */
export const changeRepository = new ChangeRepository();
