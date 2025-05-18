/**
 * Secrets Manager API Routes
 * 
 * Provides endpoints for managing secrets configurations and operations:
 * - CRUD operations for secrets manager configurations
 * - Secret create/read/update/delete operations
 * - Secret rotation
 * - Secret access logs
 * 
 * Supported providers:
 * - HashiCorp Vault
 * - AWS Secrets Manager
 * - Azure Key Vault
 * - Google Secret Manager
 * - CyberArk
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  secretsManagerConfigFormSchema, 
  secretCreateFormSchema,
  SecretAccessLogInsert 
} from "@shared/schema_secrets_manager";
import { db } from "@db";
import { secretsManagerConfigs, secretReferences, secretAccessLogs } from "@shared/schema_secrets_manager";
import { eq, and, desc, sql } from "drizzle-orm";
import { secretsManagerService } from "../services/integrations/SecretsManagerService";
import { logger, getChildLogger } from "../utils/logger";

const router = Router();
const routeLogger = getChildLogger(logger, { component: 'secrets-manager-routes' });

// Log the secret access in the database
async function logSecretAccess(logData: SecretAccessLogInsert) {
  try {
    await db.insert(secretAccessLogs).values(logData);
  } catch (error) {
    routeLogger.error('Failed to log secret access', error);
  }
}

/**
 * Get all secrets manager configurations with optional filtering
 */
