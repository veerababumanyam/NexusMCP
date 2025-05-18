import { sql } from "drizzle-orm";
import { Pool, PoolClient } from "pg";
import { db } from '../index';

export async function migrate(client: any) {
  console.log("Running migration: 007_notification_system");

  try {
    // Start transaction
    await client.execute(sql`BEGIN`);

    // Create SMTP configurations table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS smtp_configurations (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        require_tls BOOLEAN DEFAULT TRUE,
        reject_unauthorized BOOLEAN DEFAULT TRUE,
        environment TEXT DEFAULT 'production',
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_tested_at TIMESTAMP,
        test_status TEXT,
        max_retries INTEGER DEFAULT 3,
        retry_interval INTEGER DEFAULT 60
      )
    `);

    // Create notification templates table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        subject TEXT,
        html_body TEXT,
        text_body TEXT,
        variables JSONB DEFAULT '{}',
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_by INTEGER REFERENCES users(id),
        last_modified_by INTEGER REFERENCES users(id),
        locale TEXT DEFAULT 'en',
        branding_id INTEGER
      )
    `);

    // Create notification channels table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        configuration JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        throttle_limit INTEGER,
        throttle_interval INTEGER,
        default_priority TEXT DEFAULT 'normal',
        created_by INTEGER REFERENCES users(id),
        test_status TEXT,
        last_tested_at TIMESTAMP
      )
    `);

    // Create alert rules table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        name TEXT NOT NULL,
        description TEXT,
        event_type TEXT,
        conditions JSONB NOT NULL,
        priority TEXT DEFAULT 'normal' NOT NULL,
        template_id INTEGER REFERENCES notification_templates(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_by INTEGER REFERENCES users(id),
        cooldown_period INTEGER DEFAULT 0,
        last_triggered_at TIMESTAMP,
        throttle_count INTEGER DEFAULT 0
      )
    `);

    // Create alert rule channels mapping table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_rule_channels (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES alert_rules(id) NOT NULL,
        channel_id INTEGER REFERENCES notification_channels(id) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        override_priority TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create alert rule recipients mapping table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_rule_recipients (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES alert_rules(id) NOT NULL,
        type TEXT NOT NULL,
        recipient_id INTEGER,
        email TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create notification events table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_events (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        source TEXT,
        source_id TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        alert_rule_id INTEGER REFERENCES alert_rules(id),
        related_resource_type TEXT,
        related_resource_id TEXT,
        action_url TEXT,
        icon_name TEXT
      )
    `);

    // Create notification deliveries table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES notification_events(id) NOT NULL,
        channel_id INTEGER REFERENCES notification_channels(id),
        recipient_id INTEGER,
        recipient_address TEXT,
        status TEXT NOT NULL,
        status_details TEXT,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        next_retry_at TIMESTAMP,
        metrics_sent BOOLEAN DEFAULT FALSE,
        batch_id TEXT,
        external_id TEXT
      )
    `);

    // Create user notification preferences table
    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        workspace_id INTEGER REFERENCES workspaces(id),
        notification_type TEXT NOT NULL,
        channels JSONB DEFAULT '{}',
        is_enabled BOOLEAN DEFAULT TRUE,
        quiet_hours_start SMALLINT,
        quiet_hours_end SMALLINT,
        quiet_hours_days JSONB DEFAULT '[]',
        digest_enabled BOOLEAN DEFAULT FALSE,
        digest_frequency TEXT,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes for performance
    await client.execute(sql`CREATE INDEX idx_smtp_config_workspace ON smtp_configurations(workspace_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_template_workspace ON notification_templates(workspace_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_channel_workspace ON notification_channels(workspace_id)`);
    await client.execute(sql`CREATE INDEX idx_alert_rule_workspace ON alert_rules(workspace_id)`);
    await client.execute(sql`CREATE INDEX idx_alert_rule_channel_rule ON alert_rule_channels(rule_id)`);
    await client.execute(sql`CREATE INDEX idx_alert_rule_recipient_rule ON alert_rule_recipients(rule_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_event_workspace ON notification_events(workspace_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_event_user ON notification_events(user_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_event_isread ON notification_events(is_read)`);
    await client.execute(sql`CREATE INDEX idx_notification_delivery_event ON notification_deliveries(event_id)`);
    await client.execute(sql`CREATE INDEX idx_notification_delivery_status ON notification_deliveries(status)`);
    await client.execute(sql`CREATE INDEX idx_user_notification_pref_user ON user_notification_preferences(user_id)`);

    // Add default triggers for updating timestamps
    await client.execute(sql`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for each table with timestamps
    const tablesWithTimestamps = [
      'smtp_configurations',
      'notification_templates',
      'notification_channels',
      'alert_rules'
    ];

    for (const table of tablesWithTimestamps) {
      await client.execute(sql`
        DROP TRIGGER IF EXISTS ${sql.raw(`update_${table}_timestamp`)} ON ${sql.raw(table)};
        CREATE TRIGGER ${sql.raw(`update_${table}_timestamp`)}
        BEFORE UPDATE ON ${sql.raw(table)}
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();
      `);
    }

    // Insert default notification templates for system events
    await client.execute(sql`
      INSERT INTO notification_templates (name, description, type, subject, html_body, text_body, is_system, variables)
      VALUES 
      (
        'System Alert', 
        'Default template for system alerts', 
        'email', 
        '[{{workspaceName}}] System Alert: {{title}}', 
        '<h2>System Alert</h2><p><strong>{{title}}</strong></p><p>{{message}}</p><p>Time: {{timestamp}}</p><p>Severity: {{priority}}</p>{{#if actionUrl}}<p><a href="{{actionUrl}}">View Details</a></p>{{/if}}', 
        'System Alert: {{title}}\n\n{{message}}\n\nTime: {{timestamp}}\nSeverity: {{priority}}\n{{#if actionUrl}}View Details: {{actionUrl}}{{/if}}', 
        TRUE,
        '{"title": "Alert title", "message": "Alert message", "timestamp": "Timestamp", "priority": "Alert priority", "actionUrl": "Action URL", "workspaceName": "Workspace name"}'
      ),
      (
        'Security Alert', 
        'Default template for security alerts', 
        'email', 
        '[{{workspaceName}}] Security Alert: {{title}}', 
        '<h2>Security Alert</h2><p><strong>{{title}}</strong></p><p>{{message}}</p><p>Time: {{timestamp}}</p><p>Severity: {{priority}}</p><p>IP Address: {{ipAddress}}</p>{{#if actionUrl}}<p><a href="{{actionUrl}}">View Details</a></p>{{/if}}', 
        'Security Alert: {{title}}\n\n{{message}}\n\nTime: {{timestamp}}\nSeverity: {{priority}}\nIP Address: {{ipAddress}}\n{{#if actionUrl}}View Details: {{actionUrl}}{{/if}}', 
        TRUE,
        '{"title": "Alert title", "message": "Alert message", "timestamp": "Timestamp", "priority": "Alert priority", "ipAddress": "IP Address", "actionUrl": "Action URL", "workspaceName": "Workspace name"}'
      ),
      (
        'In-app Notification', 
        'Default template for in-app notifications', 
        'in-app', 
        '{{title}}', 
        NULL, 
        '{{message}}', 
        TRUE,
        '{"title": "Notification title", "message": "Notification message"}'
      )
    `);

    // Commit transaction
    await client.execute(sql`COMMIT`);
    console.log("Migration completed: 007_notification_system");
  } catch (error) {
    // Rollback on error
    await client.execute(sql`ROLLBACK`);
    console.error("Error in migration 007_notification_system:", error);
    throw error;
  }
}