/** Log levels ordered by severity */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry with optional context */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

/**
 * Get current log level from environment.
 * Defaults to 'info' in production, 'debug' in development.
 */
function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  return env || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be emitted based on min level.
 *
 * @param level - Level to check
 * @returns true if the level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[getMinLevel()];
}

/**
 * Emit a structured log entry to console.
 *
 * @param entry - Log entry to emit
 */
function emit(entry: LogEntry): void {
  const { level, message, timestamp, context } = entry;
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  const line = `[${timestamp}] ${level.toUpperCase()} ${message}${ctx}`;

  switch (level) {
    case 'error': console.error(line); break;
    case 'warn': console.warn(line); break;
    default: console.log(line);
  }
}

/**
 * Structured logger with context support.
 * Uses JSON format for easy parsing in production.
 *
 * @example
 * logger.info('Dataset synced', { datasetId: '123', rows: 500 });
 * logger.error('Sync failed', { datasetId: '123', error: err.message });
 *
 * const syncLogger = logger.child({ module: 'sync' });
 * syncLogger.info('Starting sync'); // includes module: 'sync'
 */
export const logger = {
  /**
   * Log debug message. Only visible when LOG_LEVEL=debug.
   *
   * @param message - Log message
   * @param context - Optional structured context
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return;
    emit({ level: 'debug', message, timestamp: new Date().toISOString(), context });
  },

  /**
   * Log informational message.
   *
   * @param message - Log message
   * @param context - Optional structured context
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('info')) return;
    emit({ level: 'info', message, timestamp: new Date().toISOString(), context });
  },

  /**
   * Log warning message.
   *
   * @param message - Log message
   * @param context - Optional structured context
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return;
    emit({ level: 'warn', message, timestamp: new Date().toISOString(), context });
  },

  /**
   * Log error message.
   *
   * @param message - Log message
   * @param context - Optional structured context
   */
  error(message: string, context?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;
    emit({ level: 'error', message, timestamp: new Date().toISOString(), context });
  },

  /**
   * Create a child logger with default context merged into every log.
   *
   * @param defaultContext - Context fields to include in every log entry
   * @returns Logger instance with merged context
   */
  child(defaultContext: Record<string, unknown>) {
    return {
      debug: (msg: string, ctx?: Record<string, unknown>) =>
        logger.debug(msg, { ...defaultContext, ...ctx }),
      info: (msg: string, ctx?: Record<string, unknown>) =>
        logger.info(msg, { ...defaultContext, ...ctx }),
      warn: (msg: string, ctx?: Record<string, unknown>) =>
        logger.warn(msg, { ...defaultContext, ...ctx }),
      error: (msg: string, ctx?: Record<string, unknown>) =>
        logger.error(msg, { ...defaultContext, ...ctx }),
    };
  },
};
