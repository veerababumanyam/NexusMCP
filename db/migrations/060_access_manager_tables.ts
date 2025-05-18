/**
 * Access Manager Tables Migration
 * 
 * This migration adds tables for enterprise-grade authentication and authorization:
 * - OAuth2 clients for API authorization
 * - OAuth2 tokens (access and refresh)
 * - mTLS certificate management
 * - Dynamic client registration
 * - Access audit logging for compliance (SOC 2, GDPR, HIPAA)
 */

import { db } from '../index';
import { sql } from 'drizzle-orm';

export async function migrate() {
  console.log('Running Access Manager tables migration...');
  
  try {
    // Create OAuth2 clients table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id SERIAL PRIMARY KEY,
        client_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        client_name TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        redirect_uris JSONB NOT NULL,
        grant_types JSONB NOT NULL,
        scopes JSONB NOT NULL,
        is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
        is_auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        user_id INTEGER REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create OAuth2 authorization codes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_auth_codes (
        id SERIAL PRIMARY KEY,
        auth_code TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES oauth_clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        scopes JSONB NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS oauth_auth_codes_client_user_idx ON oauth_auth_codes(client_id, user_id);
    `);
    
    // Create OAuth2 access tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES oauth_clients(id),
        user_id INTEGER REFERENCES users(id),
        scopes JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_user_idx ON oauth_access_tokens(client_id, user_id);
    `);
    
    // Create OAuth2 refresh tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        id SERIAL PRIMARY KEY,
        refresh_token TEXT NOT NULL UNIQUE,
        access_token_id INTEGER NOT NULL REFERENCES oauth_access_tokens(id),
        client_id INTEGER NOT NULL REFERENCES oauth_clients(id),
        user_id INTEGER REFERENCES users(id),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create client dynamic registration table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_registrations (
        id SERIAL PRIMARY KEY,
        registration_token TEXT NOT NULL UNIQUE,
        client_id INTEGER NOT NULL REFERENCES oauth_clients(id),
        registration_uri TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create mTLS certificates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mtls_certificates (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES oauth_clients(id),
        certificate_thumbprint TEXT NOT NULL UNIQUE,
        certificate_subject TEXT NOT NULL,
        certificate_issuer TEXT NOT NULL,
        certificate_serial TEXT NOT NULL,
        certificate_not_before TIMESTAMP WITH TIME ZONE NOT NULL,
        certificate_not_after TIMESTAMP WITH TIME ZONE NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create access audit logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS access_audit_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        user_id INTEGER REFERENCES users(id),
        client_id INTEGER REFERENCES oauth_clients(id),
        token_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        request_path TEXT,
        request_method TEXT,
        scopes JSONB,
        status_code INTEGER,
        error_code TEXT,
        error_message TEXT,
        details JSONB,
        compliance_relevant BOOLEAN DEFAULT FALSE
      );
      
      CREATE INDEX IF NOT EXISTS access_audit_logs_event_time_idx ON access_audit_logs(event_time);
      CREATE INDEX IF NOT EXISTS access_audit_logs_user_id_idx ON access_audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS access_audit_logs_client_id_idx ON access_audit_logs(client_id);
      CREATE INDEX IF NOT EXISTS access_audit_logs_event_type_idx ON access_audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS access_audit_logs_compliance_idx ON access_audit_logs(compliance_relevant);
    `);
    
    console.log('Access Manager tables migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error running Access Manager tables migration:', error);
    throw error;
  }
}