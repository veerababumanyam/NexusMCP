import winston from 'winston';

// Create a Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'nexus-mcp' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...metadata }) => {
            let metaStr = '';
            if (Object.keys(metadata).length > 0 && metadata.service) {
              metaStr = JSON.stringify(metadata);
            }
            return `${timestamp} ${level}: ${message} ${metaStr}`;
          }
        )
      )
    })
  ]
});

// Add a stream for Express logging
logger.stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;