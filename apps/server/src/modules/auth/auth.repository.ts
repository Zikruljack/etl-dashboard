import { eq } from 'drizzle-orm';
import { users } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';

/** User record type inferred from Drizzle schema */
export type UserRecord = typeof users.$inferSelect;

/** Insert type for creating a user */
export type UserInsert = typeof users.$inferInsert;

/** Safe user fields (excludes password hash) */
export type SafeUser = Omit<UserRecord, 'passwordHash'>;

/**
 * Repository for user data access in auth context.
 * Handles user lookup for authentication and registration.
 */
class AuthRepository extends BaseRepository<typeof users, UserRecord, UserInsert> {
  constructor() {
    super(users, 'users');
  }

  /**
   * Find a user by email address.
   * Used during login and registration to check for existing accounts.
   *
   * @param email - Email address to search for
   * @returns User record or null if not found
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.findOneWhere(eq(users.email, email));
  }

  /**
   * Convert a full user record to safe format (without password hash).
   *
   * @param user - Full user record from database
   * @returns User object safe for API responses
   */
  toSafe(user: UserRecord): SafeUser {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}

/** Singleton instance of AuthRepository */
export const authRepository = new AuthRepository();
