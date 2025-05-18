import { db } from '../../db';
import { eq, and, desc, sql, asc, gte, lte, like, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { createSecurityCertificatesSchema } from '@shared/schema_security_certificates';
import { securityCertificates, securityCertificateHistory, SecurityCertificate, CertificateHistory } from '@shared/schema_security_certificates';

/**
 * Service for managing SSL/TLS certificates
 * Handles certificate lifecycle, expiration monitoring, and rotation
 */
export class CertificateManagementService {
  /**
   * Get certificates with optional filtering
   */
  async getCertificates(filters: {
    workspaceId?: number;
    status?: string;
    type?: string;
    searchTerm?: string;
    domain?: string;
    isExpiring?: boolean;
    isExpired?: boolean;
    tags?: string[];
    page?: number;
    limit?: number;
  } = {}) {
    const {
      workspaceId,
      status,
      type,
      searchTerm,
      domain,
      isExpiring,
      isExpired,
      tags,
      page = 1,
      limit = 50
    } = filters;

    let query = db.select().from(securityCertificates);
    const conditions = [];

    if (workspaceId !== undefined) {
      conditions.push(eq(securityCertificates.workspaceId, workspaceId));
    }

    if (status) {
      conditions.push(eq(securityCertificates.status, status));
    }

    if (type) {
      conditions.push(eq(securityCertificates.type, type));
    }

    if (searchTerm) {
      conditions.push(
        or(
          like(securityCertificates.name, `%${searchTerm}%`),
          like(securityCertificates.issuer, `%${searchTerm}%`),
          like(securityCertificates.subject, `%${searchTerm}%`)
        )
      );
    }

    if (domain) {
      // Search in the domains array
      conditions.push(
        sql`${securityCertificates.domains} @> ${domain}`
      );
    }

    if (isExpiring === true) {
      // Certificates expiring within 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      conditions.push(
        and(
          gte(securityCertificates.validTo, new Date()),
          lte(securityCertificates.validTo, thirtyDaysFromNow)
        )
      );
    }

    if (isExpired === true) {
      // Already expired certificates
      conditions.push(lte(securityCertificates.validTo, new Date()));
    }

    if (tags && tags.length > 0) {
      // Search for certificates with any of the provided tags
      conditions.push(
        sql`${securityCertificates.tags} && ${tags}`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.orderBy(desc(securityCertificates.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;
    return results;
  }

  /**
   * Get a certificate by ID
   */
  async getCertificateById(id: number): Promise<SecurityCertificate | null> {
    const [result] = await db
      .select()
      .from(securityCertificates)
      .where(eq(securityCertificates.id, id));
    
    return result || null;
  }

  /**
   * Create a new certificate
   */
  async createCertificate(certificate: Omit<SecurityCertificate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecurityCertificate> {
    // Additional validation could be performed here
    // such as checking certificate format, expiration dates, etc.
    
    const [result] = await db
      .insert(securityCertificates)
      .values({
        ...certificate,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Log this action in the certificate history
    await this.addCertificateHistory({
      certificateId: result.id,
      action: 'created',
      details: { message: 'Certificate was created', actor: certificate.createdBy },
      userId: certificate.createdBy,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Update a certificate
   */
  async updateCertificate(
    id: number,
    update: Partial<Omit<SecurityCertificate, 'id' | 'createdAt'>>
  ): Promise<SecurityCertificate | null> {
    const [result] = await db
      .update(securityCertificates)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(securityCertificates.id, id))
      .returning();

    if (result) {
      // Log this action in the certificate history
      await this.addCertificateHistory({
        certificateId: id,
        action: 'updated',
        details: { 
          message: 'Certificate was updated',
          updatedFields: Object.keys(update),
          actor: update.updatedBy
        },
        userId: update.updatedBy || null,
        timestamp: new Date()
      });
    }

    return result || null;
  }

  /**
   * Delete a certificate
   */
  async deleteCertificate(id: number, userId?: number): Promise<boolean> {
    try {
      // First, log this action in the certificate history
      // Get the certificate before deleting
      const certificate = await this.getCertificateById(id);
      
      if (certificate) {
        await this.addCertificateHistory({
          certificateId: id,
          action: 'deleted',
          details: { 
            message: 'Certificate was deleted',
            certificateName: certificate.name,
            certificateType: certificate.type,
            actor: userId
          },
          userId: userId || null,
          timestamp: new Date()
        });
      }

      // Now delete the certificate
      const [deletedCertificate] = await db
        .delete(securityCertificates)
        .where(eq(securityCertificates.id, id))
        .returning();

      return !!deletedCertificate;
    } catch (error) {
      console.error('Error deleting certificate:', error);
      return false;
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(
    id: number, 
    reason: string,
    revokedBy?: number
  ): Promise<SecurityCertificate | null> {
    const [revokedCertificate] = await db
      .update(securityCertificates)
      .set({ 
        status: 'revoked',
        revocationReason: reason,
        revocationDate: new Date(),
        revokedBy: revokedBy || null,
        updatedAt: new Date()
      })
      .where(eq(securityCertificates.id, id))
      .returning();

    if (revokedCertificate) {
      // Log this action in the certificate history
      await this.addCertificateHistory({
        certificateId: id,
        action: 'revoked',
        details: { 
          message: 'Certificate was revoked',
          reason: reason
        },
        userId: revokedBy || null,
        timestamp: new Date()
      });
    }

    return revokedCertificate || null;
  }

  /**
   * Renew a certificate
   * In real implementation, this would involve creating a new certificate
   * and replacing the old one
   */
  async renewCertificate(
    id: number,
    newCertificateData: {
      certificate: string;
      privateKey?: string;
      validFrom?: Date;
      validTo?: Date;
    },
    renewedBy?: number
  ): Promise<SecurityCertificate | null> {
    const certificate = await this.getCertificateById(id);
    
    if (!certificate) {
      return null;
    }

    const [renewedCertificate] = await db
      .update(securityCertificates)
      .set({ 
        ...newCertificateData,
        status: 'active',
        renewalDate: new Date(),
        renewedBy: renewedBy || null,
        updatedAt: new Date()
      })
      .where(eq(securityCertificates.id, id))
      .returning();

    if (renewedCertificate) {
      // Log this action in the certificate history
      await this.addCertificateHistory({
        certificateId: id,
        action: 'renewed',
        details: { 
          message: 'Certificate was renewed',
          previousValidTo: certificate.validTo,
          newValidTo: newCertificateData.validTo
        },
        userId: renewedBy || null,
        timestamp: new Date()
      });
    }

    return renewedCertificate || null;
  }

  /**
   * Get certificate history
   */
  async getCertificateHistory(
    certificateId: number,
    limit: number = 50
  ): Promise<CertificateHistory[]> {
    const history = await db
      .select()
      .from(securityCertificateHistory)
      .where(eq(securityCertificateHistory.certificateId, certificateId))
      .orderBy(desc(securityCertificateHistory.timestamp))
      .limit(limit);
    
    return history;
  }

  /**
   * Add certificate history entry
   */
  private async addCertificateHistory(
    entry: Omit<CertificateHistory, 'id'>
  ): Promise<CertificateHistory> {
    const [result] = await db
      .insert(securityCertificateHistory)
      .values(entry)
      .returning();

    return result;
  }

  /**
   * Check for expiring certificates
   * Returns certificates that are expiring within the specified days
   */
  async getExpiringCertificates(
    daysToExpiration: number = 30,
    workspaceId?: number
  ): Promise<SecurityCertificate[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToExpiration);

    let query = db
      .select()
      .from(securityCertificates)
      .where(
        and(
          eq(securityCertificates.status, 'active'),
          gte(securityCertificates.validTo, new Date()),
          lte(securityCertificates.validTo, expirationDate)
        )
      );

    if (workspaceId !== undefined) {
      query = query.where(eq(securityCertificates.workspaceId, workspaceId));
    }

    const results = await query;
    return results;
  }

  /**
   * Get certificate expiration statistics
   */
  async getExpirationStats(workspaceId?: number): Promise<{
    total: number;
    expiringSoon: number;
    expired: number;
    valid: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    // Base query condition
    let condition = sql`1 = 1`;
    
    // Add workspace filter if provided
    if (workspaceId !== undefined) {
      condition = and(condition, eq(securityCertificates.workspaceId, workspaceId));
    }

    // Calculate total certificates
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityCertificates)
      .where(condition);

    // Calculate certificates expiring in the next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const [{ count: expiringSoon }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityCertificates)
      .where(
        and(
          condition,
          eq(securityCertificates.status, 'active'),
          gte(securityCertificates.validTo, new Date()),
          lte(securityCertificates.validTo, thirtyDaysFromNow)
        )
      );

    // Calculate expired certificates
    const [{ count: expired }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(securityCertificates)
      .where(
        and(
          condition,
          lte(securityCertificates.validTo, new Date())
        )
      );

    // Calculate valid certificates (not expired or expiring soon)
    const valid = total - expired - expiringSoon;

    // Get counts by status
    const statusCounts = await db
      .select({
        status: securityCertificates.status,
        count: sql<number>`count(*)`
      })
      .from(securityCertificates)
      .where(condition)
      .groupBy(securityCertificates.status);

    const byStatus: Record<string, number> = {};
    for (const { status, count } of statusCounts) {
      if (status) {
        byStatus[status] = Number(count);
      }
    }

    // Get counts by type
    const typeCounts = await db
      .select({
        type: securityCertificates.type,
        count: sql<number>`count(*)`
      })
      .from(securityCertificates)
      .where(condition)
      .groupBy(securityCertificates.type);

    const byType: Record<string, number> = {};
    for (const { type, count } of typeCounts) {
      if (type) {
        byType[type] = Number(count);
      }
    }

    return {
      total,
      expiringSoon,
      expired,
      valid,
      byStatus,
      byType
    };
  }
}

export const certificateManagementService = new CertificateManagementService();