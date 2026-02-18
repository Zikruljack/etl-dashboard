import { users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';

/** User record type */
export type UserRecord = typeof users.$inferSelect;

/** User insert type */
export type UserInsert = typeof users.$inferInsert;

/** User role type */
export type UserRole = 'admin' | 'editor' | 'viewer';

/** User data safe for API responses (no password hash) */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

/**
 * Repository for user management (admin operations).
 * Handles listing, role updates, and deletion.
 */
class UserRepository extends BaseRepository<typeof users, UserRecord, UserInsert> {
  constructor() {
    super(users, 'users');
  }

  /**
   * Get all users with safe fields only (no password hash).
   *
   * @returns Array of users without sensitive data
   */
  async findAllSafe(): Promise<SafeUser[]> {
    const rows = await this.db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.createdAt);
    return rows;
  }
}

/** Singleton instance of UserRepository */
export const userRepository = new UserRepository();
