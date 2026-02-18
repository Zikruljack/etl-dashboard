import { eq, sql, type SQL } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { db } from '../config/database.js';

/**
 * Acceptable order-by value: SQL expression or column reference.
 * Uses `any` to accommodate Drizzle's complex PgColumn generic types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrderBy = SQL | any;

/** Result of a paginated query */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/** Options for paginated queries */
export interface PaginateOptions {
  limit: number;
  offset: number;
  orderBy?: OrderBy;
}

/**
 * Generic base repository providing common CRUD operations.
 * Extend this class per entity to add domain-specific queries.
 *
 * Uses Drizzle ORM for type-safe PostgreSQL access.
 * All database access MUST go through repositories — services never query DB directly.
 *
 * @typeParam TTable - Drizzle table type
 * @typeParam TSelect - Type returned from select queries (inferred from table)
 * @typeParam TInsert - Type for insert operations (inferred from table)
 *
 * @example
 * class UserRepository extends BaseRepository<typeof users> {
 *   constructor() {
 *     super(users, 'users');
 *   }
 *   async findByEmail(email: string) {
 *     return this.findOneWhere(eq(users.email, email));
 *   }
 * }
 */
export class BaseRepository<
  TTable extends AnyPgTable,
  TSelect = TTable['$inferSelect'],
  TInsert = TTable['$inferInsert'],
> {
  /** Drizzle database instance */
  protected readonly db = db;

  /**
   * @param table - Drizzle table reference
   * @param tableName - Human-readable table name for error messages
   */
  constructor(
    protected readonly table: TTable,
    protected readonly tableName: string,
  ) {}

  /**
   * Find a single record by UUID primary key.
   *
   * @param id - UUID of the record
   * @returns Record or null if not found
   */
  async findById(id: string): Promise<TSelect | null> {
    const idColumn = (this.table as any).id;
    const [row] = await this.db
      .select()
      .from(this.table as any)
      .where(eq(idColumn, id))
      .limit(1);
    return (row as TSelect) ?? null;
  }

  /**
   * Find all records, optionally ordered.
   *
   * @param orderBy - Optional SQL order clause
   * @returns Array of all records
   */
  async findAll(orderBy?: OrderBy): Promise<TSelect[]> {
    const query = this.db.select().from(this.table as any);
    if (orderBy) {
      return query.orderBy(orderBy) as unknown as TSelect[];
    }
    return query as unknown as TSelect[];
  }

  /**
   * Find records matching a WHERE condition.
   *
   * @param where - Drizzle SQL where clause
   * @param orderBy - Optional SQL order clause
   * @returns Array of matching records
   */
  async findWhere(where: SQL, orderBy?: OrderBy): Promise<TSelect[]> {
    const query = this.db.select().from(this.table as any).where(where);
    if (orderBy) {
      return query.orderBy(orderBy) as unknown as TSelect[];
    }
    return query as unknown as TSelect[];
  }

  /**
   * Find a single record matching a WHERE condition.
   *
   * @param where - Drizzle SQL where clause
   * @returns Record or null if not found
   */
  async findOneWhere(where: SQL): Promise<TSelect | null> {
    const [row] = await this.db
      .select()
      .from(this.table as any)
      .where(where)
      .limit(1);
    return (row as TSelect) ?? null;
  }

  /**
   * Find records with pagination (limit/offset).
   *
   * @param options - Pagination options (limit, offset, optional orderBy)
   * @param where - Optional WHERE condition
   * @returns Paginated result with data array and total count
   */
  async findPaginated(options: PaginateOptions, where?: SQL): Promise<PaginatedResult<TSelect>> {
    const countQuery = this.db.select({ count: sql<number>`count(*)` }).from(this.table as any);
    if (where) countQuery.where(where);
    const [{ count }] = await countQuery;

    let dataQuery = this.db
      .select()
      .from(this.table as any)
      .limit(options.limit)
      .offset(options.offset);

    if (where) dataQuery = dataQuery.where(where) as typeof dataQuery;
    if (options.orderBy) dataQuery = dataQuery.orderBy(options.orderBy) as typeof dataQuery;

    const data = await dataQuery;
    return { data: data as TSelect[], total: Number(count) };
  }

  /**
   * Insert a new record and return it.
   *
   * @param data - Record data to insert
   * @returns Newly created record
   */
  async create(data: TInsert): Promise<TSelect> {
    const [row] = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();
    return row as TSelect;
  }

  /**
   * Insert multiple records and return them.
   *
   * @param data - Array of records to insert
   * @returns Array of newly created records
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    if (data.length === 0) return [];
    const rows = await this.db
      .insert(this.table)
      .values(data as any[])
      .returning();
    return rows as TSelect[];
  }

  /**
   * Update a record by ID and return it.
   *
   * @param id - UUID of the record to update
   * @param data - Partial fields to update
   * @returns Updated record or null if not found
   */
  async update(id: string, data: Partial<TInsert>): Promise<TSelect | null> {
    const idColumn = (this.table as any).id;
    const [row] = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(idColumn, id))
      .returning();
    return (row as TSelect) ?? null;
  }

  /**
   * Update records matching a WHERE condition.
   *
   * @param where - Drizzle SQL where clause
   * @param data - Partial fields to update
   * @returns Array of updated records
   */
  async updateWhere(where: SQL, data: Partial<TInsert>): Promise<TSelect[]> {
    const rows = await this.db
      .update(this.table)
      .set(data as any)
      .where(where)
      .returning();
    return rows as TSelect[];
  }

  /**
   * Delete a record by ID and return it.
   *
   * @param id - UUID of the record to delete
   * @returns Deleted record or null if not found
   */
  async delete(id: string): Promise<TSelect | null> {
    const idColumn = (this.table as any).id;
    const [row] = await this.db
      .delete(this.table)
      .where(eq(idColumn, id))
      .returning();
    return (row as TSelect) ?? null;
  }

  /**
   * Delete records matching a WHERE condition.
   *
   * @param where - Drizzle SQL where clause
   * @returns Array of deleted records
   */
  async deleteWhere(where: SQL): Promise<TSelect[]> {
    const rows = await this.db
      .delete(this.table)
      .where(where)
      .returning();
    return rows as TSelect[];
  }

  /**
   * Count records matching an optional WHERE condition.
   *
   * @param where - Optional WHERE condition
   * @returns Number of matching records
   */
  async count(where?: SQL): Promise<number> {
    const query = this.db.select({ count: sql<number>`count(*)` }).from(this.table as any);
    if (where) query.where(where);
    const [{ count }] = await query;
    return Number(count);
  }
}
