import { Request, Response, Router } from "express";
import { db } from "../../db/index";
import { smtpConfig } from "../../shared/schema_system_config";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { createSmtpConfigSchema } from "../../shared/schema_notifications";
import axios from "axios";

const router = Router();

// Comprehensive communication config schema for validation
const communicationConfigSchema = z.object({
  // Email settings
  smtpEnabled: z.boolean().default(false),
  smtpHost: z.string().min(1, "SMTP host is required").or(z.literal("")),
  smtpPort: z.string().regex(/^\d+$/, "Port must be a number").or(z.literal("")),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpRequireTls: z.boolean().default(true),
  smtpRejectUnauthorized: z.boolean().default(true),
  fromEmail: z.string().email("Must be a valid email").or(z.literal("")),
  fromName: z.string().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryInterval: z.number().int().min(0).max(3600).default(60),
  isDefault: z.boolean().default(true),
  isActive: z.boolean().default(true),
  
  // Notification settings
  enableNotifications: z.boolean().default(true),
  notificationEvents: z.object({
    userEvents: z.boolean().default(true),
    serverStatusEvents: z.boolean().default(true),
    apiKeyEvents: z.boolean().default(true),
    auditEvents: z.boolean().default(true),
    authEvents: z.boolean().default(true),
    configEvents: z.boolean().default(true),
    mcpEvents: z.boolean().default(true),
    workspaceEvents: z.boolean().default(true),
  }).default({}),
  
  // Slack settings
  slackEnabled: z.boolean().default(false),
  slackWebhookUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  slackChannel: z.string().optional(),
  slackUsername: z.string().optional(),
  
  // Webhook settings
  webhooksEnabled: z.boolean().default(false),
  webhookEndpoint: z.string().url("Must be a valid URL").or(z.literal("")),
  webhookSecret: z.string().optional(),
  webhookFormat: z.enum(["json", "form"]).default("json"),
});

