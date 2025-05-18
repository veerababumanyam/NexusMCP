/**
 * Centralized logging utility for the application.
 * Uses Winston library for structured logging with various log levels and formats.
 */

import { createLogger, format, transports } from 'winston';
const { combine, timestamp, printf, colorize, errors } = format;

// Define custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
    // Format error objects
    metaStr = `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    // Format other metadata
    metaStr = ` ${JSON.stringify(metadata)}`;
  }
  return `${timestamp} ${level}: ${message}${metaStr}`;
});

// Create the logger instance
export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    colorize(),
    logFormat
  ),
  defaultMeta: { 
    service: 'mcp-middleware',
    environment: process.env.NODE_ENV || 'development' 
  },
  transports: [
    new transports.Console(),
  ],
});

// Add file transport for production environments
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

// Handle uncaught exceptions
logger.exceptions.handle(
  new transports.File({ filename: 'logs/exceptions.log' })
);

export default logger;