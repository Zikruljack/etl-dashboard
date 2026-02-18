/**
 * File upload middleware.
 * Uses multer with memory storage for CSV/Excel uploads.
 * Validates file type via extension whitelist and magic bytes
 * before passing buffer to the route handler.
 */

import multer from 'multer';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { sanitizeFilename } from '../security/file-validator.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'upload' });

/** Max file size for data file uploads (50MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Allowed extensions for data file uploads */
const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls'];

/** MIME types accepted by multer filter (broad to avoid client MIME issues) */
const ALLOWED_MIMES = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip',
  'application/octet-stream',
  'application/x-ole-storage',
];

/** Magic bytes for binary file types */
const MAGIC_BYTES: Record<string, Buffer> = {
  xlsx: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK (ZIP)
  xls: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),  // OLE2
};

/**
 * Multer instance with memory storage and size limit.
 * Files are kept in memory (buffer) — no temp files on disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      cb(new AppError(400, `File extension ".${ext}" not allowed. Allowed: ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}`));
      return;
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      // Log but don't block — client MIME can be unreliable
      log.warn('Unexpected MIME type', { mime: file.mimetype, filename: file.originalname });
    }
    cb(null, true);
  },
});

/**
 * Validate file buffer magic bytes match the declared extension.
 *
 * @param buffer - File content buffer
 * @param extension - File extension (without dot)
 * @returns true if valid
 */
function validateMagicBytes(buffer: Buffer, extension: string): boolean {
  const expected = MAGIC_BYTES[extension];
  if (!expected) {
    // CSV is text-based — check it's not binary
    if (extension === 'csv') {
      const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
      return !sample.some((byte) => byte === 0);
    }
    return true;
  }

  if (buffer.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Middleware: accept a single file upload and validate it.
 * After this middleware, `req.file` contains the validated file with buffer.
 * The file's `originalname` is sanitized.
 *
 * @param fieldName - Form field name for the file (default: 'file')
 * @returns Express middleware chain
 *
 * @example
 * router.post('/upload', ...uploadFile('file'), async (req, res, next) => {
 *   const buffer = req.file!.buffer;
 *   const ext = path.extname(req.file!.originalname).toLowerCase().replace('.', '');
 *   // ... parse buffer
 * });
 */
export function uploadFile(fieldName = 'file') {
  return [
    upload.single(fieldName),
    (req: Request, _res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new AppError(400, 'No file uploaded');
        }

        // Sanitize filename
        req.file.originalname = sanitizeFilename(req.file.originalname);

        // Validate magic bytes
        const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
        if (!validateMagicBytes(req.file.buffer, ext)) {
          throw new AppError(400, 'File content does not match its extension. The file may be corrupted or mislabeled.');
        }

        // Empty file check
        if (req.file.buffer.length === 0) {
          throw new AppError(400, 'Uploaded file is empty');
        }

        log.info('File upload accepted', {
          filename: req.file.originalname,
          size: req.file.size,
          mime: req.file.mimetype,
        });

        next();
      } catch (err) {
        next(err);
      }
    },
  ] as any[];
}