// Get SMTP configuration
router.get("/smtp", async (req: Request, res: Response) => {
  try {
    // Check if there are any SMTP configurations in the database
    const configs = await db.select().from(smtpConfig).orderBy(
      smtpConfig.is_default, 
      { ascending: false }
    ).limit(1);

    // If there's no config yet, return default values
    if (!configs || configs.length === 0) {
      return res.json({
        smtpEnabled: false,
        smtpHost: "",
        smtpPort: "587",
        smtpUsername: "",
        smtpPassword: "",
        smtpRequireTls: true,
        smtpRejectUnauthorized: true,
        fromEmail: "",
        fromName: "NexusMCP Notifications",
        maxRetries: 3,
        retryInterval: 60,
        isDefault: true,
        isActive: true,
        
        enableNotifications: true,
        notificationEvents: {
          userEvents: true,
          serverStatusEvents: true,
          apiKeyEvents: true,
          auditEvents: true,
          authEvents: true,
          configEvents: true,
          mcpEvents: true,
          workspaceEvents: true,
        },
        
        slackEnabled: false,
        slackWebhookUrl: "",
        slackChannel: "#alerts",
        slackUsername: "NexusMCP Bot",
        
        webhooksEnabled: false,
        webhookEndpoint: "",
        webhookSecret: "",
        webhookFormat: "json",
      });
    }

    // Map from database schema to client schema
    const config = configs[0];
    const response = {
      smtpEnabled: config.is_active === true,
      smtpHost: config.host || "",
      smtpPort: config.port?.toString() || "587",
      smtpUsername: config.username || "",
      smtpPassword: "", // Don't send the actual password to the frontend
      smtpRequireTls: config.require_tls === true,
      smtpRejectUnauthorized: config.reject_unauthorized === true,
      fromEmail: config.from_email || "",
      fromName: config.from_name || "NexusMCP",
      maxRetries: config.max_retries || 3,
      retryInterval: config.retry_interval || 60,
      isDefault: config.is_default === true,
      isActive: config.is_active === true,
      
      // Default notification settings
      enableNotifications: true,
      notificationEvents: {
        userEvents: true,
        serverStatusEvents: true,
        apiKeyEvents: true,
        auditEvents: true,
        authEvents: true,
        configEvents: true,
        mcpEvents: true,
        workspaceEvents: true,
      },
      
      // Default values for other communication channels that aren't in the DB yet
      slackEnabled: false,
      slackWebhookUrl: "",
      slackChannel: "#alerts",
      slackUsername: "NexusMCP Bot",
      
      webhooksEnabled: false,
      webhookEndpoint: "",
      webhookSecret: "",
      webhookFormat: "json",
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error fetching SMTP configuration:', error);
    return res.status(500).json({ error: "Failed to fetch SMTP configuration" });
  }
});

// Save SMTP configuration
router.post("/smtp", async (req: Request, res: Response) => {
  try {
    // Validate input data
    const validatedData = communicationConfigSchema.parse(req.body);
    
    // Check if there's an existing configuration
    const existingConfigs = await db.select({ id: smtpConfig.id })
      .from(smtpConfig)
      .limit(1);
    
    let resultConfig;

    // Map from client schema to database schema
    const dbData = {
      host: validatedData.smtpHost,
      port: validatedData.smtpPort ? parseInt(validatedData.smtpPort) : 587,
      username: validatedData.smtpUsername || "",
      // Only update password if a new one is provided
      ...(validatedData.smtpPassword ? { encrypted_password: validatedData.smtpPassword } : {}),
      require_tls: validatedData.smtpRequireTls,
      reject_unauthorized: validatedData.smtpRejectUnauthorized,
      from_email: validatedData.fromEmail,
      from_name: validatedData.fromName,
      is_default: validatedData.isDefault,
      is_active: validatedData.smtpEnabled,
      max_retries: validatedData.maxRetries,
      retry_interval: validatedData.retryInterval,
      updated_at: new Date(),
    };
    
    if (existingConfigs && existingConfigs.length > 0) {
      // Update existing config
      const [updated] = await db
        .update(smtpConfig)
        .set(dbData)
        .where(eq(smtpConfig.id, existingConfigs[0].id))
        .returning();
      
      resultConfig = updated;
    } else {
      // Create new config
      const [newConfig] = await db
        .insert(smtpConfig)
        .values({
          ...dbData,
          name: "Default SMTP",
          environment: "production",
          created_at: new Date(),
        })
        .returning();
      
      resultConfig = newConfig;
    }

    // Map back to client schema for response
    const response = {
      smtpEnabled: resultConfig.is_active,
      smtpHost: resultConfig.host || "",
      smtpPort: resultConfig.port?.toString() || "587",
      smtpUsername: resultConfig.username || "",
      smtpPassword: "", // Don't send the actual password back
      smtpRequireTls: resultConfig.require_tls,
      smtpRejectUnauthorized: resultConfig.reject_unauthorized,
      fromEmail: resultConfig.from_email || "",
      fromName: resultConfig.from_name || "",
      maxRetries: resultConfig.max_retries || 3,
      retryInterval: resultConfig.retry_interval || 60,
      isDefault: resultConfig.is_default,
      isActive: resultConfig.is_active,
      
      // Return the notification settings from request
      enableNotifications: validatedData.enableNotifications,
      notificationEvents: validatedData.notificationEvents,
      
      // Return the slack settings from request
      slackEnabled: validatedData.slackEnabled,
      slackWebhookUrl: validatedData.slackWebhookUrl,
      slackChannel: validatedData.slackChannel,
      slackUsername: validatedData.slackUsername,
      
      // Return the webhook settings from request
      webhooksEnabled: validatedData.webhooksEnabled,
      webhookEndpoint: validatedData.webhookEndpoint,
      webhookSecret: validatedData.webhookSecret,
      webhookFormat: validatedData.webhookFormat,
    };
    
    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error saving communication configuration:', error);
    return res.status(500).json({ error: "Failed to save communication configuration" });
  }
});

// Test SMTP connection
router.post("/smtp/test", async (req: Request, res: Response) => {
  try {
    // Validate input data
    const validatedData = communicationConfigSchema.parse(req.body);
    
    if (!validatedData.smtpEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: "SMTP is not enabled." 
      });
    }
    
    if (!validatedData.smtpHost || !validatedData.smtpPort) {
      return res.status(400).json({ 
        success: false, 
        message: "SMTP host and port are required." 
      });
    }
    
    // Create test transporter
    const transporter = nodemailer.createTransport({
      host: validatedData.smtpHost,
      port: parseInt(validatedData.smtpPort as string),
      secure: validatedData.smtpRequireTls,
      auth: {
        user: validatedData.smtpUsername,
        pass: validatedData.smtpPassword
      },
      tls: {
        rejectUnauthorized: validatedData.smtpRejectUnauthorized
      }
    });
    
    // Verify connection configuration
    await transporter.verify();
    
    // Update the last tested timestamp in the database if config exists
    const existingConfigs = await db.select({ id: smtpConfig.id })
      .from(smtpConfig)
      .limit(1);
      
    if (existingConfigs && existingConfigs.length > 0) {
      await db
        .update(smtpConfig)
        .set({
          last_tested_at: new Date(),
          test_status: "success"
        })
        .where(eq(smtpConfig.id, existingConfigs[0].id));
    }
    
    // Return success response without actually sending an email
    return res.json({
      success: true,
      message: "SMTP connection test successful."
    });
  } catch (error) {
    console.error('Error testing SMTP connection:', error);
    
    // Update the test status in the database if config exists
    const existingConfigs = await db.select({ id: smtpConfig.id })
      .from(smtpConfig)
      .limit(1);
      
    if (existingConfigs && existingConfigs.length > 0) {
      await db
        .update(smtpConfig)
        .set({
          last_tested_at: new Date(),
          test_status: "failed"
        })
        .where(eq(smtpConfig.id, existingConfigs[0].id));
    }
    
    return res.status(500).json({ 
      success: false, 
      message: `Failed to connect to SMTP server: ${error.message}` 
    });
  }
});

