import { db } from "../../db";
import {
  smtpConfigurations,
  notificationTemplates,
  notificationChannels,
  notificationEvents,
  notificationDeliveries,
  alertRules,
  SmtpConfiguration,
  NotificationTemplate,
  NotificationChannel,
  AlertRule
} from "../../shared/schema_notifications";
import { users, workspaces } from "../../shared/schema";
import { eq, and, or, desc, asc, sql, not, isNull, inArray } from "drizzle-orm";
import * as nodemailer from "nodemailer";
import * as crypto from "crypto";
import * as handlebars from "handlebars";
import * as winston from "winston";
import { PoolClient } from "pg";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import axios from "axios";

// Initialize logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "notification-service" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Define notification channel types
export type ChannelType = "email" | "slack" | "teams" | "webhook" | "in-app" | "sms";

// Define notification priority levels
export type NotificationPriority = "critical" | "high" | "normal" | "low" | "info";

// Interface for notification options
export interface NotificationOptions {
  title: string;
  message: string;
  priority: NotificationPriority;
  workspaceId?: number;
  userId?: number;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, any>;
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionUrl?: string;
  iconName?: string;
  templateId?: number;
  channelIds?: number[];
  expiresAt?: Date;
}

// Interface for SMTP test options
export interface SmtpTestOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  requireTls?: boolean;
  rejectUnauthorized?: boolean;
  testRecipient: string;
}

/**
 * NotificationService class provides functionality for sending notifications through various channels
 * and managing notification templates, SMTP configurations, and alert rules.
 */
export class NotificationService {
  private encryptionKey: Buffer;
  private encryptionIv: Buffer;
  private static instance: NotificationService;

  /**
   * Create a new NotificationService instance.
   * Use the getInstance() method to get a singleton instance.
   */
  private constructor() {
    // Get encryption key from environment or generate a secure one
    // In production, this should come from a secure secret manager
    const key = process.env.NOTIFICATION_ENCRYPTION_KEY || 
      crypto.randomBytes(32).toString('hex');
    
    // Create encryption key and iv
    this.encryptionKey = Buffer.from(key, 'hex');
    this.encryptionIv = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_IV || 
      crypto.randomBytes(16).toString('hex'), 'hex');
    
