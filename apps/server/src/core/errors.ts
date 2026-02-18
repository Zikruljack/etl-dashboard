/**
 * Custom application error with HTTP status code.
 * Thrown in services/repositories, caught by global error handler.
 *
 * @example
 * throw new AppError(404, 'Dataset not found');
 * throw new AppError(400, 'Validation failed', { email: ['Invalid format'] });
 */
export class AppError extends Error {
  /** HTTP status code */
  public readonly statusCode: number;

  /** Optional field-level validation errors */
  public readonly errors?: Record<string, string[]>;

  constructor(statusCode: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Assert a condition, throw AppError if falsy.
 * Useful for repository "not found" checks.
 *
 * @param condition - Value to check for truthiness
 * @param statusCode - HTTP status code if assertion fails
 * @param message - Error message if assertion fails
 * @throws AppError if condition is falsy
 */
export function assertFound<T>(
  condition: T | null | undefined,
  message = 'Resource not found',
  statusCode = 404,
): asserts condition is T {
  if (!condition) {
    throw new AppError(statusCode, message);
  }
}