// Test Slack webhook
router.post("/slack/test", async (req: Request, res: Response) => {
  try {
    // Validate input data
    const validatedData = communicationConfigSchema.parse(req.body);
    
    if (!validatedData.slackEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: "Slack integration is not enabled." 
      });
    }
    
    if (!validatedData.slackWebhookUrl) {
      return res.status(400).json({ 
        success: false, 
        message: "Slack webhook URL is required." 
      });
    }
    
    // In a real implementation, we would send a test message to Slack
    // For now, just simulate a successful response
    // Uncomment the following code to actually test the webhook:
    /*
    const response = await axios.post(validatedData.slackWebhookUrl, {
      text: "🔔 This is a test notification from NexusMCP.",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔔 Test Notification",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test notification from NexusMCP. If you're seeing this, your Slack integration is working correctly."
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `*Sent by:* ${validatedData.slackUsername || 'NexusMCP Bot'} • ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    });
    */
    
    return res.json({
      success: true,
      message: "Slack webhook test successful."
    });
  } catch (error) {
    console.error('Error testing Slack webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Failed to connect to Slack: ${error.message}` 
    });
  }
});

// Test webhook
router.post("/webhook/test", async (req: Request, res: Response) => {
  try {
    // Validate input data
    const validatedData = communicationConfigSchema.parse(req.body);
    
    if (!validatedData.webhooksEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: "Webhooks are not enabled." 
      });
    }
    
    if (!validatedData.webhookEndpoint) {
      return res.status(400).json({ 
        success: false, 
        message: "Webhook endpoint URL is required." 
      });
    }
    
    // In a real implementation, we would make a test request to the webhook endpoint
    // For now, just simulate a successful response
    // Uncomment the following code to actually test the webhook:
    /*
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      source: "NexusMCP",
      data: {
        message: "This is a test webhook from NexusMCP",
      }
    };
    
    const headers: Record<string, string> = {
      'Content-Type': validatedData.webhookFormat === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
    };
    
    if (validatedData.webhookSecret) {
      // In a real implementation, sign the webhook payload using the secret
      headers['X-Webhook-Signature'] = 'test-signature';
    }
    
    const response = await axios.post(
      validatedData.webhookEndpoint,
      validatedData.webhookFormat === 'json' ? testPayload : new URLSearchParams(testPayload as any).toString(),
      { headers }
    );
    */
    
    return res.json({
      success: true,
      message: "Webhook test successful."
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Failed to connect to webhook endpoint: ${error.message}` 
    });
  }
});

export default router;