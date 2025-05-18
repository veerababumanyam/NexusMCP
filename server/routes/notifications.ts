import { Router, Request, Response } from "express";
import { NotificationService, NotificationOptions } from "../services/notificationService";
import {
  createSmtpConfigSchema,
  testSmtpConnectionSchema,
  smtpConfigurationSchema,
  notificationTemplateSchema,
  notificationChannelSchema,
  alertRuleSchema,
  userNotificationPreferencesSchema
} from "../../shared/schema_notifications";
import { db } from "../../db";
import { z } from "zod";
import { createAuditLog } from "../services/enhancedAuditService";

// Initialize router and notification service
const router = Router();
const notificationService = NotificationService.getInstance();

/**
 * Middleware to check if user has access to workspace
 */
const checkWorkspaceAccess = async (req: Request, res: Response, next: any) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId || req.body.workspaceId);
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    // Check if user is authenticated (already handled by requireAuth middleware from routes.ts)
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  } catch (error) {
    console.error("Error checking workspace access:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Helper function to check user's workspace access
async function checkUserWorkspaceAccess(req: Request, workspaceId: number | null): Promise<boolean> {
  if (!workspaceId) return false;
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) return false;
  
  // TODO: Implement proper workspace access check with workspace memberships
  return true;
}

// SMTP Configuration Routes

/**
 * Get all SMTP configurations for a workspace
 */
router.get("/smtp-configurations/:workspaceId", 
  checkWorkspaceAccess,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.workspaceId);
      const includeInactive = req.query.includeInactive === "true";
      const environment = req.query.environment as string;

      const configurations = await notificationService.getSmtpConfigurationsForWorkspace(
        workspaceId,
        { includeInactive, environment }
      );

      // Remove sensitive data
      const sanitizedConfigs = configurations.map(config => {
        const { encryptedPassword, ...sanitized } = config;
        return sanitized;
      });

      res.json(sanitizedConfigs);
    } catch (error) {
      console.error("Error getting SMTP configurations:", error);
      res.status(500).json({ error: "Failed to get SMTP configurations" });
    }
  }
);

/**
 * Get SMTP configuration by ID
 */
router.get("/smtp-configurations/:workspaceId/:id", 
  checkWorkspaceAccess,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const config = await notificationService.getSmtpConfigurationById(id);

      if (!config) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }

      // Check if user has access to this configuration's workspace
      if (config.workspaceId !== parseInt(req.params.workspaceId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Remove sensitive data
      const { encryptedPassword, ...sanitizedConfig } = config;
      
      res.json(sanitizedConfig);
    } catch (error) {
      console.error("Error getting SMTP configuration:", error);
      res.status(500).json({ error: "Failed to get SMTP configuration" });
    }
  }
);

/**
 * Create a new SMTP configuration
 */
router.post("/smtp-configurations",
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = createSmtpConfigSchema.parse(req.body);
      const workspaceId = req.body.workspaceId;

      // Check workspace access
      if (!await checkUserWorkspaceAccess(req, workspaceId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Create configuration
      const newConfig = await notificationService.createSmtpConfiguration({
        ...validatedData,
        workspaceId
      });

      // Create audit log
      await auditLogCreate({
        action: "create",
        userId: req.user?.id || null,
        workspaceId,
        resourceType: "smtp_configuration",
        resourceId: newConfig.id.toString(),
        details: {
          name: newConfig.name,
          host: newConfig.host,
          port: newConfig.port,
          fromEmail: newConfig.fromEmail,
          environment: newConfig.environment
        },
        status: "success",
        severity: "info"
      });

      // Remove sensitive data from response
      const { encryptedPassword, ...sanitizedConfig } = newConfig;
      
      res.status(201).json(sanitizedConfig);
    } catch (error) {
      console.error("Error creating SMTP configuration:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ error: "Failed to create SMTP configuration" });
    }
  }
);

/**
 * Update an SMTP configuration
 */
router.put("/smtp-configurations/:id",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing configuration
      const existingConfig = await notificationService.getSmtpConfigurationById(id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }

      // Check workspace access
      if (!await checkUserWorkspaceAccess(req, existingConfig.workspaceId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate update data
      const updateData: any = req.body;
      
      // Update configuration
      const updatedConfig = await notificationService.updateSmtpConfiguration(id, updateData);

      // Create audit log
      await auditLogCreate({
        action: "update",
        userId: req.user?.id || null,
        workspaceId: existingConfig.workspaceId,
        resourceType: "smtp_configuration",
        resourceId: id.toString(),
        details: {
          name: updatedConfig.name,
          host: updatedConfig.host,
          port: updatedConfig.port,
          fromEmail: updatedConfig.fromEmail,
          environment: updatedConfig.environment
        },
        status: "success",
        severity: "info"
      });

      // Remove sensitive data from response
      const { encryptedPassword, ...sanitizedConfig } = updatedConfig;
      
      res.json(sanitizedConfig);
    } catch (error) {
      console.error("Error updating SMTP configuration:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ error: "Failed to update SMTP configuration" });
    }
  }
);

/**
 * Delete an SMTP configuration
 */
router.delete("/smtp-configurations/:id",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing configuration
      const existingConfig = await notificationService.getSmtpConfigurationById(id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }

      // Check workspace access
      if (!await checkUserWorkspaceAccess(req, existingConfig.workspaceId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete configuration
      const success = await notificationService.deleteSmtpConfiguration(id);

      if (!success) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }

      // Create audit log
      await auditLogCreate({
        action: "delete",
        userId: req.user?.id || null,
        workspaceId: existingConfig.workspaceId,
        resourceType: "smtp_configuration",
        resourceId: id.toString(),
        details: {
          name: existingConfig.name
        },
        status: "success",
        severity: "info"
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting SMTP configuration:", error);
      res.status(500).json({ error: "Failed to delete SMTP configuration" });
    }
  }
);

/**
 * Test an SMTP configuration
 */
router.post("/smtp-configurations/:id/test",
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { testRecipient } = req.body;
      
      if (!testRecipient) {
        return res.status(400).json({ error: "Test recipient email is required" });
      }

      // Get existing configuration
      const existingConfig = await notificationService.getSmtpConfigurationById(id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SMTP configuration not found" });
      }

      // Check workspace access
      if (!await checkUserWorkspaceAccess(req, existingConfig.workspaceId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Test configuration
      const result = await notificationService.testSmtpConfigurationById(id, testRecipient);

      // Create audit log
      await auditLogCreate({
        action: "test",
        userId: req.user?.id || null,
        workspaceId: existingConfig.workspaceId,
        resourceType: "smtp_configuration",
        resourceId: id.toString(),
        details: {
          name: existingConfig.name,
          result: result.success ? "success" : "failure",
          message: result.message
        },
        status: result.success ? "success" : "failure",
        severity: "info"
      });

      res.json(result);
    } catch (error) {
      console.error("Error testing SMTP configuration:", error);
      res.status(500).json({ error: "Failed to test SMTP configuration" });
    }
  }
);

/**
 * Test a new SMTP configuration without saving it
 */
router.post("/smtp-configurations/test",
  async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = testSmtpConnectionSchema.parse(req.body);
      
      // Test configuration
      const result = await notificationService.testSmtpConnection(validatedData);
      
      res.json(result);
    } catch (error) {
      console.error("Error testing SMTP configuration:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ error: "Failed to test SMTP configuration" });
    }
  }
);

// Add the rest of the notification router routes
// These follow the same pattern as the SMTP configuration routes
// Notification Templates, Channels, Preferences, etc.

export default router;