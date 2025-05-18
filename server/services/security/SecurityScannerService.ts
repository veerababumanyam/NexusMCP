/**
 * Security Scanner Service
 * 
 * Provides functionality for managing security scanners, targets, scans, and vulnerabilities.
 * This service is used by the security scanner API endpoints.
 */

import { db } from '../../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  securityScanners,
  scanTargets,
  scanResults,
  scanVulnerabilities,
  SecurityScanner,
  ScanTarget,
  ScanResult,
  ScanVulnerability,
  securityScannerValidationSchema,
  scanTargetValidationSchema,
  scanResultValidationSchema,
  scanVulnerabilityValidationSchema,
  scannerTypes,
  targetTypes,
  scannerStatusTypes,
  scanResultStatusTypes,
  severityTypes,
  vulnerabilityStatusTypes,
  asJson,
  Json
} from '../../../shared/schema_security_scanner';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';

/**
 * Helper functions to process JSON fields in different entity types 
 * to ensure type compatibility with the database schema
 */

// Type guard function to check if an object has a specific property
function hasProperty<K extends string>(obj: unknown, prop: K): obj is { [key in K]: unknown } {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

// Process security scanner JSON fields
function processScanner(scanner: any): SecurityScanner {
  return {
    ...scanner,
    config: hasProperty(scanner, 'config') && scanner.config !== null ? asJson(scanner.config) : null,
    credentials: hasProperty(scanner, 'credentials') && scanner.credentials !== null ? asJson(scanner.credentials) : null,
    scheduleConfig: hasProperty(scanner, 'scheduleConfig') && scanner.scheduleConfig !== null ? asJson(scanner.scheduleConfig) : null,
  } as SecurityScanner;
}

// Process scan target JSON fields
function processTarget(target: any): ScanTarget {
  return {
    ...target,
    config: hasProperty(target, 'config') && target.config !== null ? asJson(target.config) : null,
    credentials: hasProperty(target, 'credentials') && target.credentials !== null ? asJson(target.credentials) : null,
  } as ScanTarget;
}

// Process scan result JSON fields
function processScanResult(result: any): ScanResult {
  return {
    ...result,
    summary: hasProperty(result, 'summary') && result.summary !== null ? asJson(result.summary) : null,
  } as ScanResult;
}

// Process vulnerability JSON fields
function processVulnerability(vulnerability: any): ScanVulnerability {
  return {
    ...vulnerability,
    details: hasProperty(vulnerability, 'details') && vulnerability.details !== null ? asJson(vulnerability.details) : null,
  } as ScanVulnerability;
}

/**
 * Service for managing security scanners and related functionality
 */
export class SecurityScannerService {
  /**
   * Get all security scanners with optional workspace filtering
   */
  async getScanners(workspaceId?: number): Promise<SecurityScanner[]> {
    try {
      // Use regular select queries instead of the prepared query builder
      let scanners;
      if (workspaceId) {
        scanners = await db.select().from(securityScanners)
          .where(eq(securityScanners.workspaceId, workspaceId))
          .orderBy(desc(securityScanners.updatedAt));
      } else {
        scanners = await db.select().from(securityScanners)
          .orderBy(desc(securityScanners.updatedAt));
      }
      
      // Process JSON fields to ensure type compatibility
      return scanners.map(scanner => processScanner(scanner));
    } catch (error) {
      logger.error('Error getting scanners:', error);
      throw new Error('Failed to get scanners');
    }
  }

  /**
   * Get a single security scanner by ID
   */
  async getScanner(id: number): Promise<SecurityScanner | null> {
    try {
      const result = await db.select().from(securityScanners)
        .where(eq(securityScanners.id, id))
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processScanner(result[0]);
    } catch (error) {
      logger.error(`Error getting scanner ${id}:`, error);
      throw new Error('Failed to get scanner');
    }
  }

  /**
   * Create a new security scanner
   */
  async createScanner(data: any): Promise<SecurityScanner> {
    try {
      // Process JSON fields before validation
      if (data.config) {
        data.config = asJson(data.config);
      }
      if (data.credentials) {
        data.credentials = asJson(data.credentials);
      }
      if (data.scheduleConfig) {
        data.scheduleConfig = asJson(data.scheduleConfig);
      }
      
      // Validate the input data
      const validatedData = securityScannerValidationSchema.parse(data);
      
      // Insert into the database
      const [newScanner] = await db.insert(securityScanners)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      // Process JSON fields to ensure type compatibility
      return processScanner(newScanner);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error('Validation error creating scanner:', error.errors);
        throw new Error(`Validation error: ${error.errors[0]?.message || 'Invalid input'}`);
      }
      
      logger.error('Error creating scanner:', error);
      throw new Error('Failed to create scanner');
    }
  }

  /**
   * Update an existing security scanner
   */
  async updateScanner(id: number, data: any): Promise<SecurityScanner | null> {
    try {
      // Process JSON fields before validation
      if (data.config) {
        data.config = asJson(data.config);
      }
      if (data.credentials) {
        data.credentials = asJson(data.credentials);
      }
      if (data.scheduleConfig) {
        data.scheduleConfig = asJson(data.scheduleConfig);
      }
      
      // Validate the input data (partial validation)
      const validatedData = securityScannerValidationSchema.partial().parse(data);
      
      // Update the database
      const [updatedScanner] = await db.update(securityScanners)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(securityScanners.id, id))
        .returning();
        
      if (!updatedScanner) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processScanner(updatedScanner);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error(`Validation error updating scanner ${id}:`, error.errors);
        throw new Error(`Validation error: ${error.errors[0]?.message || 'Invalid input'}`);
      }
      
      logger.error(`Error updating scanner ${id}:`, error);
      throw new Error('Failed to update scanner');
    }
  }

  /**
   * Delete a security scanner
   */
  async deleteScanner(id: number): Promise<boolean> {
    try {
      const result = await db.delete(securityScanners)
        .where(eq(securityScanners.id, id))
        .returning({ id: securityScanners.id });
        
      return result.length > 0;
    } catch (error) {
      logger.error(`Error deleting scanner ${id}:`, error);
      throw new Error('Failed to delete scanner');
    }
  }

  /**
   * Get all scan targets with optional workspace filtering
   */
  async getScanTargets(workspaceId?: number): Promise<ScanTarget[]> {
    try {
      let targets;
      if (workspaceId) {
        targets = await db.select().from(scanTargets)
          .where(eq(scanTargets.workspaceId, workspaceId))
          .orderBy(desc(scanTargets.updatedAt));
      } else {
        targets = await db.select().from(scanTargets)
          .orderBy(desc(scanTargets.updatedAt));
      }
      
      // Process JSON fields for type compatibility
      return targets.map(target => processTarget(target));
    } catch (error) {
      logger.error('Error getting scan targets:', error);
      throw new Error('Failed to get scan targets');
    }
  }

  /**
   * Get a single scan target by ID
   */
  async getScanTarget(id: number): Promise<ScanTarget | null> {
    try {
      const result = await db.select().from(scanTargets)
        .where(eq(scanTargets.id, id))
        .limit(1);
        
      if (result.length === 0) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processTarget(result[0]);
    } catch (error) {
      logger.error(`Error getting scan target ${id}:`, error);
      throw new Error('Failed to get scan target');
    }
  }

  /**
   * Create a new scan target
   */
  async createScanTarget(data: any): Promise<ScanTarget> {
    try {
      // Process JSON fields before validation
      if (data.config) {
        data.config = asJson(data.config);
      }
      if (data.credentials) {
        data.credentials = asJson(data.credentials);
      }
      
      // Validate the input data
      const validatedData = scanTargetValidationSchema.parse(data);
      
      // Insert into the database
      const [newTarget] = await db.insert(scanTargets)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      // Process JSON fields for type compatibility
      return processTarget(newTarget);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error('Validation error creating scan target:', error.errors);
        throw new Error(`Validation error: ${error.errors[0]?.message || 'Invalid input'}`);
      }
      
      logger.error('Error creating scan target:', error);
      throw new Error('Failed to create scan target');
    }
  }

  /**
   * Update an existing scan target
   */
  async updateScanTarget(id: number, data: any): Promise<ScanTarget | null> {
    try {
      // Process JSON fields before validation
      if (data.config) {
        data.config = asJson(data.config);
      }
      if (data.credentials) {
        data.credentials = asJson(data.credentials);
      }
      
      // Validate the input data (partial validation)
      const validatedData = scanTargetValidationSchema.partial().parse(data);
      
      // Update the database
      const [updatedTarget] = await db.update(scanTargets)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(scanTargets.id, id))
        .returning();
        
      if (!updatedTarget) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processTarget(updatedTarget);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error(`Validation error updating scan target ${id}:`, error.errors);
        throw new Error(`Validation error: ${error.errors[0]?.message || 'Invalid input'}`);
      }
      
      logger.error(`Error updating scan target ${id}:`, error);
      throw new Error('Failed to update scan target');
    }
  }

  /**
   * Delete a scan target
   */
  async deleteScanTarget(id: number): Promise<boolean> {
    try {
      const result = await db.delete(scanTargets)
        .where(eq(scanTargets.id, id))
        .returning({ id: scanTargets.id });
        
      return result.length > 0;
    } catch (error) {
      logger.error(`Error deleting scan target ${id}:`, error);
      throw new Error('Failed to delete scan target');
    }
  }

  /**
   * Get scan results for a security scanner
   */
  async getScanResults(scannerId: number): Promise<ScanResult[]> {
    try {
      const results = await db.select().from(scanResults)
        .where(eq(scanResults.scannerId, scannerId))
        .orderBy(desc(scanResults.startTime));
      
      // Process JSON fields for type compatibility
      return results.map(result => processScanResult(result));
    } catch (error) {
      logger.error(`Error getting scan results for scanner ${scannerId}:`, error);
      throw new Error('Failed to get scan results');
    }
  }

  /**
   * Get vulnerabilities for a scan result
   */
  async getScanVulnerabilities(scanResultId: number): Promise<ScanVulnerability[]> {
    try {
      const vulnerabilities = await db.select().from(scanVulnerabilities)
        .where(eq(scanVulnerabilities.scanResultId, scanResultId))
        .orderBy(
          // Order by severity (critical, high, medium, low, info)
          desc(scanVulnerabilities.severity),
          // Then by status (open first, then in progress, etc.)
          desc(scanVulnerabilities.status)
        );
      
      // Process JSON fields for type compatibility
      return vulnerabilities.map(vulnerability => processVulnerability(vulnerability));
    } catch (error) {
      logger.error(`Error getting vulnerabilities for scan ${scanResultId}:`, error);
      throw new Error('Failed to get vulnerabilities');
    }
  }

  /**
   * Start a new security scan
   */
  async startScan(scannerId: number, targetId: number, userId?: number): Promise<ScanResult> {
    try {
      // Check if scanner and target exist
      const scanner = await this.getScanner(scannerId);
      if (!scanner) {
        throw new Error('Scanner not found');
      }
      
      const target = await this.getScanTarget(targetId);
      if (!target) {
        throw new Error('Target not found');
      }
      
      // Create a new scan result
      const [newScanResult] = await db.insert(scanResults)
        .values({
          scannerId,
          targetId,
          startTime: new Date(),
          status: 'running' as const,
          initiatedBy: userId || null,
          summary: asJson({}), // Initialize with empty JSON object
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // In a real implementation, we would start the actual scan here
      // For now, we'll use a simulated scan process
      this.simulateScan(newScanResult.id, scanner.scannerType, target.targetType);
      
      // Update the scanner's last scan time
      await db.update(securityScanners)
        .set({
          lastScanTime: new Date(),
          updatedAt: new Date()
        })
        .where(eq(securityScanners.id, scannerId));
      
      // Process JSON fields for type compatibility
      return processScanResult(newScanResult);
    } catch (error) {
      logger.error(`Error starting scan for scanner ${scannerId} and target ${targetId}:`, error);
      throw new Error('Failed to start scan');
    }
  }

  /**
   * Update scan status
   */
  async updateScanStatus(scanId: number, status: typeof scanResultStatusTypes[number], summary?: any): Promise<ScanResult | null> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };
      
      // If the scan is completed or failed, set the end time
      if (status === 'completed' || status === 'failed') {
        updateData.endTime = new Date();
      }
      
      // If a summary was provided, include it and convert to JSON-compatible type
      if (summary) {
        updateData.summary = asJson(summary);
      }
      
      const [updatedScan] = await db.update(scanResults)
        .set(updateData)
        .where(eq(scanResults.id, scanId))
        .returning();
        
      if (!updatedScan) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processScanResult(updatedScan);
    } catch (error) {
      logger.error(`Error updating scan status for scan ${scanId}:`, error);
      throw new Error('Failed to update scan status');
    }
  }

  /**
   * Add a vulnerability to a scan result
   */
  async addVulnerability(scanResultId: number, data: any): Promise<ScanVulnerability> {
    try {
      // Process JSON fields
      if (data.details) {
        data.details = asJson(data.details);
      }
      
      // Validate the data
      const validatedData = scanVulnerabilityValidationSchema.parse({
        ...data,
        scanResultId
      });
      
      // Insert into the database
      const [newVulnerability] = await db.insert(scanVulnerabilities)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      // Process JSON fields for type compatibility
      return processVulnerability(newVulnerability);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.error('Validation error creating vulnerability:', error.errors);
        throw new Error(`Validation error: ${error.errors[0]?.message || 'Invalid input'}`);
      }
      
      logger.error(`Error adding vulnerability to scan ${scanResultId}:`, error);
      throw new Error('Failed to add vulnerability');
    }
  }

  /**
   * Update vulnerability status
   */
  async updateVulnerabilityStatus(vulnerabilityId: number, status: typeof vulnerabilityStatusTypes[number]): Promise<ScanVulnerability | null> {
    try {
      const [updatedVulnerability] = await db.update(scanVulnerabilities)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(scanVulnerabilities.id, vulnerabilityId))
        .returning();
        
      if (!updatedVulnerability) {
        return null;
      }
      
      // Process JSON fields for type compatibility
      return processVulnerability(updatedVulnerability);
    } catch (error) {
      logger.error(`Error updating vulnerability status for vulnerability ${vulnerabilityId}:`, error);
      throw new Error('Failed to update vulnerability status');
    }
  }

  /**
   * Simulate a security scan (for demonstration purposes)
   * In a real implementation, this would be replaced with an actual scanner
   */
  private async simulateScan(scanId: number, scannerType: string, targetType: string): Promise<void> {
    // In a real implementation, this would perform the actual scan
    // For now, we'll simulate it with a timeout and random findings
    setTimeout(async () => {
      try {
        // Generate random vulnerabilities (1-5)
        const vulnerabilityCount = Math.floor(Math.random() * 5) + 1;
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        let infoCount = 0;
        
        const vulnerabilities = [];
        for (let i = 0; i < vulnerabilityCount; i++) {
          // Generate a random severity
          const severityIndex = Math.floor(Math.random() * severityTypes.length);
          const severity = severityTypes[severityIndex];
          
          switch (severity) {
            case 'critical': criticalCount++; break;
            case 'high': highCount++; break;
            case 'medium': mediumCount++; break;
            case 'low': lowCount++; break;
            case 'info': infoCount++; break;
          }
          
          // Create a vulnerability based on scanner and target type
          const vulnerabilityData = this.getSimulatedVulnerability(scannerType, targetType, severity);
          
          vulnerabilities.push(
            this.addVulnerability(scanId, vulnerabilityData)
          );
        }
        
        // Wait for all vulnerabilities to be added
        await Promise.all(vulnerabilities);
        
        // Update the scan result with a summary and complete status
        await this.updateScanStatus(scanId, 'completed', {
          totalVulnerabilities: vulnerabilityCount,
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount,
          info: infoCount
        });
      } catch (error) {
        logger.error(`Error in simulated scan ${scanId}:`, error);
        await this.updateScanStatus(scanId, 'failed');
      }
    }, 5000); // Simulate a 5 second scan
  }

  /**
   * Get a simulated vulnerability based on scanner and target type
   */
  private getSimulatedVulnerability(scannerType: string, targetType: string, severity: string): any {
    // These are sample vulnerabilities, in a real implementation they would be generated based on scan results
    const vulnerabilities = {
      vulnerability: {
        server: [
          {
            title: 'CVE-2023-12345: OpenSSL Vulnerability',
            description: 'Outdated OpenSSL version with known security vulnerabilities',
            severity,
            cvssScore: severity === 'critical' ? 9.8 : severity === 'high' ? 8.5 : severity === 'medium' ? 6.5 : 4.2,
            cveId: 'CVE-2023-12345',
            location: '/etc/ssl',
            remediation: 'Update OpenSSL to latest version',
            status: 'open',
            details: {
              affected_versions: '1.0.1 - 1.0.2',
              recommended_version: '1.1.1t'
            }
          },
          {
            title: 'Exposed SSH Port',
            description: 'SSH port 22 is exposed to the public internet',
            severity,
            cvssScore: severity === 'critical' ? 9.2 : severity === 'high' ? 7.5 : severity === 'medium' ? 5.5 : 3.2,
            location: 'Port 22/TCP',
            remediation: 'Restrict SSH access to VPN/trusted IPs only',
            status: 'open'
          }
        ],
        web: [
          {
            title: 'Cross-Site Scripting (XSS) Vulnerability',
            description: 'Unsanitized user input is reflected in the response',
            severity,
            cvssScore: severity === 'critical' ? 9.1 : severity === 'high' ? 7.8 : severity === 'medium' ? 5.8 : 3.5,
            location: '/search?q=parameter',
            remediation: 'Implement proper input sanitization and Content-Security-Policy',
            status: 'open'
          },
          {
            title: 'SQL Injection Vulnerability',
            description: 'User input is directly concatenated in SQL queries',
            severity,
            cvssScore: severity === 'critical' ? 9.9 : severity === 'high' ? 8.8 : severity === 'medium' ? 6.8 : 4.0,
            location: '/api/users?id=parameter',
            remediation: 'Use parameterized queries or an ORM',
            status: 'open'
          }
        ]
      },
      malware: {
        server: [
          {
            title: 'Suspicious Binary Detected',
            description: 'Potentially malicious executable file found',
            severity,
            location: '/tmp/suspicious_file.bin',
            remediation: 'Remove the file and investigate how it was created',
            status: 'open'
          }
        ],
        web: [
          {
            title: 'Malicious JavaScript Detected',
            description: 'JavaScript code attempting to exfiltrate data',
            severity,
            location: '/assets/js/analytics.js',
            remediation: 'Remove the malicious code and verify source integrity',
            status: 'open'
          }
        ]
      },
      compliance: {
        server: [
          {
            title: 'Weak Password Policy',
            description: 'Password policy does not meet compliance requirements',
            severity,
            location: '/etc/pam.d/common-password',
            remediation: 'Update password policy to enforce complexity requirements',
            status: 'open',
            details: {
              compliance_framework: 'PCI DSS',
              requirement: '8.2.3'
            }
          }
        ],
        web: [
          {
            title: 'Missing Security Headers',
            description: 'HTTP response is missing recommended security headers',
            severity,
            location: 'HTTP Response Headers',
            remediation: 'Add Content-Security-Policy, X-Frame-Options, and other security headers',
            status: 'open',
            details: {
              compliance_framework: 'OWASP Top 10',
              requirement: 'A6:2017'
            }
          }
        ]
      }
    };
    
    // Get vulnerabilities based on scanner type and target type
    const scannerVulns = vulnerabilities[scannerType as keyof typeof vulnerabilities];
    if (!scannerVulns) {
      // Fallback to vulnerability scanner if not found
      const vulnerabilityVulns = vulnerabilities.vulnerability;
      const targetVulns = vulnerabilityVulns[targetType as keyof typeof vulnerabilityVulns] || vulnerabilityVulns.server;
      return targetVulns[Math.floor(Math.random() * targetVulns.length)];
    }
    
    const targetVulns = scannerVulns[targetType as keyof typeof scannerVulns];
    if (!targetVulns) {
      // Fallback to server vulnerabilities if not found
      return scannerVulns.server[Math.floor(Math.random() * scannerVulns.server.length)];
    }
    
    return targetVulns[Math.floor(Math.random() * targetVulns.length)];
  }
}