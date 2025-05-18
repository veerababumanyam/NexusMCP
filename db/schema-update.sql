-- System Integrations
CREATE TABLE IF NOT EXISTS "system_integrations" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "config" JSONB,
  "workspace_id" INTEGER REFERENCES "workspaces"("id"),
  "created_by" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_sync_at" TIMESTAMP
);

-- API Keys
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "hash" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "workspace_id" INTEGER REFERENCES "workspaces"("id"),
  "scopes" JSONB,
  "expires_at" TIMESTAMP,
  "last_used_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE
);

-- Plugins
CREATE TABLE IF NOT EXISTS "plugins" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT NOT NULL,
  "author" TEXT,
  "author_url" TEXT,
  "license" TEXT,
  "homepage" TEXT,
  "repository" TEXT,
  "tags" JSONB,
  "category" TEXT NOT NULL,
  "install_count" INTEGER DEFAULT 0,
  "rating" INTEGER DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "is_verified" BOOLEAN DEFAULT FALSE,
  "published_at" TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" INTEGER REFERENCES "users"("id"),
  "main_file" TEXT NOT NULL,
  "config" JSONB,
  "permissions" JSONB,
  "resources" JSONB
);

-- Plugin Versions
CREATE TABLE IF NOT EXISTS "plugin_versions" (
  "id" SERIAL PRIMARY KEY,
  "plugin_id" INTEGER NOT NULL REFERENCES "plugins"("id"),
  "version" TEXT NOT NULL,
  "changelog" TEXT,
  "download_url" TEXT,
  "sha256" TEXT,
  "size" INTEGER,
  "release_notes" TEXT,
  "is_latest" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "published_at" TIMESTAMP,
  UNIQUE("plugin_id", "version")
);

-- Plugin Installations
CREATE TABLE IF NOT EXISTS "plugin_installations" (
  "id" SERIAL PRIMARY KEY,
  "plugin_id" INTEGER NOT NULL REFERENCES "plugins"("id"),
  "version_id" INTEGER NOT NULL REFERENCES "plugin_versions"("id"),
  "workspace_id" INTEGER NOT NULL REFERENCES "workspaces"("id"),
  "status" TEXT NOT NULL DEFAULT 'active',
  "config" JSONB,
  "installed_by" INTEGER REFERENCES "users"("id"),
  "installed_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_used_at" TIMESTAMP
);

-- Developer Resources
CREATE TABLE IF NOT EXISTS "developer_resources" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "content" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "tags" JSONB,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "author" INTEGER REFERENCES "users"("id"),
  "view_count" INTEGER DEFAULT 0,
  "is_published" BOOLEAN DEFAULT FALSE,
  "published_at" TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflow Templates
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "template" JSONB NOT NULL,
  "is_system" BOOLEAN DEFAULT FALSE,
  "created_by" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workflows
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "definition" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "workspace_id" INTEGER NOT NULL REFERENCES "workspaces"("id"),
  "template_id" INTEGER REFERENCES "workflow_templates"("id"),
  "created_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_run_at" TIMESTAMP,
  "stats" JSONB
);

-- Workflow Runs
CREATE TABLE IF NOT EXISTS "workflow_runs" (
  "id" SERIAL PRIMARY KEY,
  "workflow_id" INTEGER NOT NULL REFERENCES "workflows"("id"),
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "finished_at" TIMESTAMP,
  "result" JSONB,
  "error" TEXT,
  "triggered_by" INTEGER REFERENCES "users"("id"),
  "execution_time" INTEGER,
  "nodes" JSONB
);

-- Localizations
CREATE TABLE IF NOT EXISTS "localizations" (
  "id" SERIAL PRIMARY KEY,
  "locale" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("locale", "namespace", "key")
);

-- User Preferences
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") UNIQUE,
  "language" TEXT NOT NULL DEFAULT 'en-US',
  "theme" TEXT NOT NULL DEFAULT 'system',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "date_format" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  "time_format" TEXT NOT NULL DEFAULT 'HH:mm:ss',
  "accessibility" JSONB,
  "notifications" JSONB,
  "dashboard_layout" JSONB,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);