import { db } from "./index";
import * as schema from "@shared/schema";
import * as systemConfigSchema from "@shared/schema_system_config";
import { authService } from "../server/services/auth-service";
import { seedMarketplaceData } from "./seed-marketplace";

async function seed() {
  try {
    console.log("Seeding database...");
    
    // Check if admin user exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "admin")
    });
    
    // Create admin user if it doesn't exist
    if (!existingAdmin) {
      console.log("Creating admin user...");
      const hashedPassword = await authService.hashPassword("admin@123");
      
      await db.insert(schema.users).values({
        username: "admin",
        password: hashedPassword,
        fullName: "Super Admin",
        email: "admin@example.com",
        role: "admin",
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log("Admin user created with username: admin, password: admin@123");
    } else {
      console.log("Admin user already exists, skipping.");
    }
    
    // Check if default workspace exists using direct SQL to avoid schema issues
    const existingWorkspaceResult = await db.execute(
      `SELECT id FROM workspaces WHERE name = 'Enterprise' LIMIT 1`
    );
    const existingWorkspace = existingWorkspaceResult.rows.length > 0 ? existingWorkspaceResult.rows[0] : null;
    
    // Create default workspaces if they don't exist
    if (!existingWorkspace) {
      console.log("Creating default workspaces...");
      
      const workspaces = [
        {
          name: "Enterprise",
          description: "Primary enterprise workspace for production servers",
          status: "active",
          isPrivate: false
        },
        {
          name: "Development",
          description: "Development workspace for testing and development",
          status: "active",
          isPrivate: false
        },
        {
          name: "Testing",
          description: "Testing workspace for QA and verification",
          status: "active",
          isPrivate: false
        }
      ];
      
      for (const workspace of workspaces) {
        await db.insert(schema.workspaces).values(workspace);
      }
      
      console.log("Default workspaces created.");
    } else {
      console.log("Default workspaces already exist, skipping.");
    }
    
    // Check if sample MCP servers exist
    const existingServer = await db.query.mcpServers.findFirst({
      where: (servers, { eq }) => eq(servers.name, "Production-MCP-01")
    });
    
    // Create sample MCP servers if they don't exist
    if (!existingServer) {
      console.log("Creating sample MCP servers...");
      
      // Get workspace IDs using direct SQL queries to avoid schema issues
      const enterpriseWorkspaceResult = await db.execute(
        `SELECT id FROM workspaces WHERE name = 'Enterprise' LIMIT 1`
      );
      const enterpriseWorkspace = enterpriseWorkspaceResult.rows.length > 0 ? enterpriseWorkspaceResult.rows[0] : null;
      
      const developmentWorkspaceResult = await db.execute(
        `SELECT id FROM workspaces WHERE name = 'Development' LIMIT 1`
      );
      const developmentWorkspace = developmentWorkspaceResult.rows.length > 0 ? developmentWorkspaceResult.rows[0] : null;
      
      const testingWorkspaceResult = await db.execute(
        `SELECT id FROM workspaces WHERE name = 'Testing' LIMIT 1`
      );
      const testingWorkspace = testingWorkspaceResult.rows.length > 0 ? testingWorkspaceResult.rows[0] : null;
      
      if (enterpriseWorkspace && developmentWorkspace && testingWorkspace) {
        const servers = [
          {
            name: "Production-MCP-01",
            url: "https://mcp-prod-01.example.com",
            apiKey: "sample-api-key-1",
            status: "active",
            version: "2.4.1",
            type: "primary",
            workspaceId: enterpriseWorkspace.id,
            config: {
              maxConnections: 100,
              timeout: 30000
            }
          },
          {
            name: "Production-MCP-02",
            url: "https://mcp-prod-02.example.com",
            apiKey: "sample-api-key-2",
            status: "active",
            version: "2.4.1",
            type: "secondary",
            workspaceId: enterpriseWorkspace.id,
            config: {
              maxConnections: 100,
              timeout: 30000
            }
          },
          {
            name: "Dev-MCP-01",
            url: "https://mcp-dev-01.example.com",
            apiKey: "sample-api-key-3",
            status: "active",
            version: "2.5.0-beta",
            type: "development",
            workspaceId: developmentWorkspace.id,
            config: {
              maxConnections: 50,
              timeout: 60000
            }
          },
          {
            name: "Test-MCP-01",
            url: "https://mcp-test-01.example.com",
            apiKey: "sample-api-key-4",
            status: "inactive",
            version: "2.4.2",
            type: "testing",
            workspaceId: testingWorkspace.id,
            config: {
              maxConnections: 50,
              timeout: 30000
            }
          },
          {
            name: "Staging-MCP-01",
            url: "https://mcp-staging-01.example.com",
            apiKey: "sample-api-key-5",
            status: "active",
            version: "2.4.1",
            type: "staging",
            workspaceId: testingWorkspace.id,
            config: {
              maxConnections: 75,
              timeout: 30000
            }
          }
        ];
        
        for (const server of servers) {
          await db.insert(schema.mcpServers).values(server);
        }
        
        console.log("Sample MCP servers created.");
        
        // Create sample tools for each server
        console.log("Creating sample tools...");
        
        // Get server IDs
        const prodServer1 = await db.query.mcpServers.findFirst({
          where: (servers, { eq }) => eq(servers.name, "Production-MCP-01")
        });
        
        const prodServer2 = await db.query.mcpServers.findFirst({
          where: (servers, { eq }) => eq(servers.name, "Production-MCP-02")
        });
        
        const devServer = await db.query.mcpServers.findFirst({
          where: (servers, { eq }) => eq(servers.name, "Dev-MCP-01")
        });
        
        if (prodServer1 && prodServer2 && devServer) {
          const commonTools = [
            {
              name: "text-analyzer",
              description: "Analyzes and processes text inputs",
              status: "active",
              toolType: "mcp",
              metadata: { inputFormat: "text", outputFormat: "json" }
            },
            {
              name: "code-analyzer",
              description: "Analyzes and processes code snippets",
              status: "active",
              toolType: "mcp",
              metadata: { inputFormat: "code", outputFormat: "json" }
            },
            {
              name: "image-analyzer",
              description: "Analyzes and processes image data",
              status: "active",
              toolType: "mcp",
              metadata: { inputFormat: "base64", outputFormat: "json" }
            },
            {
              name: "data-extractor",
              description: "Extracts structured data from unstructured inputs",
              status: "active",
              toolType: "mcp",
              metadata: { inputFormat: "text", outputFormat: "json" }
            }
          ];
          
          // Add tools to prod server 1
          for (const tool of commonTools) {
            await db.insert(schema.tools).values({
              ...tool,
              serverId: prodServer1.id
            });
          }
          
          // Add tools to prod server 2
          for (const tool of commonTools) {
            await db.insert(schema.tools).values({
              ...tool,
              serverId: prodServer2.id
            });
          }
          
          // Add some extra tools to dev server
          const devTools = [
            ...commonTools,
            {
              name: "experimental-analyzer",
              description: "Experimental tool for advanced analysis",
              status: "active",
              toolType: "mcp",
              serverId: devServer.id,
              metadata: { inputFormat: "mixed", outputFormat: "json" }
            },
            {
              name: "beta-processor",
              description: "Beta version of data processor",
              status: "active",
              toolType: "mcp",
              serverId: devServer.id,
              metadata: { inputFormat: "json", outputFormat: "json" }
            }
          ];
          
          for (const tool of devTools) {
            await db.insert(schema.tools).values({
              ...tool,
              serverId: devServer.id
            });
          }
          
          console.log("Sample tools created.");
        }
      }
    } else {
      console.log("Sample MCP servers already exist, skipping.");
    }
    
    // Seed A2A orchestration data
    const existingAgent = await db.query.agents.findFirst();
    
    if (!existingAgent) {
      console.log("Creating sample A2A agents...");
      
      // Get workspace IDs using direct SQL queries to avoid schema issues
      const enterpriseWorkspaceResult = await db.execute(
        `SELECT id FROM workspaces WHERE name = 'Enterprise' LIMIT 1`
      );
      const enterpriseWorkspace = enterpriseWorkspaceResult.rows.length > 0 ? enterpriseWorkspaceResult.rows[0] : null;
      
      const developmentWorkspaceResult = await db.execute(
        `SELECT id FROM workspaces WHERE name = 'Development' LIMIT 1`
      );
      const developmentWorkspace = developmentWorkspaceResult.rows.length > 0 ? developmentWorkspaceResult.rows[0] : null;
      
      if (enterpriseWorkspace && developmentWorkspace) {
        // Sample agents
        const agents = [
          {
            name: "LLM Assistant",
            type: "llm",
            description: "Large Language Model assistant agent",
            capabilities: ["text-generation", "summarization", "question-answering"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "Data Retrieval",
            type: "retrieval",
            description: "Document and data retrieval agent",
            capabilities: ["search", "document-retrieval", "knowledge-base"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "Code Analysis",
            type: "tool",
            description: "Code analysis and documentation agent",
            capabilities: ["code-analysis", "documentation", "refactoring"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "Data Processing",
            type: "tool",
            description: "Data processing and transformation agent",
            capabilities: ["data-processing", "transformation", "filtering"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "DB Connector",
            type: "connector",
            description: "Database connection and query agent",
            capabilities: ["sql-generation", "db-connection", "data-retrieval"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "API Connector",
            type: "connector",
            description: "External API connector agent",
            capabilities: ["api-request", "data-fetching", "webhook-handling"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "A2A Orchestrator",
            type: "orchestrator",
            description: "Agent-to-agent workflow orchestrator",
            capabilities: ["workflow-execution", "agent-coordination", "error-handling"],
            status: "active",
            workspaceId: enterpriseWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            name: "Experimental Agent",
            type: "llm",
            description: "Experimental LLM agent for testing",
            capabilities: ["text-generation", "code-generation", "planning"],
            status: "inactive",
            workspaceId: developmentWorkspace.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        
        // Insert agents
        for (const agent of agents) {
          await db.insert(schema.agents).values(agent);
        }
        
        console.log("Sample agents created successfully");
        
        // Get the created agents for flow creation
        const createdAgents = await db.query.agents.findMany();
        
        // Create a map of agent names to IDs for easy reference
        const agentMap = createdAgents.reduce((map, agent) => {
          map[agent.name] = agent.id;
          return map;
        }, {});
        
        // Create sample flows
        console.log("Creating sample A2A flows...");
        
        // Get admin user for createdBy field
        const adminUser = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.username, "admin")
        });
        
        if (adminUser) {
          const flows = [
            {
              name: "Text Analysis Pipeline",
              description: "Process and analyze text data through multiple agents",
              status: "active",
              workspaceId: enterpriseWorkspace.id,
              createdBy: adminUser.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              definition: {
                version: "1.0",
                description: "A pipeline for processing and analyzing text",
                inputs: {
                  text: { type: "string", required: true }
                },
                outputs: {
                  analysis: { type: "object" },
                  summary: { type: "string" }
                },
                steps: [
                  {
                    id: "step1",
                    name: "Text Processing",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      text: "$.inputs.text"
                    },
                    outputs: {
                      processed_text: "$.outputs.result"
                    }
                  },
                  {
                    id: "step2",
                    name: "Context Retrieval",
                    agentId: agentMap["Data Retrieval"],
                    inputs: {
                      query: "$.steps.step1.outputs.processed_text"
                    },
                    outputs: {
                      context: "$.outputs.documents"
                    }
                  },
                  {
                    id: "step3",
                    name: "Final Analysis",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      text: "$.inputs.text",
                      context: "$.steps.step2.outputs.context"
                    },
                    outputs: {
                      analysis: "$.outputs.analysis",
                      summary: "$.outputs.summary"
                    }
                  }
                ]
              }
            },
            {
              name: "Code Documentation Generator",
              description: "Analyze code and generate documentation",
              status: "active",
              workspaceId: enterpriseWorkspace.id,
              createdBy: adminUser.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              definition: {
                version: "1.0",
                description: "Generate documentation from code",
                inputs: {
                  code: { type: "string", required: true },
                  language: { type: "string", required: true }
                },
                outputs: {
                  documentation: { type: "string" }
                },
                steps: [
                  {
                    id: "step1",
                    name: "Code Analysis",
                    agentId: agentMap["Code Analysis"],
                    inputs: {
                      code: "$.inputs.code",
                      language: "$.inputs.language"
                    },
                    outputs: {
                      analysis: "$.outputs.analysis"
                    }
                  },
                  {
                    id: "step2",
                    name: "Documentation Generation",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      analysis: "$.steps.step1.outputs.analysis",
                      code: "$.inputs.code",
                      language: "$.inputs.language"
                    },
                    outputs: {
                      documentation: "$.outputs.text"
                    }
                  }
                ]
              }
            },
            {
              name: "Data Processing Pipeline",
              description: "Process and analyze data from external sources",
              status: "active",
              workspaceId: enterpriseWorkspace.id,
              createdBy: adminUser.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              definition: {
                version: "1.0",
                description: "Process data from external sources",
                inputs: {
                  data_source: { type: "string", required: true },
                  query_params: { type: "object", required: false }
                },
                outputs: {
                  processed_data: { type: "object" },
                  insights: { type: "array" }
                },
                steps: [
                  {
                    id: "step1",
                    name: "Data Extraction",
                    agentId: agentMap["API Connector"],
                    inputs: {
                      source: "$.inputs.data_source",
                      params: "$.inputs.query_params"
                    },
                    outputs: {
                      raw_data: "$.outputs.data"
                    }
                  },
                  {
                    id: "step2",
                    name: "Data Processing",
                    agentId: agentMap["Data Processing"],
                    inputs: {
                      data: "$.steps.step1.outputs.raw_data"
                    },
                    outputs: {
                      processed_data: "$.outputs.data"
                    }
                  },
                  {
                    id: "step3",
                    name: "Data Analysis",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      data: "$.steps.step2.outputs.processed_data"
                    },
                    outputs: {
                      insights: "$.outputs.analysis",
                      summary: "$.outputs.summary"
                    }
                  }
                ]
              }
            },
            {
              name: "Database Query Assistant",
              description: "Generate and execute SQL queries",
              status: "active",
              workspaceId: enterpriseWorkspace.id,
              createdBy: adminUser.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              definition: {
                version: "1.0",
                description: "Generate and execute SQL queries from natural language",
                inputs: {
                  question: { type: "string", required: true },
                  database_context: { type: "object", required: true }
                },
                outputs: {
                  query: { type: "string" },
                  results: { type: "array" },
                  explanation: { type: "string" }
                },
                steps: [
                  {
                    id: "step1",
                    name: "SQL Generation",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      question: "$.inputs.question",
                      context: "$.inputs.database_context"
                    },
                    outputs: {
                      sql_query: "$.outputs.query"
                    }
                  },
                  {
                    id: "step2",
                    name: "Query Execution",
                    agentId: agentMap["DB Connector"],
                    inputs: {
                      query: "$.steps.step1.outputs.sql_query",
                      connection: "$.inputs.database_context.connection"
                    },
                    outputs: {
                      results: "$.outputs.results"
                    }
                  },
                  {
                    id: "step3",
                    name: "Result Explanation",
                    agentId: agentMap["LLM Assistant"],
                    inputs: {
                      query: "$.steps.step1.outputs.sql_query",
                      results: "$.steps.step2.outputs.results",
                      question: "$.inputs.question"
                    },
                    outputs: {
                      explanation: "$.outputs.explanation"
                    }
                  }
                ]
              }
            },
            {
              name: "Experimental Flow",
              description: "Experimental flow for testing - not for production use",
              status: "draft",
              workspaceId: developmentWorkspace.id,
              createdBy: adminUser.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              definition: {
                version: "0.1",
                description: "Experimental flow for testing",
                inputs: {
                  test_input: { type: "string", required: true }
                },
                outputs: {
                  test_output: { type: "string" }
                },
                steps: [
                  {
                    id: "step1",
                    name: "Test Processing",
                    agentId: agentMap["Experimental Agent"],
                    inputs: {
                      text: "$.inputs.test_input"
                    },
                    outputs: {
                      result: "$.outputs.result"
                    }
                  }
                ]
              }
            }
          ];
          
          // Insert flows
          for (const flow of flows) {
            await db.insert(schema.a2aFlows).values(flow);
          }
          
          console.log("Sample A2A flows created successfully");
          
          // Create some sample executions
          console.log("Creating sample flow executions...");
          
          // Get flows
          const createdFlows = await db.query.a2aFlows.findMany({
            where: (flows, { eq }) => eq(flows.status, "active")
          });
          
          if (createdFlows.length > 0) {
            // Get a completed execution timestamp (10 minutes ago)
            const completedAt = new Date();
            completedAt.setMinutes(completedAt.getMinutes() - 10);
            
            // Get a timestamp from 15 minutes ago for start time
            const startedAt = new Date();
            startedAt.setMinutes(startedAt.getMinutes() - 15);
            
            // Sample executions (all completed for simplicity)
            const executions = [
              {
                flowId: createdFlows[0].id,
                status: "completed",
                startedAt,
                completedAt,
                initiatedBy: adminUser.id,
                workspaceId: createdFlows[0].workspaceId,
                created_at: startedAt,
                updated_at: completedAt,
                result: {
                  success: true,
                  stepResults: [
                    {
                      stepId: 1,
                      status: "completed",
                      output: "Processed text sample result"
                    },
                    {
                      stepId: 2,
                      status: "completed",
                      output: "Retrieved context sample result"
                    },
                    {
                      stepId: 3,
                      status: "completed",
                      output: "Final analysis sample result"
                    }
                  ],
                  summary: "Successfully processed sample text through the pipeline"
                }
              },
              {
                flowId: createdFlows[1].id,
                status: "completed",
                startedAt,
                completedAt,
                initiatedBy: adminUser.id,
                workspaceId: createdFlows[1].workspaceId,
                created_at: startedAt,
                updated_at: completedAt,
                result: {
                  success: true,
                  stepResults: [
                    {
                      stepId: 1,
                      status: "completed",
                      output: "Code analysis sample result"
                    },
                    {
                      stepId: 2,
                      status: "completed",
                      output: "Documentation generation sample result"
                    }
                  ],
                  summary: "Successfully generated documentation for the provided code"
                }
              }
            ];
            
            // Insert executions using direct SQL to avoid schema mismatches
            for (const execution of executions) {
              await db.execute(`
                INSERT INTO a2a_executions (
                  flow_id, status, started_at, completed_at, result, error, initiated_by, workspace_id, created_at, updated_at
                ) VALUES (
                  $1, $2::execution_status, $3, $4, $5, $6, $7, $8, $9, $10
                )
              `, [
                execution.flowId,
                execution.status,
                execution.startedAt,
                execution.completedAt || null,
                execution.result ? JSON.stringify(execution.result) : null,
                execution.error || null,
                execution.initiatedBy,
                execution.workspaceId,
                execution.created_at,
                execution.updated_at
              ]);
            }
            
            console.log("Sample A2A executions created successfully");
          }
        }
      }
    } else {
      console.log("A2A agents already exist, skipping A2A seed data.");
    }
    
    // Seed System Configuration data
    console.log("Checking system configuration data...");
    
    // Check if system branding exists by using direct query instead of query builder
    const existingBrandingResult = await db.execute(
      `SELECT id FROM system_branding LIMIT 1`
    );
    const existingBranding = existingBrandingResult.rows.length > 0;
    
    if (!existingBranding) {
      console.log("Creating system branding configuration...");
      
      await db.insert(systemConfigSchema.systemBranding).values({
        organizationName: "NexusMCP Platform",
        primaryColor: "#4f46e5",
        secondaryColor: "#7c3aed",
        footerText: "© 2025 NexusMCP Enterprise Platform",
        address: "1000 Technology Drive, Innovation Park",
        organizationLogo: "/images/logo.svg",
        faviconUrl: "/favicon.ico"
      });
      
      console.log("System branding configuration created.");
    } else {
      console.log("System branding configuration already exists, skipping.");
    }
    
    // Check if SMTP configurations exist using direct query
    const existingSmtpResult = await db.execute(
      `SELECT id FROM smtp_configurations LIMIT 1`
    );
    const existingSmtpConfig = existingSmtpResult.rows.length > 0;
    
    if (!existingSmtpConfig) {
      console.log("Creating sample SMTP configurations...");
      
      const smtpConfigs = [
        {
          name: "Company SMTP",
          host: "smtp.company.com",
          port: 587,
          username: "notifications@company.com",
          encrypted_password: "sample-password-1",
          from_email: "notifications@company.com",
          from_name: "NexusMCP Notifications",
          require_tls: true,
          reject_unauthorized: true,
          environment: "production",
          is_default: true,
          is_active: true,
          max_retries: 3,
          retry_interval: 60,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          name: "Gmail SMTP",
          host: "smtp.gmail.com",
          port: 587,
          username: "company.alerts@gmail.com",
          encrypted_password: "sample-password-2",
          from_email: "company.alerts@gmail.com",
          from_name: "NexusMCP Alerts",
          require_tls: true,
          reject_unauthorized: true,
          environment: "production",
          is_default: false,
          is_active: true,
          max_retries: 3,
          retry_interval: 60,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      for (const config of smtpConfigs) {
        await db.execute(`
          INSERT INTO smtp_configurations (
            name, host, port, username, encrypted_password, from_email, from_name, 
            require_tls, reject_unauthorized, environment, is_default, is_active,
            max_retries, retry_interval, created_at, updated_at
          ) VALUES (
            '${config.name}',
            '${config.host}',
            ${config.port},
            '${config.username}',
            '${config.encrypted_password}',
            '${config.from_email}',
            '${config.from_name}',
            ${config.require_tls},
            ${config.reject_unauthorized},
            '${config.environment}',
            ${config.is_default},
            ${config.is_active},
            ${config.max_retries},
            ${config.retry_interval},
            '${config.created_at}',
            '${config.updated_at}'
          )
        `);
      }
      
      console.log("Sample SMTP configurations created.");
    } else {
      console.log("SMTP configurations already exist, skipping.");
    }
    
    // Check if system integrations exist using direct query
    const existingIntegrationResult = await db.execute(
      `SELECT id FROM system_integrations LIMIT 1`
    );
    const existingIntegration = existingIntegrationResult.rows.length > 0;
    
    if (!existingIntegration) {
      console.log("Creating sample system integrations...");
      
      const integrations = [
        {
          name: "Company LDAP Directory",
          description: "Enterprise LDAP Directory for user authentication and group management",
          type: "ldap",
          status: "active",
          config: {
            host: "ldap.company.com",
            port: 389,
            bindDN: "cn=admin,dc=company,dc=com",
            baseDN: "dc=company,dc=com",
            userFilter: "(objectClass=person)",
            groupFilter: "(objectClass=group)"
          }
        },
        {
          name: "Prometheus Monitoring",
          description: "Internal Prometheus server for metrics collection",
          type: "prometheus",
          status: "active",
          config: {
            url: "http://prometheus.internal:9090",
            basicAuth: true,
            username: "prometheus-user",
            password: "sample-password-3"
          }
        },
        {
          name: "Grafana Dashboard",
          description: "Grafana visualization platform for metrics and analytics",
          type: "grafana",
          status: "active", 
          config: {
            url: "http://grafana.internal:3000",
            apiKey: "sample-grafana-key"
          }
        }
      ];
      
      for (const integration of integrations) {
        await db.execute(`
          INSERT INTO system_integrations (
            name, description, type, status, config
          ) VALUES (
            '${integration.name}',
            '${integration.description}',
            '${integration.type}',
            '${integration.status}',
            '${JSON.stringify(integration.config)}'
          )
        `);
      }
      
      console.log("Sample system integrations created.");
    } else {
      console.log("System integrations already exist, skipping.");
    }
    
    // Check if database configurations exist using direct query
    const existingDbConfigResult = await db.execute(
      `SELECT id FROM database_config LIMIT 1`
    );
    const existingDbConfig = existingDbConfigResult.rows.length > 0;
    
    if (!existingDbConfig) {
      console.log("Creating sample database configurations...");
      
      const dbConfigs = [
        {
          name: "Primary PostgreSQL",
          type: "postgres",
          host: "postgres.internal",
          port: 5432,
          database: "nexusmcp",
          username: "postgres",
          password: "sample-password-4",
          ssl: false,
          isDefault: true,
          isEnabled: true,
          options: {
            poolSize: 20,
            idleTimeoutMillis: 30000
          }
        },
        {
          name: "Analytics Database",
          type: "postgres",
          host: "analytics-db.internal",
          port: 5432,
          database: "analytics",
          username: "analytics_user",
          password: "sample-password-5",
          ssl: false,
          isDefault: false,
          isEnabled: true,
          options: {
            poolSize: 10,
            idleTimeoutMillis: 60000
          }
        }
      ];
      
      for (const config of dbConfigs) {
        await db.execute(`
          INSERT INTO database_config (
            name, type, host, port, database, username, password, ssl, 
            options, is_default, is_enabled
          ) VALUES (
            '${config.name}',
            '${config.type}',
            '${config.host}',
            ${config.port},
            '${config.database}',
            '${config.username}',
            '${config.password}',
            ${config.ssl},
            '${JSON.stringify(config.options)}',
            ${config.isDefault},
            ${config.isEnabled}
          )
        `);
      }
      
      console.log("Sample database configurations created.");
    } else {
      console.log("Database configurations already exist, skipping.");
    }
    
    // Check if monitoring configurations exist using direct query
    const existingMonitoringConfigResult = await db.execute(
      `SELECT id FROM monitoring_config LIMIT 1`
    );
    const existingMonitoringConfig = existingMonitoringConfigResult.rows.length > 0;
    
    if (!existingMonitoringConfig) {
      console.log("Creating sample monitoring configurations...");
      
      const monitoringConfigs = [
        {
          type: "prometheus",
          url: "http://prometheus.internal:9090/api/v1",
          apiKey: "sample-prometheus-key",
          refreshInterval: 60,
          isEnabled: true
        },
        {
          type: "datadog",
          url: "https://api.datadoghq.com/api/v1",
          apiKey: "sample-datadog-key",
          authToken: "sample-datadog-token",
          refreshInterval: 120,
          isEnabled: true
        }
      ];
      
      for (const config of monitoringConfigs) {
        await db.execute(`
          INSERT INTO monitoring_config (
            type, url, api_key, auth_token, refresh_interval, is_enabled
          ) VALUES (
            '${config.type}',
            '${config.url}',
            '${config.apiKey}',
            ${config.authToken ? `'${config.authToken}'` : 'NULL'},
            ${config.refreshInterval},
            ${config.isEnabled}
          )
        `);
      }
      
      console.log("Sample monitoring configurations created.");
    } else {
      console.log("Monitoring configurations already exist, skipping.");
    }
    
    // Seed connector marketplace data
    try {
      await seedMarketplaceData();
    } catch (marketplaceError) {
      console.error("Error seeding marketplace data:", marketplaceError);
    }
    
    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
