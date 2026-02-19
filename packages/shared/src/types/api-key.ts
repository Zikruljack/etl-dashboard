/**
 * API Key types.
 * Used by frontend for displaying/managing API keys.
 */

/**
 * A public (safe) view of an API key — never contains hash or full key.
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  /** First 12 chars of key for display (e.g. "etld_a1b2c3d") */
  keyPrefix: string;
  rateLimitPerHour: number | null;
  rateLimitPerDay: number | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * API key with user info — returned in admin list.
 */
export interface ApiKeyWithUser extends ApiKey {
  userName: string;
  userEmail: string;
}

/**
 * Returned once after key generation — contains the full key.
 * Show to user immediately; cannot be retrieved again.
 */
export interface GeneratedApiKey extends ApiKey {
  /** Full plain-text key — show ONCE and never store */
  fullKey: string;
}

/**
 * Request body for generating a new API key.
 */
export interface GenerateApiKeyRequest {
  name: string;
  rateLimitPerHour?: number | null;
  rateLimitPerDay?: number | null;
  expiresAt?: string | null;
}

/**
 * Request body for updating API key limits (admin).
 */
export interface UpdateApiKeyLimitsRequest {
  rateLimitPerHour?: number | null;
  rateLimitPerDay?: number | null;
  isActive?: boolean;
}
