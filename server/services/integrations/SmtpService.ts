import { db } from '@db';
import { eq, desc, and } from 'drizzle-orm';
import { 
  smtpConfigurations, 
  emailTemplates, 
  emailLogs,
  SmtpConfiguration,
  EmailTemplate,
  EmailLog,
  SmtpConfigurationInsert,
  EmailTemplateInsert,
  TestEmail
} from '@shared/schema_smtp';
import * as nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';
import { eventBus, EventType } from '../../eventBus';
import { Request } from 'express';
import { enhancedAuditService } from '../enhancedAuditService';

/**
 * SMTP Service
 * Manages SMTP configurations, email templates, and email delivery
 */
export class SmtpService {
  /**
   * Get all SMTP configurations
   */
  async getAllSmtpConfigurations(workspaceId?: number): Promise<SmtpConfiguration[]> {
    try {
      let query = db.select().from(smtpConfigurations);
      
      if (workspaceId) {
        query = query.where(eq(smtpConfigurations.workspaceId, workspaceId));
      }
      
      return await query.orderBy(desc(smtpConfigurations.isDefault), desc(smtpConfigurations.updatedAt));
    } catch (error) {
      logger.error('Error fetching SMTP configurations:', error);
      throw new Error('Failed to fetch SMTP configurations');
    }
  }

  /**
   * Get SMTP configuration by ID
   */
  async getSmtpConfigurationById(id: number): Promise<SmtpConfiguration | undefined> {
    try {
      const configs = await db.select().from(smtpConfigurations).where(eq(smtpConfigurations.id, id)).limit(1);
      return configs.length ? configs[0] : undefined;
    } catch (error) {
      logger.error(`Error fetching SMTP configuration with ID ${id}:`, error);
      throw new Error('Failed to fetch SMTP configuration');
    }
  }

