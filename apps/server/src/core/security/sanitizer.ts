/**
 * Input sanitizer for preventing XSS and injection attacks.
 * Applied to user inputs before processing.
 *
 * Does NOT sanitize data from external data sources (CSV, Sheets)
 * because those are stored as data, not rendered as HTML.
 */

/**
 * Strip HTML tags from a string value.
 * Prevents XSS when values are rendered in frontend.
 *
 * @param input - String to sanitize
 * @returns String with HTML tags removed
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Remove null bytes from a string.
 * Prevents null byte injection in file paths and queries.
 *
 * @param input - String to sanitize
 * @returns String with null bytes removed
 */
export function stripNullBytes(input: string): string {
  return input.replace(/\0/g, '');
}

/**
 * Sanitize a string input: trim, strip null bytes, limit length.
 * For user-provided text fields (names, descriptions, titles).
 *
 * @param input - String to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return stripNullBytes(input).trim().slice(0, maxLength);
}

/**
 * Validate and sanitize a UUID string.
 * Prevents injection through malformed UUIDs in route params.
 *
 * @param input - String to validate as UUID
 * @returns true if input is a valid UUID v4 format
 */
export function isValidUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

/**
 * Recursively sanitize all string values in an object.
 * Used for JSONB fields to prevent stored XSS.
 *
 * Handles nested objects and arrays. Non-string values pass through unchanged.
 *
 * @param input - Value to sanitize (any type)
 * @returns Sanitized value with all strings cleaned
 *
 * @example
 * sanitizeDeep({ name: '<script>alert(1)</script>', count: 5 })
 * // → { name: 'alert(1)', count: 5 }
 */
export function sanitizeDeep(input: unknown): unknown {
  if (typeof input === 'string') {
    return sanitizeString(stripHtml(input));
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeDeep);
  }

  if (input !== null && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[sanitizeString(key, 255)] = sanitizeDeep(value);
    }
    return result;
  }

  return input;
}
