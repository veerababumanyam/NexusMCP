/**
 * Messaging System Migration
 * 
 * This migration adds tables for enterprise messaging functionality:
 * - Messaging platform integrations (Slack, MS Teams)
 * - SMS provider integrations (Twilio, Vonage, Plivo)
 * - Message templates across platforms
 * - Message delivery logging
 */

import { pool } from './index';
import { db } from '../db';
import { 
  messagingConfigurations,
  smsConfigurations,
  messageTemplates,
  messageDeliveryLogs
} from '../shared/schema_messaging';
import { 
  messagingConfigurationsRelations,
  smsConfigurationsRelations,
  messageTemplatesRelations,
  messageDeliveryLogsRelations
} from '../shared/schema_messaging';

/**
 * Run the messaging system migration
 */
export async function runMessagingSystemMigration() {
  console.log('Running messaging system migration...');
  
  try {
    // Create messaging tables
    await createMessagingTables();
    
    // Seed default message templates for common notifications
    await seedDefaultTemplates();
    
    console.log('Messaging system migration completed successfully');
  } catch (error) {
    console.error('Error during messaging system migration:', error);
    throw error;
  }
}

/**
 * Create all messaging tables using SQL
 */
async function createMessagingTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create messaging_configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messaging_configurations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        platform TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        credentials JSONB,
        webhook_url TEXT,
        channel_id TEXT,
        bot_token TEXT,
        additional_config JSONB,
        status TEXT DEFAULT 'unknown',
        status_message TEXT,
        last_tested TIMESTAMP,
        workspace_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER
      );
    `);
    
    // Create sms_configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_configurations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        provider TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        account_sid TEXT,
        auth_token TEXT,
        from_number TEXT,
        additional_config JSONB,
        status TEXT DEFAULT 'unknown',
        status_message TEXT,
        last_tested TIMESTAMP,
        workspace_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER
      );
    `);
    
    // Create message_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        platform TEXT NOT NULL,
        content TEXT NOT NULL,
        format TEXT DEFAULT 'plain',
        variables JSONB,
        blocks JSONB,
        workspace_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER
      );
    `);
    
    // Create message_delivery_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_delivery_logs (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT,
        message_content TEXT,
        status TEXT NOT NULL,
        config_id INTEGER,
        template_id INTEGER,
        message_id TEXT,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        delivered_at TIMESTAMP,
        failure_reason TEXT,
        metadata JSONB,
        workspace_id INTEGER,
        created_by INTEGER
      );
    `);
    
    // Add foreign key constraints
    await client.query(`
      ALTER TABLE message_delivery_logs
      ADD CONSTRAINT fk_message_delivery_logs_template
      FOREIGN KEY (template_id) REFERENCES message_templates(id)
      ON DELETE SET NULL;
    `);
    
    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messaging_configurations_platform ON messaging_configurations(platform);
      CREATE INDEX IF NOT EXISTS idx_messaging_configurations_workspace ON messaging_configurations(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sms_configurations_provider ON sms_configurations(provider);
      CREATE INDEX IF NOT EXISTS idx_sms_configurations_workspace ON sms_configurations(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_message_templates_platform ON message_templates(platform);
      CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);
      CREATE INDEX IF NOT EXISTS idx_message_delivery_logs_platform ON message_delivery_logs(platform);
      CREATE INDEX IF NOT EXISTS idx_message_delivery_logs_status ON message_delivery_logs(status);
      CREATE INDEX IF NOT EXISTS idx_message_delivery_logs_sent_at ON message_delivery_logs(sent_at);
    `);
    
    await client.query('COMMIT');
    console.log('Created messaging system tables');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating messaging tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seed default message templates for common notifications
 */
async function seedDefaultTemplates() {
  try {
    // Check if templates already exist
    const existingTemplates = await db.select().from(messageTemplates);
    
    if (existingTemplates.length > 0) {
      console.log(`Found ${existingTemplates.length} existing message templates. Skipping seeding.`);
      return;
    }
    
    // Default Slack Templates
    const slackTemplates = [
      {
        name: 'Incident Alert - Slack',
        description: 'Standard template for critical incident alerts',
        type: 'alert',
        platform: 'slack',
        content: 'ALERT: {{incidentTitle}} - Severity: {{severity}}. {{description}}',
        format: 'slack_blocks',
        variables: {
          incidentTitle: "Title of the incident",
          severity: "Severity level (Critical, High, Medium, Low)",
          description: "Description of the incident",
          timestamp: "When the incident occurred",
          affectedSystems: "Affected systems or components"
        },
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 INCIDENT ALERT: {{incidentTitle}}"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Severity:*\n{{severity}}"
              },
              {
                type: "mrkdwn",
                text: "*When:*\n{{timestamp}}"
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Details:*\n{{description}}"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Affected Systems:*\n{{affectedSystems}}"
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View Details",
                  emoji: true
                },
                url: "{{incidentUrl}}"
              }
            ]
          }
        ]
      },
      {
        name: 'MCP Server Status Update - Slack',
        description: 'Updates on MCP server status changes',
        type: 'status_update',
        platform: 'slack',
        content: 'MCP Server {{serverName}} status changed to {{status}}.',
        format: 'slack_blocks',
        variables: {
          serverName: "Name of the MCP server",
          status: "New status of the server",
          previousStatus: "Previous status of the server",
          timestamp: "When the status changed",
          details: "Additional details about the status change"
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "MCP Server Status Update"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Server:*\n{{serverName}}"
              },
              {
                type: "mrkdwn",
                text: "*Status:*\n{{status}}"
              },
              {
                type: "mrkdwn",
                text: "*Previous Status:*\n{{previousStatus}}"
              },
              {
                type: "mrkdwn",
                text: "*Time:*\n{{timestamp}}"
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Details:*\n{{details}}"
            }
          }
        ]
      }
    ];
    
    // Default MS Teams Templates
    const msTeamsTemplates = [
      {
        name: 'Incident Alert - MS Teams',
        description: 'Standard template for critical incident alerts for MS Teams',
        type: 'alert',
        platform: 'ms_teams',
        content: 'ALERT: {{incidentTitle}} - Severity: {{severity}}. {{description}}',
        format: 'adaptive_cards',
        variables: {
          incidentTitle: "Title of the incident",
          severity: "Severity level (Critical, High, Medium, Low)",
          description: "Description of the incident",
          timestamp: "When the incident occurred",
          affectedSystems: "Affected systems or components"
        },
        blocks: {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "type": "AdaptiveCard",
          "version": "1.3",
          "body": [
            {
              "type": "TextBlock",
              "size": "Medium",
              "weight": "Bolder",
              "text": "🚨 INCIDENT ALERT: {{incidentTitle}}",
              "wrap": true
            },
            {
              "type": "FactSet",
              "facts": [
                {
                  "title": "Severity",
                  "value": "{{severity}}"
                },
                {
                  "title": "When",
                  "value": "{{timestamp}}"
                }
              ]
            },
            {
              "type": "TextBlock",
              "text": "Details:",
              "weight": "Bolder",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "{{description}}",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "Affected Systems:",
              "weight": "Bolder",
              "wrap": true
            },
            {
              "type": "TextBlock",
              "text": "{{affectedSystems}}",
              "wrap": true
            }
          ],
          "actions": [
            {
              "type": "Action.OpenUrl",
              "title": "View Details",
              "url": "{{incidentUrl}}"
            }
          ]
        }
      }
    ];
    
    // Default SMS Templates
    const smsTemplates = [
      {
        name: 'Incident Alert - SMS',
        description: 'Concise incident alert for SMS',
        type: 'alert',
        platform: 'sms',
        content: 'ALERT: {{incidentTitle}}. Severity: {{severity}}. {{shortDescription}}',
        format: 'plain',
        variables: {
          incidentTitle: "Title of the incident",
          severity: "Severity level",
          shortDescription: "Brief description of the incident"
        }
      },
      {
        name: 'System Status - SMS',
        description: 'Brief system status update for SMS',
        type: 'status_update',
        platform: 'sms',
        content: 'NexusMCP: {{systemName}} is now {{status}}. {{details}}',
        format: 'plain',
        variables: {
          systemName: "Name of the system",
          status: "Current status",
          details: "Additional details"
        }
      }
    ];
    
    // Universal Templates
    const universalTemplates = [
      {
        name: 'Generic Notification',
        description: 'Generic notification template for all platforms',
        type: 'notification',
        platform: 'all',
        content: '{{title}} - {{message}}',
        format: 'plain',
        variables: {
          title: "Notification title",
          message: "Notification message",
          timestamp: "Time of notification"
        }
      }
    ];
    
    // Insert all templates
    const allTemplates = [...slackTemplates, ...msTeamsTemplates, ...smsTemplates, ...universalTemplates];
    
    for (const template of allTemplates) {
      await db.insert(messageTemplates).values(template);
    }
    
    console.log(`Seeded ${allTemplates.length} default message templates`);
  } catch (error) {
    console.error('Error seeding default message templates:', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMessagingSystemMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}