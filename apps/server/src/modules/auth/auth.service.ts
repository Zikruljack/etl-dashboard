import { AppError } from '../../core/errors.js';
import { hashPassword, comparePassword } from '../../utils/hash.js';
import { signToken } from '../../utils/jwt.js';
import { authRepository } from './auth.repository.js';

/** Auth response returned after login/register */
interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
}

/**
 * Register a new user account.
 * Creates user with hashed password and returns JWT token.
 *
 * @param email - User email (must be unique)
 * @param password - Plain text password (min 6 chars, validated at route level)
 * @param name - User display name
 * @returns Auth result with user data and JWT token
 * @throws AppError(409) if email is already registered
 */
export async function register(email: string, password: string, name: string): Promise<AuthResult> {
  const existing = await authRepository.findByEmail(email);
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await hashPassword(password);
  const user = await authRepository.create({ email, passwordHash, name });

  const token = signToken({ userId: user.id, role: user.role });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    token,
  };
}

/**
 * Authenticate user with email and password.
 *
 * @param email - User email
 * @param password - Plain text password
 * @returns Auth result with user data and JWT token
 * @throws AppError(401) if email not found or password incorrect
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await authRepository.findByEmail(email);
  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const token = signToken({ userId: user.id, role: user.role });
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    token,
  };
}

/**
 * Get current authenticated user's profile.
 *
 * @param userId - UUID of the authenticated user
 * @returns User profile data (without password hash)
 * @throws AppError(404) if user not found (token valid but user deleted)
 */
export async function getMe(userId: string) {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
