import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from '../infrastructure/logging/Logger';

// Create a database connection pool
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
});

// Log connection status
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL connection error:', err);
});

// Initialize Drizzle ORM with connection pool
export const db = drizzle(pool);

// Export pool for use in transactions
export { sql } from 'drizzle-orm';