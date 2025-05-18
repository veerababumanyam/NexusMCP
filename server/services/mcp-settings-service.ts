/**
 * MCP Global Settings Service
 * 
 * This service handles all global configuration settings for MCP servers:
 * - Security policies (TLS, OAuth, API keys, IP filtering)
 * - Connection parameters (timeouts, retries, circuit breaking)
 * - Resource allocation (request limits, load balancing)
 * - Advanced settings (logging, compression, buffering)
 */

import { pool, db } from "../../db";
import { sql } from "drizzle-orm";
import { type WebSocket } from "ws";
import { logger } from "../utils/logger";
import fs from "fs";
import path from "path";
import { McpProxyService } from "./mcp-proxy-service";

// Types for configuration settings
export type SecuritySettings = {
  enforceTls: boolean;
  apiKeyRotationDays: number;
  enforceOAuth: boolean;
  allowedAuthMethods: string[];
  ipAllowList: string | undefined;
  ipDenyList: string | undefined;
  enforceIpFilter: boolean;
};

export type ConnectionSettings = {
  maxConnectionsPerServer: number;
  connectionTimeoutSeconds: number;
  retryAttemptsOnFailure: number;
  retryDelaySeconds: number;
  enableCircuitBreaker: boolean;
  monitorHeartbeatIntervalSeconds: number;
};

export type ResourceSettings = {
  maxConcurrentRequests: number;
  requestTimeoutSeconds: number;
  maxRequestSizeKb: number;
  enableLoadBalancing: boolean;
  loadBalancingStrategy: "round_robin" | "least_connections" | "weighted";
};

export type AdvancedSettings = {
  logLevel: "debug" | "info" | "warn" | "error";
  enableRequestCompression: boolean;
  enableResponseCompression: boolean;
  proxyBufferSizeKb: number;
  enableTelemetry: boolean;
  telemetryInterval: number;
};

// Class to manage MCP global settings
export class McpSettingsService {
  private configPath: string;
  private proxyService: McpProxyService;
  private securitySettings: SecuritySettings;
  private connectionSettings: ConnectionSettings;
  private resourceSettings: ResourceSettings;
  private advancedSettings: AdvancedSettings;

  constructor(proxyService: McpProxyService) {
    this.proxyService = proxyService;
    
    // Default configuration path
    this.configPath = path.join(process.cwd(), 'config');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }
    
    // Default security settings
    this.securitySettings = {
      enforceTls: true,
      apiKeyRotationDays: 90,
      enforceOAuth: false,
      allowedAuthMethods: ["api_key", "oauth", "basic"],
      ipAllowList: "",
      ipDenyList: "",
      enforceIpFilter: false
    };
    
    // Default connection settings
    this.connectionSettings = {
      maxConnectionsPerServer: 100,
      connectionTimeoutSeconds: 30,
      retryAttemptsOnFailure: 3,
      retryDelaySeconds: 5,
      enableCircuitBreaker: true,
      monitorHeartbeatIntervalSeconds: 60
    };
    
    // Default resource settings
    this.resourceSettings = {
      maxConcurrentRequests: 50,
      requestTimeoutSeconds: 30,
      maxRequestSizeKb: 1024,
      enableLoadBalancing: true,
      loadBalancingStrategy: "least_connections"
    };
    
    // Default advanced settings
    this.advancedSettings = {
      logLevel: "info",
      enableRequestCompression: true,
      enableResponseCompression: true,
      proxyBufferSizeKb: 64,
      enableTelemetry: true,
      telemetryInterval: 60
    };
    
