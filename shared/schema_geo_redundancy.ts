/**
 * Schema definitions for geo-redundancy and multi-region deployment
 */

import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, primaryKey } from "drizzle-orm/pg-core";
import { type PgArray, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

/**
 * Regions table for managing deployment regions
 */
export const regions = pgTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('available'),
  isPrimary: boolean('is_primary').notNull().default(false),
  isEdgeEnabled: boolean('is_edge_enabled').notNull().default(false),
  failoverRegion: text('failover_region').references(() => regions.id),
  maxNodes: integer('max_nodes'),
  minNodes: integer('min_nodes'),
  priority: integer('priority').notNull().default(50),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata')
});

export const regionsRelations = relations(regions, ({ many, one }) => ({
  zones: many(zones),
  failoverTo: one(regions, {
    fields: [regions.failoverRegion],
    references: [regions.id]
  }),
  metrics: many(regionMetrics),
  sourceRoutes: many(regionRoutes, { relationName: 'sourceRoutes' }),
  destinationRoutes: many(regionRoutes, { relationName: 'destinationRoutes' }),
  countryMaps: many(countryRegionMap)
}));

/**
 * Zones table for availability zones within regions
 */
export const zones = pgTable('zones', {
  id: text('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => regions.id),
  name: text('name').notNull(),
  status: text('status').notNull().default('available'),
  isPrimary: boolean('is_primary').notNull().default(false),
  priority: integer('priority').notNull().default(50),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata')
});

export const zonesRelations = relations(zones, ({ one }) => ({
  region: one(regions, {
    fields: [zones.regionId],
    references: [regions.id]
  })
}));

/**
 * Region metrics table for storing performance metrics by region
 */
export const regionMetrics = pgTable('region_metrics', {
  id: serial('id').primaryKey(),
  regionId: text('region_id').notNull().references(() => regions.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  cpuUsage: decimal('cpu_usage'),
  memoryUsage: decimal('memory_usage'),
  networkIn: integer('network_in'),
  networkOut: integer('network_out'),
  latency: decimal('latency'),
  requestCount: integer('request_count'),
  errorCount: integer('error_count'),
  nodeCount: integer('node_count'),
  activeNodeCount: integer('active_node_count')
});

export const regionMetricsRelations = relations(regionMetrics, ({ one }) => ({
  region: one(regions, {
    fields: [regionMetrics.regionId],
    references: [regions.id]
  })
}));

/**
 * Region routes table for routing configuration
 */
export const regionRoutes = pgTable('region_routes', {
  id: serial('id').primaryKey(),
  sourceRegionId: text('source_region_id').notNull().references(() => regions.id),
  destinationRegionId: text('destination_region_id').notNull().references(() => regions.id),
  priority: integer('priority').notNull().default(50),
  isEnabled: boolean('is_enabled').notNull().default(true),
  routeWeight: integer('route_weight').notNull().default(100),
  failoverOnly: boolean('failover_only').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const regionRoutesRelations = relations(regionRoutes, ({ one }) => ({
  sourceRegion: one(regions, {
    fields: [regionRoutes.sourceRegionId],
    references: [regions.id],
    relationName: 'sourceRoutes'
  }),
  destinationRegion: one(regions, {
    fields: [regionRoutes.destinationRegionId],
    references: [regions.id],
    relationName: 'destinationRoutes'
  })
}));

/**
 * Country Region Map table for geographic routing
 */
export const countryRegionMap = pgTable('country_region_map', {
  countryCode: text('country_code').notNull(),
  regionId: text('region_id').notNull().references(() => regions.id),
  priority: integer('priority').notNull().default(50),
},
(table) => {
  return {
    pk: primaryKey({ columns: [table.countryCode, table.regionId] })
  };
});

export const countryRegionMapRelations = relations(countryRegionMap, ({ one }) => ({
  region: one(regions, {
    fields: [countryRegionMap.regionId],
    references: [regions.id]
  })
}));

/**
 * Geo Latency table for tracking region-to-region latency
 */
export const geoLatency = pgTable('geo_latency', {
  id: serial('id').primaryKey(),
  sourceRegionId: text('source_region_id').notNull().references(() => regions.id),
  destinationRegionId: text('destination_region_id').notNull().references(() => regions.id),
  averageLatency: decimal('average_latency'),
  minLatency: decimal('min_latency'),
  maxLatency: decimal('max_latency'),
  stdDeviation: decimal('std_deviation'),
  sampleCount: integer('sample_count'),
  successRate: decimal('success_rate'),
  lastCheck: timestamp('last_check').defaultNow().notNull(),
  isActive: boolean('is_active').notNull().default(true)
});

export const geoLatencyRelations = relations(geoLatency, ({ one }) => ({
  sourceRegion: one(regions, {
    fields: [geoLatency.sourceRegionId],
    references: [regions.id]
  }),
  destinationRegion: one(regions, {
    fields: [geoLatency.destinationRegionId],
    references: [regions.id]
  })
}));

/**
 * Multi-region configuration table
 */
export const multiRegionConfig = pgTable('multi_region_config', {
  id: integer('id').primaryKey().default(1),
  isEnabled: boolean('is_enabled').notNull().default(true),
  primaryRegionId: text('primary_region_id').notNull().references(() => regions.id),
  routingStrategy: text('routing_strategy').notNull().default('nearest'),
  autoFailover: boolean('auto_failover').notNull().default(true),
  edgeCaching: boolean('edge_caching').notNull().default(false),
  asyncReplication: boolean('async_replication').notNull().default(true),
  maxLatencyThreshold: decimal('max_latency_threshold'),
  healthCheckInterval: integer('health_check_interval'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').notNull()
});

export const multiRegionConfigRelations = relations(multiRegionConfig, ({ one }) => ({
  primaryRegion: one(regions, {
    fields: [multiRegionConfig.primaryRegionId],
    references: [regions.id]
  })
}));

/**
 * Failover history table
 */
export const failoverHistory = pgTable('failover_history', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  fromRegionId: text('from_region_id').notNull().references(() => regions.id),
  toRegionId: text('to_region_id').notNull().references(() => regions.id),
  reason: text('reason'),
  isAutomatic: boolean('is_automatic').notNull().default(true),
  triggeredBy: integer('triggered_by'),
  isSuccessful: boolean('is_successful').notNull().default(true),
  recoveryTime: decimal('recovery_time')
});

export const failoverHistoryRelations = relations(failoverHistory, ({ one }) => ({
  fromRegion: one(regions, {
    fields: [failoverHistory.fromRegionId],
    references: [regions.id]
  }),
  toRegion: one(regions, {
    fields: [failoverHistory.toRegionId],
    references: [regions.id]
  })
}));

/**
 * Edge cache configuration table
 */
export const edgeCacheConfig = pgTable('edge_cache_config', {
  id: serial('id').primaryKey(),
  pathPattern: text('path_pattern').notNull(),
  cacheTtl: integer('cache_ttl').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  regions: jsonb('regions'),
  invalidationKey: text('invalidation_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Schema types for Zod validation

export const regionInsertSchema = createInsertSchema(regions);
export type RegionInsert = z.infer<typeof regionInsertSchema>;
export const regionSelectSchema = createSelectSchema(regions);
export type Region = z.infer<typeof regionSelectSchema>;

export const zoneInsertSchema = createInsertSchema(zones);
export type ZoneInsert = z.infer<typeof zoneInsertSchema>;
export const zoneSelectSchema = createSelectSchema(zones);
export type Zone = z.infer<typeof zoneSelectSchema>;

export const regionMetricInsertSchema = createInsertSchema(regionMetrics);
export type RegionMetricInsert = z.infer<typeof regionMetricInsertSchema>;
export const regionMetricSelectSchema = createSelectSchema(regionMetrics);
export type RegionMetric = z.infer<typeof regionMetricSelectSchema>;

export const regionRouteInsertSchema = createInsertSchema(regionRoutes);
export type RegionRouteInsert = z.infer<typeof regionRouteInsertSchema>;
export const regionRouteSelectSchema = createSelectSchema(regionRoutes);
export type RegionRoute = z.infer<typeof regionRouteSelectSchema>;

export const countryRegionMapInsertSchema = createInsertSchema(countryRegionMap);
export type CountryRegionMapInsert = z.infer<typeof countryRegionMapInsertSchema>;
export const countryRegionMapSelectSchema = createSelectSchema(countryRegionMap);
export type CountryRegionMap = z.infer<typeof countryRegionMapSelectSchema>;

export const geoLatencyInsertSchema = createInsertSchema(geoLatency);
export type GeoLatencyInsert = z.infer<typeof geoLatencyInsertSchema>;
export const geoLatencySelectSchema = createSelectSchema(geoLatency);
export type GeoLatency = z.infer<typeof geoLatencySelectSchema>;

export const multiRegionConfigInsertSchema = createInsertSchema(multiRegionConfig);
export type MultiRegionConfigInsert = z.infer<typeof multiRegionConfigInsertSchema>;
export const multiRegionConfigSelectSchema = createSelectSchema(multiRegionConfig);
export type MultiRegionConfig = z.infer<typeof multiRegionConfigSelectSchema>;

export const failoverHistoryInsertSchema = createInsertSchema(failoverHistory);
export type FailoverHistoryInsert = z.infer<typeof failoverHistoryInsertSchema>;
export const failoverHistorySelectSchema = createSelectSchema(failoverHistory);
export type FailoverHistory = z.infer<typeof failoverHistorySelectSchema>;

export const edgeCacheConfigInsertSchema = createInsertSchema(edgeCacheConfig);
export type EdgeCacheConfigInsert = z.infer<typeof edgeCacheConfigInsertSchema>;
export const edgeCacheConfigSelectSchema = createSelectSchema(edgeCacheConfig);
export type EdgeCacheConfig = z.infer<typeof edgeCacheConfigSelectSchema>;