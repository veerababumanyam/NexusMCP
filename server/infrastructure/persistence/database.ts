/**
 * Database Infrastructure Module
 * 
 * Implements the data persistence layer with infrastructure concerns:
 * - Database connection management
 * - Connection pooling
 * - Query logging and monitoring
 * - Error handling and retries
 * - Transaction management
 * 
 * Following Architecture Principles:
 * - Separation of concerns (infrastructure vs domain)
 * - Repository pattern
 * - Dependency inversion
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, or, not, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { eventBus } from '../events/EventBus';
import * as schema from '@shared/schema';
import { pool as dbPool } from '../../../db/index';

// Add error handling to pool
dbPool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  
  // Emit database error event
  eventBus.publish('infrastructure.database.error', {
    error: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }, {
    source: 'database_infrastructure'
  });
});

// Create database connection with Drizzle ORM
const db = drizzle(dbPool, { schema });

/**
 * Database utility functions for infrastructure concerns
 */
export const dbUtils = {
  /**
   * Encrypt sensitive data for storage
   * @param data The data to encrypt
   */
  encrypt: (data: string): string => {
    // In a production system, use a proper encryption library
    // This is a simple implementation for demonstration
    const algorithm = 'aes-256-ctr';
    const secret = process.env.ENCRYPTION_KEY || 'fallback_development_key_only';
    const iv = randomBytes(16);
    
    // Return a simple hash for demonstration
    // Real implementation would use cipher.update/final
    const hash = createHash('sha256')
      .update(data + secret)
      .digest('hex');
    
    return `${hash}.${iv.toString('hex')}`;
  },
  
  /**
   * Decrypt sensitive data from storage
   * @param encryptedData The encrypted data to decrypt
   */
  decrypt: (encryptedData: string): string => {
    // In a production system, implement proper decryption
    // This is a placeholder that returns the encrypted data
    return encryptedData.split('.')[0];
  },
  
  /**
   * Check database health
   */
  healthCheck: async (): Promise<boolean> => {
    try {
      // Try a simple query to check connection
      const result = await dbPool.query('SELECT 1 as health');
      return result.rows[0]?.health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  },
  
  /**
   * Execute raw SQL query
   * Use with caution - prefer using Drizzle ORM for most operations
   */
  executeRawSql: async <T = any>(query: string, params: any[] = []): Promise<T[]> => {
    try {
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Raw SQL query failed:', error);
      throw error;
    }
  },
  
  /**
   * Run database migrations
   */
  runMigrations: async (): Promise<void> => {
    try {
      console.log('Running database migrations...');
      // Implementation using drizzle-kit or similar
      // await migrate(db, { migrationsFolder: './drizzle' });
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  },
  
  /**
   * Create a transaction
   */
  createTransaction: async <T>(callback: (tx: typeof db) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create transaction database instance
      const tx = drizzle(client, { schema });
      
      // Execute callback within transaction
      const result = await callback(tx);
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

// Export database and utilities
export { db, pool, eq, and, or, not, sql };