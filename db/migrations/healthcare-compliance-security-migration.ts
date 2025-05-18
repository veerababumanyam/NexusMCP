import { db, pool } from '../index';
import { sql } from 'drizzle-orm';
import { 
  clinicalPlugins, 
  clinicalPluginUsageLogs, 
  clinicalPluginMarketplace,
  ehrIntegrations,
  ehrSyncLogs,
  ehrIntegrationMetrics,
  availableEhrIntegrations
} from '../../shared/schema_healthcare';

import {
  vaultSecrets,
  vaultAccessLogs,
  certificates,
  certificateEvents,
  externalVaultIntegrations,
  externalVaultPaths
} from '../../shared/schema_security';

import {
  dataInventory,
  privacyRequestTypes,
  privacyRequests,
  privacyRequestEvents,
  consentPurposes,
  consentRecords,
  dataProcessingActivities
} from '../../shared/schema_compliance';

/**
 * Run the combined healthcare, security vault, and compliance migration
 */
export async function runCombinedMigration() {
  console.log('Running combined healthcare, security vault, and compliance migration...');
  
  try {
    // Create all the tables in a transaction for atomicity
    await pool.connect(async (conn) => {
      const transaction = conn.transaction();
      
      try {
        await transaction.execute(sql`
          SET LOCAL synchronous_commit TO 'off';
          SET LOCAL statement_timeout = '60s';
        `);
        
        // Healthcare tables
        console.log('Creating healthcare tables...');
        await transaction.execute(sql`
          CREATE TABLE IF NOT EXISTS ${clinicalPlugins._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            version TEXT NOT NULL,
            author TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'inactive',
            hipaa_compliant BOOLEAN NOT NULL DEFAULT FALSE,
            last_used TIMESTAMP,
            usage_count INTEGER DEFAULT 0,
            api_endpoint TEXT,
            configuration JSONB,
            data_access JSON,
            metadata_schema JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            tags JSON,
            security_review JSONB,
            installation_source TEXT,
            marketplace_id TEXT
          );
          
          CREATE TABLE IF NOT EXISTS ${clinicalPluginUsageLogs._.name} (
            id SERIAL PRIMARY KEY,
            plugin_id INTEGER NOT NULL REFERENCES ${clinicalPlugins._.name}(id),
            user_id INTEGER NOT NULL,
            session_id TEXT,
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            action TEXT NOT NULL,
            duration INTEGER,
            status TEXT,
            error_details TEXT,
            metadata JSONB
          );
          
          CREATE TABLE IF NOT EXISTS ${clinicalPluginMarketplace._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            version TEXT NOT NULL,
            author TEXT NOT NULL,
            rating INTEGER,
            installations INTEGER DEFAULT 0,
            hipaa_compliant BOOLEAN NOT NULL DEFAULT FALSE,
            price TEXT,
            setup_complexity TEXT,
            data_access JSON,
            average_setup_time TEXT,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
            features JSON,
            requires_approval BOOLEAN DEFAULT FALSE,
            approval_status TEXT,
            certifications JSON
          );
          
          CREATE TABLE IF NOT EXISTS ${ehrIntegrations._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            version TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'inactive',
            credentials_type TEXT NOT NULL,
            credential_id INTEGER,
            sync_frequency TEXT NOT NULL,
            last_sync TIMESTAMP,
            next_sync TIMESTAMP,
            data_types JSON,
            configuration JSONB,
            mapping_rules JSONB,
            hipaa_compliant BOOLEAN NOT NULL DEFAULT FALSE,
            audit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${ehrSyncLogs._.name} (
            id SERIAL PRIMARY KEY,
            integration_id INTEGER NOT NULL REFERENCES ${ehrIntegrations._.name}(id),
            start_time TIMESTAMP NOT NULL DEFAULT NOW(),
            end_time TIMESTAMP,
            status TEXT NOT NULL,
            records_processed INTEGER DEFAULT 0,
            records_success INTEGER DEFAULT 0,
            records_failed INTEGER DEFAULT 0,
            error_message TEXT,
            details JSONB
          );
          
          CREATE TABLE IF NOT EXISTS ${ehrIntegrationMetrics._.name} (
            id SERIAL PRIMARY KEY,
            integration_id INTEGER NOT NULL REFERENCES ${ehrIntegrations._.name}(id),
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            uptime DECIMAL(5,2) DEFAULT 0,
            response_time INTEGER DEFAULT 0,
            error_rate DECIMAL(5,2) DEFAULT 0,
            synced_records INTEGER DEFAULT 0,
            request_count INTEGER DEFAULT 0,
            average_request_time INTEGER DEFAULT 0,
            last_health_check TIMESTAMP,
            health_check_status TEXT,
            metrics_period TEXT NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS ${availableEhrIntegrations._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT NOT NULL,
            setup_complexity TEXT NOT NULL,
            certifications JSON,
            data_access JSON,
            average_setup_time TEXT,
            documentation_url TEXT,
            template_configuration JSONB,
            requires_credentials BOOLEAN DEFAULT TRUE,
            supported_auth_methods JSON,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        
        // Security Vault tables
        console.log('Creating security vault tables...');
        await transaction.execute(sql`
          CREATE TABLE IF NOT EXISTS ${vaultSecrets._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            value TEXT NOT NULL,
            environment TEXT NOT NULL,
            metadata JSONB,
            project_id INTEGER,
            tags JSON,
            created_by INTEGER NOT NULL,
            updated_by INTEGER,
            expires_at TIMESTAMP,
            rotation_required BOOLEAN DEFAULT FALSE,
            last_rotated TIMESTAMP,
            rotation_period_days INTEGER,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${vaultAccessLogs._.name} (
            id SERIAL PRIMARY KEY,
            secret_id INTEGER REFERENCES ${vaultSecrets._.name}(id),
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            ip_address TEXT,
            user_agent TEXT,
            access_granted BOOLEAN NOT NULL,
            access_reason TEXT,
            details JSONB
          );
          
          CREATE TABLE IF NOT EXISTS ${certificates._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            public_key TEXT NOT NULL,
            private_key TEXT,
            certificate TEXT NOT NULL,
            chain TEXT,
            issued_by TEXT NOT NULL,
            issued_to TEXT NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL,
            serial_number TEXT,
            fingerprint TEXT NOT NULL,
            in_use BOOLEAN DEFAULT FALSE,
            auto_renew BOOLEAN DEFAULT FALSE,
            renewal_reminder_days INTEGER DEFAULT 30,
            environment_id INTEGER,
            status TEXT DEFAULT 'active',
            tags JSON,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${certificateEvents._.name} (
            id SERIAL PRIMARY KEY,
            certificate_id INTEGER REFERENCES ${certificates._.name}(id),
            event_type TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            user_id INTEGER,
            details JSONB
          );
          
          CREATE TABLE IF NOT EXISTS ${externalVaultIntegrations._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            auth_method TEXT NOT NULL,
            auth_credential_id INTEGER,
            namespace TEXT,
            status TEXT DEFAULT 'configured',
            last_connected TIMESTAMP,
            connection_error TEXT,
            created_by INTEGER NOT NULL,
            updated_by INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${externalVaultPaths._.name} (
            id SERIAL PRIMARY KEY,
            integration_id INTEGER REFERENCES ${externalVaultIntegrations._.name}(id),
            path TEXT NOT NULL,
            description TEXT,
            mount_point TEXT,
            allow_fetch BOOLEAN DEFAULT FALSE,
            allow_write BOOLEAN DEFAULT FALSE,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        
        // Compliance tables
        console.log('Creating compliance tables...');
        await transaction.execute(sql`
          CREATE TABLE IF NOT EXISTS ${dataInventory._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            data_type TEXT NOT NULL,
            data_format TEXT NOT NULL,
            source_system TEXT NOT NULL,
            storage_location TEXT NOT NULL,
            retention_period TEXT,
            data_owner TEXT,
            classification TEXT NOT NULL,
            pii_elements JSON,
            security_controls JSONB,
            regulatory_frameworks JSON,
            data_subject_types JSON,
            data_flow_diagram TEXT,
            last_review_date TIMESTAMP,
            review_frequency TEXT,
            access_restrictions JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${consentPurposes._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            legal_basis TEXT NOT NULL,
            data_categories JSON,
            retention_period TEXT,
            is_essential BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            consent_version TEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            jurisdiction_rules JSONB,
            requires_explicit_consent BOOLEAN DEFAULT TRUE,
            display_order INTEGER
          );
          
          CREATE TABLE IF NOT EXISTS ${privacyRequestTypes._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            regulatory_basis JSON,
            required_verification TEXT NOT NULL,
            response_timeframe INTEGER NOT NULL,
            applicable_jurisdictions JSON,
            default_workflow JSONB,
            notification_template TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS ${privacyRequests._.name} (
            id SERIAL PRIMARY KEY,
            request_type_id INTEGER NOT NULL REFERENCES ${privacyRequestTypes._.name}(id),
            identifier TEXT NOT NULL,
            requestor_name TEXT NOT NULL,
            requestor_email TEXT NOT NULL,
            data_subject_name TEXT NOT NULL,
            data_subject_id TEXT,
            status TEXT NOT NULL DEFAULT 'submitted',
            request_details JSONB,
            submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
            due_date DATE NOT NULL,
            completed_at TIMESTAMP,
            last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            last_updated_by INTEGER,
            assigned_to INTEGER,
            verification_status TEXT DEFAULT 'pending',
            verification_method TEXT,
            verification_date TIMESTAMP,
            notes TEXT,
            resolution JSONB,
            affected_systems JSON
          );
          
          CREATE TABLE IF NOT EXISTS ${privacyRequestEvents._.name} (
            id SERIAL PRIMARY KEY,
            request_id INTEGER NOT NULL REFERENCES ${privacyRequests._.name}(id),
            event_type TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            user_id INTEGER,
            details JSONB,
            system_generated BOOLEAN DEFAULT FALSE
          );
          
          CREATE TABLE IF NOT EXISTS ${consentRecords._.name} (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            purpose_id INTEGER NOT NULL REFERENCES ${consentPurposes._.name}(id),
            status TEXT NOT NULL,
            collection_method TEXT NOT NULL,
            collection_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            expiry_date TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            consent_version TEXT NOT NULL,
            data_categories JSON,
            proof JSONB,
            last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
            jurisdiction_id INTEGER,
            identity_verification JSONB
          );
          
          CREATE TABLE IF NOT EXISTS ${dataProcessingActivities._.name} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            purpose_id INTEGER REFERENCES ${consentPurposes._.name}(id),
            processor TEXT NOT NULL,
            processing_type TEXT NOT NULL,
            legal_basis TEXT NOT NULL,
            data_categories JSON,
            data_subjects JSON,
            cross_border_transfers BOOLEAN DEFAULT FALSE,
            transfer_mechanisms JSONB,
            security_measures JSONB,
            retention_period TEXT,
            risk_level TEXT,
            dpia_required BOOLEAN DEFAULT FALSE,
            dpia_completed BOOLEAN DEFAULT FALSE,
            last_review_date TIMESTAMP,
            review_frequency TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          -- Create indexes for better query performance
          CREATE INDEX IF NOT EXISTS clinical_plugins_name_idx ON ${clinicalPlugins._.name}(name);
          CREATE INDEX IF NOT EXISTS clinical_plugins_status_idx ON ${clinicalPlugins._.name}(status);
          CREATE INDEX IF NOT EXISTS clinical_plugin_usage_logs_plugin_id_idx ON ${clinicalPluginUsageLogs._.name}(plugin_id);
          CREATE INDEX IF NOT EXISTS clinical_plugin_usage_logs_user_id_idx ON ${clinicalPluginUsageLogs._.name}(user_id);
          CREATE INDEX IF NOT EXISTS ehr_integrations_status_idx ON ${ehrIntegrations._.name}(status);
          CREATE INDEX IF NOT EXISTS ehr_sync_logs_integration_id_idx ON ${ehrSyncLogs._.name}(integration_id);
          CREATE INDEX IF NOT EXISTS ehr_integration_metrics_integration_id_idx ON ${ehrIntegrationMetrics._.name}(integration_id);
          
          CREATE INDEX IF NOT EXISTS vault_secrets_name_idx ON ${vaultSecrets._.name}(name);
          CREATE INDEX IF NOT EXISTS vault_secrets_type_idx ON ${vaultSecrets._.name}(type);
          CREATE INDEX IF NOT EXISTS vault_secrets_status_idx ON ${vaultSecrets._.name}(status);
          CREATE INDEX IF NOT EXISTS vault_access_logs_secret_id_idx ON ${vaultAccessLogs._.name}(secret_id);
          CREATE INDEX IF NOT EXISTS vault_access_logs_user_id_idx ON ${vaultAccessLogs._.name}(user_id);
          CREATE INDEX IF NOT EXISTS certificates_name_idx ON ${certificates._.name}(name);
          CREATE INDEX IF NOT EXISTS certificates_status_idx ON ${certificates._.name}(status);
          CREATE INDEX IF NOT EXISTS certificates_valid_to_idx ON ${certificates._.name}(valid_to);
          
          CREATE INDEX IF NOT EXISTS privacy_requests_status_idx ON ${privacyRequests._.name}(status);
          CREATE INDEX IF NOT EXISTS privacy_requests_type_id_idx ON ${privacyRequests._.name}(request_type_id);
          CREATE INDEX IF NOT EXISTS privacy_request_events_request_id_idx ON ${privacyRequestEvents._.name}(request_id);
          CREATE INDEX IF NOT EXISTS consent_records_user_id_idx ON ${consentRecords._.name}(user_id);
          CREATE INDEX IF NOT EXISTS consent_records_purpose_id_idx ON ${consentRecords._.name}(purpose_id);
          CREATE INDEX IF NOT EXISTS consent_purposes_name_idx ON ${consentPurposes._.name}(name);
        `);
        
        await transaction.commit();
        console.log('All tables created successfully');
      } catch (error) {
        await transaction.rollback();
        console.error('Error creating tables:', error);
        throw error;
      }
    });
    
    // Seed some default data
    await seedDefaultData();
    
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

/**
 * Seed default data for enterprise-grade functionality
 */
async function seedDefaultData() {
  try {
    console.log('Seeding default data...');
    
    // Seed default privacy request types
    await seedPrivacyRequestTypes();
    
    // Seed default consent purposes
    await seedConsentPurposes();
    
    // Seed sample EHR integrations
    await seedSampleEhrIntegrations();
    
    console.log('Default data seeded successfully');
  } catch (error) {
    console.error('Error seeding default data:', error);
  }
}

/**
 * Seed default privacy request types
 */
async function seedPrivacyRequestTypes() {
  const existingTypes = await db.select().from(privacyRequestTypes).execute();
  
  if (existingTypes.length === 0) {
    console.log('Seeding privacy request types...');
    
    const defaultTypes = [
      {
        name: 'Data Access Request',
        description: 'Request for access to personal data under GDPR Article 15 and other privacy laws',
        category: 'Access',
        regulatoryBasis: ['GDPR Article 15', 'CCPA Section 1798.100', 'PIPEDA Principle 9'],
        requiredVerification: 'Enhanced',
        responseTimeFrame: 30,
        applicableJurisdictions: ['EU', 'UK', 'California', 'Canada'],
        defaultWorkflow: {
          steps: [
            { name: 'Verification', assigneeRole: 'Privacy Analyst' },
            { name: 'Data Collection', assigneeRole: 'Data Steward' },
            { name: 'Review', assigneeRole: 'Privacy Officer' },
            { name: 'Delivery', assigneeRole: 'Privacy Analyst' }
          ]
        },
        notificationTemplate: 'data_access_request_notification',
        isActive: true
      },
      {
        name: 'Right to Erasure',
        description: 'Request for deletion of personal data under GDPR Article 17 and other privacy laws',
        category: 'Deletion',
        regulatoryBasis: ['GDPR Article 17', 'CCPA Section 1798.105', 'CPRA Section 1798.105'],
        requiredVerification: 'Enhanced',
        responseTimeFrame: 30,
        applicableJurisdictions: ['EU', 'UK', 'California'],
        defaultWorkflow: {
          steps: [
            { name: 'Verification', assigneeRole: 'Privacy Analyst' },
            { name: 'Impact Analysis', assigneeRole: 'Data Steward' },
            { name: 'Deletion Processing', assigneeRole: 'System Administrator' },
            { name: 'Verification', assigneeRole: 'Privacy Officer' },
            { name: 'Confirmation', assigneeRole: 'Privacy Analyst' }
          ]
        },
        notificationTemplate: 'deletion_request_notification',
        isActive: true
      },
      {
        name: 'Data Correction',
        description: 'Request to correct inaccurate personal data under GDPR Article 16 and other privacy laws',
        category: 'Correction',
        regulatoryBasis: ['GDPR Article 16', 'CCPA Section 1798.106', 'PIPEDA Principle 9'],
        requiredVerification: 'Enhanced',
        responseTimeFrame: 30,
        applicableJurisdictions: ['EU', 'UK', 'California', 'Canada'],
        defaultWorkflow: {
          steps: [
            { name: 'Verification', assigneeRole: 'Privacy Analyst' },
            { name: 'Correction Processing', assigneeRole: 'Data Steward' },
            { name: 'Verification', assigneeRole: 'Privacy Officer' },
            { name: 'Confirmation', assigneeRole: 'Privacy Analyst' }
          ]
        },
        notificationTemplate: 'correction_request_notification',
        isActive: true
      },
      {
        name: 'Data Portability',
        description: 'Request for portable copy of data under GDPR Article 20 and other privacy laws',
        category: 'Portability',
        regulatoryBasis: ['GDPR Article 20', 'CCPA Section 1798.100', 'CPRA Section 1798.100'],
        requiredVerification: 'Enhanced',
        responseTimeFrame: 30,
        applicableJurisdictions: ['EU', 'UK', 'California'],
        defaultWorkflow: {
          steps: [
            { name: 'Verification', assigneeRole: 'Privacy Analyst' },
            { name: 'Data Collection', assigneeRole: 'Data Steward' },
            { name: 'Format Conversion', assigneeRole: 'System Administrator' },
            { name: 'Review', assigneeRole: 'Privacy Officer' },
            { name: 'Delivery', assigneeRole: 'Privacy Analyst' }
          ]
        },
        notificationTemplate: 'portability_request_notification',
        isActive: true
      },
      {
        name: 'Opt-Out of Sale',
        description: 'Request to opt-out of the sale of personal information under CCPA/CPRA',
        category: 'Opt-out',
        regulatoryBasis: ['CCPA Section 1798.120', 'CPRA Section 1798.120'],
        requiredVerification: 'Basic',
        responseTimeFrame: 15,
        applicableJurisdictions: ['California', 'Virginia', 'Colorado'],
        defaultWorkflow: {
          steps: [
            { name: 'Verification', assigneeRole: 'Privacy Analyst' },
            { name: 'Opt-Out Processing', assigneeRole: 'Data Steward' },
            { name: 'Confirmation', assigneeRole: 'Privacy Analyst' }
          ]
        },
        notificationTemplate: 'opt_out_request_notification',
        isActive: true
      }
    ];
    
    for (const type of defaultTypes) {
      await db.insert(privacyRequestTypes).values(type).execute();
    }
    
    console.log(`Seeded ${defaultTypes.length} privacy request types`);
  }
}

/**
 * Seed default consent purposes
 */
async function seedConsentPurposes() {
  const existingPurposes = await db.select().from(consentPurposes).execute();
  
  if (existingPurposes.length === 0) {
    console.log('Seeding consent purposes...');
    
    const defaultPurposes = [
      {
        name: 'Essential Services',
        description: 'Processing necessary for the functioning of the platform and providing the service',
        legalBasis: 'Contract',
        dataCategories: ['Account Data', 'Usage Data', 'Device Data'],
        retentionPeriod: 'Account Lifetime + 90 days',
        isEssential: true,
        isActive: true,
        consentVersion: '1.0.0',
        requiresExplicitConsent: false,
        displayOrder: 1
      },
      {
        name: 'Analytics and Improvement',
        description: 'Processing to analyze usage patterns and improve our services',
        legalBasis: 'Legitimate Interest',
        dataCategories: ['Usage Data', 'Device Data', 'Behavior Data'],
        retentionPeriod: '25 months',
        isEssential: false,
        isActive: true,
        consentVersion: '1.0.0',
        requiresExplicitConsent: true,
        displayOrder: 2
      },
      {
        name: 'Personalized Experience',
        description: 'Processing to customize and enhance your experience with our services',
        legalBasis: 'Consent',
        dataCategories: ['Preference Data', 'Behavior Data', 'Profile Data'],
        retentionPeriod: 'Account Lifetime or Consent Withdrawal',
        isEssential: false,
        isActive: true,
        consentVersion: '1.0.0',
        requiresExplicitConsent: true,
        displayOrder: 3
      },
      {
        name: 'Marketing Communications',
        description: 'Processing to send promotional materials and relevant offers',
        legalBasis: 'Consent',
        dataCategories: ['Contact Data', 'Preference Data', 'Profile Data'],
        retentionPeriod: 'Until Consent Withdrawal',
        isEssential: false,
        isActive: true,
        consentVersion: '1.0.0',
        requiresExplicitConsent: true,
        displayOrder: 4
      },
      {
        name: 'AI Model Training',
        description: 'Processing data to improve AI models and enhance tool accuracy',
        legalBasis: 'Consent',
        dataCategories: ['Interaction Data', 'Content Data'],
        retentionPeriod: '36 months',
        isEssential: false,
        isActive: true,
        consentVersion: '1.0.0',
        requiresExplicitConsent: true,
        displayOrder: 5
      }
    ];
    
    for (const purpose of defaultPurposes) {
      await db.insert(consentPurposes).values(purpose).execute();
    }
    
    console.log(`Seeded ${defaultPurposes.length} consent purposes`);
  }
}

/**
 * Seed sample EHR integrations
 */
async function seedSampleEhrIntegrations() {
  const existingTemplates = await db.select().from(availableEhrIntegrations).execute();
  
  if (existingTemplates.length === 0) {
    console.log('Seeding available EHR integrations...');
    
    const defaultTemplates = [
      {
        name: 'Epic FHIR Integration',
        type: 'FHIR',
        version: 'R4',
        description: 'Integration with Epic EHR systems using FHIR R4 API',
        setupComplexity: 'Complex',
        certifications: ['HITRUST', 'ONC Certified'],
        dataAccess: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationRequest', 'Procedure'],
        averageSetupTime: '3-4 weeks',
        documentationUrl: 'https://fhir.epic.com/Documentation',
        templateConfiguration: {
          authType: 'OAuth2',
          endpointPattern: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
          scopes: ['patient/*.read', 'user/*.read'],
          tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token'
        },
        requiresCredentials: true,
        supportedAuthMethods: ['OAuth2', 'Client Certificates']
      },
      {
        name: 'Cerner Millennium FHIR Integration',
        type: 'FHIR',
        version: 'R4',
        description: 'Integration with Cerner Millennium EHR systems using FHIR R4 API',
        setupComplexity: 'Complex',
        certifications: ['HITRUST', 'ONC Certified'],
        dataAccess: ['Patient', 'Encounter', 'Observation', 'Condition', 'Medication', 'AllergyIntolerance'],
        averageSetupTime: '3-5 weeks',
        documentationUrl: 'https://fhir.cerner.com/millennium/dstu2/',
        templateConfiguration: {
          authType: 'OAuth2',
          endpointPattern: 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
          scopes: ['patient/*.read', 'user/*.read'],
          tokenUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token'
        },
        requiresCredentials: true,
        supportedAuthMethods: ['OAuth2', 'SMART on FHIR']
      },
      {
        name: 'Allscripts FHIR Integration',
        type: 'FHIR',
        version: 'R4',
        description: 'Integration with Allscripts EHR systems using FHIR R4 API',
        setupComplexity: 'Medium',
        certifications: ['ONC Certified'],
        dataAccess: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationStatement'],
        averageSetupTime: '2-4 weeks',
        documentationUrl: 'https://developer.allscripts.com/content/fhir/index.html',
        templateConfiguration: {
          authType: 'OAuth2',
          endpointPattern: 'https://apis.allscripts.com/fhir/r4',
          scopes: ['patient/*.read', 'user/*.read'],
          tokenUrl: 'https://apis.allscripts.com/auth/oauth2/token'
        },
        requiresCredentials: true,
        supportedAuthMethods: ['OAuth2', 'API Key']
      },
      {
        name: 'NextGen Healthcare Integration',
        type: 'Proprietary',
        version: '5.9',
        description: 'Integration with NextGen Healthcare EHR using proprietary API',
        setupComplexity: 'Medium',
        certifications: ['ONC Certified'],
        dataAccess: ['Demographics', 'Encounters', 'Clinical Data', 'Medications', 'Lab Results'],
        averageSetupTime: '2-3 weeks',
        documentationUrl: 'https://www.nextgen.com/products-and-services/interoperability',
        templateConfiguration: {
          authType: 'Basic',
          endpointPattern: 'https://api.nextgen.com/api/v1',
          headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}
        },
        requiresCredentials: true,
        supportedAuthMethods: ['Basic Auth', 'API Key']
      },
      {
        name: 'Athenahealth FHIR Integration',
        type: 'FHIR',
        version: 'R4',
        description: 'Integration with Athenahealth EHR systems using FHIR R4 API',
        setupComplexity: 'Medium',
        certifications: ['ONC Certified'],
        dataAccess: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationStatement'],
        averageSetupTime: '2-3 weeks',
        documentationUrl: 'https://developer.athenahealth.com/docs/read/fhir',
        templateConfiguration: {
          authType: 'OAuth2',
          endpointPattern: 'https://api.athenahealth.com/fhir/r4',
          scopes: ['patient/*.read', 'user/*.read'],
          tokenUrl: 'https://api.athenahealth.com/oauth2/token'
        },
        requiresCredentials: true,
        supportedAuthMethods: ['OAuth2', 'API Key']
      },
      {
        name: 'HL7 v2.x Integration',
        type: 'HL7',
        version: 'v2.5',
        description: 'Generic HL7 v2.x integration for legacy healthcare systems',
        setupComplexity: 'Complex',
        certifications: [],
        dataAccess: ['ADT', 'ORM', 'ORU', 'SIU', 'MDM'],
        averageSetupTime: '4-6 weeks',
        documentationUrl: 'https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185',
        templateConfiguration: {
          connectionType: 'MLLP',
          port: 2575,
          requiresAcknowledgement: true,
          messageTypes: ['ADT', 'ORM', 'ORU', 'SIU', 'MDM']
        },
        requiresCredentials: true,
        supportedAuthMethods: ['TLS Certificates', 'IP Whitelisting']
      }
    ];
    
    for (const template of defaultTemplates) {
      await db.insert(availableEhrIntegrations).values(template).execute();
    }
    
    console.log(`Seeded ${defaultTemplates.length} available EHR integration templates`);
  }
}

// Export the function for use in the main migration script
if (require.main === module) {
  runCombinedMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}