router.get("/configs", async (req: Request, res: Response) => {
  try {
    const { provider, isActive, search, page = '1', limit = '20' } = req.query;
    
    // Base query
    let query = db
      .select()
      .from(secretsManagerConfigs)
      .orderBy(desc(secretsManagerConfigs.updatedAt));
    
    // Apply filters
    if (provider) {
      query = query.where(eq(secretsManagerConfigs.provider, provider as string));
    }
    
    if (isActive !== undefined) {
      const isActiveFilter = isActive === 'true';
      query = query.where(eq(secretsManagerConfigs.isActive, isActiveFilter));
    }
    
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(
        sql`${secretsManagerConfigs.name} ILIKE ${searchTerm} OR ${secretsManagerConfigs.description} ILIKE ${searchTerm}`
      );
    }
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Execute query with pagination
    const configs = await query.limit(limitNum).offset(offset);
    
    // Count total for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(secretsManagerConfigs)
      .execute();
    
    const total = countResult[0]?.count || 0;
    
    res.json({
      configs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    routeLogger.error("Error fetching secrets manager configurations", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secrets manager configurations", message: errorMessage });
  }
});

/**
 * Get a secrets manager configuration by ID
 */
router.get("/configs/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    const config = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, id))
      .limit(1);
    
    if (!config || config.length === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    res.json(config[0]);
  } catch (error) {
    routeLogger.error(`Error fetching secrets manager configuration with ID ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secrets manager configuration", message: errorMessage });
  }
});

/**
 * Create a new secrets manager configuration
 */
router.post("/configs", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = secretsManagerConfigFormSchema.parse(req.body);
    
    // Add user info for tracking
    if (req.user) {
      validatedData.createdBy = req.user.id;
    }
    
    // If set as default, unset other defaults
    if (validatedData.isDefault) {
      await db
        .update(secretsManagerConfigs)
        .set({ isDefault: false })
        .where(eq(secretsManagerConfigs.isDefault, true));
    }
    
    // Insert the new configuration
    const [config] = await db
      .insert(secretsManagerConfigs)
      .values(validatedData)
      .returning();
    
    // Configure the secrets manager service with the new config if it's active and default
    if (config.isActive && config.isDefault) {
      secretsManagerService.configure({
        provider: config.provider as any,
        baseUrl: config.baseUrl || undefined,
        region: config.region || undefined,
        namespace: config.namespace || undefined,
        projectId: config.projectId || undefined,
        vaultId: config.vaultId || undefined,
        auth: {
          type: config.authType as any,
          credentials: config.authCredentials as Record<string, string>,
        },
        options: {
          prefix: config.secretsPrefix || undefined,
          cacheTtl: config.cacheTtl || undefined,
          autoRotate: config.autoRotate || false,
          rotationFrequency: config.rotationFrequency || undefined,
        }
      });
    }
    
    res.status(201).json(config);
  } catch (error) {
    routeLogger.error("Error creating secrets manager configuration", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to create secrets manager configuration", message: errorMessage });
  }
});

/**
 * Update a secrets manager configuration
 */
router.put("/configs/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Validate request body
    const validatedData = secretsManagerConfigFormSchema.parse(req.body);
    
    // Add user info for tracking
    if (req.user) {
      validatedData.updatedBy = req.user.id;
    }
    
    // Check if config exists
    const existingConfig = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, id))
      .limit(1);
    
    if (!existingConfig || existingConfig.length === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    // If set as default, unset other defaults
    if (validatedData.isDefault) {
      await db
        .update(secretsManagerConfigs)
        .set({ isDefault: false })
        .where(and(
          eq(secretsManagerConfigs.isDefault, true),
          sql`${secretsManagerConfigs.id} != ${id}`
        ));
    }
    
    // Update the configuration
    const [config] = await db
      .update(secretsManagerConfigs)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(secretsManagerConfigs.id, id))
      .returning();
    
    // Configure the secrets manager service with the updated config if it's active and default
    if (config.isActive && config.isDefault) {
      secretsManagerService.configure({
        provider: config.provider as any,
        baseUrl: config.baseUrl || undefined,
        region: config.region || undefined,
        namespace: config.namespace || undefined,
        projectId: config.projectId || undefined,
        vaultId: config.vaultId || undefined,
        auth: {
          type: config.authType as any,
          credentials: config.authCredentials as Record<string, string>,
        },
        options: {
          prefix: config.secretsPrefix || undefined,
          cacheTtl: config.cacheTtl || undefined,
          autoRotate: config.autoRotate || false,
          rotationFrequency: config.rotationFrequency || undefined,
        }
      });
    }
    
    res.json(config);
  } catch (error) {
    routeLogger.error(`Error updating secrets manager configuration with ID ${req.params.id}`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to update secrets manager configuration", message: errorMessage });
  }
});

/**
 * Delete a secrets manager configuration
 */
router.delete("/configs/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Check if configuration exists
    const existingConfig = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, id))
      .limit(1);
    
    if (!existingConfig || existingConfig.length === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    // Check if secrets are using this configuration
    const secretsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(secretReferences)
      .where(eq(secretReferences.configId, id))
      .execute();
    
    if (secretsCount[0]?.count > 0) {
      return res.status(400).json({ 
        error: "Cannot delete configuration with associated secrets", 
        message: `There are ${secretsCount[0].count} secrets using this configuration. Please delete or reassign them first.` 
      });
    }
    
    // Delete the configuration
    await db
      .delete(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, id));
    
    res.status(204).end();
  } catch (error) {
    routeLogger.error(`Error deleting secrets manager configuration with ID ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to delete secrets manager configuration", message: errorMessage });
  }
});

/**
 * Test a secrets manager configuration
 */
router.post("/configs/:id/test", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, id))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(404).json({ error: "Configuration not found" });
    }
    
    const config = configs[0];
    
    // Create a temporary configuration for testing
    const testConfig = {
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    };
    
    // Configure the service temporarily for testing
    secretsManagerService.configure(testConfig);
    
    // Create a test secret key with random suffix
    const testKey = `test-connection-${Date.now()}`;
    
    // Try to set and then get the secret
    const setResult = await secretsManagerService.setSecret(testKey, "test-value");
    
    if (!setResult) {
      return res.status(400).json({ 
        success: false, 
        message: "Failed to set test secret. Please check your configuration and credentials." 
      });
    }
    
    const getValue = await secretsManagerService.getSecret(testKey);
    
    // Clean up the test secret
    await secretsManagerService.deleteSecret(testKey);
    
    // If we got back the value, the connection is working
    const success = getValue === "test-value";
    
    // If this was the default config, re-configure with it
    if (config.isDefault && config.isActive) {
      secretsManagerService.configure(testConfig);
    }
    
    res.json({
      success,
      message: success 
        ? "Successfully connected to secrets manager" 
        : "Connection test failed. The secret was set but could not be retrieved correctly."
    });
    
    // Log the access
    await logSecretAccess({
      secretKey: testKey,
      action: "test",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error testing secrets manager configuration with ID ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to test secrets manager configuration", 
      message: errorMessage 
    });
  }
});

/**
 * Get supported secrets managers and their options
 */
