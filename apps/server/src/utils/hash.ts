import bcrypt from 'bcryptjs';

/**
 * Hash a plain text password using bcrypt.
 * Uses 12 rounds of salt for security.
 *
 * @param password - Plain text password to hash
 * @returns Bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a plain text password against a bcrypt hash.
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns true if password matches the hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
