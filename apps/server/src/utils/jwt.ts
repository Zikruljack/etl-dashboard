import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** JWT token payload stored in every issued token */
export interface JwtPayload {
  userId: string;
  role: string;
}

/**
 * Sign a JWT token with user payload.
 * Token expires based on JWT_EXPIRES_IN env var (default: 7d).
 *
 * @param payload - User data to encode in token
 * @returns Signed JWT string
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

/**
 * Verify and decode a JWT token.
 *
 * @param token - JWT string to verify
 * @returns Decoded payload with userId and role
 * @throws JsonWebTokenError if token is invalid or expired
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
}
