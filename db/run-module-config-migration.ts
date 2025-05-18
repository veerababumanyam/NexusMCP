/**
 * Module Configuration Migration
 * 
 * This migration adds tables for system module configuration:
 * - System modules configuration (enable/disable enterprise modules)
 * - AI provider configuration (OpenAI, Azure OpenAI, etc.)
 */

import { db, pool } from './index';
import { systemModules, aiProviders } from '../shared/schema_system';
import { sql } from 'drizzle-orm';

/**
 * Run the module configuration migration
 */
export async function runModuleConfigMigration() {
  console.log('Running module configuration migration...');
  
  try {
    // Create tables
    await createSystemModulesTables();
    
    // Seed default data
    await seedDefaultModules();
    await seedDefaultAiProviders();
    
    console.log('Module configuration migration completed successfully.');
  } catch (error) {
    console.error('Error running module configuration migration:', error);
    throw error;
  }
}

/**
 * Create system module tables using SQL
 */
async function createSystemModulesTables() {
  console.log('Creating system module tables...');
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_modules (
        id SERIAL PRIMARY KEY,
        module_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        required_permission TEXT,
        config_path TEXT,
        icon_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_providers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        is_default BOOLEAN DEFAULT false,
        config_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('System module tables created.');
  } catch (error) {
    console.error('Error creating system module tables:', error);
    throw error;
  }
}

/**
 * Seed default system modules
 */
async function seedDefaultModules() {
  console.log('Seeding default system modules...');
  
  // Check existing modules to avoid duplicates
  const existingModules = await db.select().from(systemModules);
  const existingModuleNames = existingModules.map(m => m.moduleName);
  
  // Define default modules
  const defaultModules = [
    {
      moduleName: 'financial',
      displayName: 'Financial Services',
      description: 'Financial services features including regulatory compliance, transaction monitoring, and anomaly detection',
      enabled: true,
      requiredPermission: 'financial:access',
      configPath: '/system/modules/financial',
      iconName: 'CreditCard'
    },
    {
      moduleName: 'healthcare',
      displayName: 'Healthcare Services',
      description: 'Healthcare compliance features including PHI management, HIPAA compliance, and medical data processing',
      enabled: true,
      requiredPermission: 'healthcare:access',
      configPath: '/system/modules/healthcare',
      iconName: 'Activity'
    },
    {
      moduleName: 'ml_analysis',
      displayName: 'Machine Learning Analysis',
      description: 'Advanced ML-powered analytics for data analysis and pattern recognition',
      enabled: true,
      requiredPermission: 'ml:access',
      configPath: '/system/modules/ml',
      iconName: 'Brain'
    }
  ];
  
  // Insert modules that don't already exist
  for (const module of defaultModules) {
    if (!existingModuleNames.includes(module.moduleName)) {
      await db.insert(systemModules).values(module);
      console.log(`Added module: ${module.displayName}`);
    } else {
      console.log(`Module ${module.displayName} already exists, skipping`);
    }
  }
}

/**
 * Seed default AI providers
 */
async function seedDefaultAiProviders() {
  console.log('Seeding default AI providers...');
  
  // Check existing providers to avoid duplicates
  const existingProviders = await db.select().from(aiProviders);
  const existingProviderNames = existingProviders.map(p => p.name);
  
  // Define default providers
  const defaultProviders = [
    {
      name: 'openai',
      displayName: 'OpenAI',
      description: 'Standard OpenAI API integration',
      providerType: 'openai',
      enabled: true,
      isDefault: true,
      configData: {
        defaultModel: 'gpt-4o',
        timeout: 30000
      }
    },
    {
      name: 'azure_openai',
      displayName: 'Azure OpenAI',
      description: 'Microsoft Azure OpenAI API integration',
      providerType: 'azure_openai',
      enabled: false,
      isDefault: false,
      configData: {
        apiVersion: '2023-05-15',
        defaultModel: 'gpt-4',
        timeout: 30000
      }
    }
  ];
  
  // Insert providers that don't already exist
  for (const provider of defaultProviders) {
    if (!existingProviderNames.includes(provider.name)) {
      await db.insert(aiProviders).values(provider);
      console.log(`Added AI provider: ${provider.displayName}`);
    } else {
      console.log(`AI provider ${provider.displayName} already exists, skipping`);
    }
  }
}