import { db } from ".";
import {
  connectorCategories,
  connectorPublishers,
  connectors,
  connectorVersions,
  connectorTags,
  connectorTagRelations,
  connectorCategoryInsertSchema,
  connectorPublisherInsertSchema,
  connectorInsertSchema,
  connectorVersionInsertSchema,
  connectorTagInsertSchema
} from "@shared/schema_marketplace";
import { ConnectorStatus, ConnectorType } from "../server/services/marketplace/ConnectorMarketplaceService";
import { eq } from "drizzle-orm";

/**
 * Seed script for connector marketplace data
 */
export async function seedMarketplaceData() {
  try {
    console.log("Seeding marketplace data...");

    // Seed connector categories
    await seedCategories();
    
    // Seed connector publishers
    await seedPublishers();
    
    // Seed connector tags
    await seedTags();
    
    // Seed sample connectors
    await seedSampleConnectors();
    
    console.log("Marketplace data seeding completed successfully");
  } catch (error) {
    console.error("Error seeding marketplace data:", error);
    throw error;
  }
}

/**
 * Seed connector categories
 */
async function seedCategories() {
  console.log("Seeding connector categories...");
  
  const categories = [
    {
      name: "AI Models",
      slug: "ai-models",
      description: "Connectors for various AI models and services",
      iconUrl: "/images/categories/ai-models.svg",
      position: 1,
      isActive: true
    },
    {
      name: "Data Sources",
      slug: "data-sources",
      description: "Connectors for databases, data warehouses, and other data sources",
      iconUrl: "/images/categories/data-sources.svg",
      position: 2,
      isActive: true
    },
    {
      name: "Security",
      slug: "security",
      description: "Security-related connectors and plugins",
      iconUrl: "/images/categories/security.svg",
      position: 3,
      isActive: true
    },
    {
      name: "Analytics",
      slug: "analytics",
      description: "Analytics and monitoring connectors",
      iconUrl: "/images/categories/analytics.svg",
      position: 4,
      isActive: true
    },
    {
      name: "Integration",
      slug: "integration",
      description: "Integrations with third-party systems and services",
      iconUrl: "/images/categories/integration.svg",
      position: 5,
      isActive: true
    },
    {
      name: "Utilities",
      slug: "utilities",
      description: "Utility connectors and tools",
      iconUrl: "/images/categories/utilities.svg",
      position: 6,
      isActive: true
    },
    {
      name: "Visualization",
      slug: "visualization",
      description: "Data visualization and charting connectors",
      iconUrl: "/images/categories/visualization.svg",
      position: 7,
      isActive: true
    }
  ];
  
  for (const categoryData of categories) {
    // Check if category already exists
    const existingCategory = await db.query.connectorCategories.findFirst({
      where: eq(connectorCategories.slug, categoryData.slug)
    });
    
    if (!existingCategory) {
      // Validate data
      const validatedData = connectorCategoryInsertSchema.parse(categoryData);
      
      // Insert category
      await db.insert(connectorCategories).values(validatedData);
      console.log(`Created category: ${categoryData.name}`);
    } else {
      console.log(`Category already exists: ${categoryData.name}`);
    }
  }
}

/**
 * Seed connector publishers
 */
async function seedPublishers() {
  console.log("Seeding connector publishers...");
  
  const publishers = [
    {
      name: "NexusMCP",
      slug: "nexusmcp",
      description: "Official NexusMCP connectors",
      websiteUrl: "https://nexusmcp.io",
      logoUrl: "/images/publishers/nexusmcp.svg",
      email: "connectors@nexusmcp.io",
      isVerified: true,
      isOfficial: true,
      isActive: true,
      ownerId: 1 // Assumes admin user with ID 1
    },
    {
      name: "AI Systems",
      slug: "ai-systems",
      description: "Advanced AI integration connectors",
      websiteUrl: "https://ai-systems.example.com",
      logoUrl: "/images/publishers/ai-systems.svg",
      email: "connectors@ai-systems.example.com",
      isVerified: true,
      isOfficial: false,
      isActive: true,
      ownerId: 1 // Assumes admin user with ID 1
    },
    {
      name: "DataTech Solutions",
      slug: "datatech-solutions",
      description: "Enterprise data integration specialists",
      websiteUrl: "https://datatech-solutions.example.com",
      logoUrl: "/images/publishers/datatech.svg",
      email: "connectors@datatech-solutions.example.com",
      isVerified: true,
      isOfficial: false,
      isActive: true,
      ownerId: 1 // Assumes admin user with ID 1
    },
    {
      name: "SecurityFirst",
      slug: "security-first",
      description: "Enterprise security solutions and connectors",
      websiteUrl: "https://security-first.example.com",
      logoUrl: "/images/publishers/security-first.svg",
      email: "connectors@security-first.example.com",
      isVerified: true,
      isOfficial: false,
      isActive: true,
      ownerId: 1 // Assumes admin user with ID 1
    }
  ];
  
  for (const publisherData of publishers) {
    // Check if publisher already exists
    const existingPublisher = await db.query.connectorPublishers.findFirst({
      where: eq(connectorPublishers.slug, publisherData.slug)
    });
    
    if (!existingPublisher) {
      // Validate data
      const validatedData = connectorPublisherInsertSchema.parse(publisherData);
      
      // Insert publisher
      await db.insert(connectorPublishers).values(validatedData);
      console.log(`Created publisher: ${publisherData.name}`);
    } else {
      console.log(`Publisher already exists: ${publisherData.name}`);
    }
  }
}

