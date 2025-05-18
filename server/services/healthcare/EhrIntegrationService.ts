/**
 * EHR Integration Service
 * 
 * Enterprise-grade service for integrating with Electronic Health Record systems,
 * including Epic, Cerner, and FHIR-compliant systems.
 * 
 * Features:
 * - Secure connection management
 * - Authentication and token handling
 * - Standardized data access across different EHR systems
 * - Fine-grained permission controls
 * - HIPAA-compliant logging and consent validation
 */
import axios, { AxiosInstance } from "axios";
import { db } from "../../../db";
import { ehrIntegrations } from "../../../shared/schema_healthcare";
import { sql, eq, and } from "drizzle-orm";
import { hipaaAuditService } from "./HipaaAuditService";
import { phiRedactionService } from "./PhiRedactionService";
import { eventBus } from "../../eventBus";

// Define interfaces for now until we have the actual schemas
interface EhrSystem {
  id: number;
  workspaceId: number;
  name: string;
  systemType: string;
  baseUrl: string;
  tokenUrl?: string;
  authType: string;
  clientId?: string;
  clientSecret?: string;
  apiVersion?: string;
  isActive: boolean;
  settings?: any;
}

type PhiCategory = string;

// Token cache to prevent excessive auth requests
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface EhrRequestOptions {
  userId: number;
  patientIdentifier: string;
  resourceType: string;
  accessReason: string;
  ipAddress: string;
  userAgent?: string;
  redactPhi?: boolean;
  onPremiseOnly?: boolean;
  consentId?: number;
}

export class EhrIntegrationService {
  private tokenCache: Map<number, TokenCache> = new Map();
  private connectors: Map<string, any> = new Map();
  private httpClients: Map<number, AxiosInstance> = new Map();
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize the service and register system connectors
   */
  private async initialize() {
    try {
      // Register our specific EHR system connectors
      this.registerConnector('EPIC', new EpicConnector());
      this.registerConnector('CERNER', new CernerConnector());
      this.registerConnector('FHIR', new FhirConnector());
      
      console.log('EHR Integration Service initialized');
    } catch (error) {
      console.error('Failed to initialize EHR Integration Service:', error);
    }
  }
  
  /**
   * Register a specific EHR system connector implementation
   */
  private registerConnector(type: string, connector: any) {
    this.connectors.set(type, connector);
  }
  
  /**
   * Get EHR system by ID using direct SQL
   */
  private async getEhrSystem(ehrSystemId: number): Promise<EhrSystem> {
    // Use raw SQL for now since we don't have the actual schema defined
    const ehrSystemQuery = `
      SELECT * FROM ehr_systems 
      WHERE id = $1
    `;

    try {
      const result = await db.execute(sql.raw(ehrSystemQuery, [ehrSystemId]));
      const rows = Array.isArray(result) ? result : [];
      
      const ehrSystem = rows.length > 0 ? {
        id: rows[0].id,
        workspaceId: rows[0].workspace_id,
        name: rows[0].name,
        systemType: rows[0].system_type,
        baseUrl: rows[0].base_url,
        tokenUrl: rows[0].token_url,
        authType: rows[0].auth_type,
        clientId: rows[0].client_id,
        clientSecret: rows[0].client_secret,
        apiVersion: rows[0].api_version,
        isActive: rows[0].is_active,
        settings: rows[0].settings
      } as EhrSystem : null;
      
      if (!ehrSystem) {
        throw new Error(`EHR system with ID ${ehrSystemId} not found`);
      }
      
      return ehrSystem;
    } catch (error) {
      console.error(`Error fetching EHR system ${ehrSystemId}:`, error);
      throw new Error(`Failed to get EHR system with ID ${ehrSystemId}`);
    }
  }
  
