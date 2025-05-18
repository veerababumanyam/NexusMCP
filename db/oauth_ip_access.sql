-- OAuth2 IP Access Control Tables

-- Create IP allowlist table for OAuth2 clients
CREATE TABLE IF NOT EXISTS oauth_ip_allowlist (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  UNIQUE(client_id, ip_address)
);

-- Create IP access logs table for OAuth2 clients
CREATE TABLE IF NOT EXISTS oauth_ip_access_logs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  token_id INTEGER REFERENCES oauth_access_tokens(id) ON DELETE SET NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  request_path TEXT NOT NULL,
  access_status TEXT NOT NULL, -- 'allowed', 'denied', 'invalid_token', etc.
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  details JSONB
);

-- Create table for OAuth client activation windows (time-based restrictions)
CREATE TABLE IF NOT EXISTS oauth_client_activation_windows (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0-6 (Sunday to Saturday)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  UNIQUE(client_id, day_of_week, start_time, end_time)
);

-- Add additional columns to oauth_clients table
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS enforce_ip_allowlist BOOLEAN DEFAULT FALSE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS enforce_time_restrictions BOOLEAN DEFAULT FALSE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS auto_revoke_on_violation BOOLEAN DEFAULT FALSE;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS max_violations INTEGER DEFAULT 5;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;
ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMP WITH TIME ZONE;

-- Create index on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_oauth_ip_allowlist_client_id ON oauth_ip_allowlist(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_ip_allowlist_ip_address ON oauth_ip_allowlist(ip_address);
CREATE INDEX IF NOT EXISTS idx_oauth_ip_access_logs_client_id ON oauth_ip_access_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_ip_access_logs_ip_address ON oauth_ip_access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_oauth_ip_access_logs_timestamp ON oauth_ip_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_oauth_client_activation_windows_client_id ON oauth_client_activation_windows(client_id);