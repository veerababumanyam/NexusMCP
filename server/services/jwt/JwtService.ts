import { JwtSettings, JwtClaimMapping, JwtTokenAudit } from '@shared/schema_jwt';
import { db } from '../../../db';
import { jwtSettings, jwtClaimMappings, jwtTokenAudit } from '@shared/schema_jwt';
import { eq, and, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../logger';

// Types
interface GenerateTokenOptions {
  userId?: number;
  audience?: string;
  expiresIn?: number;
  claims?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  purpose?: string;
  metadata?: Record<string, any>;
}

interface TokenResult {
  token: string;
  expires: Date;
  refreshToken?: string;
  refreshExpires?: Date;
  tokenId: string;
}

interface JwtKeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Service for JWT operations including token generation, validation, and key management
 */
export class JwtService {
  private static instance: JwtService;

  private constructor() {}

  /**
   * Get the singleton instance of JwtService
   */
  public static getInstance(): JwtService {
    if (!JwtService.instance) {
      JwtService.instance = new JwtService();
    }
    return JwtService.instance;
  }

  /**
   * Get all JWT settings
   */
  public async getAllSettings(): Promise<JwtSettings[]> {
    try {
      return await db.query.jwtSettings.findMany({
        orderBy: [desc(jwtSettings.defaultSettings), desc(jwtSettings.createdAt)]
      });
    } catch (error) {
      logger.error('Error fetching JWT settings', { error });
      throw new Error('Failed to fetch JWT settings');
    }
  }

  /**
   * Get JWT settings by ID
   */
  public async getSettingsById(id: number): Promise<JwtSettings | null> {
    try {
      return await db.query.jwtSettings.findFirst({
        where: eq(jwtSettings.id, id)
      });
    } catch (error) {
      logger.error(`Error fetching JWT settings with ID ${id}`, { error });
      throw new Error('Failed to fetch JWT settings');
    }
  }

  /**
   * Get default JWT settings
   */
  public async getDefaultSettings(): Promise<JwtSettings | null> {
    try {
      return await db.query.jwtSettings.findFirst({
        where: eq(jwtSettings.defaultSettings, true)
      });
    } catch (error) {
      logger.error('Error fetching default JWT settings', { error });
      throw new Error('Failed to fetch default JWT settings');
    }
  }

  /**
   * Create new JWT settings
   */
  public async createSettings(data: Omit<JwtSettings, 'id' | 'createdAt' | 'updatedAt'>): Promise<JwtSettings> {
    try {
      // If setting as default, clear other defaults
      if (data.defaultSettings) {
        await db.update(jwtSettings)
          .set({ defaultSettings: false })
          .where(eq(jwtSettings.defaultSettings, true));
      }

      // Generate key pair based on algorithm if RSA or ECDSA
      if (
        data.signingAlgorithm.startsWith('RS') || 
        data.signingAlgorithm.startsWith('ES')
      ) {
        const keyPair = await this.generateKeyPair(data.signingAlgorithm);
        data.signingKey = keyPair.privateKey;
        data.publicKey = keyPair.publicKey;
      } else {
        // For HMAC, generate a secure random string
        const secret = crypto.randomBytes(32).toString('hex');
        data.signingKey = secret;
      }

      const [result] = await db.insert(jwtSettings)
        .values({
          ...data,
          lastRotated: new Date()
        })
        .returning();

      return result;
    } catch (error) {
      logger.error('Error creating JWT settings', { error });
      throw new Error('Failed to create JWT settings');
    }
  }

  /**
   * Update JWT settings
   */
  public async updateSettings(id: number, data: Partial<JwtSettings>): Promise<JwtSettings> {
    try {
      // If setting as default, clear other defaults
      if (data.defaultSettings) {
        await db.update(jwtSettings)
          .set({ defaultSettings: false })
          .where(and(
            eq(jwtSettings.defaultSettings, true),
            eq(jwtSettings.id, id, 'not')
          ));
      }

      const [result] = await db.update(jwtSettings)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(jwtSettings.id, id))
        .returning();

      if (!result) {
        throw new Error('JWT settings not found');
      }

      return result;
    } catch (error) {
      logger.error(`Error updating JWT settings with ID ${id}`, { error });
      throw new Error('Failed to update JWT settings');
    }
  }

  /**
   * Delete JWT settings
   */
  public async deleteSettings(id: number): Promise<void> {
    try {
      const deleted = await db.delete(jwtSettings)
        .where(eq(jwtSettings.id, id))
        .returning();

      if (!deleted.length) {
        throw new Error('JWT settings not found');
      }
    } catch (error) {
      logger.error(`Error deleting JWT settings with ID ${id}`, { error });
      throw new Error('Failed to delete JWT settings');
    }
  }

  /**
   * Rotate keys for JWT settings
   */
  public async rotateKeys(id: number): Promise<JwtSettings> {
    try {
      const settings = await this.getSettingsById(id);
      if (!settings) {
        throw new Error('JWT settings not found');
      }

      let signingKey: string;
      let publicKey: string | null = null;

      // Generate key pair based on algorithm if RSA or ECDSA
      if (
        settings.signingAlgorithm.startsWith('RS') || 
        settings.signingAlgorithm.startsWith('ES')
      ) {
        const keyPair = await this.generateKeyPair(settings.signingAlgorithm);
        signingKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;
      } else {
        // For HMAC, generate a secure random string
        signingKey = crypto.randomBytes(32).toString('hex');
      }

      const [result] = await db.update(jwtSettings)
        .set({
          signingKey,
          publicKey,
          lastRotated: new Date(),
          updatedAt: new Date()
        })
        .where(eq(jwtSettings.id, id))
        .returning();

      return result;
    } catch (error) {
      logger.error(`Error rotating keys for JWT settings with ID ${id}`, { error });
      throw new Error('Failed to rotate keys');
    }
  }

  /**
   * Get JWT claim mappings for a specific settings
   */
  public async getClaimMappings(settingsId: number): Promise<JwtClaimMapping[]> {
    try {
      return await db.query.jwtClaimMappings.findMany({
        where: eq(jwtClaimMappings.settingsId, settingsId),
        orderBy: [desc(jwtClaimMappings.isRequired), desc(jwtClaimMappings.createdAt)]
      });
    } catch (error) {
      logger.error(`Error fetching JWT claim mappings for settings ${settingsId}`, { error });
      throw new Error('Failed to fetch JWT claim mappings');
    }
  }

  /**
   * Create a new claim mapping
   */
  public async createClaimMapping(data: Omit<JwtClaimMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<JwtClaimMapping> {
    try {
      const [result] = await db.insert(jwtClaimMappings)
        .values(data)
        .returning();

      return result;
    } catch (error) {
      logger.error('Error creating JWT claim mapping', { error });
      throw new Error('Failed to create JWT claim mapping');
    }
  }

  /**
   * Update a claim mapping
   */
  public async updateClaimMapping(id: number, data: Partial<JwtClaimMapping>): Promise<JwtClaimMapping> {
    try {
      const [result] = await db.update(jwtClaimMappings)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(jwtClaimMappings.id, id))
        .returning();

      if (!result) {
        throw new Error('JWT claim mapping not found');
      }

      return result;
    } catch (error) {
      logger.error(`Error updating JWT claim mapping with ID ${id}`, { error });
      throw new Error('Failed to update JWT claim mapping');
    }
  }

  /**
   * Delete a claim mapping
   */
  public async deleteClaimMapping(id: number): Promise<void> {
    try {
      const deleted = await db.delete(jwtClaimMappings)
        .where(eq(jwtClaimMappings.id, id))
        .returning();

      if (!deleted.length) {
        throw new Error('JWT claim mapping not found');
      }
    } catch (error) {
      logger.error(`Error deleting JWT claim mapping with ID ${id}`, { error });
      throw new Error('Failed to delete JWT claim mapping');
    }
  }

  /**
   * Generate a JWT token using specified JWT settings
   */
  public async generateToken(settingsId: number, options: GenerateTokenOptions = {}): Promise<TokenResult> {
    try {
      const settings = await this.getSettingsById(settingsId);
      if (!settings) {
        throw new Error('JWT settings not found');
      }

      if (!settings.isActive) {
        throw new Error('JWT settings are inactive');
      }

      if (!settings.signingKey) {
        throw new Error('JWT settings do not have a signing key');
      }

      // Generate token ID
      const tokenId = uuidv4();

      // Calculate expiration
      const expiresIn = options.expiresIn || settings.tokenLifetime;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Standard JWT claims
      const payload: Record<string, any> = {
        jti: tokenId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000),
        iss: settings.issuer,
        ...options.claims
      };

      // Add audience if provided
      const audience = options.audience || settings.audience;
      if (audience) {
        payload.aud = audience;
      }

      // Get custom claim mappings and apply them
      if (options.userId) {
        const claimMappings = await this.getClaimMappings(settingsId);
        // Apply claims mappings logic here based on user data
        // This would require fetching user data and applying the mappings
      }

      // Sign the token
      const token = jwt.sign(payload, settings.signingKey, {
        algorithm: settings.signingAlgorithm as any
      });

      // Record token in audit trail
      await db.insert(jwtTokenAudit)
        .values({
          settingsId,
          userId: options.userId,
          tokenId,
          issuedAt: new Date(),
          expiresAt,
          clientIp: options.ip,
          userAgent: options.userAgent,
          purpose: options.purpose,
          metadata: options.metadata
        });

      return {
        token,
        expires: expiresAt,
        tokenId
      };
    } catch (error) {
      logger.error(`Error generating token using JWT settings ${settingsId}`, { error });
      throw new Error('Failed to generate JWT token');
    }
  }

  /**
   * Verify a JWT token
   */
  public async verifyToken(token: string, settingsId?: number): Promise<any> {
    try {
      // If settings ID is provided, use those settings
      if (settingsId) {
        const settings = await this.getSettingsById(settingsId);
        if (!settings || !settings.isActive || !settings.signingKey) {
          throw new Error('Invalid or inactive JWT settings');
        }

        return jwt.verify(token, settings.signingKey, {
          algorithms: [settings.signingAlgorithm] as jwt.Algorithm[]
        });
      }

      // Otherwise, try the default settings first
      const defaultSettings = await this.getDefaultSettings();
      if (defaultSettings && defaultSettings.isActive && defaultSettings.signingKey) {
        try {
          return jwt.verify(token, defaultSettings.signingKey, {
            algorithms: [defaultSettings.signingAlgorithm] as jwt.Algorithm[]
          });
        } catch (e) {
          // If verification fails with default settings, try others
        }
      }

      // Try all active settings
      const allSettings = await this.getAllSettings();
      for (const settings of allSettings) {
        if (settings.isActive && settings.signingKey) {
          try {
            return jwt.verify(token, settings.signingKey, {
              algorithms: [settings.signingAlgorithm] as jwt.Algorithm[]
            });
          } catch (e) {
            // Continue trying other settings
          }
        }
      }

      throw new Error('Token could not be verified with any available settings');
    } catch (error) {
      logger.error('Error verifying JWT token', { error });
      throw new Error('Failed to verify JWT token');
    }
  }

  /**
   * Revoke a JWT token
   */
  public async revokeToken(tokenId: string, userId?: number, reason?: string): Promise<void> {
    try {
      const [result] = await db.update(jwtTokenAudit)
        .set({
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy: userId,
          reason
        })
        .where(eq(jwtTokenAudit.tokenId, tokenId))
        .returning();

      if (!result) {
        throw new Error('Token not found in audit trail');
      }
    } catch (error) {
      logger.error(`Error revoking token ${tokenId}`, { error });
      throw new Error('Failed to revoke JWT token');
    }
  }

  /**
   * Check if a token has been revoked
   */
  public async isTokenRevoked(tokenId: string): Promise<boolean> {
    try {
      const token = await db.query.jwtTokenAudit.findFirst({
        where: eq(jwtTokenAudit.tokenId, tokenId)
      });

      return token ? token.isRevoked : false;
    } catch (error) {
      logger.error(`Error checking if token ${tokenId} is revoked`, { error });
      throw new Error('Failed to check if token is revoked');
    }
  }

  /**
   * Generate a key pair for asymmetric algorithms
   */
  private async generateKeyPair(algorithm: string): Promise<JwtKeyPair> {
    try {
      let keyType: 'rsa' | 'ec';
      let options: any = {};

      if (algorithm.startsWith('RS')) {
        keyType = 'rsa';
        options = {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        };
      } else if (algorithm.startsWith('ES')) {
        keyType = 'ec';
        let namedCurve: string;
        
        switch (algorithm) {
          case 'ES256':
            namedCurve = 'prime256v1';
            break;
          case 'ES384':
            namedCurve = 'secp384r1';
            break;
          case 'ES512':
            namedCurve = 'secp521r1';
            break;
          default:
            namedCurve = 'prime256v1';
        }
        
        options = {
          namedCurve,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        };
      } else {
        throw new Error(`Unsupported algorithm for key pair generation: ${algorithm}`);
      }

      return new Promise((resolve, reject) => {
        crypto.generateKeyPair(keyType, options, (err, publicKey, privateKey) => {
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
    } catch (error) {
      logger.error(`Error generating key pair for algorithm ${algorithm}`, { error });
      throw new Error('Failed to generate key pair');
    }
  }

  /**
   * Generate a test token for demonstration and testing purposes
   */
  public async generateTestToken(settingsId: number, payload: Record<string, any> = {}): Promise<{ token: string; payload: any }> {
    try {
      const settings = await this.getSettingsById(settingsId);
      if (!settings) {
        throw new Error('JWT settings not found');
      }

      if (!settings.isActive) {
        throw new Error('JWT settings are inactive');
      }

      if (!settings.signingKey) {
        throw new Error('JWT settings do not have a signing key');
      }

      // Generate token ID
      const tokenId = uuidv4();

      // Standard JWT claims
      const tokenPayload: Record<string, any> = {
        jti: tokenId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + settings.tokenLifetime,
        iss: settings.issuer,
        ...payload
      };

      // Add audience if provided
      if (settings.audience) {
        tokenPayload.aud = settings.audience;
      }

      // Sign the token
      const token = jwt.sign(tokenPayload, settings.signingKey, {
        algorithm: settings.signingAlgorithm as any
      });

      return {
        token,
        payload: tokenPayload
      };
    } catch (error) {
      logger.error(`Error generating test token using JWT settings ${settingsId}`, { error });
      throw new Error('Failed to generate test JWT token');
    }
  }

  /**
   * Get JWKS (JSON Web Key Set) for a specific JWT settings
   */
  public async getJwks(settingsId: number): Promise<any> {
    try {
      const settings = await this.getSettingsById(settingsId);
      if (!settings) {
        throw new Error('JWT settings not found');
      }

      if (!settings.isActive) {
        throw new Error('JWT settings are inactive');
      }

      if (!settings.publicKey) {
        throw new Error('JWT settings do not have a public key');
      }

      // Convert PEM public key to JWK
      // This is a simplified version - in production, use a proper library
      // like jose or node-jwk-to-pem for this conversion
      const keyId = crypto.createHash('sha256')
        .update(settings.publicKey)
        .digest('hex');

      let alg: string;
      let kty: string;
      let crv: string | undefined;

      if (settings.signingAlgorithm.startsWith('RS')) {
        alg = settings.signingAlgorithm;
        kty = 'RSA';
      } else if (settings.signingAlgorithm.startsWith('ES')) {
        alg = settings.signingAlgorithm;
        kty = 'EC';
        
        switch (settings.signingAlgorithm) {
          case 'ES256':
            crv = 'P-256';
            break;
          case 'ES384':
            crv = 'P-384';
            break;
          case 'ES512':
            crv = 'P-521';
            break;
        }
      } else {
        throw new Error(`Algorithm ${settings.signingAlgorithm} not supported for JWKS`);
      }

      // In a real implementation, extract the actual components from the public key
      // For now, we'll return a placeholder
      return {
        keys: [
          {
            kty,
            use: 'sig',
            kid: keyId,
            alg,
            ...(crv ? { crv } : {}),
            // For RSA: n (modulus) and e (exponent) would be included
            // For EC: x and y coordinates would be included
          }
        ]
      };
    } catch (error) {
      logger.error(`Error generating JWKS for settings ${settingsId}`, { error });
      throw new Error('Failed to generate JWKS');
    }
  }
}