    // Load saved settings if they exist
    this.loadSettings();
  }
  
  /**
   * Load settings from files or database
   */
  private async loadSettings() {
    try {
      // First try to load from database
      const securityConfig = await this.getSettingsFromDb('security');
      if (securityConfig) {
        this.securitySettings = { ...this.securitySettings, ...securityConfig };
      }
      
      const connectionConfig = await this.getSettingsFromDb('connection');
      if (connectionConfig) {
        this.connectionSettings = { ...this.connectionSettings, ...connectionConfig };
      }
      
      const resourceConfig = await this.getSettingsFromDb('resource');
      if (resourceConfig) {
        this.resourceSettings = { ...this.resourceSettings, ...resourceConfig };
      }
      
      const advancedConfig = await this.getSettingsFromDb('advanced');
      if (advancedConfig) {
        this.advancedSettings = { ...this.advancedSettings, ...advancedConfig };
      }
      
      logger.info('MCP settings loaded from database');
    } catch (error) {
      logger.warn('Error loading MCP settings from database, using default settings', error);
      
      // Fallback to loading from config files
      this.loadSettingsFromFiles();
    }
    
    // Apply the loaded settings to the proxy service
    this.applySettings();
  }
  
  /**
   * Load settings from config files (fallback method)
   */
  private loadSettingsFromFiles() {
    try {
      const securityPath = path.join(this.configPath, 'security-settings.json');
      if (fs.existsSync(securityPath)) {
        this.securitySettings = JSON.parse(fs.readFileSync(securityPath, 'utf8'));
      }
      
      const connectionPath = path.join(this.configPath, 'connection-settings.json');
      if (fs.existsSync(connectionPath)) {
        this.connectionSettings = JSON.parse(fs.readFileSync(connectionPath, 'utf8'));
      }
      
      const resourcePath = path.join(this.configPath, 'resource-settings.json');
      if (fs.existsSync(resourcePath)) {
        this.resourceSettings = JSON.parse(fs.readFileSync(resourcePath, 'utf8'));
      }
      
      const advancedPath = path.join(this.configPath, 'advanced-settings.json');
      if (fs.existsSync(advancedPath)) {
        this.advancedSettings = JSON.parse(fs.readFileSync(advancedPath, 'utf8'));
      }
      
      logger.info('MCP settings loaded from config files');
    } catch (error) {
      logger.warn('Error loading MCP settings from config files, using default settings', error);
    }
  }
  
  /**
   * Get settings from database
   * @param settingType Type of settings to load
   */
  private async getSettingsFromDb(settingType: string) {
    try {
      const result = await db.execute(
        sql`SELECT value FROM system_config WHERE key = ${`mcp_${settingType}_settings`}`
      );
      
      // Handle different result formats (array or object with rows property)
      const rows = Array.isArray(result) ? result : result.rows || [];
      
      if (rows.length > 0 && rows[0]?.value) {
        return JSON.parse(rows[0].value);
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching ${settingType} settings from database`, error);
      return null;
    }
  }
  
  /**
   * Get all security settings
   */
  async getSecuritySettings(): Promise<SecuritySettings> {
    return { ...this.securitySettings };
  }
  
  /**
   * Update security settings
   * @param settings New security settings
   */
  async updateSecuritySettings(settings: SecuritySettings): Promise<SecuritySettings> {
    // Merge new settings with defaults for any missing properties
    this.securitySettings = { 
      ...this.securitySettings,
      ...settings
    };
    
    // Save to database and filesystem for redundancy
    await this.saveSettings('security', this.securitySettings);
    
    // Apply settings to MCP Proxy Service for immediate effect
    this.applySecuritySettings();
    
    return { ...this.securitySettings };
  }
  
  /**
   * Get all connection settings
   */
  async getConnectionSettings(): Promise<ConnectionSettings> {
    return { ...this.connectionSettings };
  }
  
  /**
   * Update connection settings
   * @param settings New connection settings
   */
  async updateConnectionSettings(settings: ConnectionSettings): Promise<ConnectionSettings> {
    // Merge new settings with defaults for any missing properties
    this.connectionSettings = { 
      ...this.connectionSettings,
      ...settings
    };
    
    // Save to database and filesystem for redundancy
    await this.saveSettings('connection', this.connectionSettings);
    
    // Apply settings to MCP Proxy Service for immediate effect
    this.applyConnectionSettings();
    
    return { ...this.connectionSettings };
  }
  
  /**
   * Get all resource settings
   */
  async getResourceSettings(): Promise<ResourceSettings> {
    return { ...this.resourceSettings };
  }
  
  /**
   * Update resource settings
   * @param settings New resource settings
   */
  async updateResourceSettings(settings: ResourceSettings): Promise<ResourceSettings> {
    // Merge new settings with defaults for any missing properties
    this.resourceSettings = { 
      ...this.resourceSettings,
      ...settings
    };
    
    // Save to database and filesystem for redundancy
    await this.saveSettings('resource', this.resourceSettings);
    
    // Apply settings to MCP Proxy Service for immediate effect
    this.applyResourceSettings();
    
    return { ...this.resourceSettings };
  }
  
  /**
   * Get all advanced settings
   */
  async getAdvancedSettings(): Promise<AdvancedSettings> {
    return { ...this.advancedSettings };
  }
  
  /**
   * Update advanced settings
   * @param settings New advanced settings
   */
  async updateAdvancedSettings(settings: AdvancedSettings): Promise<AdvancedSettings> {
    // Merge new settings with defaults for any missing properties
    this.advancedSettings = { 
      ...this.advancedSettings,
      ...settings
    };
    
    // Save to database and filesystem for redundancy
    await this.saveSettings('advanced', this.advancedSettings);
    
    // Apply settings to MCP Proxy Service for immediate effect
    this.applyAdvancedSettings();
    
    return { ...this.advancedSettings };
  }
  
  /**
   * Save settings to both database and file system
   * @param settingType Type of settings to save
   * @param settings Settings data to save
   */
  private async saveSettings(settingType: string, settings: any) {
    try {
      // Save to database
      await db.execute(
        sql`INSERT INTO system_config (key, value, type, category) 
            VALUES (${`mcp_${settingType}_settings`}, ${JSON.stringify(settings)}, 'json', 'mcp')
            ON CONFLICT (key) DO UPDATE 
            SET value = ${JSON.stringify(settings)}, updated_at = CURRENT_TIMESTAMP`
      );
      
      // Save to filesystem as backup
      const configPath = path.join(this.configPath, `${settingType}-settings.json`);
      fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
      
      logger.info(`MCP ${settingType} settings saved successfully`);
      return true;
    } catch (error) {
      logger.error(`Error saving MCP ${settingType} settings`, error);
      throw error;
    }
  }
  
  /**
   * Apply all current settings to the MCP Proxy Service
   */
  private applySettings() {
    this.applySecuritySettings();
    this.applyConnectionSettings();
    this.applyResourceSettings();
    this.applyAdvancedSettings();
    
    logger.info('Applied all MCP settings to proxy service');
  }
  
  /**
   * Apply security settings to MCP Proxy Service
   */
  private applySecuritySettings() {
    // Set TLS enforcement
    this.proxyService.setTlsEnforcement(this.securitySettings.enforceTls);
    
    // Set OAuth enforcement
    this.proxyService.setOAuthEnforcement(this.securitySettings.enforceOAuth);
    
    // Set allowed authentication methods
    this.proxyService.setAllowedAuthMethods(this.securitySettings.allowedAuthMethods);
    
    // Set IP filtering
    if (this.securitySettings.enforceIpFilter) {
      const allowList = this.securitySettings.ipAllowList 
        ? this.securitySettings.ipAllowList
            .split(',')
            .map(ip => ip.trim())
            .filter(ip => ip)
        : [];
        
      const denyList = this.securitySettings.ipDenyList
        ? this.securitySettings.ipDenyList
            .split(',')
            .map(ip => ip.trim())
            .filter(ip => ip)
        : [];
        
      this.proxyService.setIpFilters(allowList, denyList);
    } else {
      // Disable IP filtering
      this.proxyService.setIpFilters([], []);
    }
    
    logger.info('Applied security settings to MCP proxy service');
  }
  
  /**
   * Apply connection settings to MCP Proxy Service
   */
  private applyConnectionSettings() {
    // Set connection limits
    this.proxyService.setConnectionLimits({
      maxConnectionsPerServer: this.connectionSettings.maxConnectionsPerServer,
      connectionTimeoutMs: this.connectionSettings.connectionTimeoutSeconds * 1000,
      retryAttempts: this.connectionSettings.retryAttemptsOnFailure,
      retryDelayMs: this.connectionSettings.retryDelaySeconds * 1000
    });
    
    // Set circuit breaker
    this.proxyService.setCircuitBreaker({
      enabled: this.connectionSettings.enableCircuitBreaker,
      failureThreshold: 5, // Default: 5 failures before tripping
      resetTimeoutMs: 30000 // Default: 30 seconds before reset attempt
    });
    
    // Set heartbeat interval
    this.proxyService.setHeartbeatInterval(
      this.connectionSettings.monitorHeartbeatIntervalSeconds * 1000
    );
    
    logger.info('Applied connection settings to MCP proxy service');
  }
  
  /**
   * Apply resource settings to MCP Proxy Service
   */
  private applyResourceSettings() {
    // Set request limits
    this.proxyService.setRequestLimits({
      maxConcurrentRequests: this.resourceSettings.maxConcurrentRequests,
      requestTimeoutMs: this.resourceSettings.requestTimeoutSeconds * 1000,
      maxRequestSizeBytes: this.resourceSettings.maxRequestSizeKb * 1024
    });
    
    // Set load balancing
    this.proxyService.setLoadBalancing({
      enabled: this.resourceSettings.enableLoadBalancing,
      strategy: this.resourceSettings.loadBalancingStrategy
    });
    
    logger.info('Applied resource settings to MCP proxy service');
  }
  
  /**
   * Apply advanced settings to MCP Proxy Service
   */
  private applyAdvancedSettings() {
    // Set log level
    logger.level = this.advancedSettings.logLevel;
    
    // Set compression
    this.proxyService.setCompression({
      requestCompression: this.advancedSettings.enableRequestCompression,
      responseCompression: this.advancedSettings.enableResponseCompression
    });
    
    // Set buffer size
    this.proxyService.setBufferSize(this.advancedSettings.proxyBufferSizeKb * 1024);
    
    // Set telemetry
    this.proxyService.setTelemetry({
      enabled: this.advancedSettings.enableTelemetry,
      intervalMs: this.advancedSettings.telemetryInterval * 1000
    });
    
    logger.info('Applied advanced settings to MCP proxy service');
  }
}