router.get("/supported-providers", (_req: Request, res: Response) => {
  try {
    const providers = {
      hashicorp_vault: {
        name: "HashiCorp Vault",
        description: "Open-source secrets management solution",
        authTypes: [
          { value: "token", label: "Token Auth" },
          { value: "approle", label: "AppRole Auth" },
          { value: "kubernetes", label: "Kubernetes Auth" },
          { value: "userpass", label: "Username & Password" },
          { value: "ldap", label: "LDAP Auth" },
          { value: "aws", label: "AWS IAM Auth" },
          { value: "azure", label: "Azure Auth" }
        ],
        secretsEngines: [
          { value: "kv", label: "Key/Value (v1)" },
          { value: "kv2", label: "Key/Value (v2)" },
          { value: "transit", label: "Transit" },
          { value: "database", label: "Database" },
          { value: "aws", label: "AWS" },
          { value: "azure", label: "Azure" },
          { value: "pki", label: "PKI" }
        ],
        fields: [
          { name: "baseUrl", label: "Vault Server URL", type: "url", required: true },
          { name: "namespace", label: "Namespace", type: "text", required: false },
          { name: "secretsPath", label: "Secrets Path", type: "text", required: false, default: "secret/" }
        ]
      },
      aws_secrets_manager: {
        name: "AWS Secrets Manager",
        description: "AWS service for managing secrets",
        authTypes: [
          { value: "iam", label: "IAM Role (EC2/ECS/Lambda)" },
          { value: "access_key", label: "Access Key & Secret" },
          { value: "profile", label: "AWS Profile" }
        ],
        regions: [
          { value: "us-east-1", label: "US East (N. Virginia)" },
          { value: "us-east-2", label: "US East (Ohio)" },
          { value: "us-west-1", label: "US West (N. California)" },
          { value: "us-west-2", label: "US West (Oregon)" },
          { value: "af-south-1", label: "Africa (Cape Town)" },
          { value: "ap-east-1", label: "Asia Pacific (Hong Kong)" },
          { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
          { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
          { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
          { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
          { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
          { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
          { value: "ca-central-1", label: "Canada (Central)" },
          { value: "eu-central-1", label: "Europe (Frankfurt)" },
          { value: "eu-west-1", label: "Europe (Ireland)" },
          { value: "eu-west-2", label: "Europe (London)" },
          { value: "eu-west-3", label: "Europe (Paris)" },
          { value: "eu-north-1", label: "Europe (Stockholm)" },
          { value: "eu-south-1", label: "Europe (Milan)" },
          { value: "me-south-1", label: "Middle East (Bahrain)" },
          { value: "sa-east-1", label: "South America (São Paulo)" }
        ],
        fields: [
          { name: "region", label: "AWS Region", type: "select", required: true, options: "regions" }
        ]
      },
      azure_key_vault: {
        name: "Azure Key Vault",
        description: "Microsoft's service for managing keys, secrets, and certificates",
        authTypes: [
          { value: "managed_identity", label: "Managed Identity" },
          { value: "service_principal", label: "Service Principal" },
          { value: "client_secret", label: "Client Secret" }
        ],
        fields: [
          { name: "vaultUrl", label: "Key Vault URL", type: "url", required: true },
          { name: "tenantId", label: "Tenant ID", type: "text", required: false },
          { name: "clientId", label: "Client ID", type: "text", required: false },
          { name: "clientSecret", label: "Client Secret", type: "password", required: false }
        ]
      },
      google_secret_manager: {
        name: "Google Secret Manager",
        description: "Google Cloud's service for managing secrets",
        authTypes: [
          { value: "service_account", label: "Service Account" },
          { value: "application_default", label: "Application Default Credentials" }
        ],
        fields: [
          { name: "projectId", label: "Google Cloud Project ID", type: "text", required: true }
        ]
      },
      cyberark: {
        name: "CyberArk",
        description: "Enterprise secrets management platform",
        authTypes: [
          { value: "oauth2", label: "OAuth 2.0" },
          { value: "cyberark_adc", label: "CyberArk Application Identity" },
          { value: "api_key", label: "API Key" }
        ],
        fields: [
          { name: "baseUrl", label: "CyberArk Server URL", type: "url", required: true },
          { name: "appId", label: "Application ID", type: "text", required: false },
          { name: "safe", label: "Safe Name", type: "text", required: false }
        ]
      },
      local: {
        name: "Local Storage (Development Only)",
        description: "Local in-memory storage for development purposes only",
        authTypes: [
          { value: "token", label: "Simple Token" }
        ],
        fields: [
          { name: "secretsPrefix", label: "Secrets Prefix", type: "text", required: false, default: "dev/" }
        ]
      }
    };
    
    res.json(providers);
  } catch (error) {
    routeLogger.error("Error fetching supported secrets providers", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch supported secrets providers", message: errorMessage });
  }
});

/**
 * Get all secret references
 */
router.get("/secrets", async (req: Request, res: Response) => {
  try {
    const { provider, configId, search, page = '1', limit = '20' } = req.query;
    
    // Base query
    let query = db
      .select()
      .from(secretReferences)
      .orderBy(desc(secretReferences.updatedAt));
    
    // Apply filters
    if (provider) {
      query = query.where(eq(secretReferences.provider, provider as string));
    }
    
    if (configId) {
      const configIdNum = parseInt(configId as string);
      if (!isNaN(configIdNum)) {
        query = query.where(eq(secretReferences.configId, configIdNum));
      }
    }
    
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(
        sql`${secretReferences.key} ILIKE ${searchTerm} OR ${secretReferences.description} ILIKE ${searchTerm}`
      );
    }
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Execute query with pagination
    const secrets = await query.limit(limitNum).offset(offset);
    
    // Count total for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(secretReferences)
      .execute();
    
    const total = countResult[0]?.count || 0;
    
    res.json({
      secrets,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    routeLogger.error("Error fetching secret references", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secret references", message: errorMessage });
  }
});

/**
 * Get a secret reference by key
 */
router.get("/secrets/:key", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    // Get the secret reference
    const secretRef = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, key))
      .limit(1);
    
    if (!secretRef || secretRef.length === 0) {
      return res.status(404).json({ error: "Secret not found" });
    }
    
    res.json(secretRef[0]);
    
    // Log the access
    await logSecretAccess({
      secretKey: key,
      action: "get",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error fetching secret reference with key ${req.params.key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secret reference", message: errorMessage });
    
    // Log the failed access
    await logSecretAccess({
      secretKey: req.params.key,
      action: "get",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: false,
      errorMessage: errorMessage,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  }
});

/**
 * Create a new secret
 */
router.post("/secrets", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = secretCreateFormSchema.parse(req.body);
    
    // Check if the secret key already exists
    const existingSecret = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, validatedData.key))
      .limit(1);
    
    if (existingSecret && existingSecret.length > 0) {
      return res.status(400).json({ error: "Secret key already exists" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, validatedData.configId))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: "Invalid configuration ID" });
    }
    
    const config = configs[0];
    
    // Configure the service with the selected configuration
    secretsManagerService.configure({
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    });
    
    // Try to set the secret
    const setResult = await secretsManagerService.setSecret(validatedData.key, validatedData.value, {
      description: validatedData.description,
      tags: validatedData.tags,
      expiresAt: validatedData.expiresAt
    });
    
    if (!setResult) {
      return res.status(500).json({ error: "Failed to set secret in the secrets management system" });
    }
    
    // Add user info for tracking
    const userId = req.user?.id;
    
    // Insert the secret reference
    const [secretRef] = await db
      .insert(secretReferences)
      .values({
        key: validatedData.key,
        description: validatedData.description,
        configId: validatedData.configId,
        provider: config.provider,
        version: 1,
        tags: validatedData.tags || [],
        accessGroups: validatedData.accessGroups || [],
        expiresAt: validatedData.expiresAt,
        createdBy: userId,
        updatedBy: userId
      })
      .returning();
    
    res.status(201).json(secretRef);
    
    // Log the access
    await logSecretAccess({
      secretKey: validatedData.key,
      action: "set",
      userId: userId,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error("Error creating secret", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to create secret", message: errorMessage });
    
    // Log the failed access if we have a key
    if (req.body?.key) {
      await logSecretAccess({
        secretKey: req.body.key,
        action: "set",
        userId: req.user?.id,
        username: req.user?.username || "unknown",
        success: false,
        errorMessage: errorMessage,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers['user-agent'] || "unknown",
        timestamp: new Date()
      });
    }
  }
});

/**
 * Get the value of a secret
 */
router.get("/secrets/:key/value", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    // Get the secret reference
    const secretRef = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, key))
      .limit(1);
    
    if (!secretRef || secretRef.length === 0) {
      return res.status(404).json({ error: "Secret not found" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, secretRef[0].configId))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: "Invalid configuration for this secret" });
    }
    
    const config = configs[0];
    
    // Configure the service with the selected configuration
    secretsManagerService.configure({
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    });
    
    // Get the secret value
    const value = await secretsManagerService.getSecret(key);
    
    if (value === null) {
      // Log the failed access
      await logSecretAccess({
        secretKey: key,
        action: "get_value",
        userId: req.user?.id,
        username: req.user?.username || "unknown",
        success: false,
        errorMessage: "Secret not found in provider",
        ipAddress: req.ip || "unknown",
        userAgent: req.headers['user-agent'] || "unknown",
        timestamp: new Date()
      });
      
      return res.status(404).json({ error: "Secret value not found in the secrets management system" });
    }
    
    res.json({ key, value });
    
    // Log the access
    await logSecretAccess({
      secretKey: key,
      action: "get_value",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error fetching secret value for key ${req.params.key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secret value", message: errorMessage });
    
    // Log the failed access
    await logSecretAccess({
      secretKey: req.params.key,
      action: "get_value",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: false,
      errorMessage: errorMessage,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  }
});

/**
 * Update a secret
 */
router.put("/secrets/:key", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    // Validate request body
    const validatedData = secretCreateFormSchema.parse(req.body);
    
    // Check if the key in the URL matches the key in the body
    if (key !== validatedData.key) {
      return res.status(400).json({ error: "Key in URL must match key in request body" });
    }
    
    // Get the secret reference
    const secretRef = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, key))
      .limit(1);
    
    if (!secretRef || secretRef.length === 0) {
      return res.status(404).json({ error: "Secret not found" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, validatedData.configId))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: "Invalid configuration ID" });
    }
    
    const config = configs[0];
    
    // Configure the service with the selected configuration
    secretsManagerService.configure({
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    });
    
    // Try to set the secret
    const setResult = await secretsManagerService.setSecret(key, validatedData.value, {
      description: validatedData.description,
      tags: validatedData.tags,
      expiresAt: validatedData.expiresAt,
      version: secretRef[0].version + 1
    });
    
    if (!setResult) {
      return res.status(500).json({ error: "Failed to update secret in the secrets management system" });
    }
    
    // Add user info for tracking
    const userId = req.user?.id;
    
    // Update the secret reference
    const [updatedSecretRef] = await db
      .update(secretReferences)
      .set({
        description: validatedData.description,
        configId: validatedData.configId,
        provider: config.provider,
        version: secretRef[0].version + 1,
        tags: validatedData.tags || [],
        accessGroups: validatedData.accessGroups || [],
        expiresAt: validatedData.expiresAt,
        updatedAt: new Date(),
        updatedBy: userId
      })
      .where(eq(secretReferences.key, key))
      .returning();
    
    res.json(updatedSecretRef);
    
    // Log the access
    await logSecretAccess({
      secretKey: key,
      action: "update",
      userId: userId,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error updating secret with key ${req.params.key}`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to update secret", message: errorMessage });
    
    // Log the failed access
    await logSecretAccess({
      secretKey: req.params.key,
      action: "update",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: false,
      errorMessage: errorMessage,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  }
});

/**
 * Delete a secret
 */
router.delete("/secrets/:key", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    // Get the secret reference
    const secretRef = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, key))
      .limit(1);
    
    if (!secretRef || secretRef.length === 0) {
      return res.status(404).json({ error: "Secret not found" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, secretRef[0].configId))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: "Invalid configuration for this secret" });
    }
    
    const config = configs[0];
    
    // Configure the service with the selected configuration
    secretsManagerService.configure({
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    });
    
    // Try to delete the secret
    const deleteResult = await secretsManagerService.deleteSecret(key);
    
    if (!deleteResult) {
      return res.status(500).json({ error: "Failed to delete secret from the secrets management system" });
    }
    
    // Delete the secret reference
    await db
      .delete(secretReferences)
      .where(eq(secretReferences.key, key));
    
    res.status(204).end();
    
    // Log the access
    await logSecretAccess({
      secretKey: key,
      action: "delete",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error deleting secret with key ${req.params.key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to delete secret", message: errorMessage });
    
    // Log the failed access
    await logSecretAccess({
      secretKey: req.params.key,
      action: "delete",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: false,
      errorMessage: errorMessage,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  }
});

/**
 * Rotate a secret
 */
router.post("/secrets/:key/rotate", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    
    // Get the secret reference
    const secretRef = await db
      .select()
      .from(secretReferences)
      .where(eq(secretReferences.key, key))
      .limit(1);
    
    if (!secretRef || secretRef.length === 0) {
      return res.status(404).json({ error: "Secret not found" });
    }
    
    // Get the configuration
    const configs = await db
      .select()
      .from(secretsManagerConfigs)
      .where(eq(secretsManagerConfigs.id, secretRef[0].configId))
      .limit(1);
    
    if (!configs || configs.length === 0) {
      return res.status(400).json({ error: "Invalid configuration for this secret" });
    }
    
    const config = configs[0];
    
    // Configure the service with the selected configuration
    secretsManagerService.configure({
      provider: config.provider as any,
      baseUrl: config.baseUrl || undefined,
      region: config.region || undefined,
      namespace: config.namespace || undefined,
      projectId: config.projectId || undefined,
      vaultId: config.vaultId || undefined,
      auth: {
        type: config.authType as any,
        credentials: config.authCredentials as Record<string, string>,
      },
      options: {
        prefix: config.secretsPrefix || undefined,
        cacheTtl: config.cacheTtl || undefined,
        autoRotate: config.autoRotate || false,
        rotationFrequency: config.rotationFrequency || undefined,
      }
    });
    
    // Try to rotate the secret
    const rotateResult = await secretsManagerService.rotateSecret(key);
    
    if (!rotateResult) {
      return res.status(500).json({ 
        error: "Failed to rotate secret", 
        message: "The secret rotation failed or is not supported by the provider"
      });
    }
    
    // Update the secret reference
    const [updatedSecretRef] = await db
      .update(secretReferences)
      .set({
        version: secretRef[0].version + 1,
        lastRotated: new Date(),
        updatedAt: new Date(),
        updatedBy: req.user?.id
      })
      .where(eq(secretReferences.key, key))
      .returning();
    
    res.json({
      success: true,
      message: "Secret rotated successfully",
      secret: updatedSecretRef
    });
    
    // Log the access
    await logSecretAccess({
      secretKey: key,
      action: "rotate",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: true,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  } catch (error) {
    routeLogger.error(`Error rotating secret with key ${req.params.key}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to rotate secret", message: errorMessage });
    
    // Log the failed access
    await logSecretAccess({
      secretKey: req.params.key,
      action: "rotate",
      userId: req.user?.id,
      username: req.user?.username || "unknown",
      success: false,
      errorMessage: errorMessage,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers['user-agent'] || "unknown",
      timestamp: new Date()
    });
  }
});

/**
 * Get secret access logs
 */
router.get("/access-logs", async (req: Request, res: Response) => {
  try {
    const { secretKey, action, userId, success, startDate, endDate, page = '1', limit = '20' } = req.query;
    
    // Base query
    let query = db
      .select()
      .from(secretAccessLogs)
      .orderBy(desc(secretAccessLogs.timestamp));
    
    // Apply filters
    if (secretKey) {
      query = query.where(eq(secretAccessLogs.secretKey, secretKey as string));
    }
    
    if (action) {
      query = query.where(eq(secretAccessLogs.action, action as string));
    }
    
    if (userId) {
      const userIdNum = parseInt(userId as string);
      if (!isNaN(userIdNum)) {
        query = query.where(eq(secretAccessLogs.userId, userIdNum));
      }
    }
    
    if (success !== undefined) {
      const successFilter = success === 'true';
      query = query.where(eq(secretAccessLogs.success, successFilter));
    }
    
    if (startDate) {
      const startDateObj = new Date(startDate as string);
      if (!isNaN(startDateObj.getTime())) {
        query = query.where(sql`${secretAccessLogs.timestamp} >= ${startDateObj}`);
      }
    }
    
    if (endDate) {
      const endDateObj = new Date(endDate as string);
      if (!isNaN(endDateObj.getTime())) {
        query = query.where(sql`${secretAccessLogs.timestamp} <= ${endDateObj}`);
      }
    }
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Execute query with pagination
    const logs = await query.limit(limitNum).offset(offset);
    
    // Count total for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(secretAccessLogs)
      .execute();
    
    const total = countResult[0]?.count || 0;
    
    res.json({
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    routeLogger.error("Error fetching secret access logs", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to fetch secret access logs", message: errorMessage });
  }
});

export default router;