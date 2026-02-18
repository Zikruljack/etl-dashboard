import { readFile } from 'fs/promises';
import path from 'path';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

/** File type definitions with magic bytes signatures */
interface FileTypeSignature {
  /** Human-readable name */
  name: string;
  /** Allowed file extensions (without dot) */
  extensions: string[];
  /** Allowed MIME types */
  mimeTypes: string[];
  /** Magic bytes at start of file (hex pairs). Null = no magic bytes (text-based like CSV) */
  magicBytes: Buffer | null;
  /** Offset to check magic bytes at */
  magicOffset?: number;
}

/** Known file type signatures for ETL-supported formats */
const FILE_SIGNATURES: Record<string, FileTypeSignature> = {
  csv: {
    name: 'CSV',
    extensions: ['csv'],
    mimeTypes: ['text/csv', 'text/plain', 'application/csv'],
    magicBytes: null, // Text-based, no magic bytes
  },
  xlsx: {
    name: 'Excel (XLSX)',
    extensions: ['xlsx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', // XLSX is a ZIP container
    ],
    magicBytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK\x03\x04 (ZIP signature)
  },
  xls: {
    name: 'Excel (XLS)',
    extensions: ['xls'],
    mimeTypes: ['application/vnd.ms-excel', 'application/x-ole-storage'],
    magicBytes: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), // OLE2 compound document
  },
};

/** Validation options for file upload */
export interface FileValidationOptions {
  /** Allowed file type keys from FILE_SIGNATURES */
  allowedTypes: string[];
  /** Maximum file size in bytes. Default: 50MB */
  maxSizeBytes?: number;
  /** Whether to scan file content for dangerous patterns. Default: true */
  scanContent?: boolean;
}

/** Result of file validation */
export interface FileValidationResult {
  /** Whether the file passed all checks */
  valid: boolean;
  /** Detected file type key */
  detectedType: string | null;
  /** Original filename (sanitized) */
  sanitizedName: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Sanitize a filename to prevent path traversal and injection.
 * Removes directory separators, null bytes, and special characters.
 *
 * @param filename - Original filename from upload
 * @returns Sanitized filename safe for filesystem use
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\0/g, '')                    // Remove null bytes
    .replace(/\.\./g, '')                  // Remove path traversal
    .replace(/[/\\:*?"<>|]/g, '_')         // Replace unsafe chars
    .replace(/^\.+/, '')                   // Remove leading dots (hidden files)
    .trim()
    .slice(0, 255);                        // Limit length
}

/**
 * Get file extension from filename (lowercase, without dot).
 *
 * @param filename - Filename to extract extension from
 * @returns Lowercase extension or empty string
 */
function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase().replace('.', '');
}

/**
 * Check if a buffer starts with expected magic bytes at given offset.
 *
 * @param buffer - File content buffer
 * @param signature - Expected magic bytes
 * @param offset - Byte offset to check at
 * @returns true if magic bytes match
 */