/**
 * Seed connector tags
 */
async function seedTags() {
  console.log("Seeding connector tags...");
  
  const tags = [
    { name: "Featured", slug: "featured" },
    { name: "AI", slug: "ai" },
    { name: "ML", slug: "ml" },
    { name: "Database", slug: "database" },
    { name: "Security", slug: "security" },
    { name: "Analytics", slug: "analytics" },
    { name: "Visualization", slug: "visualization" },
    { name: "Integration", slug: "integration" },
    { name: "Utility", slug: "utility" },
    { name: "Enterprise", slug: "enterprise" },
    { name: "Open Source", slug: "open-source" },
    { name: "Premium", slug: "premium" },
    { name: "Free", slug: "free" }
  ];
  
  for (const tagData of tags) {
    // Check if tag already exists
    const existingTag = await db.query.connectorTags.findFirst({
      where: eq(connectorTags.slug, tagData.slug)
    });
    
    if (!existingTag) {
      // Validate data
      const validatedData = connectorTagInsertSchema.parse(tagData);
      
      // Insert tag
      await db.insert(connectorTags).values(validatedData);
      console.log(`Created tag: ${tagData.name}`);
    } else {
      console.log(`Tag already exists: ${tagData.name}`);
    }
  }
}

/**
 * Seed sample connectors
 */
