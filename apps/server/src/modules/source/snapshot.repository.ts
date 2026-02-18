import { eq, desc } from 'drizzle-orm';
import { rawSnapshots } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';

/** Raw snapshot record type */
export type SnapshotRecord = typeof rawSnapshots.$inferSelect;

/** Raw snapshot insert type */
export type SnapshotInsert = typeof rawSnapshots.$inferInsert;

/**
 * Repository for raw snapshot operations.
 * Stores complete cell grids fetched from sources.
 */
class SnapshotRepository extends BaseRepository<typeof rawSnapshots, SnapshotRecord, SnapshotInsert> {
  constructor() {
    super(rawSnapshots, 'raw_snapshots');
  }

  /**
   * Get the latest snapshot for a dataset.
   *
   * @param datasetId - UUID of the parent dataset
   * @returns Latest snapshot or null
   */
  async findLatestByDataset(datasetId: string): Promise<SnapshotRecord | null> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(rawSnapshots.datasetId, datasetId))
      .orderBy(desc(rawSnapshots.fetchedAt))
      .limit(1);
    return (row as SnapshotRecord) ?? null;
  }

  /**
   * Get all snapshots for a dataset, ordered by fetch time.
   *
   * @param datasetId - UUID of the parent dataset
   * @returns Array of snapshots (newest first)
   */
  async findByDataset(datasetId: string): Promise<SnapshotRecord[]> {
    return this.findWhere(
      eq(rawSnapshots.datasetId, datasetId),
      desc(rawSnapshots.fetchedAt),
    );
  }

  /**
   * Link an orphan snapshot to a dataset.
   * Used when a snapshot is created before the dataset (during wizard flow).
   *
   * @param snapshotId - UUID of the snapshot
   * @param datasetId - UUID of the dataset to link to
   * @returns Updated snapshot or null
   */
  async linkToDataset(snapshotId: string, datasetId: string): Promise<SnapshotRecord | null> {
    return this.update(snapshotId, { datasetId } as Partial<SnapshotInsert>);
  }
}

/** Singleton instance */
export const snapshotRepository = new SnapshotRepository();
