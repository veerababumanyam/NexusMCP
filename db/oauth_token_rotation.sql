-- OAuth2 Token Rotation and Credential Management Tables

-- Add secret rotation fields to OAuth clients table
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS secret_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS secret_last_rotated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS require_rotation BOOLEAN DEFAULT FALSE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS rotation_period_days INTEGER DEFAULT 90;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS rotation_notification_days INTEGER DEFAULT 15;

-- OAuth client secret history
CREATE TABLE IF NOT EXISTS oauth_client_secret_history (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  client_secret_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expired_at TIMESTAMP WITH TIME ZONE,
  created_by INTEGER REFERENCES users(id),
  rotation_reason TEXT,
  UNIQUE(client_id, client_secret_hash)
);

-- Token usage statistics
CREATE TABLE IF NOT EXISTS oauth_token_usage_stats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  token_requests INTEGER DEFAULT 0,
  token_denials INTEGER DEFAULT 0,
  api_requests INTEGER DEFAULT 0,
  unique_ips INTEGER DEFAULT 0,
  UNIQUE(client_id, date)
);

-- OAuth client security events
CREATE TABLE IF NOT EXISTS oauth_security_events (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES oauth_clients(id) ON DELETE CASCADE,
  token_id INTEGER REFERENCES oauth_access_tokens(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'suspicious_ip', 'excessive_requests', 'rotation_reminder', etc.
  event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  description TEXT NOT NULL,
  details JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by INTEGER REFERENCES users(id),
  resolution_notes TEXT
);

-- OAuth notification settings
CREATE TABLE IF NOT EXISTS oauth_notification_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notify_credential_expiry BOOLEAN DEFAULT TRUE,
  notify_suspicious_activity BOOLEAN DEFAULT TRUE,
  notify_client_disabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  dashboard_notifications BOOLEAN DEFAULT TRUE,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_client_secret_history_client_id ON oauth_client_secret_history(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_token_usage_stats_client_id ON oauth_token_usage_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_token_usage_stats_date ON oauth_token_usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_oauth_security_events_client_id ON oauth_security_events(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_security_events_event_time ON oauth_security_events(event_time);
CREATE INDEX IF NOT EXISTS idx_oauth_security_events_severity ON oauth_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_oauth_security_events_resolved_at ON oauth_security_events(resolved_at);