-- Add cluster nodes table for distributed deployment
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline',
    role TEXT NOT NULL DEFAULT 'worker',
    region TEXT NOT NULL DEFAULT 'default-region',
    zone TEXT NOT NULL DEFAULT 'default-zone',
    cpu INTEGER,
    memory INTEGER,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Index for quick lookups of nodes by status
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- Index for quick lookups of nodes by role
CREATE INDEX IF NOT EXISTS idx_nodes_role ON nodes(role);

-- Index for region-based lookups (for geo-distribution)
CREATE INDEX IF NOT EXISTS idx_nodes_region ON nodes(region);

-- Composite index for region+zone (for locality routing)
CREATE INDEX IF NOT EXISTS idx_nodes_region_zone ON nodes(region, zone);