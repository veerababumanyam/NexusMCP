import { pgTable, serial, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Connection Settings Table
export const connectionSettings = pgTable("connection_settings", {
  id: serial("id").primaryKey(),
  maxConnections: integer("max_connections").notNull().default(100),
  connectionTimeout: integer("connection_timeout").notNull().default(5000), // in milliseconds
  idleTimeout: integer("idle_timeout").notNull().default(60000), // in milliseconds
  keepAliveInterval: integer("keep_alive_interval").notNull().default(30000), // in milliseconds
  retryInterval: integer("retry_interval").notNull().default(2000), // in milliseconds
  maxRetries: integer("max_retries").notNull().default(5),
  circuitBreakerEnabled: boolean("circuit_breaker_enabled").notNull().default(true),
  circuitBreakerThreshold: integer("circuit_breaker_threshold").notNull().default(5),
  circuitBreakerResetTimeout: integer("circuit_breaker_reset_timeout").notNull().default(30000), // in milliseconds
  healthCheckEnabled: boolean("health_check_enabled").notNull().default(true),
  healthCheckInterval: integer("health_check_interval").notNull().default(60000), // in milliseconds
  loadBalancingEnabled: boolean("load_balancing_enabled").notNull().default(true),
  loadBalancingStrategy: text("load_balancing_strategy").notNull().default("round_robin"),
  tlsVerification: boolean("tls_verification").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Create Zod schemas for validation
export const connectionSettingsInsertSchema = createInsertSchema(connectionSettings, {
  maxConnections: (schema) => schema.min(1, "Maximum connections must be at least 1").max(1000, "Maximum connections must be at most 1000"),
  connectionTimeout: (schema) => schema.min(1000, "Connection timeout must be at least 1000ms").max(60000, "Connection timeout must be at most 60000ms"),
  idleTimeout: (schema) => schema.min(1000, "Idle timeout must be at least 1000ms").max(300000, "Idle timeout must be at most 300000ms"),
  keepAliveInterval: (schema) => schema.min(1000, "Keep-alive interval must be at least 1000ms").max(60000, "Keep-alive interval must be at most 60000ms"),
  retryInterval: (schema) => schema.min(100, "Retry interval must be at least 100ms").max(10000, "Retry interval must be at most 10000ms"),
  maxRetries: (schema) => schema.min(0, "Maximum retries must be at least 0").max(20, "Maximum retries must be at most 20"),
  circuitBreakerThreshold: (schema) => schema.min(1, "Circuit breaker threshold must be at least 1").max(100, "Circuit breaker threshold must be at most 100"),
  circuitBreakerResetTimeout: (schema) => schema.min(1000, "Circuit breaker reset timeout must be at least 1000ms").max(300000, "Circuit breaker reset timeout must be at most 300000ms"),
  healthCheckInterval: (schema) => schema.min(1000, "Health check interval must be at least 1000ms").max(300000, "Health check interval must be at most 300000ms"),
  loadBalancingStrategy: (schema) => schema.refine(
    (val) => ["round_robin", "least_connections", "weighted", "sticky_session"].includes(val), 
    { message: "Load balancing strategy must be one of: round_robin, least_connections, weighted, sticky_session" }
  )
});

export type ConnectionSettingsInsert = z.infer<typeof connectionSettingsInsertSchema>;
export const connectionSettingsSelectSchema = createSelectSchema(connectionSettings);
export type ConnectionSettings = z.infer<typeof connectionSettingsSelectSchema>;