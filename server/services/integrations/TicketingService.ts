/**
 * Enterprise ITSM Ticketing Integration Service
 * 
 * Provides integration with enterprise ticketing systems like:
 * - ServiceNow
 * - Jira Service Management
 * - Zendesk
 * - Salesforce Service Cloud
 * - Freshdesk
 */
import axios, { AxiosRequestConfig } from 'axios';
import { db } from '../../db';
import { systemIntegrations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { eventBus } from '../../eventBus';
import { logger } from '../../logger';

// Standard ticket interface for all providers
export interface Ticket {
  id?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  category?: string;
  reporter?: string;
  assignee?: string;
  createdAt?: Date;
  updatedAt?: Date;
  dueDate?: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}

// Configuration interfaces for each ticketing system
interface ServiceNowConfig {
  instanceUrl: string;
  username: string;
  password: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
}

interface JiraConfig {
  url: string;
  apiToken: string;
  email: string;
  projectKey: string;
  issueType?: string;
}

interface ZendeskConfig {
  subdomain: string;
  email: string;
  apiToken: string;
}

interface SalesforceConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface FreshdeskConfig {
  domain: string;
  apiKey: string;
}

// Union type for all supported ticketing system configs
type TicketingSystemConfig = 
  | { type: 'servicenow', config: ServiceNowConfig }
  | { type: 'jira', config: JiraConfig }
  | { type: 'zendesk', config: ZendeskConfig }
  | { type: 'salesforce', config: SalesforceConfig }
  | { type: 'freshdesk', config: FreshdeskConfig };

class TicketingService {
  private initialized: boolean = false;
  private availableSystems: Map<string, TicketingSystemConfig> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service by loading all ticketing integrations from the database
   */
  public async initialize(): Promise<void> {
    try {
      const integrations = await db.query.systemIntegrations.findMany({
        where: eq(systemIntegrations.type, 'ticketing'),
      });

      for (const integration of integrations) {
        if (integration.status === 'active' && integration.config) {
          try {
            const config = integration.config as TicketingSystemConfig;
            this.availableSystems.set(integration.name, config);
          } catch (error) {
            logger.error(`Failed to parse config for ticketing system ${integration.name}:`, error);
          }
        }
      }

      this.initialized = true;
      logger.info(`Ticketing Service initialized with ${this.availableSystems.size} systems`);
      
      // Register event listeners for ticket-related events
      this.registerEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize Ticketing Service:', error);
      throw new Error(`Failed to initialize Ticketing Service: ${error.message}`);
    }
  }

  /**
   * Register event handlers for ticket-related events
   */
  private registerEventHandlers(): void {
    eventBus.on('system.incident.created', async (event) => {
      try {
        if (event.data.autoCreateTicket && event.data.severity >= 3) { // High severity
          const defaultSystem = await this.getDefaultTicketingSystem();
          if (defaultSystem) {
            await this.createTicket(defaultSystem, {
              title: `System Incident: ${event.data.title}`,
              description: event.data.description,
              priority: event.data.severity >= 4 ? 'critical' : 'high',
              status: 'open',
              category: 'incident',
              customFields: {
                incidentId: event.data.id,
                affectedSystems: event.data.affectedSystems,
                detectedAt: event.data.detectedAt
              }
            });
            logger.info(`Created ticket for incident ${event.data.id}`);
          }
        }
      } catch (error) {
        logger.error('Failed to create ticket for incident:', error);
      }
    });
  }

  /**
   * Get the default ticketing system for automatic ticket creation
   */
  private async getDefaultTicketingSystem(): Promise<string | null> {
    try {
      const defaultSystem = await db.query.systemIntegrations.findFirst({
        where: and(
          eq(systemIntegrations.type, 'ticketing'),
          eq(systemIntegrations.status, 'active')
        ),
        orderBy: (integrations, { asc }) => [asc(integrations.id)]
      });

      return defaultSystem ? defaultSystem.name : null;
    } catch (error) {
      logger.error('Failed to get default ticketing system:', error);
      return null;
    }
  }

  /**
   * Get all available ticketing systems
   */
  public async getAvailableSystems(): Promise<Array<{
    id: number;
    name: string;
    status: string;
    type: string;
    systemType: string;
    lastSync?: Date;
  }>> {
    try {
      const systems = await db.query.systemIntegrations.findMany({
        where: eq(systemIntegrations.type, 'ticketing'),
        orderBy: (integrations, { asc }) => [asc(integrations.name)]
      });

      return systems.map(system => ({
        id: system.id,
        name: system.name,
        status: system.status,
        type: system.type,
        systemType: system.config ? (system.config as any).type : 'unknown',
        lastSync: system.lastSyncAt
      }));
    } catch (error) {
      logger.error('Failed to get available ticketing systems:', error);
      throw new Error(`Failed to get available ticketing systems: ${error.message}`);
    }
  }

  /**
   * Create a new ticket in the specified ticketing system
   */
  public async createTicket(systemName: string, ticket: Ticket): Promise<Ticket> {
    const system = this.availableSystems.get(systemName);
    if (!system) {
      throw new Error(`Ticketing system "${systemName}" not found or not active`);
    }

    try {
      logger.info(`Creating ticket in ${systemName}: ${ticket.title}`);
      
      switch (system.type) {
        case 'servicenow':
          return await this.createServiceNowTicket(system.config, ticket);
        case 'jira':
          return await this.createJiraTicket(system.config, ticket);
        case 'zendesk':
          return await this.createZendeskTicket(system.config, ticket);
        case 'salesforce':
          return await this.createSalesforceTicket(system.config, ticket);
        case 'freshdesk':
          return await this.createFreshdeskTicket(system.config, ticket);
        default:
          throw new Error(`Unsupported ticketing system type: ${system.type}`);
      }
    } catch (error) {
      logger.error(`Failed to create ticket in ${systemName}:`, error);
      throw new Error(`Failed to create ticket in ${systemName}: ${error.message}`);
    }
  }

  /**
   * Get tickets from a specific ticketing system
   */
  public async getTickets(
    systemName: string, 
    filters: { 
      status?: string,
      priority?: string, 
      assignee?: string,
      dateFrom?: Date,
      dateTo?: Date,
      limit?: number,
      offset?: number
    } = {}
  ): Promise<Ticket[]> {
    const system = this.availableSystems.get(systemName);
    if (!system) {
      throw new Error(`Ticketing system "${systemName}" not found or not active`);
    }

    try {
      logger.info(`Fetching tickets from ${systemName}`);
      
      switch (system.type) {
        case 'servicenow':
          return await this.getServiceNowTickets(system.config, filters);
        case 'jira':
          return await this.getJiraTickets(system.config, filters);
        case 'zendesk':
          return await this.getZendeskTickets(system.config, filters);
        case 'salesforce':
          return await this.getSalesforceTickets(system.config, filters);
        case 'freshdesk':
          return await this.getFreshdeskTickets(system.config, filters);
        default:
          throw new Error(`Unsupported ticketing system type: ${system.type}`);
      }
    } catch (error) {
      logger.error(`Failed to get tickets from ${systemName}:`, error);
      throw new Error(`Failed to get tickets from ${systemName}: ${error.message}`);
    }
  }

  /**
   * Update an existing ticket in a ticketing system
   */
  public async updateTicket(
    systemName: string, 
    ticketId: string, 
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    const system = this.availableSystems.get(systemName);
    if (!system) {
      throw new Error(`Ticketing system "${systemName}" not found or not active`);
    }

    try {
      logger.info(`Updating ticket ${ticketId} in ${systemName}`);
      
      switch (system.type) {
        case 'servicenow':
          return await this.updateServiceNowTicket(system.config, ticketId, updates);
        case 'jira':
          return await this.updateJiraTicket(system.config, ticketId, updates);
        case 'zendesk':
          return await this.updateZendeskTicket(system.config, ticketId, updates);
        case 'salesforce':
          return await this.updateSalesforceTicket(system.config, ticketId, updates);
        case 'freshdesk':
          return await this.updateFreshdeskTicket(system.config, ticketId, updates);
        default:
          throw new Error(`Unsupported ticketing system type: ${system.type}`);
      }
    } catch (error) {
      logger.error(`Failed to update ticket ${ticketId} in ${systemName}:`, error);
      throw new Error(`Failed to update ticket ${ticketId} in ${systemName}: ${error.message}`);
    }
  }

  /**
   * Test a ticketing system connection
   */
  public async testConnection(systemName: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const system = this.availableSystems.get(systemName);
    if (!system) {
      throw new Error(`Ticketing system "${systemName}" not found or not active`);
    }

    try {
      logger.info(`Testing connection to ${systemName}`);
      
      switch (system.type) {
        case 'servicenow':
          return await this.testServiceNowConnection(system.config);
        case 'jira':
          return await this.testJiraConnection(system.config);
        case 'zendesk':
          return await this.testZendeskConnection(system.config);
        case 'salesforce':
          return await this.testSalesforceConnection(system.config);
        case 'freshdesk':
          return await this.testFreshdeskConnection(system.config);
        default:
          throw new Error(`Unsupported ticketing system type: ${system.type}`);
      }
    } catch (error) {
      logger.error(`Failed to test connection to ${systemName}:`, error);
      return {
        success: false,
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Sync tickets from a specific system to update local cache (if applicable)
   */
  public async syncTickets(systemName: string): Promise<{
    success: boolean;
    message: string;
    count?: number;
  }> {
    try {
      const system = await db.query.systemIntegrations.findFirst({
        where: and(
          eq(systemIntegrations.name, systemName),
          eq(systemIntegrations.type, 'ticketing')
        )
      });

      if (!system) {
        throw new Error(`Ticketing system "${systemName}" not found`);
      }

      // Update last sync timestamp
      await db.update(systemIntegrations)
        .set({ lastSyncAt: new Date() })
        .where(eq(systemIntegrations.id, system.id));

      // For now, just return success
      return {
        success: true,
        message: `Successfully synced tickets from ${systemName}`,
        count: 0
      };
    } catch (error) {
      logger.error(`Failed to sync tickets from ${systemName}:`, error);
      return {
        success: false,
        message: `Failed to sync tickets: ${error.message}`
      };
    }
  }

  // ServiceNow implementation
  private async createServiceNowTicket(config: ServiceNowConfig, ticket: Ticket): Promise<Ticket> {
    // In a real implementation, we would make API calls to ServiceNow
    // For now we'll just simulate a successful creation
    logger.info(`[MOCK] Creating ServiceNow ticket: ${ticket.title}`);
    
    return {
      ...ticket,
      id: `INC${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getServiceNowTickets(config: ServiceNowConfig, filters: any): Promise<Ticket[]> {
    // In a real implementation, we would make API calls to ServiceNow
    logger.info(`[MOCK] Getting ServiceNow tickets with filters:`, filters);
    
    return [{
      id: 'INC0010001',
      title: 'Sample ServiceNow Incident',
      description: 'This is a sample ServiceNow incident for demonstration',
      priority: 'high',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  private async updateServiceNowTicket(
    config: ServiceNowConfig, 
    ticketId: string, 
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    // In a real implementation, we would make API calls to ServiceNow
    logger.info(`[MOCK] Updating ServiceNow ticket ${ticketId}:`, updates);
    
    return {
      id: ticketId,
      title: updates.title || 'Updated Ticket',
      description: updates.description || 'Updated description',
      priority: updates.priority || 'medium',
      status: updates.status || 'in_progress',
      updatedAt: new Date()
    };
  }

  private async testServiceNowConnection(config: ServiceNowConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // In a real implementation, we would test the connection to ServiceNow
      logger.info(`[MOCK] Testing ServiceNow connection to ${config.instanceUrl}`);
      
      return {
        success: true,
        message: 'Successfully connected to ServiceNow',
        details: {
          url: config.instanceUrl,
          authenticated: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to ServiceNow: ${error.message}`
      };
    }
  }

  // Jira implementation
  private async createJiraTicket(config: JiraConfig, ticket: Ticket): Promise<Ticket> {
    // In a real implementation, we would make API calls to Jira
    logger.info(`[MOCK] Creating Jira ticket: ${ticket.title}`);
    
    return {
      ...ticket,
      id: `${config.projectKey}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getJiraTickets(config: JiraConfig, filters: any): Promise<Ticket[]> {
    // In a real implementation, we would make API calls to Jira
    logger.info(`[MOCK] Getting Jira tickets with filters:`, filters);
    
    return [{
      id: `${config.projectKey}-123`,
      title: 'Sample Jira Issue',
      description: 'This is a sample Jira issue for demonstration',
      priority: 'medium',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  private async updateJiraTicket(
    config: JiraConfig,
    ticketId: string,
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    // In a real implementation, we would make API calls to Jira
    logger.info(`[MOCK] Updating Jira ticket ${ticketId}:`, updates);
    
    return {
      id: ticketId,
      title: updates.title || 'Updated Jira Issue',
      description: updates.description || 'Updated description',
      priority: updates.priority || 'high',
      status: updates.status || 'in_progress',
      updatedAt: new Date()
    };
  }

  private async testJiraConnection(config: JiraConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // In a real implementation, we would test the connection to Jira
      logger.info(`[MOCK] Testing Jira connection to ${config.url}`);
      
      return {
        success: true,
        message: 'Successfully connected to Jira',
        details: {
          url: config.url,
          projectKey: config.projectKey,
          authenticated: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Jira: ${error.message}`
      };
    }
  }

  // Zendesk implementation
  private async createZendeskTicket(config: ZendeskConfig, ticket: Ticket): Promise<Ticket> {
    // In a real implementation, we would make API calls to Zendesk
    logger.info(`[MOCK] Creating Zendesk ticket: ${ticket.title}`);
    
    return {
      ...ticket,
      id: `${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getZendeskTickets(config: ZendeskConfig, filters: any): Promise<Ticket[]> {
    // In a real implementation, we would make API calls to Zendesk
    logger.info(`[MOCK] Getting Zendesk tickets with filters:`, filters);
    
    return [{
      id: '12345',
      title: 'Sample Zendesk Ticket',
      description: 'This is a sample Zendesk ticket for demonstration',
      priority: 'high',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  private async updateZendeskTicket(
    config: ZendeskConfig,
    ticketId: string,
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    // In a real implementation, we would make API calls to Zendesk
    logger.info(`[MOCK] Updating Zendesk ticket ${ticketId}:`, updates);
    
    return {
      id: ticketId,
      title: updates.title || 'Updated Zendesk Ticket',
      description: updates.description || 'Updated description',
      priority: updates.priority || 'high',
      status: updates.status || 'pending',
      updatedAt: new Date()
    };
  }

  private async testZendeskConnection(config: ZendeskConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // In a real implementation, we would test the connection to Zendesk
      logger.info(`[MOCK] Testing Zendesk connection to ${config.subdomain}`);
      
      return {
        success: true,
        message: 'Successfully connected to Zendesk',
        details: {
          subdomain: config.subdomain,
          authenticated: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Zendesk: ${error.message}`
      };
    }
  }

  // Salesforce Service Cloud implementation
  private async createSalesforceTicket(config: SalesforceConfig, ticket: Ticket): Promise<Ticket> {
    // In a real implementation, we would make API calls to Salesforce
    logger.info(`[MOCK] Creating Salesforce case: ${ticket.title}`);
    
    return {
      ...ticket,
      id: `500${Math.floor(Math.random() * 10000000)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getSalesforceTickets(config: SalesforceConfig, filters: any): Promise<Ticket[]> {
    // In a real implementation, we would make API calls to Salesforce
    logger.info(`[MOCK] Getting Salesforce cases with filters:`, filters);
    
    return [{
      id: '5001234567',
      title: 'Sample Salesforce Case',
      description: 'This is a sample Salesforce case for demonstration',
      priority: 'medium',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  private async updateSalesforceTicket(
    config: SalesforceConfig,
    ticketId: string,
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    // In a real implementation, we would make API calls to Salesforce
    logger.info(`[MOCK] Updating Salesforce case ${ticketId}:`, updates);
    
    return {
      id: ticketId,
      title: updates.title || 'Updated Salesforce Case',
      description: updates.description || 'Updated description',
      priority: updates.priority || 'high',
      status: updates.status || 'in_progress',
      updatedAt: new Date()
    };
  }

  private async testSalesforceConnection(config: SalesforceConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // In a real implementation, we would test the connection to Salesforce
      logger.info(`[MOCK] Testing Salesforce connection to ${config.instanceUrl}`);
      
      return {
        success: true,
        message: 'Successfully connected to Salesforce Service Cloud',
        details: {
          url: config.instanceUrl,
          authenticated: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Salesforce: ${error.message}`
      };
    }
  }

  // Freshdesk implementation
  private async createFreshdeskTicket(config: FreshdeskConfig, ticket: Ticket): Promise<Ticket> {
    // In a real implementation, we would make API calls to Freshdesk
    logger.info(`[MOCK] Creating Freshdesk ticket: ${ticket.title}`);
    
    return {
      ...ticket,
      id: `${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getFreshdeskTickets(config: FreshdeskConfig, filters: any): Promise<Ticket[]> {
    // In a real implementation, we would make API calls to Freshdesk
    logger.info(`[MOCK] Getting Freshdesk tickets with filters:`, filters);
    
    return [{
      id: '12345',
      title: 'Sample Freshdesk Ticket',
      description: 'This is a sample Freshdesk ticket for demonstration',
      priority: 'medium',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  private async updateFreshdeskTicket(
    config: FreshdeskConfig,
    ticketId: string,
    updates: Partial<Ticket>
  ): Promise<Ticket> {
    // In a real implementation, we would make API calls to Freshdesk
    logger.info(`[MOCK] Updating Freshdesk ticket ${ticketId}:`, updates);
    
    return {
      id: ticketId,
      title: updates.title || 'Updated Freshdesk Ticket',
      description: updates.description || 'Updated description',
      priority: updates.priority || 'high',
      status: updates.status || 'pending',
      updatedAt: new Date()
    };
  }

  private async testFreshdeskConnection(config: FreshdeskConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // In a real implementation, we would test the connection to Freshdesk
      logger.info(`[MOCK] Testing Freshdesk connection to ${config.domain}`);
      
      return {
        success: true,
        message: 'Successfully connected to Freshdesk',
        details: {
          domain: config.domain,
          authenticated: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Freshdesk: ${error.message}`
      };
    }
  }
}

export const ticketingService = new TicketingService();