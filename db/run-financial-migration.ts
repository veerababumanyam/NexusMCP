/**
 * Financial Services Migration
 * 
 * This migration script adds tables for financial services functionality:
 * - Financial data feeds and secure data sources
 * - Regulatory compliance (SEC, FINRA, MiFID II)
 * - Financial role-based access control
 * - Financial audit trails and anomaly detection
 * - LLM output validation for regulatory compliance
 */

import { pool, db } from './index';
import { financialSchema } from '../shared/schema_financial'; 
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

/**
 * Run the financial services migration
 */
export async function runFinancialServicesMigration() {
  console.log('Starting Financial Services Migration...');

  try {
    // Create all financial tables
    await createFinancialTables();
    
    // Seed initial regulatory frameworks
    await seedRegulatoryFrameworks();
    
    // Seed financial roles
    await seedFinancialRoles();

    console.log('Financial Services Migration completed successfully!');
    return true;
  } catch (error) {
    console.error('Financial Services Migration failed:', error);
    return false;
  }
}

/**
 * Create all financial tables using SQL
 */
async function createFinancialTables() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating financial_data_sources table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_data_sources (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        provider TEXT NOT NULL,
        source_type TEXT NOT NULL,
        connection_details JSONB,
        status TEXT NOT NULL DEFAULT 'inactive',
        refresh_frequency TEXT,
        refresh_schedule JSONB,
        data_format TEXT,
        requires_authentication BOOLEAN DEFAULT TRUE,
        auth_method TEXT,
        credentials JSONB,
        validated_at TIMESTAMP,
        workspace_id INTEGER REFERENCES workspaces(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating financial_data_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_data_permissions (
        id SERIAL PRIMARY KEY,
        source_id INTEGER NOT NULL REFERENCES financial_data_sources(id),
        user_id INTEGER REFERENCES users(id),
        role_id INTEGER,
        workspace_id INTEGER REFERENCES workspaces(id),
        permission_level TEXT NOT NULL,
        data_filters JSONB,
        access_restrictions JSONB,
        data_classification TEXT,
        audit_requirement TEXT,
        expires_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating financial_instruments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_instruments (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        exchange TEXT,
        currency TEXT,
        isin TEXT,
        cusip TEXT,
        sedol TEXT,
        bloomberg TEXT,
        reuters TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating regulatory_frameworks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulatory_frameworks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        version TEXT,
        jurisdiction TEXT,
        category TEXT,
        effective_date DATE,
        documentation_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        is_default BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating regulatory_rules table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulatory_rules (
        id SERIAL PRIMARY KEY,
        framework_id INTEGER NOT NULL REFERENCES regulatory_frameworks(id),
        rule_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        rule_text TEXT,
        category TEXT,
        severity TEXT DEFAULT 'medium',
        validation_logic JSONB,
        examples JSONB,
        remediation TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating llm_regulation_validators table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS llm_regulation_validators (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        framework_ids JSONB,
        validator_type TEXT NOT NULL,
        validation_logic JSONB NOT NULL,
        block_severity TEXT,
        flag_severity TEXT,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        workspace_id INTEGER REFERENCES workspaces(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating llm_validation_results table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS llm_validation_results (
        id SERIAL PRIMARY KEY,
        validator_id INTEGER NOT NULL REFERENCES llm_regulation_validators(id),
        session_id TEXT,
        request_id TEXT,
        input_text TEXT,
        output_text TEXT,
        validation_passed BOOLEAN NOT NULL,
        severity TEXT,
        rule_matches JSONB,
        action_taken TEXT,
        modified_output TEXT,
        user_id INTEGER REFERENCES users(id),
        workspace_id INTEGER REFERENCES workspaces(id),
        mcp_server_id INTEGER,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata JSONB
      );
    `);

    console.log('Creating financial_roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        base_role_id INTEGER,
        permissions JSONB,
        data_scope_restrictions JSONB,
        trading_limits JSONB,
        approval_requirements JSONB,
        regulatory_frameworks JSONB,
        is_system BOOLEAN DEFAULT FALSE,
        workspace_id INTEGER REFERENCES workspaces(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating financial_user_roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        role_id INTEGER NOT NULL REFERENCES financial_roles(id),
        workspace_id INTEGER REFERENCES workspaces(id),
        certifications JSONB,
        restrictions JSONB,
        expires_at TIMESTAMP,
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMP,
        revoked_by INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'active'
      );
    `);

    console.log('Creating financial_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        transaction_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        instrument_id INTEGER REFERENCES financial_instruments(id),
        quantity DECIMAL(18,8),
        price DECIMAL(18,8),
        currency TEXT,
        amount DECIMAL(18,8),
        direction TEXT,
        status TEXT NOT NULL,
        executed_at TIMESTAMP,
        settled_at TIMESTAMP,
        counterparty TEXT,
        notes TEXT,
        metadata JSONB,
        requested_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        executed_by INTEGER REFERENCES users(id),
        workspace_id INTEGER REFERENCES workspaces(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating financial_anomaly_rules table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_anomaly_rules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        rule_type TEXT NOT NULL,
        rule_logic JSONB NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL,
        detection_phase TEXT,
        notification_targets JSONB,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        workspace_id INTEGER REFERENCES workspaces(id),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating financial_anomaly_detections table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_anomaly_detections (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER NOT NULL REFERENCES financial_anomaly_rules(id),
        transaction_id UUID REFERENCES financial_transactions(transaction_id),
        session_id TEXT,
        user_id INTEGER REFERENCES users(id),
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        description TEXT NOT NULL,
        evidence_data JSONB,
        detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        assigned_to INTEGER REFERENCES users(id),
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        resolution_notes TEXT,
        workspace_id INTEGER REFERENCES workspaces(id)
      );
    `);

    console.log('Creating financial_audit_traces table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_audit_traces (
        id SERIAL PRIMARY KEY,
        trace_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        session_id TEXT,
        request_id TEXT,
        user_id INTEGER REFERENCES users(id),
        transaction_id UUID REFERENCES financial_transactions(transaction_id),
        source_data_points JSONB,
        reasoning TEXT,
        outcome TEXT,
        evidence_references JSONB,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        workspace_id INTEGER REFERENCES workspaces(id),
        metadata JSONB
      );
    `);

    await client.query('COMMIT');
    console.log('Successfully created all financial services tables');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating financial services tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seed initial regulatory frameworks for SEC, FINRA, MiFID II
 */
async function seedRegulatoryFrameworks() {
  console.log('Seeding regulatory frameworks...');

  const secFramework = await db.query.regulatoryFrameworks.findFirst({
    where: sql`code = 'SEC'`
  });

  if (!secFramework) {
    // Insert SEC framework
    await db.insert(financialSchema.regulatoryFrameworks).values({
      name: 'Securities and Exchange Commission',
      code: 'SEC',
      description: 'Regulatory framework governing securities markets in the United States',
      version: '2023',
      jurisdiction: 'US',
      category: 'securities',
      effectiveDate: new Date('1934-06-06'),
      documentationUrl: 'https://www.sec.gov/regulation',
      status: 'active',
      isDefault: true,
      metadata: {
        agencyType: 'federal',
        enforcementPowers: ['civil penalties', 'criminal referrals', 'administrative proceedings'],
        applicableEntities: ['broker-dealers', 'investment advisers', 'exchanges', 'funds', 'public companies']
      }
    });

    // Add some key SEC rules
    await db.insert(financialSchema.regulatoryRules).values([
      {
        frameworkId: 1, // Assuming the SEC framework gets ID 1
        ruleId: 'Rule 10b-5',
        title: 'Employment of Manipulative and Deceptive Practices',
        description: 'Prohibits fraud or deceit in connection with the purchase or sale of any security',
        ruleText: 'It shall be unlawful for any person, directly or indirectly... (a) To employ any device, scheme, or artifice to defraud, (b) To make any untrue statement of a material fact...',
        category: 'market_integrity',
        severity: 'high',
        status: 'active'
      },
      {
        frameworkId: 1,
        ruleId: 'Regulation S-P',
        title: 'Privacy of Consumer Financial Information',
        description: 'Requires financial institutions to provide consumers with privacy notices and protects against unauthorized disclosure of nonpublic personal information',
        category: 'privacy',
        severity: 'high',
        status: 'active'
      },
      {
        frameworkId: 1,
        ruleId: 'Regulation BI',
        title: 'Best Interest Obligation',
        description: 'Broker-dealers must act in the best interest of retail customers when making recommendations',
        category: 'investor_protection',
        severity: 'high',
        status: 'active'
      }
    ]);
  }

  const finraFramework = await db.query.regulatoryFrameworks.findFirst({
    where: sql`code = 'FINRA'`
  });

  if (!finraFramework) {
    // Insert FINRA framework
    await db.insert(financialSchema.regulatoryFrameworks).values({
      name: 'Financial Industry Regulatory Authority',
      code: 'FINRA',
      description: 'Self-regulatory organization overseeing broker-dealers in the United States',
      version: '2023',
      jurisdiction: 'US',
      category: 'broker-dealer',
      documentationUrl: 'https://www.finra.org/rules-guidance',
      status: 'active',
      isDefault: true,
      metadata: {
        agencyType: 'sro',
        enforcementPowers: ['fines', 'suspensions', 'bars', 'expulsions'],
        applicableEntities: ['broker-dealers', 'registered representatives']
      }
    });

    // Add key FINRA rules
    await db.insert(financialSchema.regulatoryRules).values([
      {
        frameworkId: 2, // Assuming the FINRA framework gets ID 2
        ruleId: 'Rule 2111',
        title: 'Suitability',
        description: 'Requires that a broker-dealer have a reasonable basis to believe that a recommended transaction or investment strategy is suitable for the customer',
        category: 'investor_protection',
        severity: 'high',
        status: 'active'
      },
      {
        frameworkId: 2,
        ruleId: 'Rule 2210',
        title: 'Communications with the Public',
        description: 'Provides standards for broker-dealer communications with the public, including advertising',
        category: 'disclosure',
        severity: 'medium',
        status: 'active'
      }
    ]);
  }

  const mifidFramework = await db.query.regulatoryFrameworks.findFirst({
    where: sql`code = 'MiFID-II'`
  });

  if (!mifidFramework) {
    // Insert MiFID II framework
    await db.insert(financialSchema.regulatoryFrameworks).values({
      name: 'Markets in Financial Instruments Directive II',
      code: 'MiFID-II',
      description: 'EU legislation providing harmonized regulation for investment services across the European Economic Area',
      version: '2018',
      jurisdiction: 'EU',
      category: 'investment_services',
      effectiveDate: new Date('2018-01-03'),
      documentationUrl: 'https://www.esma.europa.eu/policy-rules/mifid-ii-and-mifir',
      status: 'active',
      isDefault: true,
      metadata: {
        agencyType: 'regulatory',
        supersedes: 'MiFID I',
        applicableEntities: ['investment firms', 'credit institutions', 'trading venues']
      }
    });

    // Add key MiFID II rules
    await db.insert(financialSchema.regulatoryRules).values([
      {
        frameworkId: 3, // Assuming the MiFID II framework gets ID 3
        ruleId: 'Article 24',
        title: 'General Principles and Information to Clients',
        description: 'Investment firms must act honestly, fairly and professionally in accordance with the best interests of their clients',
        category: 'investor_protection',
        severity: 'high',
        status: 'active'
      },
      {
        frameworkId: 3,
        ruleId: 'Article 27',
        title: 'Best Execution',
        description: 'Investment firms must take all sufficient steps to obtain the best possible result for their clients when executing orders',
        category: 'market_integrity',
        severity: 'high',
        status: 'active'
      }
    ]);
  }
  
  console.log('Regulatory frameworks seeded successfully');
}

/**
 * Seed financial roles
 */
async function seedFinancialRoles() {
  console.log('Seeding financial roles...');

  // Check if roles already exist
  const analystRole = await db.query.financialRoles.findFirst({
    where: sql`code = 'ANALYST'`
  });

  if (!analystRole) {
    // Insert financial analyst role
    await db.insert(financialSchema.financialRoles).values({
      name: 'Financial Analyst',
      code: 'ANALYST',
      description: 'Research and analyze financial data, prepare reports, and make recommendations',
      permissions: [
        'data.financial.read',
        'reports.financial.create',
        'models.financial.use',
        'instruments.view'
      ],
      dataScopeRestrictions: {
        timeRestriction: 'market_hours_only',
        sensitivityLevels: ['public', 'internal'],
        geographicRestrictions: []
      },
      isSystem: true
    });
  }

  const advisorRole = await db.query.financialRoles.findFirst({
    where: sql`code = 'ADVISOR'`
  });

  if (!advisorRole) {
    // Insert financial advisor role
    await db.insert(financialSchema.financialRoles).values({
      name: 'Financial Advisor',
      code: 'ADVISOR',
      description: 'Provide personalized financial advice to clients',
      permissions: [
        'data.financial.read',
        'clients.manage',
        'reports.financial.create',
        'models.financial.use',
        'instruments.view',
        'recommendations.create'
      ],
      dataScopeRestrictions: {
        clientRestriction: 'assigned_only',
        sensitivityLevels: ['public', 'internal', 'client_specific'],
        requiresDisclosure: true
      },
      approvalRequirements: {
        highValueRecommendations: true,
        complexProducts: true
      },
      regulatoryFrameworks: ['SEC', 'FINRA'],
      isSystem: true
    });
  }

  const traderRole = await db.query.financialRoles.findFirst({
    where: sql`code = 'TRADER'`
  });

  if (!traderRole) {
    // Insert trader role
    await db.insert(financialSchema.financialRoles).values({
      name: 'Trader',
      code: 'TRADER',
      description: 'Execute financial trades and manage trading positions',
      permissions: [
        'data.financial.read',
        'trades.execute',
        'positions.manage',
        'instruments.view',
        'instruments.trade'
      ],
      dataScopeRestrictions: {
        timeRestriction: 'market_hours_only',
        sensitivityLevels: ['public', 'internal', 'trading'],
        geographicRestrictions: []
      },
      tradingLimits: {
        maxOrderSize: 1000000,
        requiresApprovalAbove: 500000,
        instrumentRestrictions: ['complex_derivatives', 'foreign_securities']
      },
      approvalRequirements: {
        largeOrders: true,
        overnight: true,
        newInstruments: true
      },
      regulatoryFrameworks: ['SEC', 'FINRA', 'MiFID-II'],
      isSystem: true
    });
  }

  const complianceRole = await db.query.financialRoles.findFirst({
    where: sql`code = 'COMPLIANCE'`
  });

  if (!complianceRole) {
    // Insert compliance officer role
    await db.insert(financialSchema.financialRoles).values({
      name: 'Compliance Officer',
      code: 'COMPLIANCE',
      description: 'Monitor and ensure compliance with financial regulations',
      permissions: [
        'data.financial.read',
        'compliance.manage',
        'audits.view',
        'audits.create',
        'reports.compliance.create',
        'logs.view',
        'activity.monitor',
        'alerts.manage',
        'instruments.view'
      ],
      dataScopeRestrictions: {
        sensitivityLevels: ['public', 'internal', 'client_specific', 'trading', 'compliance'],
        timeRestriction: 'unrestricted'
      },
      regulatoryFrameworks: ['SEC', 'FINRA', 'MiFID-II'],
      isSystem: true
    });
  }

  console.log('Financial roles seeded successfully');
}