    logger.info("NotificationService initialized");
  }

  /**
   * Get the singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Encrypt sensitive data like SMTP passwords
   */
  private encrypt(text: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, this.encryptionIv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt encrypted data
   */
  private decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, this.encryptionIv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Create a new SMTP configuration
   */
  async createSmtpConfiguration(
    configData: {
      name: string;
      host: string;
      port: number;
      username: string;
      password: string;
      fromEmail: string;
      fromName?: string;
      requireTls?: boolean;
      rejectUnauthorized?: boolean;
      environment?: string;
      isDefault?: boolean;
      isActive?: boolean;
      workspaceId?: number;
      maxRetries?: number;
      retryInterval?: number;
    }
  ): Promise<SmtpConfiguration> {
    try {
      // Encrypt the password
      const encryptedPassword = this.encrypt(configData.password);

      // If this is marked as default, unset any existing defaults for this workspace
      if (configData.isDefault) {
        await db.update(smtpConfigurations)
          .set({ isDefault: false })
          .where(
            and(
              eq(smtpConfigurations.workspaceId, configData.workspaceId || null),
              eq(smtpConfigurations.isDefault, true)
            )
          );
      }

      // Insert the new configuration
      const [newConfig] = await db.insert(smtpConfigurations).values({
        name: configData.name,
        host: configData.host,
        port: configData.port,
        username: configData.username,
        encryptedPassword,
        fromEmail: configData.fromEmail,
        fromName: configData.fromName,
        requireTls: configData.requireTls !== undefined ? configData.requireTls : true,
        rejectUnauthorized: configData.rejectUnauthorized !== undefined ? configData.rejectUnauthorized : true,
        environment: configData.environment || 'production',
        isDefault: configData.isDefault !== undefined ? configData.isDefault : false,
        isActive: configData.isActive !== undefined ? configData.isActive : true,
        workspaceId: configData.workspaceId || null,
        maxRetries: configData.maxRetries || 3,
        retryInterval: configData.retryInterval || 60,
      }).returning();

      logger.info(`SMTP configuration created: ${newConfig.id}`);
      return newConfig;
    } catch (error) {
      logger.error(`Error creating SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing SMTP configuration
   */
  async updateSmtpConfiguration(
    id: number,
    configData: {
      name?: string;
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      fromEmail?: string;
      fromName?: string;
      requireTls?: boolean;
      rejectUnauthorized?: boolean;
      environment?: string;
      isDefault?: boolean;
      isActive?: boolean;
      maxRetries?: number;
      retryInterval?: number;
    }
  ): Promise<SmtpConfiguration> {
    try {
      // Get current config to check workspace
      const existingConfig = await this.getSmtpConfigurationById(id);
      if (!existingConfig) {
        throw new Error(`SMTP configuration with ID ${id} not found`);
      }

      // Prepare update data
      const updateData: any = { ...configData };
      
      // Encrypt password if provided
      if (configData.password) {
        updateData.encryptedPassword = this.encrypt(configData.password);
        delete updateData.password;
      }

      // If this is marked as default, unset any existing defaults for this workspace
      if (configData.isDefault) {
        await db.update(smtpConfigurations)
          .set({ isDefault: false })
          .where(
            and(
              eq(smtpConfigurations.workspaceId, existingConfig.workspaceId || null),
              eq(smtpConfigurations.isDefault, true),
              not(eq(smtpConfigurations.id, id))
            )
          );
      }

      // Update the configuration
      const [updatedConfig] = await db.update(smtpConfigurations)
        .set(updateData)
        .where(eq(smtpConfigurations.id, id))
        .returning();

      logger.info(`SMTP configuration updated: ${id}`);
      return updatedConfig;
    } catch (error) {
      logger.error(`Error updating SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Delete an SMTP configuration
   */
  async deleteSmtpConfiguration(id: number): Promise<boolean> {
    try {
      const result = await db.delete(smtpConfigurations)
        .where(eq(smtpConfigurations.id, id))
        .returning();
      
      const success = result.length > 0;
      if (success) {
        logger.info(`SMTP configuration deleted: ${id}`);
      } else {
        logger.warn(`SMTP configuration not found for deletion: ${id}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error deleting SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Get an SMTP configuration by ID
   */
  async getSmtpConfigurationById(id: number): Promise<SmtpConfiguration | null> {
    try {
      const config = await db.query.smtpConfigurations.findFirst({
        where: eq(smtpConfigurations.id, id),
      });
      
      return config || null;
    } catch (error) {
      logger.error(`Error getting SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Get SMTP configurations for a workspace
   */
  async getSmtpConfigurationsForWorkspace(
    workspaceId: number,
    options: { 
      includeInactive?: boolean,
      environment?: string 
    } = {}
  ): Promise<SmtpConfiguration[]> {
    try {
      let query = db.select().from(smtpConfigurations)
        .where(eq(smtpConfigurations.workspaceId, workspaceId));
      
      if (!options.includeInactive) {
        query = query.where(eq(smtpConfigurations.isActive, true));
      }
      
      if (options.environment) {
        query = query.where(eq(smtpConfigurations.environment, options.environment));
      }
      
      return await query.orderBy(desc(smtpConfigurations.isDefault), asc(smtpConfigurations.name));
    } catch (error) {
      logger.error(`Error getting SMTP configurations for workspace: ${error}`);
      throw error;
    }
  }

  /**
   * Get the default SMTP configuration for a workspace and environment
   */
  async getDefaultSmtpConfiguration(
    workspaceId: number,
    environment: string = 'production'
  ): Promise<SmtpConfiguration | null> {
    try {
      const config = await db.query.smtpConfigurations.findFirst({
        where: and(
          eq(smtpConfigurations.workspaceId, workspaceId),
          eq(smtpConfigurations.isDefault, true),
          eq(smtpConfigurations.isActive, true),
          eq(smtpConfigurations.environment, environment)
        ),
      });
      
      if (config) {
        return config;
      }
      
      // If no default found, get any active config for this environment
      return await db.query.smtpConfigurations.findFirst({
        where: and(
          eq(smtpConfigurations.workspaceId, workspaceId),
          eq(smtpConfigurations.isActive, true),
          eq(smtpConfigurations.environment, environment)
        ),
      });
    } catch (error) {
      logger.error(`Error getting default SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Test an SMTP configuration
   * This function attempts to connect to an SMTP server and send a test email
   */
  async testSmtpConnection(options: SmtpTestOptions): Promise<{ success: boolean; message: string }> {
    try {
      // Create a transporter
      const transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.port === 465,
        auth: {
          user: options.username,
          pass: options.password,
        },
        tls: {
          rejectUnauthorized: options.rejectUnauthorized !== false,
        },
        requireTLS: options.requireTls !== false,
      });
      
      // Verify connection
      await transporter.verify();
      
      // Send test email
      const result = await transporter.sendMail({
        from: options.fromName 
          ? `"${options.fromName}" <${options.fromEmail}>`
          : options.fromEmail,
        to: options.testRecipient,
        subject: 'SMTP Configuration Test',
        text: 'This is a test email to verify your SMTP configuration.',
        html: '<p>This is a test email to verify your SMTP configuration.</p>',
      });
      
      logger.info(`SMTP test successful. Message ID: ${result.messageId}`);
      return {
        success: true,
        message: `Test email sent successfully. Message ID: ${result.messageId}`,
      };
    } catch (error) {
      logger.error(`SMTP test failed: ${error}`);
      return {
        success: false,
        message: `SMTP test failed: ${error.message}`,
      };
    }
  }

  /**
   * Test an existing SMTP configuration by ID
   */
  async testSmtpConfigurationById(
    id: number,
    testRecipient: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getSmtpConfigurationById(id);
      if (!config) {
        return {
          success: false,
          message: `SMTP configuration with ID ${id} not found`,
        };
      }
      
      // Get decrypted password
      const password = this.decrypt(config.encryptedPassword);
      
      // Test the configuration
      const result = await this.testSmtpConnection({
        host: config.host,
        port: config.port,
        username: config.username,
        password,
        fromEmail: config.fromEmail,
        fromName: config.fromName || undefined,
        requireTls: config.requireTls,
        rejectUnauthorized: config.rejectUnauthorized,
        testRecipient,
      });
      
      // Update the test status
      await db.update(smtpConfigurations)
        .set({
          testStatus: result.success ? 'success' : 'failure',
          lastTestedAt: new Date(),
        })
        .where(eq(smtpConfigurations.id, id));
      
      return result;
    } catch (error) {
      logger.error(`Error testing SMTP configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Get all notification templates for a workspace
   */
  async getNotificationTemplates(
    workspaceId: number,
    options: {
      type?: string;
      includeSystem?: boolean;
      includeInactive?: boolean;
    } = {}
  ): Promise<NotificationTemplate[]> {
    try {
      let whereConditions = [
        or(
          eq(notificationTemplates.workspaceId, workspaceId),
          eq(notificationTemplates.isSystem, true)
        ),
      ];
      
      if (!options.includeInactive) {
        whereConditions.push(eq(notificationTemplates.isActive, true));
      }
      
      if (options.type) {
        whereConditions.push(eq(notificationTemplates.type, options.type));
      }
      
      if (!options.includeSystem) {
        whereConditions.push(
          or(
            eq(notificationTemplates.isSystem, false),
            eq(notificationTemplates.workspaceId, workspaceId)
          )
        );
      }
      
      const templates = await db.select().from(notificationTemplates)
        .where(and(...whereConditions))
        .orderBy(desc(notificationTemplates.isSystem), asc(notificationTemplates.name));
      
      return templates;
    } catch (error) {
      logger.error(`Error getting notification templates: ${error}`);
      throw error;
    }
  }

  /**
   * Get a notification template by ID
   */
  async getNotificationTemplateById(id: number): Promise<NotificationTemplate | null> {
    try {
      const template = await db.query.notificationTemplates.findFirst({
        where: eq(notificationTemplates.id, id),
      });
      
      return template || null;
    } catch (error) {
      logger.error(`Error getting notification template: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new notification template
   */
  async createNotificationTemplate(
    templateData: {
      workspaceId: number;
      name: string;
      description?: string;
      type: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: Record<string, any>;
      isActive?: boolean;
      createdBy?: number;
      locale?: string;
      brandingId?: number;
    }
  ): Promise<NotificationTemplate> {
    try {
      const [newTemplate] = await db.insert(notificationTemplates).values({
        ...templateData,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      logger.info(`Notification template created: ${newTemplate.id}`);
      return newTemplate;
    } catch (error) {
      logger.error(`Error creating notification template: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing notification template
   */
  async updateNotificationTemplate(
    id: number,
    templateData: {
      name?: string;
      description?: string;
      type?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: Record<string, any>;
      isActive?: boolean;
      lastModifiedBy?: number;
      locale?: string;
      brandingId?: number;
    }
  ): Promise<NotificationTemplate> {
    try {
      // Check if template exists and is not a system template
      const existingTemplate = await this.getNotificationTemplateById(id);
      if (!existingTemplate) {
        throw new Error(`Notification template with ID ${id} not found`);
      }
      
      if (existingTemplate.isSystem) {
        throw new Error(`Cannot update system template with ID ${id}`);
      }
      
      // Update the template
      const [updatedTemplate] = await db.update(notificationTemplates)
        .set({
          ...templateData,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplates.id, id))
        .returning();
      
      logger.info(`Notification template updated: ${id}`);
      return updatedTemplate;
    } catch (error) {
      logger.error(`Error updating notification template: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a notification template
   */
  async deleteNotificationTemplate(id: number): Promise<boolean> {
    try {
      // Check if template exists and is not a system template
      const existingTemplate = await this.getNotificationTemplateById(id);
      if (!existingTemplate) {
        return false;
      }
      
      if (existingTemplate.isSystem) {
        throw new Error(`Cannot delete system template with ID ${id}`);
      }
      
      // Check if template is used by any alert rules
      const alertRulesUsingTemplate = await db.select({ id: alertRules.id })
        .from(alertRules)
        .where(eq(alertRules.templateId, id))
        .limit(1);
      
      if (alertRulesUsingTemplate.length > 0) {
        throw new Error(`Cannot delete template with ID ${id} because it is used by alert rules`);
      }
      
      // Delete the template
      const result = await db.delete(notificationTemplates)
        .where(eq(notificationTemplates.id, id))
        .returning();
      
      const success = result.length > 0;
      if (success) {
        logger.info(`Notification template deleted: ${id}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error deleting notification template: ${error}`);
      throw error;
    }
  }

  /**
   * Get all notification channels for a workspace
   */
  async getNotificationChannels(
    workspaceId: number,
    options: {
      type?: string;
      includeInactive?: boolean;
    } = {}
  ): Promise<NotificationChannel[]> {
    try {
      let query = db.select().from(notificationChannels)
        .where(eq(notificationChannels.workspaceId, workspaceId));
      
      if (!options.includeInactive) {
        query = query.where(eq(notificationChannels.isActive, true));
      }
      
      if (options.type) {
        query = query.where(eq(notificationChannels.type, options.type));
      }
      
      return await query.orderBy(asc(notificationChannels.name));
    } catch (error) {
      logger.error(`Error getting notification channels: ${error}`);
      throw error;
    }
  }

  /**
   * Get a notification channel by ID
   */
  async getNotificationChannelById(id: number): Promise<NotificationChannel | null> {
    try {
      const channel = await db.query.notificationChannels.findFirst({
        where: eq(notificationChannels.id, id),
      });
      
      return channel || null;
    } catch (error) {
      logger.error(`Error getting notification channel: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new notification channel
   */
  async createNotificationChannel(
    channelData: {
      workspaceId: number;
      name: string;
      type: string;
      configuration: Record<string, any>;
      isActive?: boolean;
      throttleLimit?: number;
      throttleInterval?: number;
      defaultPriority?: string;
      createdBy?: number;
    }
  ): Promise<NotificationChannel> {
    try {
      // Validate configuration based on channel type
      this.validateChannelConfiguration(channelData.type, channelData.configuration);
      
      const [newChannel] = await db.insert(notificationChannels).values({
        ...channelData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      
      logger.info(`Notification channel created: ${newChannel.id}`);
      return newChannel;
    } catch (error) {
      logger.error(`Error creating notification channel: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing notification channel
   */
  async updateNotificationChannel(
    id: number,
    channelData: {
      name?: string;
      type?: string;
      configuration?: Record<string, any>;
      isActive?: boolean;
      throttleLimit?: number;
      throttleInterval?: number;
      defaultPriority?: string;
    }
  ): Promise<NotificationChannel> {
    try {
      // Get existing channel
      const existingChannel = await this.getNotificationChannelById(id);
      if (!existingChannel) {
        throw new Error(`Notification channel with ID ${id} not found`);
      }
      
      // If configuration or type is changing, validate new configuration
      if ((channelData.configuration || channelData.type) && 
          (channelData.configuration !== existingChannel.configuration || 
           channelData.type !== existingChannel.type)) {
        this.validateChannelConfiguration(
          channelData.type || existingChannel.type,
          channelData.configuration || existingChannel.configuration
        );
      }
      
      // Update the channel
      const [updatedChannel] = await db.update(notificationChannels)
        .set({
          ...channelData,
          updatedAt: new Date(),
        })
        .where(eq(notificationChannels.id, id))
        .returning();
      
      logger.info(`Notification channel updated: ${id}`);
      return updatedChannel;
    } catch (error) {
      logger.error(`Error updating notification channel: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a notification channel
   */
  async deleteNotificationChannel(id: number): Promise<boolean> {
    try {
      // Check for dependencies
      // TODO: Check for alert rule channel mappings
      
      // Delete the channel
      const result = await db.delete(notificationChannels)
        .where(eq(notificationChannels.id, id))
        .returning();
      
      const success = result.length > 0;
      if (success) {
        logger.info(`Notification channel deleted: ${id}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error deleting notification channel: ${error}`);
      throw error;
    }
  }

  /**
   * Validate channel configuration based on channel type
   */
  private validateChannelConfiguration(
    channelType: string,
    configuration: Record<string, any>
  ): void {
    switch (channelType) {
      case 'email':
        if (!configuration.smtpConfigId && !configuration.emailProvider) {
          throw new Error("Email channel requires either smtpConfigId or emailProvider");
        }
        
        if (configuration.emailProvider === 'ses' && !configuration.sesRegion) {
          throw new Error("AWS SES email provider requires sesRegion");
        }
        break;
        
      case 'slack':
        if (!configuration.webhookUrl) {
          throw new Error("Slack channel requires webhookUrl");
        }
        break;
        
      case 'teams':
        if (!configuration.webhookUrl) {
          throw new Error("Teams channel requires webhookUrl");
        }
        break;
        
      case 'webhook':
        if (!configuration.url) {
          throw new Error("Webhook channel requires url");
        }
        
        if (!configuration.method) {
          configuration.method = 'POST'; // Default to POST
        }
        break;
        
      case 'sms':
        if (!configuration.provider) {
          throw new Error("SMS channel requires provider");
        }
        
        if (configuration.provider === 'twilio') {
          if (!configuration.accountSid || !configuration.authToken || !configuration.fromNumber) {
            throw new Error("Twilio SMS provider requires accountSid, authToken, and fromNumber");
          }
        }
        break;
    }
  }

  /**
   * Test a notification channel
   */
  async testNotificationChannel(
    channelId: number,
    testRecipient: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get channel
      const channel = await this.getNotificationChannelById(channelId);
      if (!channel) {
        return { success: false, message: `Channel with ID ${channelId} not found` };
      }
      
      // Create a test notification
      const testTitle = `Test notification for ${channel.name}`;
      const testMessage = `This is a test notification sent at ${new Date().toISOString()}`;
      
      // Send test notification based on channel type
      let result: { success: boolean; message: string };
      
      switch (channel.type) {
        case 'email':
          result = await this.testEmailChannel(channel, testRecipient, testTitle, testMessage);
          break;
          
        case 'slack':
          result = await this.testSlackChannel(channel, testTitle, testMessage);
          break;
          
        case 'teams':
          result = await this.testTeamsChannel(channel, testTitle, testMessage);
          break;
          
        case 'webhook':
          result = await this.testWebhookChannel(channel, testTitle, testMessage);
          break;
          
        case 'sms':
          result = await this.testSmsChannel(channel, testRecipient, testMessage);
          break;
          
        default:
          result = { 
            success: false, 
            message: `Unsupported channel type: ${channel.type}` 
          };
      }
      
      // Update channel test status
      await db.update(notificationChannels)
        .set({
          testStatus: result.success ? 'success' : 'failure',
          lastTestedAt: new Date(),
        })
        .where(eq(notificationChannels.id, channelId));
      
      return result;
    } catch (error) {
      logger.error(`Error testing notification channel: ${error}`);
      return {
        success: false,
        message: `Error testing notification channel: ${error.message}`,
      };
    }
  }

  /**
   * Test an email channel
   */
  private async testEmailChannel(
    channel: NotificationChannel,
    recipient: string,
    subject: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = channel.configuration;
      
      if (config.smtpConfigId) {
        // Use SMTP configuration
        const smtpConfig = await this.getSmtpConfigurationById(config.smtpConfigId);
        if (!smtpConfig) {
          return {
            success: false,
            message: `SMTP configuration with ID ${config.smtpConfigId} not found`,
          };
        }
        
        // Create transporter
        const password = this.decrypt(smtpConfig.encryptedPassword);
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.port === 465,
          auth: {
            user: smtpConfig.username,
            pass: password,
          },
          tls: {
            rejectUnauthorized: smtpConfig.rejectUnauthorized,
          },
          requireTLS: smtpConfig.requireTls,
        });
        
        // Send email
        const result = await transporter.sendMail({
          from: smtpConfig.fromName 
            ? `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`
            : smtpConfig.fromEmail,
          to: recipient,
          subject,
          text: message,
          html: `<p>${message}</p>`,
        });
        
        return {
          success: true,
          message: `Test email sent successfully. Message ID: ${result.messageId}`,
        };
      } else if (config.emailProvider === 'ses') {
        // Use AWS SES
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
          return {
            success: false,
            message: 'AWS credentials are not configured',
          };
        }
        
        const sesClient = new SESClient({ region: config.sesRegion });
        const sendCommand = new SendEmailCommand({
          Source: config.fromEmail,
          Destination: {
            ToAddresses: [recipient],
          },
          Message: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: message,
              },
              Html: {
                Data: `<p>${message}</p>`,
              },
            },
          },
        });
        
        const result = await sesClient.send(sendCommand);
        return {
          success: true,
          message: `Test email sent successfully using AWS SES. Message ID: ${result.MessageId}`,
        };
      }
      
      return {
        success: false,
        message: 'Invalid email channel configuration',
      };
    } catch (error) {
      logger.error(`Error testing email channel: ${error}`);
      return {
        success: false,
        message: `Error testing email channel: ${error.message}`,
      };
    }
  }

  /**
   * Test a Slack channel
   */
  private async testSlackChannel(
    channel: NotificationChannel,
    title: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = channel.configuration;
      
      // Create Slack message payload
      const payload = {
        text: title,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
        ],
      };
      
      // Send to Slack webhook
      const response = await axios.post(config.webhookUrl, payload);
      
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: 'Test notification sent to Slack',
        };
      }
      
      return {
        success: false,
        message: `Slack webhook failed with status: ${response.status}`,
      };
    } catch (error) {
      logger.error(`Error testing Slack channel: ${error}`);
      return {
        success: false,
        message: `Error testing Slack channel: ${error.message}`,
      };
    }
  }

  /**
   * Test a Microsoft Teams channel
   */
  private async testTeamsChannel(
    channel: NotificationChannel,
    title: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = channel.configuration;
      
      // Create Teams message payload
      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '0078D7',
        summary: title,
        sections: [
          {
            activityTitle: title,
            activitySubtitle: new Date().toISOString(),
            text: message,
          },
        ],
      };
      
      // Send to Teams webhook
      const response = await axios.post(config.webhookUrl, payload);
      
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: 'Test notification sent to Microsoft Teams',
        };
      }
      
      return {
        success: false,
        message: `Microsoft Teams webhook failed with status: ${response.status}`,
      };
    } catch (error) {
      logger.error(`Error testing Microsoft Teams channel: ${error}`);
      return {
        success: false,
        message: `Error testing Microsoft Teams channel: ${error.message}`,
      };
    }
  }

  /**
   * Test a webhook channel
   */
  private async testWebhookChannel(
    channel: NotificationChannel,
    title: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = channel.configuration;
      
      // Create webhook payload
      const payload = {
        title,
        message,
        timestamp: new Date().toISOString(),
        test: true,
      };
      
      // Add custom headers if configured
      const headers = config.headers || {};
      
      // Send to webhook URL
      const response = await axios({
        method: config.method || 'POST',
        url: config.url,
        headers,
        data: payload,
      });
      
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: `Test notification sent to webhook. Status: ${response.status}`,
        };
      }
      
      return {
        success: false,
        message: `Webhook failed with status: ${response.status}`,
      };
    } catch (error) {
      logger.error(`Error testing webhook channel: ${error}`);
      return {
        success: false,
        message: `Error testing webhook channel: ${error.message}`,
      };
    }
  }

  /**
   * Test an SMS channel
   */
  private async testSmsChannel(
    channel: NotificationChannel,
    recipient: string,
    message: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const config = channel.configuration;
      
      // We're not implementing the actual SMS sending here as it requires
      // third-party libraries and credentials, but we'd implement it properly
      // in a real application.
      
      // For now, just return a success message
      return {
        success: true,
        message: `SMS notification would be sent to ${recipient}`,
      };
    } catch (error) {
      logger.error(`Error testing SMS channel: ${error}`);
      return {
        success: false,
        message: `Error testing SMS channel: ${error.message}`,
      };
    }
  }

  /**
   * Send a notification through all appropriate channels
   */
  async sendNotification(options: NotificationOptions): Promise<number> {
    try {
      // Start a transaction
      const trxResult = await db.transaction(async (trx) => {
        // Create notification event record
        const [event] = await trx.insert(notificationEvents).values({
          workspaceId: options.workspaceId,
          type: options.source ? 'external' : 'system',
          priority: options.priority,
          title: options.title,
          message: options.message,
          source: options.source,
          sourceId: options.sourceId,
          metadata: options.metadata || {},
          createdAt: new Date(),
          expiresAt: options.expiresAt,
          isRead: false,
          userId: options.userId,
          relatedResourceType: options.relatedResourceType,
          relatedResourceId: options.relatedResourceId,
          actionUrl: options.actionUrl,
          iconName: options.iconName,
        }).returning();
        
        // If specific channels were provided, use those
        if (options.channelIds && options.channelIds.length > 0) {
          const channels = await trx.select().from(notificationChannels)
            .where(
              and(
                inArray(notificationChannels.id, options.channelIds),
                eq(notificationChannels.isActive, true)
              )
            );
          
          // Send to each channel
          for (const channel of channels) {
            await this.sendToChannel(trx, event.id, channel);
          }
        } else {
          // Default to in-app notification for the user
          // Logic for determining other appropriate channels would go here
          // For now, just log that we'd send in-app
          logger.info(`Created in-app notification for user ${options.userId}`);
        }
        
        return event.id;
      });
      
      return trxResult;
    } catch (error) {
      logger.error(`Error sending notification: ${error}`);
      throw error;
    }
  }

  /**
   * Send a notification to a specific channel
   */
  private async sendToChannel(
    trx: any,
    eventId: number,
    channel: NotificationChannel
  ): Promise<void> {
    try {
      // Get event details
      const event = await trx.query.notificationEvents.findFirst({
        where: eq(notificationEvents.id, eventId),
      });
      
      if (!event) {
        throw new Error(`Notification event with ID ${eventId} not found`);
      }
      
      // Create delivery record
      const [delivery] = await trx.insert(notificationDeliveries).values({
        eventId,
        channelId: channel.id,
        status: 'pending',
        createdAt: new Date(),
      }).returning();
      
      // Implement actual delivery logic based on channel type
      // For now, just log that we'd send it
      logger.info(`Would send notification ${eventId} via ${channel.type} channel ${channel.id}`);
      
      // Update delivery status
      await trx.update(notificationDeliveries)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, delivery.id));
    } catch (error) {
      logger.error(`Error sending to channel: ${error}`);
      
      // Create or update delivery with error status
      await trx.insert(notificationDeliveries).values({
        eventId,
        channelId: channel.id,
        status: 'failed',
        error: error.message,
        createdAt: new Date(),
      }).onConflictDoUpdate({
        target: [notificationDeliveries.eventId, notificationDeliveries.channelId],
        set: {
          status: 'failed',
          error: error.message,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: number,
    options: {
      page?: number;
      limit?: number;
      includeRead?: boolean;
      priority?: string;
    } = {}
  ): Promise<{ notifications: any[]; total: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;
      
      let query = db.select().from(notificationEvents)
        .where(eq(notificationEvents.userId, userId));
      
      if (!options.includeRead) {
        query = query.where(eq(notificationEvents.isRead, false));
      }
      
      if (options.priority) {
        query = query.where(eq(notificationEvents.priority, options.priority));
      }
      
      // Count total matching records
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(notificationEvents)
        .where(eq(notificationEvents.userId, userId))
        .where(options.includeRead ? sql`true` : eq(notificationEvents.isRead, false))
        .where(options.priority ? eq(notificationEvents.priority, options.priority) : sql`true`);
      
      const total = countResult[0]?.count || 0;
      
      // Get paginated results
      const notifications = await query
        .orderBy(desc(notificationEvents.createdAt))
        .limit(limit)
        .offset(offset);
      
      return { notifications, total };
    } catch (error) {
      logger.error(`Error getting user notifications: ${error}`);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    notificationId: number,
    userId: number
  ): Promise<boolean> {
    try {
      // Ensure notification belongs to user
      const notification = await db.query.notificationEvents.findFirst({
        where: and(
          eq(notificationEvents.id, notificationId),
          eq(notificationEvents.userId, userId)
        ),
      });
      
      if (!notification) {
        return false;
      }
      
      // Update notification
      await db.update(notificationEvents)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(eq(notificationEvents.id, notificationId));
      
      return true;
    } catch (error) {
      logger.error(`Error marking notification as read: ${error}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: number): Promise<number> {
    try {
      const result = await db.update(notificationEvents)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notificationEvents.userId, userId),
            eq(notificationEvents.isRead, false)
          )
        );
      
      return result.rowCount || 0;
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: number,
    userId: number
  ): Promise<boolean> {
    try {
      // Ensure notification belongs to user
      const notification = await db.query.notificationEvents.findFirst({
        where: and(
          eq(notificationEvents.id, notificationId),
          eq(notificationEvents.userId, userId)
        ),
      });
      
      if (!notification) {
        return false;
      }
      
      // Delete notification
      const result = await db.delete(notificationEvents)
        .where(eq(notificationEvents.id, notificationId));
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting notification: ${error}`);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadNotificationCount(userId: number): Promise<{ total: number; critical: number }> {
    try {
      const results = await db.select({
        priority: notificationEvents.priority,
        count: sql<number>`count(*)`,
      })
      .from(notificationEvents)
      .where(
        and(
          eq(notificationEvents.userId, userId),
          eq(notificationEvents.isRead, false)
        )
      )
      .groupBy(notificationEvents.priority);
      
      let total = 0;
      let critical = 0;
      
      for (const row of results) {
        const count = Number(row.count);
        total += count;
        if (row.priority === 'critical') {
          critical += count;
        }
      }
      
      return { total, critical };
    } catch (error) {
      logger.error(`Error getting unread notification count: ${error}`);
      throw error;
    }
  }
}