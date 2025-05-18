/**
 * Messaging Service
 * 
 * Enterprise-grade service for managing and sending messages through various platforms:
 * - Slack integration
 * - Microsoft Teams integration
 * - SMS providers (Twilio, Vonage, Plivo)
 */

import { WebClient, ChatPostMessageArguments } from "@slack/web-api";
import { db } from "../../../db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { 
  messagingConfigurations, 
  smsConfigurations,
  messageTemplates,
  messageDeliveryLogs,
  testMessageSchema,
  testSmsSchema,
  type MessagingConfiguration,
  type SmsConfiguration,
  type MessageTemplate,
  type MessageDeliveryLog
} from "../../../shared/schema_messaging";
import { enhancedAuditService } from "../enhancedAuditService";
import { Request } from "express";
import { z } from "zod";

// Message platform types
export enum MessagePlatform {
  SLACK = 'slack',
  MS_TEAMS = 'ms_teams',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  CUSTOM = 'custom'
}

// Message status types
export enum MessageStatus {
  DELIVERED = 'delivered',
  FAILED = 'failed',
  PENDING = 'pending'
}

/**
 * Interface for message variables
 */
export interface MessageVariables {
  [key: string]: string | number | boolean | null;
}

/**
 * Interface for message payload
 */
export interface MessagePayload {
  content: string;
  recipient: string;
  subject?: string;
  format?: string;
  variables?: MessageVariables;
  blocks?: any;
}

/**
 * Interface for template-based message payload
 */
export interface TemplateMessagePayload {
  templateId: number;
  recipient: string;
  variables?: MessageVariables;
}

/**
 * Class that handles all message sending operations
 */
export class MessagingService {
  private slackClients: Map<number, WebClient> = new Map();
  private req?: Request;

  /**
   * Create a new MessagingService
   * @param req Express request for audit logs
   */
  constructor(req?: Request) {
    this.req = req;
  }

  /**
   * Get all messaging configurations
   * @param workspaceId Optional workspace filter
   * @returns List of messaging configurations
   */
  async getMessagingConfigurations(workspaceId?: number): Promise<MessagingConfiguration[]> {
    try {
      if (workspaceId) {
        return await db.select().from(messagingConfigurations)
          .where(eq(messagingConfigurations.workspaceId, workspaceId))
          .orderBy(desc(messagingConfigurations.createdAt));
      } else {
        return await db.select().from(messagingConfigurations)
          .where(isNull(messagingConfigurations.workspaceId))
          .orderBy(desc(messagingConfigurations.createdAt));
      }
    } catch (error) {
      console.error("Error getting messaging configurations:", error);
      throw new Error("Failed to retrieve messaging configurations");
    }
  }

  /**
   * Get a specific messaging configuration
   * @param id Configuration ID
   * @returns Messaging configuration
   */
  async getMessagingConfiguration(id: number): Promise<MessagingConfiguration | undefined> {
    try {
      const configs = await db.select().from(messagingConfigurations)
        .where(eq(messagingConfigurations.id, id));
      
      return configs[0];
    } catch (error) {
      console.error(`Error getting messaging configuration ${id}:`, error);
      throw new Error("Failed to retrieve messaging configuration");
    }
  }

  /**
   * Get default messaging configuration for a platform
   * @param platform Platform type
   * @param workspaceId Optional workspace filter
   * @returns Default messaging configuration
   */
  async getDefaultMessagingConfiguration(
    platform: string,
    workspaceId?: number
  ): Promise<MessagingConfiguration | undefined> {
    try {
      let query = db.select().from(messagingConfigurations)
        .where(
          and(
            eq(messagingConfigurations.platform, platform),
            eq(messagingConfigurations.isDefault, true)
          )
        );
      
      if (workspaceId) {
        query = query.where(eq(messagingConfigurations.workspaceId, workspaceId));
      } else {
        query = query.where(isNull(messagingConfigurations.workspaceId));
      }
      
      const configs = await query;
      return configs[0];
    } catch (error) {
      console.error(`Error getting default ${platform} configuration:`, error);
      throw new Error(`Failed to retrieve default ${platform} configuration`);
    }
  }