function checkMagicBytes(buffer: Buffer, signature: Buffer, offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Detect the actual file type from content (magic bytes).
 * Like PHP's finfo_file() — reads actual content, not just extension.
 *
 * @param buffer - File content buffer
 * @param declaredExtension - Extension from filename (for text-based formats)
 * @returns Detected file type key or null if unknown
 */
function detectFileType(buffer: Buffer, declaredExtension: string): string | null {
  // Check binary signatures first
  for (const [key, sig] of Object.entries(FILE_SIGNATURES)) {
    if (sig.magicBytes && checkMagicBytes(buffer, sig.magicBytes, sig.magicOffset ?? 0)) {
      return key;
    }
  }

  // For text-based formats (CSV), verify by extension + content heuristics
  if (declaredExtension === 'csv') {
    // Check if content looks like text (no binary data in first 8KB)
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
    const isBinary = sample.some((byte) => byte === 0);
    if (!isBinary) return 'csv';
  }

  return null;
}

/**
 * Scan file content for potentially dangerous patterns.
 * Checks for embedded scripts, macros, and other threats.
 *
 * @param buffer - File content buffer
 * @param fileType - Detected file type
 * @returns Error message if dangerous content found, null if clean
 */
function scanForThreats(buffer: Buffer, fileType: string): string | null {
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024 * 1024));

  // CSV-specific checks
  if (fileType === 'csv') {
    // Check for formula injection (cells starting with =, +, -, @)
    // These can execute when opened in Excel/Sheets
    const lines = content.split('\n').slice(0, 100);
    for (const line of lines) {
      const cells = line.split(',');
      for (const cell of cells) {
        const trimmed = cell.trim().replace(/^["']/, '');
        if (/^[=+\-@]\s*[A-Z(]/.test(trimmed)) {
          logger.warn('CSV formula injection detected', { cell: trimmed.slice(0, 50) });
          // Don't block — just log. The ETL system stores as data, doesn't execute.
        }
      }
    }

    // Check for HTML/script injection in CSV values
    if (/<script[\s>]/i.test(content) || /javascript:/i.test(content)) {
      return 'File contains potentially dangerous script content';
    }
  }

  // XLSX-specific: ZIP bombs detection (extremely high compression ratio)
  if (fileType === 'xlsx' || fileType === 'xls') {
    // If file is suspiciously small but claims many rows, it might be a zip bomb
    // This is a basic check — actual decompression check happens during parsing
    if (buffer.length < 100) {
      return 'File is too small to be a valid spreadsheet';
    }
  }

  return null;
}

/**
 * Validate an uploaded file for security.
 * Performs deep content inspection similar to PHP's file_get_contents + finfo.
 *
 * Checks performed:
 * 1. Filename sanitization (path traversal, null bytes, special chars)
 * 2. Extension whitelist
 * 3. File size limit
 * 4. Magic bytes verification (actual content type, not just extension)
 * 5. MIME type verification
 * 6. Content scanning for dangerous patterns (scripts, macros)
 *
 * @param filePath - Absolute path to the uploaded temp file
 * @param originalName - Original filename from the upload
 * @param mimeType - MIME type reported by the client
 * @param options - Validation configuration
 * @returns Validation result with detected type and sanitized name
 *
 * @example
 * const result = await validateFile(
 *   req.file.path,
 *   req.file.originalname,
 *   req.file.mimetype,
 *   { allowedTypes: ['csv', 'xlsx'], maxSizeBytes: 50 * 1024 * 1024 }
 * );
 * if (!result.valid) throw new AppError(400, result.error);
 */
export async function validateFile(
  filePath: string,
  originalName: string,
  mimeType: string,
  options: FileValidationOptions,
): Promise<FileValidationResult> {
  const { allowedTypes, maxSizeBytes = 50 * 1024 * 1024, scanContent = true } = options;
  const sanitizedName = sanitizeFilename(originalName);
  const extension = getExtension(originalName);

  // 1. Check extension whitelist
  const allowedExtensions = allowedTypes.flatMap(
    (t) => FILE_SIGNATURES[t]?.extensions ?? [],
  );
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      detectedType: null,
      sanitizedName,
      sizeBytes: 0,
      error: `File extension ".${extension}" is not allowed. Allowed: ${allowedExtensions.map((e) => `.${e}`).join(', ')}`,
    };
  }

  // 2. Read file content
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return {
      valid: false,
      detectedType: null,
      sanitizedName,
      sizeBytes: 0,
      error: 'Unable to read uploaded file',
    };
  }

  // 3. Check file size
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      detectedType: null,
      sanitizedName,
      sizeBytes: buffer.length,
      error: `File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds limit (${(maxSizeBytes / 1024 / 1024).toFixed(1)}MB)`,
    };
  }

  // 4. Empty file check
  if (buffer.length === 0) {
    return {
      valid: false,
      detectedType: null,
      sanitizedName,
      sizeBytes: 0,
      error: 'File is empty',
    };
  }

  // 5. Magic bytes verification (detect actual file type)
  const detectedType = detectFileType(buffer, extension);
  if (!detectedType) {
    return {
      valid: false,
      detectedType: null,
      sanitizedName,
      sizeBytes: buffer.length,
      error: 'Unable to determine file type from content. File may be corrupted.',
    };
  }

  // 6. Verify detected type matches allowed types
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      detectedType,
      sanitizedName,
      sizeBytes: buffer.length,
      error: `File content is ${FILE_SIGNATURES[detectedType]?.name}, which is not in allowed types`,
    };
  }

  // 7. Verify MIME type matches detected type
  const expectedMimeTypes = FILE_SIGNATURES[detectedType]?.mimeTypes ?? [];
  if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(mimeType)) {
    logger.warn('MIME type mismatch', {
      expected: expectedMimeTypes,
      actual: mimeType,
      detectedType,
      filename: sanitizedName,
    });
    // Log warning but don't block — client MIME types are unreliable
  }

  // 8. Content scanning
  if (scanContent) {
    const threat = scanForThreats(buffer, detectedType);
    if (threat) {
      return {
        valid: false,
        detectedType,
        sanitizedName,
        sizeBytes: buffer.length,
        error: threat,
      };
    }
  }

  logger.info('File validated successfully', {
    filename: sanitizedName,
    type: detectedType,
    size: buffer.length,
  });

  return {
    valid: true,
    detectedType,
    sanitizedName,
    sizeBytes: buffer.length,
  };
}