async function seedSampleConnectors() {
  console.log("Seeding sample connectors...");
  
  // Get category IDs
  const aiCategory = await db.query.connectorCategories.findFirst({
    where: eq(connectorCategories.slug, "ai-models")
  });
  
  const dataCategory = await db.query.connectorCategories.findFirst({
    where: eq(connectorCategories.slug, "data-sources")
  });
  
  const securityCategory = await db.query.connectorCategories.findFirst({
    where: eq(connectorCategories.slug, "security")
  });
  
  const utilitiesCategory = await db.query.connectorCategories.findFirst({
    where: eq(connectorCategories.slug, "utilities")
  });
  
  // Get publisher IDs
  const nexusPublisher = await db.query.connectorPublishers.findFirst({
    where: eq(connectorPublishers.slug, "nexusmcp")
  });
  
  const aiSystemsPublisher = await db.query.connectorPublishers.findFirst({
    where: eq(connectorPublishers.slug, "ai-systems")
  });
  
  const dataTechPublisher = await db.query.connectorPublishers.findFirst({
    where: eq(connectorPublishers.slug, "datatech-solutions")
  });
  
  const securityFirstPublisher = await db.query.connectorPublishers.findFirst({
    where: eq(connectorPublishers.slug, "security-first")
  });
  
  // Get tag IDs
  const aiTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "ai")
  });
  
  const securityTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "security")
  });
  
  const databaseTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "database")
  });
  
  const featuredTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "featured")
  });
  
  const enterpriseTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "enterprise")
  });
  
  const openSourceTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "open-source")
  });
  
  const utilityTag = await db.query.connectorTags.findFirst({
    where: eq(connectorTags.slug, "utility")
  });
  
  if (!aiCategory || !dataCategory || !securityCategory || !utilitiesCategory) {
    console.error("Missing required categories");
    return;
  }
  
  if (!nexusPublisher || !aiSystemsPublisher || !dataTechPublisher || !securityFirstPublisher) {
    console.error("Missing required publishers");
    return;
  }
  
  const sampleConnectors = [
    {
      name: "OpenAI Integration",
      slug: "openai-integration",
      description: "Seamlessly integrate with OpenAI models including ChatGPT, GPT-4, and DALL-E",
      shortDescription: "Integrate with OpenAI's powerful AI models",
      categoryId: aiCategory.id,
      publisherId: nexusPublisher.id,
      version: "1.0.0",
      iconUrl: "/images/connectors/openai.svg",
      bannerUrl: "/images/banners/openai-banner.jpg",
      websiteUrl: "https://openai.com",
      documentationUrl: "https://docs.nexusmcp.io/connectors/openai",
      supportUrl: "https://support.nexusmcp.io",
      licenseName: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      isFeatured: true,
      isVerified: true,
      isOfficial: true,
      isApproved: true,
      isActive: true,
      packageType: ConnectorType.INTEGRATION,
      packageName: "@nexusmcp/openai-connector",
      createdById: 1, // Admin user
      approvedById: 1, // Admin user
      status: ConnectorStatus.APPROVED,
      approvedAt: new Date(),
      configSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            title: "API Key",
            description: "Your OpenAI API key"
          },
          model: {
            type: "string",
            title: "Default Model",
            enum: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
            default: "gpt-4o"
          },
          organization: {
            type: "string",
            title: "Organization ID",
            description: "Optional OpenAI organization ID"
          }
        },
        required: ["apiKey"]
      },
      requiredPermissions: ["ai:openai:*"],
      capabilities: ["text-generation", "image-generation", "embedding", "fine-tuning"]
    },
    {
      name: "PostgreSQL Connector",
      slug: "postgresql-connector",
      description: "Enterprise-grade PostgreSQL connector with advanced security features, connection pooling, and monitoring",
      shortDescription: "Connect to PostgreSQL databases securely",
      categoryId: dataCategory.id,
      publisherId: dataTechPublisher.id,
      version: "1.2.0",
      iconUrl: "/images/connectors/postgresql.svg",
      bannerUrl: "/images/banners/postgresql-banner.jpg",
      websiteUrl: "https://www.postgresql.org",
      documentationUrl: "https://docs.nexusmcp.io/connectors/postgresql",
      supportUrl: "https://datatech-solutions.example.com/support",
      licenseName: "Apache 2.0",
      licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
      isFeatured: true,
      isVerified: true,
      isOfficial: false,
      isApproved: true,
      isActive: true,
      packageType: ConnectorType.INTEGRATION,
      packageName: "@datatech/postgresql-connector",
      createdById: 1, // Admin user
      approvedById: 1, // Admin user
      status: ConnectorStatus.APPROVED,
      approvedAt: new Date(),
      configSchema: {
        type: "object",
        properties: {
          host: {
            type: "string",
            title: "Host",
            default: "localhost"
          },
          port: {
            type: "number",
            title: "Port",
            default: 5432
          },
          database: {
            type: "string",
            title: "Database Name"
          },
          username: {
            type: "string",
            title: "Username"
          },
          password: {
            type: "string",
            title: "Password",
            format: "password"
          },
          ssl: {
            type: "boolean",
            title: "Use SSL",
            default: true
          },
          poolMin: {
            type: "number",
            title: "Min Pool Size",
            default: 2
          },
          poolMax: {
            type: "number",
            title: "Max Pool Size",
            default: 10
          }
        },
        required: ["host", "database", "username", "password"]
      },
      requiredPermissions: ["database:postgresql:*"],
      capabilities: ["connect", "query", "schema", "transaction", "monitoring"]
    },
    {
      name: "Security Scan",
      slug: "security-scan",
      description: "Comprehensive security scanning for your MCP infrastructure, agents, and connectors",
      shortDescription: "Scan your infrastructure for security vulnerabilities",
      categoryId: securityCategory.id,
      publisherId: securityFirstPublisher.id,
      version: "2.1.0",
      iconUrl: "/images/connectors/security-scan.svg",
      bannerUrl: "/images/banners/security-scan-banner.jpg",
      websiteUrl: "https://security-first.example.com/products/security-scan",
      documentationUrl: "https://docs.nexusmcp.io/connectors/security-scan",
      supportUrl: "https://security-first.example.com/support",
      licenseName: "Commercial",
      licenseUrl: "https://security-first.example.com/license",
      isFeatured: false,
      isVerified: true,
      isOfficial: false,
      isApproved: true,
      isActive: true,
      packageType: ConnectorType.SECURITY,
      packageName: "@securityfirst/security-scan",
      createdById: 1, // Admin user
      approvedById: 1, // Admin user
      status: ConnectorStatus.APPROVED,
      approvedAt: new Date(),
      configSchema: {
        type: "object",
        properties: {
          scanInterval: {
            type: "number",
            title: "Scan Interval (hours)",
            default: 24
          },
          notifyEmail: {
            type: "string",
            title: "Notification Email",
            format: "email"
          },
          vulnerabilityDatabase: {
            type: "string",
            title: "Vulnerability Database",
            enum: ["standard", "enhanced", "enterprise"],
            default: "standard"
          },
          enableAutoFix: {
            type: "boolean",
            title: "Enable Auto-Fix",
            default: false
          }
        },
        required: ["scanInterval", "notifyEmail"]
      },
      requiredPermissions: ["security:scan:*", "infrastructure:read"],
      capabilities: ["vulnerability-scanning", "compliance-checking", "remediation", "reporting"]
    },
    {
      name: "MCP Tools",
      slug: "mcp-tools",
      description: "Essential utilities and tools for MCP management and operations",
      shortDescription: "Utilities for MCP management",
      categoryId: utilitiesCategory.id,
      publisherId: nexusPublisher.id,
      version: "1.5.0",
      iconUrl: "/images/connectors/mcp-tools.svg",
      bannerUrl: "/images/banners/mcp-tools-banner.jpg",
      websiteUrl: "https://nexusmcp.io/tools",
      documentationUrl: "https://docs.nexusmcp.io/connectors/mcp-tools",
      supportUrl: "https://support.nexusmcp.io",
      licenseName: "MIT",
      licenseUrl: "https://opensource.org/licenses/MIT",
      isFeatured: false,
      isVerified: true,
      isOfficial: true,
      isApproved: true,
      isActive: true,
      packageType: ConnectorType.UTILITY,
      packageName: "@nexusmcp/mcp-tools",
      createdById: 1, // Admin user
      approvedById: 1, // Admin user
      status: ConnectorStatus.APPROVED,
      approvedAt: new Date(),
      configSchema: {
        type: "object",
        properties: {
          enableAutomation: {
            type: "boolean",
            title: "Enable Automation",
            default: true
          },
          logLevel: {
            type: "string",
            title: "Log Level",
            enum: ["debug", "info", "warn", "error"],
            default: "info"
          }
        }
      },
      requiredPermissions: ["utility:mcp-tools:*"],
      capabilities: ["diagnostics", "monitoring", "optimization", "automation"]
    }
  ];
  
  for (const connectorData of sampleConnectors) {
    // Check if connector already exists
    const existingConnector = await db.query.connectors.findFirst({
      where: eq(connectors.slug, connectorData.slug)
    });
    
    if (!existingConnector) {
      // Validate data
      const validatedData = connectorInsertSchema.parse(connectorData);
      
      // Insert connector
      const [insertedConnector] = await db.insert(connectors)
        .values(validatedData)
        .returning();
      
      console.log(`Created connector: ${connectorData.name}`);
      
      // Add connector version
      const versionData = {
        connectorId: insertedConnector.id,
        version: connectorData.version,
        changelog: `Initial release of ${connectorData.name}`,
        isActive: true,
        isLatest: true,
        packageVersion: connectorData.version,
        configSchema: connectorData.configSchema,
        requiredPermissions: connectorData.requiredPermissions,
        capabilities: connectorData.capabilities,
        createdById: 1 // Admin user
      };
      
      // Validate version data
      const validatedVersionData = connectorVersionInsertSchema.parse(versionData);
      
      // Insert version
      await db.insert(connectorVersions).values(validatedVersionData);
      
      // Add tags to connector
      const tagsToAdd = [];
      
      // Add specific tags based on connector type
      if (connectorData.categoryId === aiCategory.id && aiTag) {
        tagsToAdd.push(aiTag.id);
      }
      
      if (connectorData.categoryId === securityCategory.id && securityTag) {
        tagsToAdd.push(securityTag.id);
      }
      
      if (connectorData.categoryId === dataCategory.id && databaseTag) {
        tagsToAdd.push(databaseTag.id);
      }
      
      if (connectorData.categoryId === utilitiesCategory.id && utilityTag) {
        tagsToAdd.push(utilityTag.id);
      }
      
      // Add featured tag if applicable
      if (connectorData.isFeatured && featuredTag) {
        tagsToAdd.push(featuredTag.id);
      }
      
      // Add enterprise tag for certain publishers
      if ((connectorData.publisherId === securityFirstPublisher.id || 
           connectorData.publisherId === dataTechPublisher.id) && 
           enterpriseTag) {
        tagsToAdd.push(enterpriseTag.id);
      }
      
      // Add open source tag for MIT licensed connectors
      if (connectorData.licenseName === "MIT" && openSourceTag) {
        tagsToAdd.push(openSourceTag.id);
      }
      
      // Insert tag relations
      for (const tagId of tagsToAdd) {
        await db.insert(connectorTagRelations).values({
          connectorId: insertedConnector.id,
          tagId: tagId
        });
      }
      
      console.log(`Added ${tagsToAdd.length} tags to connector: ${connectorData.name}`);
    } else {
      console.log(`Connector already exists: ${connectorData.name}`);
    }
  }
}

// Execute if this script is run directly
if (require.main === module) {
  seedMarketplaceData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seed error:", error);
      process.exit(1);
    });
}