  /**
   * Create a new SMTP configuration
   */
  async createSmtpConfiguration(
    data: SmtpConfigurationInsert, 
    userId: number, 
    req?: Request
  ): Promise<SmtpConfiguration> {
    try {
      // Handle default SMTP configuration logic
      if (data.isDefault) {
        await this.clearDefaultSmtpConfiguration(data.workspaceId);
      }

      // Insert new configuration
      const [newConfig] = await db.insert(smtpConfigurations).values({
        ...data,
        createdBy: userId,
        updatedBy: userId
      }).returning();

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'CREATE',
          resource: 'SMTP_CONFIGURATION',
          resourceId: newConfig.id.toString(),
          metadata: {
            name: newConfig.name,
            provider: newConfig.provider,
            isDefault: newConfig.isDefault
          },
          request: req
        });
      }

      // Emit event
      eventBus.emit('system.config.changed' as EventType, {
        type: 'SMTP_CONFIGURATION',
        action: 'CREATED',
        id: newConfig.id
      });

      return newConfig;
    } catch (error) {
      logger.error('Error creating SMTP configuration:', error);
      throw new Error('Failed to create SMTP configuration');
    }
  }

  /**
   * Update an existing SMTP configuration
   */
  async updateSmtpConfiguration(
    id: number, 
    data: Partial<SmtpConfigurationInsert>, 
    userId: number, 
    req?: Request
  ): Promise<SmtpConfiguration> {
    try {
      // Handle default SMTP configuration logic
      if (data.isDefault) {
        await this.clearDefaultSmtpConfiguration(data.workspaceId);
      }

      // Update configuration
      const [updatedConfig] = await db.update(smtpConfigurations)
        .set({
          ...data,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(smtpConfigurations.id, id))
        .returning();

      if (!updatedConfig) {
        throw new Error(`SMTP configuration with ID ${id} not found`);
      }

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'UPDATE',
          resource: 'SMTP_CONFIGURATION',
          resourceId: id.toString(),
          metadata: {
            name: updatedConfig.name,
            provider: updatedConfig.provider,
            isDefault: updatedConfig.isDefault
          },
          request: req
        });
      }

      // Emit event
      eventBus.emit('system.config.changed' as EventType, {
        type: 'SMTP_CONFIGURATION',
        action: 'UPDATED',
        id: updatedConfig.id
      });

      return updatedConfig;
    } catch (error) {
      logger.error(`Error updating SMTP configuration with ID ${id}:`, error);
      throw new Error('Failed to update SMTP configuration');
    }
  }

  /**
   * Delete an SMTP configuration
   */
  async deleteSmtpConfiguration(
    id: number, 
    userId: number, 
    req?: Request
  ): Promise<void> {
    try {
      const config = await this.getSmtpConfigurationById(id);
      
      if (!config) {
        throw new Error(`SMTP configuration with ID ${id} not found`);
      }

      // Check if this is the default configuration
      if (config.isDefault) {
        throw new Error('Cannot delete the default SMTP configuration');
      }

      // Delete the configuration
      await db.delete(smtpConfigurations).where(eq(smtpConfigurations.id, id));

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'DELETE',
          resource: 'SMTP_CONFIGURATION',
          resourceId: id.toString(),
          metadata: {
            name: config.name,
            provider: config.provider
          },
          request: req
        });
      }

      // Emit event
      eventBus.emit('system.config.changed' as EventType, {
        type: 'SMTP_CONFIGURATION',
        action: 'DELETED',
        id
      });
    } catch (error) {
      logger.error(`Error deleting SMTP configuration with ID ${id}:`, error);
      throw new Error('Failed to delete SMTP configuration');
    }
  }

  /**
   * Set an SMTP configuration as default
   */
  async setDefaultSmtpConfiguration(
    id: number, 
    userId: number, 
    workspaceId?: number,
    req?: Request
  ): Promise<SmtpConfiguration> {
    try {
      // Clear current default
      await this.clearDefaultSmtpConfiguration(workspaceId);
      
      // Set new default
      const [updatedConfig] = await db.update(smtpConfigurations)
        .set({
          isDefault: true,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(smtpConfigurations.id, id))
        .returning();

      if (!updatedConfig) {
        throw new Error(`SMTP configuration with ID ${id} not found`);
      }

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'UPDATE',
          resource: 'SMTP_CONFIGURATION',
          resourceId: id.toString(),
          metadata: {
            name: updatedConfig.name,
            action: 'SET_DEFAULT'
          },
          request: req
        });
      }

      return updatedConfig;
    } catch (error) {
      logger.error(`Error setting SMTP configuration ${id} as default:`, error);
      throw new Error('Failed to set default SMTP configuration');
    }
  }

  /**
   * Clear default SMTP configuration flag
   */
  private async clearDefaultSmtpConfiguration(workspaceId?: number): Promise<void> {
    try {
      let query = db.update(smtpConfigurations)
        .set({
          isDefault: false,
          updatedAt: new Date()
        });
      
      if (workspaceId) {
        query = query.where(eq(smtpConfigurations.workspaceId, workspaceId));
      } else {
        query = query.where(eq(smtpConfigurations.isDefault, true));
      }
      
      await query;
    } catch (error) {
      logger.error('Error clearing default SMTP configuration:', error);
      throw new Error('Failed to clear default SMTP configuration');
    }
  }

  /**
   * Test SMTP configuration connection
   */
  async testSmtpConnection(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getSmtpConfigurationById(id);
      
      if (!config) {
        throw new Error(`SMTP configuration with ID ${id} not found`);
      }

      // Create nodemailer transport
      const transporter = this.createTransporter(config);
      
      // Verify connection
      await transporter.verify();
      
      // Update status
      await db.update(smtpConfigurations)
        .set({
          status: 'healthy',
          statusMessage: 'Connection test successful',
          lastTested: new Date()
        })
        .where(eq(smtpConfigurations.id, id));
      
      return {
        success: true,
        message: 'SMTP connection test successful'
      };
    } catch (error) {
      // Update status to failed
      await db.update(smtpConfigurations)
        .set({
          status: 'failed',
          statusMessage: error.message || 'Unknown error',
          lastTested: new Date()
        })
        .where(eq(smtpConfigurations.id, id));
      
      logger.error(`SMTP connection test failed for configuration ${id}:`, error);
      
      return {
        success: false,
        message: `Connection failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Send a test email
   */
  async sendTestEmail(
    data: TestEmail,
    userId: number,
    req?: Request
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getSmtpConfigurationById(data.smtpConfigId);
      
      if (!config) {
        throw new Error(`SMTP configuration with ID ${data.smtpConfigId} not found`);
      }

      // Create transport
      const transporter = this.createTransporter(config);
      
      // Set up email options
      const mailOptions = {
        from: config.senderEmail 
          ? `${config.senderName || 'NexusMCP System'} <${config.senderEmail}>`
          : `${config.senderName || 'NexusMCP System'} <noreply@example.com>`,
        to: data.recipient,
        subject: data.subject,
        text: data.message,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${data.message.replace(/\n/g, '<br>')}</div>`,
        replyTo: config.replyToEmail
      };
      
      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      // Log the email
      const [emailLog] = await db.insert(emailLogs).values({
        recipient: data.recipient,
        subject: data.subject,
        status: 'delivered',
        smtpConfigId: data.smtpConfigId,
        messageId: info.messageId,
        sentAt: new Date(),
        deliveredAt: new Date(),
        createdBy: userId,
        metadata: {
          test: true
        }
      }).returning();
      
      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'EMAIL_SENT',
          resource: 'TEST_EMAIL',
          resourceId: emailLog.id.toString(),
          metadata: {
            recipient: data.recipient,
            subject: data.subject,
            smtpConfig: config.name
          },
          request: req
        });
      }
      
      // Update SMTP config status
      await db.update(smtpConfigurations)
        .set({
          status: 'healthy',
          statusMessage: 'Test email sent successfully',
          lastTested: new Date()
        })
        .where(eq(smtpConfigurations.id, data.smtpConfigId));
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error(`Failed to send test email:`, error);
      
      // Update SMTP config status
      await db.update(smtpConfigurations)
        .set({
          status: 'failed',
          statusMessage: error.message || 'Unknown error',
          lastTested: new Date()
        })
        .where(eq(smtpConfigurations.id, data.smtpConfigId));
      
      return {
        success: false,
        error: error.message || 'Failed to send test email'
      };
    }
  }

  /**
   * Create a nodemailer transport from an SMTP configuration
   */
  private createTransporter(config: SmtpConfiguration): nodemailer.Transporter {
    try {
      // Handle special providers
      if (config.provider === 'sendgrid') {
        return nodemailer.createTransport({
          host: config.hostname || 'smtp.sendgrid.net',
          port: config.port || 587,
          secure: config.port === 465,
          auth: {
            user: config.username || 'apikey',
            pass: config.password || config.apiKey
          },
          connectionTimeout: (config.connectionTimeout || 30) * 1000
        });
      }
      
      // Default configuration
      return nodemailer.createTransport({
        host: config.hostname,
        port: config.port,
        secure: config.port === 465,
        auth: config.authType !== 'none' ? {
          user: config.username,
          pass: config.password || config.apiKey
        } : undefined,
        connectionTimeout: (config.connectionTimeout || 30) * 1000
      });
    } catch (error) {
      logger.error('Error creating mail transporter:', error);
      throw new Error('Failed to create mail transporter');
    }
  }

  /**
   * Get all email templates
   */
  async getAllEmailTemplates(workspaceId?: number): Promise<EmailTemplate[]> {
    try {
      let query = db.select().from(emailTemplates);
      
      if (workspaceId) {
        query = query.where(eq(emailTemplates.workspaceId, workspaceId));
      }
      
      return await query.orderBy(desc(emailTemplates.updatedAt));
    } catch (error) {
      logger.error('Error fetching email templates:', error);
      throw new Error('Failed to fetch email templates');
    }
  }

  /**
   * Get email template by ID
   */
  async getEmailTemplateById(id: number): Promise<EmailTemplate | undefined> {
    try {
      const templates = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
      return templates.length ? templates[0] : undefined;
    } catch (error) {
      logger.error(`Error fetching email template with ID ${id}:`, error);
      throw new Error('Failed to fetch email template');
    }
  }

  /**
   * Create a new email template
   */
  async createEmailTemplate(
    data: EmailTemplateInsert, 
    userId: number, 
    req?: Request
  ): Promise<EmailTemplate> {
    try {
      const [newTemplate] = await db.insert(emailTemplates).values({
        ...data,
        createdBy: userId,
        updatedBy: userId
      }).returning();

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'CREATE',
          resource: 'EMAIL_TEMPLATE',
          resourceId: newTemplate.id.toString(),
          metadata: {
            name: newTemplate.name,
            type: newTemplate.type
          },
          request: req
        });
      }

      return newTemplate;
    } catch (error) {
      logger.error('Error creating email template:', error);
      throw new Error('Failed to create email template');
    }
  }

  /**
   * Update an existing email template
   */
  async updateEmailTemplate(
    id: number, 
    data: Partial<EmailTemplateInsert>, 
    userId: number, 
    req?: Request
  ): Promise<EmailTemplate> {
    try {
      const [updatedTemplate] = await db.update(emailTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(emailTemplates.id, id))
        .returning();

      if (!updatedTemplate) {
        throw new Error(`Email template with ID ${id} not found`);
      }

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'UPDATE',
          resource: 'EMAIL_TEMPLATE',
          resourceId: id.toString(),
          metadata: {
            name: updatedTemplate.name,
            type: updatedTemplate.type
          },
          request: req
        });
      }

      return updatedTemplate;
    } catch (error) {
      logger.error(`Error updating email template with ID ${id}:`, error);
      throw new Error('Failed to update email template');
    }
  }

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(
    id: number, 
    userId: number, 
    req?: Request
  ): Promise<void> {
    try {
      const template = await this.getEmailTemplateById(id);
      
      if (!template) {
        throw new Error(`Email template with ID ${id} not found`);
      }

      // Delete the template
      await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'DELETE',
          resource: 'EMAIL_TEMPLATE',
          resourceId: id.toString(),
          metadata: {
            name: template.name,
            type: template.type
          },
          request: req
        });
      }
    } catch (error) {
      logger.error(`Error deleting email template with ID ${id}:`, error);
      throw new Error('Failed to delete email template');
    }
  }

  /**
   * Get email delivery logs
   */
  async getEmailLogs(
    limit: number = 10, 
    offset: number = 0, 
    filters?: {
      status?: string;
      recipient?: string;
      smtpConfigId?: number;
      templateId?: number;
      workspaceId?: number;
    }
  ): Promise<{ logs: EmailLog[]; total: number }> {
    try {
      // Build query conditions
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(eq(emailLogs.status, filters.status));
      }
      
      if (filters?.recipient) {
        conditions.push(eq(emailLogs.recipient, filters.recipient));
      }
      
      if (filters?.smtpConfigId) {
        conditions.push(eq(emailLogs.smtpConfigId, filters.smtpConfigId));
      }
      
      if (filters?.templateId) {
        conditions.push(eq(emailLogs.templateId, filters.templateId));
      }
      
      if (filters?.workspaceId) {
        conditions.push(eq(emailLogs.workspaceId, filters.workspaceId));
      }
      
      // Query for logs
      let query = db.select().from(emailLogs);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const logs = await query
        .orderBy(desc(emailLogs.sentAt))
        .limit(limit)
        .offset(offset);
      
      // Count total logs
      let countQuery = db.select({ count: db.fn.count() }).from(emailLogs);
      
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      
      const [{ count }] = await countQuery;
      
      return {
        logs,
        total: Number(count) || 0
      };
    } catch (error) {
      logger.error('Error fetching email logs:', error);
      throw new Error('Failed to fetch email logs');
    }
  }

  /**
   * Get email log by ID
   */
  async getEmailLogById(id: number): Promise<EmailLog | undefined> {
    try {
      const logs = await db.select().from(emailLogs).where(eq(emailLogs.id, id)).limit(1);
      return logs.length ? logs[0] : undefined;
    } catch (error) {
      logger.error(`Error fetching email log with ID ${id}:`, error);
      throw new Error('Failed to fetch email log');
    }
  }

  /**
   * Send an email using a template
   */
  async sendTemplatedEmail(
    templateId: number,
    smtpConfigId: number | null,
    recipient: string,
    variables: Record<string, any>,
    userId: number,
    req?: Request
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get the template
      const template = await this.getEmailTemplateById(templateId);
      
      if (!template) {
        throw new Error(`Email template with ID ${templateId} not found`);
      }

      // Get SMTP config (use default if not specified)
      let config: SmtpConfiguration | undefined;
      
      if (smtpConfigId) {
        config = await this.getSmtpConfigurationById(smtpConfigId);
      } else {
        const defaultConfigs = await db.select()
          .from(smtpConfigurations)
          .where(and(
            eq(smtpConfigurations.isDefault, true),
            eq(smtpConfigurations.isActive, true)
          ))
          .limit(1);
        
        config = defaultConfigs.length ? defaultConfigs[0] : undefined;
      }
      
      if (!config) {
        throw new Error('No SMTP configuration available for sending email');
      }

      // Replace variables in template
      const subject = this.replaceVariables(template.subject, variables);
      const htmlBody = this.replaceVariables(template.bodyHtml, variables);
      const textBody = this.replaceVariables(template.bodyText, variables);

      // Create transport
      const transporter = this.createTransporter(config);
      
      // Set up email options
      const mailOptions = {
        from: config.senderEmail 
          ? `${config.senderName || 'NexusMCP System'} <${config.senderEmail}>`
          : `${config.senderName || 'NexusMCP System'} <noreply@example.com>`,
        to: recipient,
        subject: subject,
        text: textBody,
        html: htmlBody,
        replyTo: config.replyToEmail
      };
      
      // Send email
      const info = await transporter.sendMail(mailOptions);
      
      // Log the email
      const [emailLog] = await db.insert(emailLogs).values({
        recipient: recipient,
        subject: subject,
        status: 'delivered',
        smtpConfigId: config.id,
        templateId: template.id,
        messageId: info.messageId,
        sentAt: new Date(),
        deliveredAt: new Date(),
        createdBy: userId,
        metadata: {
          variables
        }
      }).returning();
      
      // Create audit log
      if (req) {
        await enhancedAuditService.createAuditLog({
          userId,
          action: 'EMAIL_SENT',
          resource: 'TEMPLATED_EMAIL',
          resourceId: emailLog.id.toString(),
          metadata: {
            recipient,
            template: template.name,
            smtpConfig: config.name
          },
          request: req
        });
      }
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error(`Failed to send templated email:`, error);
      
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  /**
   * Replace variables in a template string
   */
  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables.hasOwnProperty(trimmedKey) ? variables[trimmedKey] : match;
    });
  }
}

// Export singleton instance
export const smtpService = new SmtpService();