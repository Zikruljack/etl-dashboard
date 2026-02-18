import { eq } from 'drizzle-orm';
import { appSettings } from '../../db/schema/index.js';
import { db } from '../../config/database.js';

/** App setting record type */
export type SettingRecord = typeof appSettings.$inferSelect;

/** Default settings with descriptions */
export const DEFAULT_SETTINGS: Array<{ key: string; value: string; description: string }> = [
  { key: 'appName', value: 'ETL Dashboard', description: 'Application display name' },
  { key: 'allowRegistration', value: 'true', description: 'Allow new user self-registration' },
  { key: 'googleServiceAccountEmail', value: '', description: 'Google service account email for Sheets API' },
  { key: 'googlePrivateKey', value: '', description: 'Google service account private key JSON' },
];

/**
 * Repository for app_settings key-value store.
 * Handles direct Drizzle queries (not extending BaseRepository since PK is not uuid).
 */
export const settingsRepository = {
  /**
   * Get all settings as a key-value map.
   *
   * @returns Map of setting key → value
   */
  async getAll(): Promise<Record<string, string>> {
    const rows = await db.select().from(appSettings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  /**
   * Get a single setting value by key.
   *
   * @param key - Setting key
   * @returns Setting value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  },

  /**
   * Upsert a setting value.
   * Creates the row if it doesn't exist, updates if it does.
   *
   * @param key - Setting key
   * @param value - Setting value
   */
  async set(key: string, value: string): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  },

  /**
   * Upsert multiple settings at once.
   *
   * @param updates - Map of key → value pairs to update
   */
  async setMany(updates: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await settingsRepository.set(key, value);
    }
  },

  /**
   * Ensure default settings exist (idempotent — won't overwrite existing values).
   * Call once at server startup.
   */
  async seedDefaults(): Promise<void> {
    for (const { key, value, description } of DEFAULT_SETTINGS) {
      await db
        .insert(appSettings)
        .values({ key, value, description, updatedAt: new Date() })
        .onConflictDoNothing();
    }
  },
};