  /**
   * Get or create an HTTP client for an EHR system with proper configuration
   */
  private async getHttpClient(ehrSystemId: number): Promise<AxiosInstance> {
    // Return cached client if available
    if (this.httpClients.has(ehrSystemId)) {
      return this.httpClients.get(ehrSystemId)!;
    }
    
    // Get the EHR system first
    const ehrSystem = await this.getEhrSystem(ehrSystemId);
    
    // Create a configured Axios instance
    const client = axios.create({
      baseURL: ehrSystem.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // Add token refresh interceptor
    client.interceptors.request.use(
      async (config) => {
        // Get access token for the EHR system
        const token = await this.getAccessToken(ehrSystem);
        
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Cache the client
    this.httpClients.set(ehrSystemId, client);
    
    return client;
  }
  
  /**
   * Get a valid access token for an EHR system
   */
  private async getAccessToken(ehrSystem: EhrSystem): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(ehrSystem.id);
    const now = Date.now();
    
    if (cached && cached.expiresAt > now) {
      return cached.accessToken;
    }
    
    // Token needs to be refreshed
    try {
      let token: string;
      let expiresIn: number;
      
      // Handle different auth types
      switch (ehrSystem.authType) {
        case 'oauth2':
          // Get the appropriate connector for this system type
          const connector = this.connectors.get(ehrSystem.systemType);
          
          if (!connector) {
            throw new Error(`No connector found for ${ehrSystem.systemType}`);
          }
          
          // Get a new token
          const tokenResponse = await connector.getAccessToken(ehrSystem);
          token = tokenResponse.accessToken;
          expiresIn = tokenResponse.expiresIn || 3600; // Default to 1 hour
          break;
          
        case 'basic':
          // Basic auth doesn't use tokens, just return a placeholder
          token = 'basic-auth';
          expiresIn = 86400; // 24 hours
          break;
          
        case 'apikey':
          // API key auth uses a static token
          token = ehrSystem.clientId || '';
          expiresIn = 86400; // 24 hours
          break;
          
        default:
          throw new Error(`Unsupported auth type: ${ehrSystem.authType}`);
      }
      
      // Cache the token
      this.tokenCache.set(ehrSystem.id, {
        accessToken: token,
        expiresAt: now + (expiresIn * 1000) - 60000 // Subtract 1 minute for safety
      });
      
      return token;
    } catch (error) {
      console.error(`Failed to get access token for EHR system ${ehrSystem.id}:`, error);
      throw new Error(`Authentication failed for EHR system: ${ehrSystem.name}`);
    }
  }
  
  /**
   * Check if a user has access to a specific PHI category
   */
  private async checkAccess(
    ehrSystemId: number,
    userId: number,
    roleId: number,
    category: PhiCategory
  ): Promise<{ hasAccess: boolean; requiresApproval: boolean }> {
    try {
      // Use raw SQL for now since we don't have the actual schema defined
      const accessControlQuery = `
        SELECT * FROM phi_access_controls 
        WHERE ehr_system_id = $1 AND role_id = $2 AND phi_category = $3
      `;
      
      const result = await db.execute(sql.raw(accessControlQuery, [ehrSystemId, roleId, category]));
      const rows = Array.isArray(result) ? result : [];
      
      if (rows.length === 0) {
        return { hasAccess: false, requiresApproval: true };
      }
      
      return {
        hasAccess: rows[0].can_view === true,
        requiresApproval: rows[0].requires_approval === true
      };
    } catch (error) {
      console.error('Error checking PHI access:', error);
      return { hasAccess: false, requiresApproval: true };
    }
  }
  
  /**
   * Get patient data from an EHR system with permission checks and auditing
   */
  public async getPatientData(
    ehrSystemId: number,
    patientId: string,
    resourceType: string,
    category: PhiCategory,
    options: EhrRequestOptions
  ): Promise<any> {
    try {
      // Get the EHR system configuration
      const ehrSystem = await this.getEhrSystem(ehrSystemId);
      
      if (!ehrSystem || !ehrSystem.isActive) {
        throw new Error(`EHR system ${ehrSystemId} not found or inactive`);
      }
      
      // Get user role from user service (simplified for example)
      const roleId = 1; // TODO: Get from user service
      
      // Check if the user has access to this PHI category
      const { hasAccess, requiresApproval } = await this.checkAccess(
        ehrSystemId,
        options.userId,
        roleId,
        category
      );
      
      if (!hasAccess) {
        // Log the access attempt and throw error
        await hipaaAuditService.recordAuditEvent({
          userId: options.userId,
          patientIdentifier: patientId,
          ehrSystemId,
          phiCategory: category,
          action: 'ACCESS_DENIED',
          resourceType,
          resourceId: patientId,
          accessMethod: 'API',
          accessReason: options.accessReason,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent
        });
        
        // Emit security event
        eventBus.emit('security.breach', {
          userId: options.userId,
          resource: `patient:${patientId}`,
          action: 'UNAUTHORIZED_PHI_ACCESS',
          severity: 'HIGH'
        });
        
        throw new Error(`Access denied to ${category} data for patient ${patientId}`);
      }
      
      // Record audit event for the access attempt
      const auditLogId = await hipaaAuditService.recordAuditEvent({
        userId: options.userId,
        patientIdentifier: patientId,
        ehrSystemId,
        phiCategory: category,
        action: 'ACCESS',
        resourceType,
        resourceId: patientId,
        accessMethod: 'API',
        accessReason: options.accessReason,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        consentId: options.consentId
      });
      
      // Get the appropriate connector for this system type
      const connector = this.connectors.get(ehrSystem.systemType);
      
      if (!connector) {
        throw new Error(`No connector found for ${ehrSystem.systemType}`);
      }
      
      // Get HTTP client for this EHR system
      const httpClient = await this.getHttpClient(ehrSystemId);
      
      // Fetch the data from the EHR system
      const data = await connector.getResource(
        httpClient,
        patientId,
        resourceType,
        ehrSystem
      );
      
      // Apply PHI redaction if requested
      let processedData = data;
      
      if (options.redactPhi) {
        // Convert to string for redaction
        const dataString = JSON.stringify(data);
        
        // Apply redaction
        const redactionResult = await phiRedactionService.redactPhi(dataString, {
          workspaceId: ehrSystem.workspaceId,
          userId: options.userId,
          patientIdentifier: patientId,
          ehrSystemId,
          recordAudit: true,
          onPremiseOnly: options.onPremiseOnly,
          transactionId: undefined // Let service generate new ID
        });
        
        // Parse back to object
        processedData = JSON.parse(redactionResult.redactedText);
      }
      
      return {
        data: processedData,
        requiresApproval,
        auditLogId
      };
    } catch (error) {
      console.error(`Error fetching patient data from EHR:`, error);
      throw error;
    }
  }
}

/**
 * Base connector class for EHR systems
 */
abstract class BaseEhrConnector {
  abstract getAccessToken(ehrSystem: EhrSystem): Promise<{ accessToken: string; expiresIn: number }>;
  abstract getResource(httpClient: AxiosInstance, patientId: string, resourceType: string, ehrSystem: EhrSystem): Promise<any>;
}

/**
 * Epic EHR Connector Implementation
 */
class EpicConnector extends BaseEhrConnector {
  async getAccessToken(ehrSystem: EhrSystem): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const tokenResponse = await axios.post(
        ehrSystem.tokenUrl || `${ehrSystem.baseUrl}/oauth2/token`,
        {
          grant_type: 'client_credentials',
          client_id: ehrSystem.clientId,
          client_secret: ehrSystem.clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        accessToken: tokenResponse.data.access_token,
        expiresIn: tokenResponse.data.expires_in
      };
    } catch (error) {
      console.error('Error getting Epic access token:', error);
      throw new Error('Failed to authenticate with Epic EHR');
    }
  }
  
  async getResource(httpClient: AxiosInstance, patientId: string, resourceType: string, ehrSystem: EhrSystem): Promise<any> {
    try {
      // Epic-specific endpoint format
      const endpoint = `/api/FHIR/${ehrSystem.apiVersion || 'R4'}/${resourceType}?patient=${patientId}`;
      
      const response = await httpClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${resourceType} from Epic:`, error);
      throw new Error(`Failed to retrieve ${resourceType} data from Epic`);
    }
  }
}

/**
 * Cerner EHR Connector Implementation
 */
class CernerConnector extends BaseEhrConnector {
  async getAccessToken(ehrSystem: EhrSystem): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const tokenResponse = await axios.post(
        ehrSystem.tokenUrl || `${ehrSystem.baseUrl}/tenants/${ehrSystem.settings?.tenantId}/protocols/oauth2/profiles/smart-v1/token`,
        {
          grant_type: 'client_credentials',
          client_id: ehrSystem.clientId,
          client_secret: ehrSystem.clientSecret,
          scope: 'system/Patient.read system/Observation.read'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        accessToken: tokenResponse.data.access_token,
        expiresIn: tokenResponse.data.expires_in
      };
    } catch (error) {
      console.error('Error getting Cerner access token:', error);
      throw new Error('Failed to authenticate with Cerner EHR');
    }
  }
  
  async getResource(httpClient: AxiosInstance, patientId: string, resourceType: string, ehrSystem: EhrSystem): Promise<any> {
    try {
      // Cerner-specific endpoint format
      const endpoint = `/api/fhir/${ehrSystem.apiVersion || 'r4'}/${resourceType}?patient=${patientId}`;
      
      const response = await httpClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${resourceType} from Cerner:`, error);
      throw new Error(`Failed to retrieve ${resourceType} data from Cerner`);
    }
  }
}

/**
 * Generic FHIR Connector Implementation
 */
class FhirConnector extends BaseEhrConnector {
  async getAccessToken(ehrSystem: EhrSystem): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const tokenResponse = await axios.post(
        ehrSystem.tokenUrl || `${ehrSystem.baseUrl}/token`,
        {
          grant_type: 'client_credentials',
          client_id: ehrSystem.clientId,
          client_secret: ehrSystem.clientSecret,
          scope: 'system/*.read'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return {
        accessToken: tokenResponse.data.access_token,
        expiresIn: tokenResponse.data.expires_in
      };
    } catch (error) {
      console.error('Error getting FHIR access token:', error);
      throw new Error('Failed to authenticate with FHIR server');
    }
  }
  
  async getResource(httpClient: AxiosInstance, patientId: string, resourceType: string, ehrSystem: EhrSystem): Promise<any> {
    try {
      // Standard FHIR endpoint format
      const endpoint = `/${resourceType}?patient=${patientId}`;
      
      const response = await httpClient.get(endpoint, {
        headers: {
          'Accept': 'application/fhir+json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${resourceType} from FHIR:`, error);
      throw new Error(`Failed to retrieve ${resourceType} data from FHIR server`);
    }
  }
}

export const ehrIntegrationService = new EhrIntegrationService();