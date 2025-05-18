-- Add geo-redundancy tables and indexes

-- Create regions table for managing deployment regions
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_edge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    failover_region TEXT REFERENCES regions(id),
    max_nodes INTEGER,
    min_nodes INTEGER,
    priority INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create zones table for availability zones within regions
CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    priority INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create region_metrics table for storing region performance metrics
CREATE TABLE IF NOT EXISTS region_metrics (
    id SERIAL PRIMARY KEY,
    region_id TEXT NOT NULL REFERENCES regions(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu_usage DECIMAL,
    memory_usage DECIMAL,
    network_in BIGINT,
    network_out BIGINT,
    latency DECIMAL, -- Average latency in ms
    request_count INTEGER,
    error_count INTEGER,
    node_count INTEGER,
    active_node_count INTEGER
);

-- Create region_routes table for routing configuration
CREATE TABLE IF NOT EXISTS region_routes (
    id SERIAL PRIMARY KEY,
    source_region_id TEXT NOT NULL REFERENCES regions(id),
    destination_region_id TEXT NOT NULL REFERENCES regions(id),
    priority INTEGER NOT NULL DEFAULT 50,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    route_weight INTEGER NOT NULL DEFAULT 100,
    failover_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create country_region_map table for mapping countries to preferred regions
CREATE TABLE IF NOT EXISTS country_region_map (
    country_code TEXT NOT NULL,
    region_id TEXT NOT NULL REFERENCES regions(id),
    priority INTEGER NOT NULL DEFAULT 50,
    PRIMARY KEY (country_code, region_id)
);

-- Create geo_latency table for tracking latency between regions
CREATE TABLE IF NOT EXISTS geo_latency (
    id SERIAL PRIMARY KEY,
    source_region_id TEXT NOT NULL REFERENCES regions(id),
    destination_region_id TEXT NOT NULL REFERENCES regions(id),
    average_latency DECIMAL, -- milliseconds
    min_latency DECIMAL,
    max_latency DECIMAL,
    std_deviation DECIMAL,
    sample_count INTEGER,
    success_rate DECIMAL, -- percentage
    last_check TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create multi_region_config table for global configuration
CREATE TABLE IF NOT EXISTS multi_region_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    primary_region_id TEXT NOT NULL REFERENCES regions(id),
    routing_strategy TEXT NOT NULL DEFAULT 'nearest',
    auto_failover BOOLEAN NOT NULL DEFAULT TRUE,
    edge_caching BOOLEAN NOT NULL DEFAULT FALSE,
    async_replication BOOLEAN NOT NULL DEFAULT TRUE,
    max_latency_threshold DECIMAL, -- milliseconds
    health_check_interval INTEGER, -- seconds
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER NOT NULL,
    CONSTRAINT only_one_config CHECK (id = 1)
);

-- Create failover_history table for tracking region failovers
CREATE TABLE IF NOT EXISTS failover_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    from_region_id TEXT NOT NULL REFERENCES regions(id),
    to_region_id TEXT NOT NULL REFERENCES regions(id),
    reason TEXT,
    is_automatic BOOLEAN NOT NULL DEFAULT TRUE,
    triggered_by INTEGER,
    is_successful BOOLEAN NOT NULL DEFAULT TRUE,
    recovery_time DECIMAL -- seconds
);

-- Create edge_cache_config table for configuring edge caching
CREATE TABLE IF NOT EXISTS edge_cache_config (
    id SERIAL PRIMARY KEY,
    path_pattern TEXT NOT NULL,
    cache_ttl INTEGER NOT NULL, -- seconds
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    regions TEXT[], -- array of region IDs where this config applies
    invalidation_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_zones_region_id ON zones(region_id);
CREATE INDEX IF NOT EXISTS idx_region_metrics_region_id ON region_metrics(region_id);
CREATE INDEX IF NOT EXISTS idx_region_metrics_timestamp ON region_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_geo_latency_source_region ON geo_latency(source_region_id);
CREATE INDEX IF NOT EXISTS idx_geo_latency_destination_region ON geo_latency(destination_region_id);
CREATE INDEX IF NOT EXISTS idx_failover_history_timestamp ON failover_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_country_region_map_country ON country_region_map(country_code);

-- Insert default regions if they don't exist
DO $$
BEGIN
    -- Primary region
    INSERT INTO regions (id, name, status, is_primary, is_edge_enabled, priority)
    VALUES ('us-east-1', 'US East (N. Virginia)', 'available', TRUE, FALSE, 100)
    ON CONFLICT (id) DO NOTHING;
    
    -- Secondary regions
    INSERT INTO regions (id, name, status, is_primary, is_edge_enabled, failover_region, priority)
    VALUES ('eu-west-1', 'EU West (Ireland)', 'available', FALSE, FALSE, 'us-east-1', 80)
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO regions (id, name, status, is_primary, is_edge_enabled, failover_region, priority)
    VALUES ('ap-southeast-1', 'Asia Pacific (Singapore)', 'available', FALSE, FALSE, 'us-east-1', 80)
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert default configuration if it doesn't exist
    INSERT INTO multi_region_config (is_enabled, primary_region_id, routing_strategy, auto_failover, 
                                       edge_caching, async_replication, max_latency_threshold, 
                                       health_check_interval, updated_by)
    VALUES (TRUE, 'us-east-1', 'nearest', TRUE, FALSE, TRUE, 500, 60, 1)
    ON CONFLICT (id) DO NOTHING;
    
    -- Add default routes
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('us-east-1', 'eu-west-1', 50, TRUE)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('us-east-1', 'ap-southeast-1', 50, TRUE)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('eu-west-1', 'us-east-1', 50, TRUE)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('eu-west-1', 'ap-southeast-1', 40, TRUE)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('ap-southeast-1', 'us-east-1', 50, TRUE)
    ON CONFLICT DO NOTHING;
    
    INSERT INTO region_routes (source_region_id, destination_region_id, priority, is_enabled)
    VALUES ('ap-southeast-1', 'eu-west-1', 40, TRUE)
    ON CONFLICT DO NOTHING;
END
$$;