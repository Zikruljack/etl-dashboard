import { eq, sql } from 'drizzle-orm';
import { datasets, datasetRows } from '../../db/schema/index.js';
import { BaseRepository, type PaginatedResult } from '../../core/base.repository.js';

/** Dataset record type */
export type DatasetRecord = typeof datasets.$inferSelect;

/** Dataset insert type */
export type DatasetInsert = typeof datasets.$inferInsert;

/** Dataset row record type */
export type DatasetRowRecord = typeof datasetRows.$inferSelect;

/** Dataset row insert type */
export type DatasetRowInsert = typeof datasetRows.$inferInsert;

/**
 * Repository for dataset metadata operations.
 * Handles CRUD on the datasets table.
 */
class DatasetRepository extends BaseRepository<typeof datasets, DatasetRecord, DatasetInsert> {
  constructor() {
    super(datasets, 'datasets');
  }

  /**
   * List all datasets ordered by creation date.
   *
   * @returns Array of all datasets
   */
  async findAllOrdered(): Promise<DatasetRecord[]> {
    return this.findAll(datasets.createdAt);
  }

  /**
   * Update sync status of a dataset.
   *
   * @param id - Dataset UUID
   * @param status - New sync status
   * @param extra - Optional extra fields to update (lastSyncedAt, columns)
   * @returns Updated dataset or null
   */
  async updateSyncStatus(
    id: string,
    status: 'idle' | 'syncing' | 'error' | 'success',
    extra: Partial<DatasetInsert> = {},
  ): Promise<DatasetRecord | null> {
    return this.update(id, {
      syncStatus: status,
      updatedAt: new Date(),
      ...extra,
    } as any);
  }
}

/**
 * Repository for dataset row data operations.
 * Handles CRUD on the dataset_rows table (JSONB row data).
 */
class DatasetRowRepository extends BaseRepository<typeof datasetRows, DatasetRowRecord, DatasetRowInsert> {
  constructor() {
    super(datasetRows, 'dataset_rows');
  }

  /**
   * Get paginated rows for a specific dataset.
   *
   * @param datasetId - UUID of the parent dataset
   * @param limit - Max rows to return
   * @param offset - Number of rows to skip
   * @returns Paginated result with row data and total count
   */
  async findByDataset(datasetId: string, limit: number, offset: number): Promise<PaginatedResult<DatasetRowRecord>> {
    return this.findPaginated(
      { limit, offset, orderBy: datasetRows.rowNumber },
      eq(datasetRows.datasetId, datasetId),
    );
  }

  /**
   * Get all rows for a dataset (for queries/aggregation).
   *
   * @param datasetId - UUID of the parent dataset
   * @returns Array of all rows ordered by row number
   */
  async findAllByDataset(datasetId: string): Promise<DatasetRowRecord[]> {
    return this.findWhere(
      eq(datasetRows.datasetId, datasetId),
      datasetRows.rowNumber,
    );
  }

  /**
   * Delete all rows for a dataset (before re-sync).
   *
   * @param datasetId - UUID of the parent dataset
   */
  async deleteByDataset(datasetId: string): Promise<void> {
    await this.deleteWhere(eq(datasetRows.datasetId, datasetId));
  }

  /**
   * Insert rows in batches to avoid memory issues with large datasets.
   *
   * @param rows - Array of row data to insert
   * @param batchSize - Number of rows per insert batch (default: 500)
   * @returns Total number of rows inserted
   */
  async insertBatch(rows: DatasetRowInsert[], batchSize = 500): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await this.createMany(batch);
      inserted += batch.length;
    }
    return inserted;
  }
}

/** Singleton instances */
export const datasetRepository = new DatasetRepository();
export const datasetRowRepository = new DatasetRowRepository();
