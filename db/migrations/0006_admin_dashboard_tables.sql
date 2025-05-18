-- Create IP Access Rules table
CREATE TABLE IF NOT EXISTS ip_access_rules (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  type TEXT NOT NULL,
  ip_value TEXT NOT NULL,
  value_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, ip_value)
);

-- Create LDAP Directories table
CREATE TABLE IF NOT EXISTS ldap_directories (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 389,
  bind_dn TEXT NOT NULL,
  bind_credential TEXT,
  search_base TEXT NOT NULL,
  user_dn_pattern TEXT,
  use_ssl BOOLEAN DEFAULT FALSE,
  use_tls BOOLEAN DEFAULT TRUE,
  connection_timeout INTEGER DEFAULT 5000,
  is_active BOOLEAN DEFAULT TRUE,
  user_id_attribute TEXT DEFAULT 'uid',
  username_attribute TEXT DEFAULT 'uid',
  email_attribute TEXT DEFAULT 'mail',
  full_name_attribute TEXT DEFAULT 'cn',
  group_member_attribute TEXT DEFAULT 'memberOf',
  sync_groups BOOLEAN DEFAULT TRUE,
  group_search_base TEXT,
  group_object_class TEXT DEFAULT 'groupOfNames',
  group_name_attribute TEXT DEFAULT 'cn',
  role_mapping JSONB,
  last_sync_at TIMESTAMP,
  sync_status TEXT,
  sync_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Security Policies table
CREATE TABLE IF NOT EXISTS security_policies (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id),
  password_min_length INTEGER DEFAULT 8,
  password_require_uppercase BOOLEAN DEFAULT TRUE,
  password_require_lowercase BOOLEAN DEFAULT TRUE,
  password_require_numbers BOOLEAN DEFAULT TRUE,
  password_require_symbols BOOLEAN DEFAULT FALSE,
  password_expiry_days INTEGER DEFAULT 90,
  password_history INTEGER DEFAULT 3,
  max_login_attempts INTEGER DEFAULT 5,
  login_lockout_minutes INTEGER DEFAULT 15,
  mfa_required BOOLEAN DEFAULT FALSE,
  mfa_remember_days INTEGER DEFAULT 30,
  mfa_allowed_methods JSONB DEFAULT '["totp", "webauthn"]'::jsonb,
  session_timeout_minutes INTEGER DEFAULT 60,
  session_max_concurrent INTEGER DEFAULT 5,
  force_reauth_high_risk BOOLEAN DEFAULT TRUE,
  alert_on_location_change BOOLEAN DEFAULT TRUE,
  alert_on_new_device BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);