import { AppError } from '../../core/errors.js';
import { userRepository, type SafeUser, type UserRole } from './user.repository.js';

/**
 * List all users (admin only).
 *
 * @returns Array of users with safe fields
 */
export async function listUsers(): Promise<SafeUser[]> {
  return userRepository.findAllSafe();
}

/**
 * Update a user's role (admin only).
 *
 * @param userId - UUID of the user to update
 * @param role - New role to assign
 * @returns Updated user with safe fields
 * @throws AppError(404) if user not found
 */
export async function updateUserRole(userId: string, role: UserRole) {
  const user = await userRepository.update(userId, {
    role,
    updatedAt: new Date(),
  } as any);
  if (!user) throw new AppError(404, 'User not found');

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Delete a user account (admin only).
 * Admins cannot delete themselves.
 *
 * @param userId - UUID of the user to delete
 * @param requesterId - UUID of the admin performing the delete
 * @returns ID of the deleted user
 * @throws AppError(400) if admin tries to delete themselves
 * @throws AppError(404) if user not found
 */
export async function deleteUser(userId: string, requesterId: string) {
  if (userId === requesterId) {
    throw new AppError(400, 'Cannot delete yourself');
  }

  const user = await userRepository.delete(userId);
  if (!user) throw new AppError(404, 'User not found');

  return { id: user.id };
}
