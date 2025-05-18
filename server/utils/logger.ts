import winston from 'winston';

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.printf(info => {
    const { timestamp, level, message } = info;
    // Safely handle metadata
    const metadata: Record<string, any> = info.metadata || {};
    const context = metadata.context ? ` [${metadata.context}]` : '';
    const meta = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} ${level}${context}: ${message}${meta}`;
  })
);

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'mcp-orchestrator' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Add file transport for production logs
    ...(process.env.NODE_ENV === 'production' 
      ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
         new winston.transports.File({ filename: 'logs/combined.log' })]
      : [])
  ]
});

/**
 * Create a child logger with additional context
 * @param parentLogger The parent logger
 * @param context Additional context to add to log entries
 */
export function getChildLogger(parentLogger: winston.Logger, context: Record<string, any> = {}) {
  return parentLogger.child({ ...context });
}

// Export a standard interface that could be implemented differently
export interface ILogger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

// Create specialized loggers for different components
export const apiLogger = getChildLogger(logger, { component: 'API' });
export const authLogger = getChildLogger(logger, { component: 'Auth' });
export const dbLogger = getChildLogger(logger, { component: 'Database' });
export const integrationLogger = getChildLogger(logger, { component: 'Integration' });