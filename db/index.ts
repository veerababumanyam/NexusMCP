import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as schemaAgents from "@shared/schema_agents";
import * as schemaAudit from "@shared/schema_audit";
import * as schemaOrchestrator from "@shared/schema_orchestrator";
import * as schemaHealthcare from "@shared/schema_healthcare";
import * as schemaUiPersonalization from "@shared/schema_ui_personalization";
import * as schemaSecurity from "@shared/schema_security";
import * as schemaSecurityScanner from "@shared/schema_security_scanner";
import * as schemaBreachDetection from "@shared/schema_breach_detection";

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Combine schemas
const combinedSchema = { 
  ...schema, 
  ...schemaAgents, 
  ...schemaAudit, 
  ...schemaOrchestrator, 
  ...schemaHealthcare,
  ...schemaUiPersonalization,
  ...schemaSecurity,
  ...schemaSecurityScanner,
  ...schemaBreachDetection
};

export const db = drizzle({ client: pool, schema: combinedSchema });