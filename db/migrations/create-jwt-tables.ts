import { db } from '../../db';
import { jwtSettings, jwtClaimMappings, jwtTokenAudit } from '../../shared/schema_jwt';
import logger from '../../server/logger';
import crypto from 'crypto';

/**
 * JWT Tables Creation Migration
 * 
 * This migration adds tables for JWT authentication and token management:
 * - JWT settings (algorithms, keys, expiration)
 * - JWT claim mappings
 * - JWT token audit trail
 */

export async function createJwtTables() {
  try {
    logger.info('Starting JWT tables migration');
    
    // Create a default JWT settings entry with a generated key pair
    const keyPair = await generateRsaKeyPair();
    
    // Create default JWT settings
    logger.info('Creating default JWT settings');
    await db.insert(jwtSettings)
      .values({
        name: 'Default JWT Settings',
        description: 'System default JWT configuration',
        issuer: 'nexusmcp.platform',
        signingAlgorithm: 'RS256',
        signingKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        tokenLifetime: 3600,
        refreshTokenLifetime: 604800,
        defaultSettings: true,
        isActive: true,
        lastRotated: new Date(),
        rotationFrequency: 0,
        useJwks: false
      })
      .onConflictDoNothing();
    
    logger.info('JWT tables migration completed successfully');
    return true;
  } catch (error) {
    logger.error('Error in JWT tables migration', { error });
    throw error;
  }
}

/**
 * Generate RSA key pair for JWT signing
 */
async function generateRsaKeyPair(): Promise<{privateKey: string, publicKey: string}> {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, (err, publicKey, privateKey) => {
      if (err) {
        reject(err);
        return;
      }
      
      resolve({
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString()
      });
    });
  });
}