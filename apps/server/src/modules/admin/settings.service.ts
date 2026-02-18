import { settingsRepository } from './settings.repository.js';

/** Public settings keys (safe to expose to admin users) */
const PUBLIC_KEYS = ['appName', 'allowRegistration', 'googleServiceAccountEmail'];
/** Sensitive keys — value is redacted in GET responses */
const SENSITIVE_KEYS = ['googlePrivateKey'];

/**
 * Get all settings, redacting sensitive values.
 *
 * @returns Settings map with sensitive values replaced by '***' if set
 */
export async function getSettings(): Promise<Record<string, string>> {
  const all = await settingsRepository.getAll();

  // Redact sensitive values — show '***' if set, '' if not set
  for (const key of SENSITIVE_KEYS) {
    if (key in all) {
      all[key] = all[key] ? '***' : '';
    }
  }

  return all;
}

/**
 * Update settings. Sensitive values are only updated if not '***' (redacted placeholder).
 *
 * @param updates - Key-value map of settings to update
 */
export async function updateSettings(updates: Record<string, string>): Promise<void> {
  const safeKeys = [...PUBLIC_KEYS, ...SENSITIVE_KEYS];
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!safeKeys.includes(key)) continue;
    // Skip sensitive values that weren't changed (still showing placeholder)
    if (SENSITIVE_KEYS.includes(key) && value === '***') continue;
    filtered[key] = value;
  }

  if (Object.keys(filtered).length > 0) {
    await settingsRepository.setMany(filtered);
  }
}