  /**
   * Create a new messaging configuration
   * @param data Messaging configuration data
   * @returns Created configuration
   */
  async createMessagingConfiguration(data: any): Promise<MessagingConfiguration> {
    try {
      // Prepare data and check if we need to set this as default
      let isDefault = data.isDefault;
      
      // If setting as default, unset any existing defaults
      if (isDefault) {
        await db.update(messagingConfigurations)
          .set({ isDefault: false })
          .where(
            and(
              eq(messagingConfigurations.platform, data.platform),
              eq(messagingConfigurations.isDefault, true),
              data.workspaceId 
                ? eq(messagingConfigurations.workspaceId, data.workspaceId)
                : isNull(messagingConfigurations.workspaceId)
            )
          );
      }
      
      const [result] = await db.insert(messagingConfigurations)
        .values({
          ...data,
          isDefault,
          createdBy: this.req?.user?.id,
          updatedBy: this.req?.user?.id
        })
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "create",
          resourceType: "messagingConfiguration",
          resourceId: result.id,
          userId: this.req.user?.id,
          metadata: {
            platform: data.platform,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error("Error creating messaging configuration:", error);
      throw new Error("Failed to create messaging configuration");
    }
  }

  /**
   * Update a messaging configuration
   * @param id Configuration ID
   * @param data Updated data
   * @returns Updated configuration
   */
  async updateMessagingConfiguration(id: number, data: any): Promise<MessagingConfiguration> {
    try {
      // Check if we need to set this as default
      let isDefault = data.isDefault;
      
      // If setting as default, unset any existing defaults
      if (isDefault) {
        const config = await this.getMessagingConfiguration(id);
        if (config) {
          await db.update(messagingConfigurations)
            .set({ isDefault: false })
            .where(
              and(
                eq(messagingConfigurations.platform, config.platform),
                eq(messagingConfigurations.isDefault, true),
                eq(messagingConfigurations.id, sql`${id} != id`),
                config.workspaceId 
                  ? eq(messagingConfigurations.workspaceId, config.workspaceId)
                  : isNull(messagingConfigurations.workspaceId)
              )
            );
        }
      }
      
      const [result] = await db.update(messagingConfigurations)
        .set({
          ...data,
          isDefault,
          updatedAt: new Date(),
          updatedBy: this.req?.user?.id
        })
        .where(eq(messagingConfigurations.id, id))
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "update",
          resourceType: "messagingConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            platform: data.platform,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error(`Error updating messaging configuration ${id}:`, error);
      throw new Error("Failed to update messaging configuration");
    }
  }

  /**
   * Delete a messaging configuration
   * @param id Configuration ID
   * @returns Deleted configuration
   */
  async deleteMessagingConfiguration(id: number): Promise<{ success: boolean }> {
    try {
      const config = await this.getMessagingConfiguration(id);
      if (!config) {
        throw new Error("Messaging configuration not found");
      }
      
      await db.delete(messagingConfigurations)
        .where(eq(messagingConfigurations.id, id));
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "delete",
          resourceType: "messagingConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            platform: config.platform,
            name: config.name
          }
        }, this.req);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error deleting messaging configuration ${id}:`, error);
      throw new Error("Failed to delete messaging configuration");
    }
  }

  /**
   * Test a messaging configuration
   * @param id Configuration ID
   * @param data Test message data
   * @returns Test result
   */
  async testMessagingConfiguration(id: number, data: z.infer<typeof testMessageSchema>): Promise<{ success: boolean, messageId?: string }> {
    try {
      const config = await this.getMessagingConfiguration(id);
      if (!config) {
        throw new Error("Messaging configuration not found");
      }
      
      const { recipient, content } = data;
      
      let result: { success: boolean, messageId?: string };
      
      // Test the configuration based on platform
      switch (config.platform) {
        case MessagePlatform.SLACK:
          result = await this.testSlackConfiguration(config, { recipient, content });
          break;
        case MessagePlatform.MS_TEAMS:
          result = await this.testMsTeamsConfiguration(config, { recipient, content });
          break;
        case MessagePlatform.WEBHOOK:
          result = await this.testWebhookConfiguration(config, { recipient, content });
          break;
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
      
      // Update the configuration status
      await db.update(messagingConfigurations)
        .set({
          status: result.success ? 'healthy' : 'failed',
          statusMessage: result.success ? 'Test successful' : 'Test failed',
          lastTested: new Date(),
          updatedAt: new Date(),
          updatedBy: this.req?.user?.id
        })
        .where(eq(messagingConfigurations.id, id));
      
      // Log the test
      await db.insert(messageDeliveryLogs)
        .values({
          platform: config.platform,
          recipient,
          messageContent: content,
          status: result.success ? MessageStatus.DELIVERED : MessageStatus.FAILED,
          configId: id,
          messageId: result.messageId,
          sentAt: new Date(),
          deliveredAt: result.success ? new Date() : undefined,
          failureReason: result.success ? undefined : 'Test failed',
          workspaceId: config.workspaceId,
          createdBy: this.req?.user?.id
        });
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "test",
          resourceType: "messagingConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            platform: config.platform,
            success: result.success
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error(`Error testing messaging configuration ${id}:`, error);
      throw new Error("Failed to test messaging configuration");
    }
  }

  /**
   * Test a Slack configuration
   * @param config Slack configuration
   * @param data Test data
   * @returns Test result
   */
  private async testSlackConfiguration(
    config: MessagingConfiguration,
    data: { recipient: string, content: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary secrets
      if (!config.botToken) {
        return { success: false };
      }
      
      // Initialize Slack client
      const slackClient = new WebClient(config.botToken);
      
      // Send a test message
      const response = await slackClient.chat.postMessage({
        channel: data.recipient,
        text: data.content
      });
      
      return {
        success: response.ok === true,
        messageId: response.ts as string
      };
    } catch (error) {
      console.error("Slack test error:", error);
      return { success: false };
    }
  }

  /**
   * Test a Microsoft Teams configuration
   * @param config Teams configuration
   * @param data Test data
   * @returns Test result
   */
  private async testMsTeamsConfiguration(
    config: MessagingConfiguration,
    data: { recipient: string, content: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary configuration
      if (!config.webhookUrl) {
        return { success: false };
      }
      
      // Create a simple card
      const card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": "Test Message",
        "sections": [{
          "activityTitle": "Test Message",
          "activitySubtitle": "From NexusMCP",
          "text": data.content
        }]
      };
      
      // Send a test message
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(card)
      });
      
      return {
        success: response.ok,
        messageId: undefined // Teams doesn't return a message ID
      };
    } catch (error) {
      console.error("MS Teams test error:", error);
      return { success: false };
    }
  }

  /**
   * Test a webhook configuration
   * @param config Webhook configuration
   * @param data Test data
   * @returns Test result
   */
  private async testWebhookConfiguration(
    config: MessagingConfiguration,
    data: { recipient: string, content: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary configuration
      if (!config.webhookUrl) {
        return { success: false };
      }
      
      // Create a simple payload
      const payload = {
        text: data.content,
        recipient: data.recipient,
        timestamp: new Date().toISOString(),
        source: "NexusMCP"
      };
      
      // Send a test message
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      return {
        success: response.ok,
        messageId: undefined
      };
    } catch (error) {
      console.error("Webhook test error:", error);
      return { success: false };
    }
  }

  // SMS PROVIDER METHODS

  /**
   * Get all SMS configurations
   * @param workspaceId Optional workspace filter
   * @returns List of SMS configurations
   */
  async getSmsConfigurations(workspaceId?: number): Promise<SmsConfiguration[]> {
    try {
      if (workspaceId) {
        return await db.select().from(smsConfigurations)
          .where(eq(smsConfigurations.workspaceId, workspaceId))
          .orderBy(desc(smsConfigurations.createdAt));
      } else {
        return await db.select().from(smsConfigurations)
          .where(isNull(smsConfigurations.workspaceId))
          .orderBy(desc(smsConfigurations.createdAt));
      }
    } catch (error) {
      console.error("Error getting SMS configurations:", error);
      throw new Error("Failed to retrieve SMS configurations");
    }
  }

  /**
   * Get a specific SMS configuration
   * @param id Configuration ID
   * @returns SMS configuration
   */
  async getSmsConfiguration(id: number): Promise<SmsConfiguration | undefined> {
    try {
      const configs = await db.select().from(smsConfigurations)
        .where(eq(smsConfigurations.id, id));
      
      return configs[0];
    } catch (error) {
      console.error(`Error getting SMS configuration ${id}:`, error);
      throw new Error("Failed to retrieve SMS configuration");
    }
  }

  /**
   * Get default SMS configuration for a provider
   * @param provider Provider type
   * @param workspaceId Optional workspace filter
   * @returns Default SMS configuration
   */
  async getDefaultSmsConfiguration(
    provider: string,
    workspaceId?: number
  ): Promise<SmsConfiguration | undefined> {
    try {
      let query = db.select().from(smsConfigurations)
        .where(
          and(
            eq(smsConfigurations.provider, provider),
            eq(smsConfigurations.isDefault, true)
          )
        );
      
      if (workspaceId) {
        query = query.where(eq(smsConfigurations.workspaceId, workspaceId));
      } else {
        query = query.where(isNull(smsConfigurations.workspaceId));
      }
      
      const configs = await query;
      return configs[0];
    } catch (error) {
      console.error(`Error getting default ${provider} configuration:`, error);
      throw new Error(`Failed to retrieve default ${provider} configuration`);
    }
  }

  /**
   * Create a new SMS configuration
   * @param data SMS configuration data
   * @returns Created configuration
   */
  async createSmsConfiguration(data: any): Promise<SmsConfiguration> {
    try {
      // Prepare data and check if we need to set this as default
      let isDefault = data.isDefault;
      
      // If setting as default, unset any existing defaults
      if (isDefault) {
        await db.update(smsConfigurations)
          .set({ isDefault: false })
          .where(
            and(
              eq(smsConfigurations.provider, data.provider),
              eq(smsConfigurations.isDefault, true),
              data.workspaceId 
                ? eq(smsConfigurations.workspaceId, data.workspaceId)
                : isNull(smsConfigurations.workspaceId)
            )
          );
      }
      
      const [result] = await db.insert(smsConfigurations)
        .values({
          ...data,
          isDefault,
          createdBy: this.req?.user?.id,
          updatedBy: this.req?.user?.id
        })
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "create",
          resourceType: "smsConfiguration",
          resourceId: result.id,
          userId: this.req.user?.id,
          metadata: {
            provider: data.provider,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error("Error creating SMS configuration:", error);
      throw new Error("Failed to create SMS configuration");
    }
  }

  /**
   * Update an SMS configuration
   * @param id Configuration ID
   * @param data Updated data
   * @returns Updated configuration
   */
  async updateSmsConfiguration(id: number, data: any): Promise<SmsConfiguration> {
    try {
      // Check if we need to set this as default
      let isDefault = data.isDefault;
      
      // If setting as default, unset any existing defaults
      if (isDefault) {
        const config = await this.getSmsConfiguration(id);
        if (config) {
          await db.update(smsConfigurations)
            .set({ isDefault: false })
            .where(
              and(
                eq(smsConfigurations.provider, config.provider),
                eq(smsConfigurations.isDefault, true),
                eq(smsConfigurations.id, sql`${id} != id`),
                config.workspaceId 
                  ? eq(smsConfigurations.workspaceId, config.workspaceId)
                  : isNull(smsConfigurations.workspaceId)
              )
            );
        }
      }
      
      const [result] = await db.update(smsConfigurations)
        .set({
          ...data,
          isDefault,
          updatedAt: new Date(),
          updatedBy: this.req?.user?.id
        })
        .where(eq(smsConfigurations.id, id))
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "update",
          resourceType: "smsConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            provider: data.provider,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error(`Error updating SMS configuration ${id}:`, error);
      throw new Error("Failed to update SMS configuration");
    }
  }

  /**
   * Delete an SMS configuration
   * @param id Configuration ID
   * @returns Delete result
   */
  async deleteSmsConfiguration(id: number): Promise<{ success: boolean }> {
    try {
      const config = await this.getSmsConfiguration(id);
      if (!config) {
        throw new Error("SMS configuration not found");
      }
      
      await db.delete(smsConfigurations)
        .where(eq(smsConfigurations.id, id));
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "delete",
          resourceType: "smsConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            provider: config.provider,
            name: config.name
          }
        }, this.req);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error deleting SMS configuration ${id}:`, error);
      throw new Error("Failed to delete SMS configuration");
    }
  }

  /**
   * Test an SMS configuration
   * @param id Configuration ID
   * @param data Test SMS data
   * @returns Test result
   */
  async testSmsConfiguration(id: number, data: z.infer<typeof testSmsSchema>): Promise<{ success: boolean, messageId?: string }> {
    try {
      const config = await this.getSmsConfiguration(id);
      if (!config) {
        throw new Error("SMS configuration not found");
      }
      
      const { phoneNumber, message } = data;
      
      let result: { success: boolean, messageId?: string };
      
      // Test the configuration based on provider
      switch (config.provider) {
        case 'twilio':
          result = await this.testTwilioConfiguration(config, { phoneNumber, message });
          break;
        case 'vonage':
          result = await this.testVonageConfiguration(config, { phoneNumber, message });
          break;
        case 'plivo':
          result = await this.testPlivoConfiguration(config, { phoneNumber, message });
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${config.provider}`);
      }
      
      // Update the configuration status
      await db.update(smsConfigurations)
        .set({
          status: result.success ? 'healthy' : 'failed',
          statusMessage: result.success ? 'Test successful' : 'Test failed',
          lastTested: new Date(),
          updatedAt: new Date(),
          updatedBy: this.req?.user?.id
        })
        .where(eq(smsConfigurations.id, id));
      
      // Log the test
      await db.insert(messageDeliveryLogs)
        .values({
          platform: MessagePlatform.SMS,
          recipient: phoneNumber,
          messageContent: message,
          status: result.success ? MessageStatus.DELIVERED : MessageStatus.FAILED,
          configId: id,
          messageId: result.messageId,
          sentAt: new Date(),
          deliveredAt: result.success ? new Date() : undefined,
          failureReason: result.success ? undefined : 'Test failed',
          workspaceId: config.workspaceId,
          createdBy: this.req?.user?.id
        });
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "test",
          resourceType: "smsConfiguration",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            provider: config.provider,
            success: result.success
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error(`Error testing SMS configuration ${id}:`, error);
      throw new Error("Failed to test SMS configuration");
    }
  }

  /**
   * Test a Twilio configuration
   * @param config Twilio configuration
   * @param data Test data
   * @returns Test result
   */
  private async testTwilioConfiguration(
    config: SmsConfiguration,
    data: { phoneNumber: string, message: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        return { success: false };
      }
      
      // Check for Twilio credentials
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        // In production, we would use the stored config.accountSid and config.authToken
        // For this demo, we'll simulate a successful response
        console.log("Simulating Twilio SMS to:", data.phoneNumber);
        console.log("Message:", data.message);
        
        return {
          success: true,
          messageId: `twilio-mock-${Date.now()}`
        };
      }
      
      // In a real implementation, we would use the Twilio SDK:
      /*
      const twilio = require('twilio')(config.accountSid, config.authToken);
      const message = await twilio.messages.create({
        body: data.message,
        from: config.fromNumber,
        to: data.phoneNumber
      });
      
      return {
        success: true,
        messageId: message.sid
      };
      */
      
      // For this demo, simulate success
      return {
        success: true,
        messageId: `twilio-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Twilio test error:", error);
      return { success: false };
    }
  }

  /**
   * Test a Vonage configuration
   * @param config Vonage configuration
   * @param data Test data
   * @returns Test result
   */
  private async testVonageConfiguration(
    config: SmsConfiguration,
    data: { phoneNumber: string, message: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        return { success: false };
      }
      
      // For this demo, simulate success
      console.log("Simulating Vonage SMS to:", data.phoneNumber);
      console.log("Message:", data.message);
      
      return {
        success: true,
        messageId: `vonage-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Vonage test error:", error);
      return { success: false };
    }
  }

  /**
   * Test a Plivo configuration
   * @param config Plivo configuration
   * @param data Test data
   * @returns Test result
   */
  private async testPlivoConfiguration(
    config: SmsConfiguration,
    data: { phoneNumber: string, message: string }
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        return { success: false };
      }
      
      // For this demo, simulate success
      console.log("Simulating Plivo SMS to:", data.phoneNumber);
      console.log("Message:", data.message);
      
      return {
        success: true,
        messageId: `plivo-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Plivo test error:", error);
      return { success: false };
    }
  }

  // MESSAGE TEMPLATE METHODS

  /**
   * Get all message templates
   * @param platform Optional platform filter
   * @param workspaceId Optional workspace filter
   * @returns List of message templates
   */
  async getMessageTemplates(platform?: string, workspaceId?: number): Promise<MessageTemplate[]> {
    try {
      let query = db.select().from(messageTemplates);
      
      if (platform) {
        query = query.where(
          eq(messageTemplates.platform, platform)
        );
      }
      
      if (workspaceId) {
        query = query.where(
          eq(messageTemplates.workspaceId, workspaceId)
        );
      } else {
        query = query.where(
          isNull(messageTemplates.workspaceId)
        );
      }
      
      return await query.orderBy(desc(messageTemplates.createdAt));
    } catch (error) {
      console.error("Error getting message templates:", error);
      throw new Error("Failed to retrieve message templates");
    }
  }

  /**
   * Get a specific message template
   * @param id Template ID
   * @returns Message template
   */
  async getMessageTemplate(id: number): Promise<MessageTemplate | undefined> {
    try {
      const templates = await db.select().from(messageTemplates)
        .where(eq(messageTemplates.id, id));
      
      return templates[0];
    } catch (error) {
      console.error(`Error getting message template ${id}:`, error);
      throw new Error("Failed to retrieve message template");
    }
  }

  /**
   * Create a new message template
   * @param data Template data
   * @returns Created template
   */
  async createMessageTemplate(data: any): Promise<MessageTemplate> {
    try {
      const [result] = await db.insert(messageTemplates)
        .values({
          ...data,
          createdBy: this.req?.user?.id,
          updatedBy: this.req?.user?.id
        })
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "create",
          resourceType: "messageTemplate",
          resourceId: result.id,
          userId: this.req.user?.id,
          metadata: {
            platform: data.platform,
            type: data.type,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error("Error creating message template:", error);
      throw new Error("Failed to create message template");
    }
  }

  /**
   * Update a message template
   * @param id Template ID
   * @param data Updated data
   * @returns Updated template
   */
  async updateMessageTemplate(id: number, data: any): Promise<MessageTemplate> {
    try {
      const [result] = await db.update(messageTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
          updatedBy: this.req?.user?.id
        })
        .where(eq(messageTemplates.id, id))
        .returning();
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "update",
          resourceType: "messageTemplate",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            platform: data.platform,
            type: data.type,
            name: data.name
          }
        }, this.req);
      }
      
      return result;
    } catch (error) {
      console.error(`Error updating message template ${id}:`, error);
      throw new Error("Failed to update message template");
    }
  }

  /**
   * Delete a message template
   * @param id Template ID
   * @returns Delete result
   */
  async deleteMessageTemplate(id: number): Promise<{ success: boolean }> {
    try {
      const template = await this.getMessageTemplate(id);
      if (!template) {
        throw new Error("Message template not found");
      }
      
      await db.delete(messageTemplates)
        .where(eq(messageTemplates.id, id));
      
      // Create audit log
      if (this.req) {
        await enhancedAuditService.createAuditLog({
          action: "delete",
          resourceType: "messageTemplate",
          resourceId: id,
          userId: this.req.user?.id,
          metadata: {
            platform: template.platform,
            type: template.type,
            name: template.name
          }
        }, this.req);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error deleting message template ${id}:`, error);
      throw new Error("Failed to delete message template");
    }
  }

  /**
   * Get delivery logs
   * @param limit Maximum number of logs to retrieve
   * @param offset Pagination offset
   * @returns List of delivery logs
   */
  async getDeliveryLogs(limit: number = 50, offset: number = 0): Promise<MessageDeliveryLog[]> {
    try {
      return await db.select().from(messageDeliveryLogs)
        .orderBy(desc(messageDeliveryLogs.sentAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error("Error getting delivery logs:", error);
      throw new Error("Failed to retrieve delivery logs");
    }
  }

  // SLACK INTEGRATION METHODS

  /**
   * Send a message to Slack
   * @param configId Configuration ID
   * @param payload Message payload
   * @returns Send result
   */
  async sendSlackMessage(
    configId: number,
    payload: MessagePayload
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const config = await this.getMessagingConfiguration(configId);
      if (!config || config.platform !== MessagePlatform.SLACK) {
        throw new Error("Invalid Slack configuration");
      }
      
      // Get or initialize Slack client
      let slackClient = this.slackClients.get(configId);
      if (!slackClient) {
        if (!config.botToken) {
          throw new Error("Missing Slack bot token");
        }
        slackClient = new WebClient(config.botToken);
        this.slackClients.set(configId, slackClient);
      }
      
      // Prepare message
      const message: ChatPostMessageArguments = {
        channel: payload.recipient,
        text: payload.content
      };
      
      // Handle blocks if present
      if (payload.blocks) {
        message.blocks = payload.blocks;
      }
      
      // Send message
      const response = await slackClient.chat.postMessage(message);
      
      // Log delivery
      await this.logMessageDelivery({
        platform: MessagePlatform.SLACK,
        recipient: payload.recipient,
        messageContent: payload.content,
        status: response.ok ? MessageStatus.DELIVERED : MessageStatus.FAILED,
        configId,
        messageId: response.ts as string | undefined,
        workspaceId: config.workspaceId
      });
      
      return {
        success: response.ok === true,
        messageId: response.ts as string
      };
    } catch (error) {
      console.error("Error sending Slack message:", error);
      
      // Log delivery failure
      await this.logMessageDelivery({
        platform: MessagePlatform.SLACK,
        recipient: payload.recipient,
        messageContent: payload.content,
        status: MessageStatus.FAILED,
        configId,
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error("Failed to send Slack message");
    }
  }

  /**
   * Send a template-based message to Slack
   * @param configId Configuration ID
   * @param payload Template message payload
   * @returns Send result
   */
  async sendSlackTemplateMessage(
    configId: number,
    payload: TemplateMessagePayload
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const template = await this.getMessageTemplate(payload.templateId);
      if (!template) {
        throw new Error("Message template not found");
      }
      
      // Render the message with variables
      const content = this.renderTemplate(template.content, payload.variables || {});
      
      // Prepare blocks if available
      let blocks = undefined;
      if (template.blocks) {
        blocks = this.renderBlocks(template.blocks, payload.variables || {});
      }
      
      // Send the message
      return await this.sendSlackMessage(configId, {
        content,
        recipient: payload.recipient,
        blocks
      });
    } catch (error) {
      console.error("Error sending Slack template message:", error);
      throw new Error("Failed to send Slack template message");
    }
  }

  // MS TEAMS INTEGRATION METHODS

  /**
   * Send a message to Microsoft Teams
   * @param configId Configuration ID
   * @param payload Message payload
   * @returns Send result
   */
  async sendMsTeamsMessage(
    configId: number,
    payload: MessagePayload
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const config = await this.getMessagingConfiguration(configId);
      if (!config || config.platform !== MessagePlatform.MS_TEAMS) {
        throw new Error("Invalid MS Teams configuration");
      }
      
      if (!config.webhookUrl) {
        throw new Error("Missing Teams webhook URL");
      }
      
      // Create card
      let card;
      if (payload.blocks) {
        card = payload.blocks;
      } else {
        // Create a simple card
        card = {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          "themeColor": "0076D7",
          "summary": payload.subject || "Message from NexusMCP",
          "sections": [{
            "activityTitle": payload.subject || "Message from NexusMCP",
            "text": payload.content
          }]
        };
      }
      
      // Send message
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(card)
      });
      
      // Log delivery
      await this.logMessageDelivery({
        platform: MessagePlatform.MS_TEAMS,
        recipient: payload.recipient,
        subject: payload.subject,
        messageContent: payload.content,
        status: response.ok ? MessageStatus.DELIVERED : MessageStatus.FAILED,
        configId,
        workspaceId: config.workspaceId
      });
      
      return {
        success: response.ok
      };
    } catch (error) {
      console.error("Error sending MS Teams message:", error);
      
      // Log delivery failure
      await this.logMessageDelivery({
        platform: MessagePlatform.MS_TEAMS,
        recipient: payload.recipient,
        subject: payload.subject,
        messageContent: payload.content,
        status: MessageStatus.FAILED,
        configId,
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error("Failed to send MS Teams message");
    }
  }

  /**
   * Send a template-based message to MS Teams
   * @param configId Configuration ID
   * @param payload Template message payload
   * @returns Send result
   */
  async sendMsTeamsTemplateMessage(
    configId: number,
    payload: TemplateMessagePayload
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const template = await this.getMessageTemplate(payload.templateId);
      if (!template) {
        throw new Error("Message template not found");
      }
      
      // Render the message with variables
      const content = this.renderTemplate(template.content, payload.variables || {});
      
      // Prepare blocks if available
      let blocks = undefined;
      if (template.blocks) {
        blocks = this.renderBlocks(template.blocks, payload.variables || {});
      }
      
      // Send the message
      return await this.sendMsTeamsMessage(configId, {
        content,
        recipient: payload.recipient,
        blocks
      });
    } catch (error) {
      console.error("Error sending MS Teams template message:", error);
      throw new Error("Failed to send MS Teams template message");
    }
  }

  // SMS METHODS

  /**
   * Send an SMS message
   * @param configId Configuration ID
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @returns Send result
   */
  async sendSms(
    configId: number,
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const config = await this.getSmsConfiguration(configId);
      if (!config) {
        throw new Error("SMS configuration not found");
      }
      
      let result: { success: boolean, messageId?: string };
      
      // Send SMS based on provider
      switch (config.provider) {
        case 'twilio':
          result = await this.sendTwilioSms(config, phoneNumber, message);
          break;
        case 'vonage':
          result = await this.sendVonageSms(config, phoneNumber, message);
          break;
        case 'plivo':
          result = await this.sendPlivoSms(config, phoneNumber, message);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${config.provider}`);
      }
      
      // Log delivery
      await this.logMessageDelivery({
        platform: MessagePlatform.SMS,
        recipient: phoneNumber,
        messageContent: message,
        status: result.success ? MessageStatus.DELIVERED : MessageStatus.FAILED,
        configId,
        messageId: result.messageId,
        workspaceId: config.workspaceId
      });
      
      return result;
    } catch (error) {
      console.error("Error sending SMS:", error);
      
      // Log delivery failure
      await this.logMessageDelivery({
        platform: MessagePlatform.SMS,
        recipient: phoneNumber,
        messageContent: message,
        status: MessageStatus.FAILED,
        configId,
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error("Failed to send SMS");
    }
  }

  /**
   * Send a template-based SMS
   * @param configId Configuration ID
   * @param templateId Template ID
   * @param phoneNumber Recipient phone number
   * @param variables Template variables
   * @returns Send result
   */
  async sendSmsTemplate(
    configId: number,
    templateId: number,
    phoneNumber: string,
    variables: MessageVariables
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      const template = await this.getMessageTemplate(templateId);
      if (!template) {
        throw new Error("Message template not found");
      }
      
      // Render the message with variables
      const message = this.renderTemplate(template.content, variables);
      
      // Send the SMS
      return await this.sendSms(configId, phoneNumber, message);
    } catch (error) {
      console.error("Error sending SMS template:", error);
      throw new Error("Failed to send SMS template");
    }
  }

  /**
   * Send an SMS via Twilio
   * @param config Twilio configuration
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @returns Send result
   */
  private async sendTwilioSms(
    config: SmsConfiguration,
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        throw new Error("Missing Twilio credentials");
      }
      
      // Check for Twilio credentials
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        // In production, we would use the stored config.accountSid and config.authToken
        // For this demo, we'll simulate a successful response
        console.log("Simulating Twilio SMS to:", phoneNumber);
        console.log("Message:", message);
        
        return {
          success: true,
          messageId: `twilio-mock-${Date.now()}`
        };
      }
      
      // In a real implementation, we would use the Twilio SDK:
      /*
      const twilio = require('twilio')(config.accountSid, config.authToken);
      const twilioMessage = await twilio.messages.create({
        body: message,
        from: config.fromNumber,
        to: phoneNumber
      });
      
      return {
        success: true,
        messageId: twilioMessage.sid
      };
      */
      
      // For this demo, simulate success
      return {
        success: true,
        messageId: `twilio-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Twilio SMS error:", error);
      return { success: false };
    }
  }

  /**
   * Send an SMS via Vonage
   * @param config Vonage configuration
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @returns Send result
   */
  private async sendVonageSms(
    config: SmsConfiguration,
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        throw new Error("Missing Vonage credentials");
      }
      
      // Simulate success for demo
      console.log("Simulating Vonage SMS to:", phoneNumber);
      console.log("Message:", message);
      
      return {
        success: true,
        messageId: `vonage-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Vonage SMS error:", error);
      return { success: false };
    }
  }

  /**
   * Send an SMS via Plivo
   * @param config Plivo configuration
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @returns Send result
   */
  private async sendPlivoSms(
    config: SmsConfiguration,
    phoneNumber: string,
    message: string
  ): Promise<{ success: boolean, messageId?: string }> {
    try {
      // Check if we have the necessary credentials
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        throw new Error("Missing Plivo credentials");
      }
      
      // Simulate success for demo
      console.log("Simulating Plivo SMS to:", phoneNumber);
      console.log("Message:", message);
      
      return {
        success: true,
        messageId: `plivo-mock-${Date.now()}`
      };
    } catch (error) {
      console.error("Plivo SMS error:", error);
      return { success: false };
    }
  }

  // UTILITY METHODS

  /**
   * Log a message delivery
   * @param data Delivery log data
   */
  private async logMessageDelivery(data: Partial<MessageDeliveryLog>): Promise<void> {
    try {
      await db.insert(messageDeliveryLogs)
        .values({
          platform: data.platform!,
          recipient: data.recipient!,
          subject: data.subject,
          messageContent: data.messageContent,
          status: data.status!,
          configId: data.configId,
          templateId: data.templateId,
          messageId: data.messageId,
          sentAt: new Date(),
          deliveredAt: data.status === MessageStatus.DELIVERED ? new Date() : undefined,
          failureReason: data.failureReason,
          metadata: data.metadata,
          workspaceId: data.workspaceId,
          createdBy: this.req?.user?.id
        });
    } catch (error) {
      console.error("Error logging message delivery:", error);
    }
  }

  /**
   * Render a template with variables
   * @param template Template string with {{variable}} placeholders
   * @param variables Variables to insert
   * @returns Rendered template
   */
  private renderTemplate(template: string, variables: MessageVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }

  /**
   * Render blocks with variables
   * @param blocks Template blocks
   * @param variables Variables to insert
   * @returns Rendered blocks
   */
  private renderBlocks(blocks: any, variables: MessageVariables): any {
    if (typeof blocks === 'string') {
      return this.renderTemplate(blocks, variables);
    } else if (Array.isArray(blocks)) {
      return blocks.map(block => this.renderBlocks(block, variables));
    } else if (blocks !== null && typeof blocks === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(blocks)) {
        result[key] = this.renderBlocks(value, variables);
      }
      return result;
    } else {
      return blocks;
    }
  }
}