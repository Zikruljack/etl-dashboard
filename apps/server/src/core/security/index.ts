/**
 * Security module — IDOR protection, file validation, input sanitization.
 */

export { checkOwnership } from './idor-guard.js';
export {
  validateFile,
  sanitizeFilename,
  type FileValidationOptions,
  type FileValidationResult,
} from './file-validator.js';
export {
  sanitizeString,
  sanitizeDeep,
  stripHtml,
  stripNullBytes,
  isValidUuid,
} from './sanitizer.js';
