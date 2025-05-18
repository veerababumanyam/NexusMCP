import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { db } from '@db';
import { eq, and, inArray, like, desc, isNull, sql, asc } from 'drizzle-orm';
import { 
  InsertMcpAgent, 
  McpAgent, 
  InsertAgentTool, 
  InsertAgentWorkflow,
  AgentWorkflow,
  InsertAgentWorkflowStep,
  InsertAgentWorkflowConnection,
  InsertAgentExecutionLog,
  InsertAgentCommunicationLog,
  mcpAgents,
  agentTools,
  agentWorkflows,
  agentWorkflowSteps,
  agentWorkflowConnections,
  agentExecutionLogs,
  agentCommunicationLogs,
  agentTemplates
} from '@shared/schema_agents';
import { tools, mcpServers } from '@shared/schema';
import { storage } from '../storage';
import { EventBus } from './eventBusService';

/**
 * Agent Management Service
 * 
 * Handles the lifecycle management of agents, including:
 * - Agent registration
 * - Agent authentication
 * - Agent configuration
 * - Agent-to-agent communication
 * - Agent workflows
 */
export class AgentManagementService {
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Register event handlers
    this.eventBus.subscribe('agent.registered', this.handleAgentRegistered.bind(this));
    this.eventBus.subscribe('agent.updated', this.handleAgentUpdated.bind(this));
    this.eventBus.subscribe('agent.deregistered', this.handleAgentDeregistered.bind(this));
    this.eventBus.subscribe('agent.execution.started', this.handleAgentExecutionStarted.bind(this));
    this.eventBus.subscribe('agent.execution.completed', this.handleAgentExecutionCompleted.bind(this));
    this.eventBus.subscribe('agent.a2a.message', this.handleA2AMessage.bind(this));
    
    console.log('Agent Management Service initialized');
  }
  
  /**
   * Register a new agent with the system
   */
  public async registerAgent(agentData: Omit<InsertMcpAgent, 'apiKey' | 'apiKeyHash'>): Promise<McpAgent> {
    try {
      // Generate API key for the agent
      const apiKey = this.generateApiKey();
      const apiKeyHash = this.hashApiKey(apiKey);
      
      // Create the agent in the database
      const [agent] = await db.insert(mcpAgents).values({
        ...agentData,
        apiKey,
        apiKeyHash
      }).returning();
      
      // Emit agent registered event
      this.eventBus.publish('agent.registered', { 
        agentId: agent.id, 
        agentType: agent.agentType,
        name: agent.name
      });
      
      console.log(`Registered new agent: ${agent.name} (${agent.agentType})`);
      
      // Return the agent with the API key (this will be the only time the API key is available in plaintext)
      return agent;
    } catch (error) {
      console.error('Error registering agent:', error);
      throw new Error(`Failed to register agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Authenticate an agent using its API key
   */
  public async authenticateAgent(agentId: number, apiKey: string): Promise<boolean> {
    try {
      const agent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, agentId)
      });
      
      if (!agent) {
        return false;
      }
      
      // Check if the API key is correct
      if (agent.apiKey !== apiKey) {
        return false;
      }
      
      // Update last active timestamp
      await db.update(mcpAgents)
        .set({ lastActiveAt: new Date() })
        .where(eq(mcpAgents.id, agentId));
      
      return true;
    } catch (error) {
      console.error('Error authenticating agent:', error);
      return false;
    }
  }
  
  /**
   * Update an existing agent
   */
  public async updateAgent(agentId: number, agentData: Partial<InsertMcpAgent>): Promise<McpAgent | null> {
    try {
      // Remove apiKey and apiKeyHash from the update data if present
      const { apiKey, apiKeyHash, ...updateData } = agentData;
      
      // Update the agent in the database
      const [agent] = await db.update(mcpAgents)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(mcpAgents.id, agentId))
        .returning();
      
      if (!agent) {
        return null;
      }
      
      // Emit agent updated event
      this.eventBus.publish('agent.updated', { 
        agentId: agent.id, 
        agentType: agent.agentType,
        name: agent.name,
        updates: Object.keys(updateData)
      });
      
      return agent;
    } catch (error) {
      console.error(`Error updating agent ${agentId}:`, error);
      throw new Error(`Failed to update agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Deregister an agent from the system
   */
  public async deregisterAgent(agentId: number): Promise<boolean> {
    try {
      // Get agent info for the event
      const agent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, agentId)
      });
      
      if (!agent) {
        return false;
      }
      
      // Delete agent tools first due to foreign key constraints
      await db.delete(agentTools)
        .where(eq(agentTools.agentId, agentId));
      
      // Delete the agent
      const result = await db.delete(mcpAgents)
        .where(eq(mcpAgents.id, agentId))
        .returning({ id: mcpAgents.id });
      
      if (result.length === 0) {
        return false;
      }
      
      // Emit agent deregistered event
      this.eventBus.publish('agent.deregistered', { 
        agentId: agent.id, 
        agentType: agent.agentType,
        name: agent.name
      });
      
      return true;
    } catch (error) {
      console.error(`Error deregistering agent ${agentId}:`, error);
      throw new Error(`Failed to deregister agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Regenerate API key for an agent
   */
  public async regenerateApiKey(agentId: number): Promise<{ apiKey: string } | null> {
    try {
      // Generate new API key
      const apiKey = this.generateApiKey();
      const apiKeyHash = this.hashApiKey(apiKey);
      
      // Update the agent in the database
      const [agent] = await db.update(mcpAgents)
        .set({
          apiKey,
          apiKeyHash,
          updatedAt: new Date()
        })
        .where(eq(mcpAgents.id, agentId))
        .returning();
      
      if (!agent) {
        return null;
      }
      
      // Emit event
      this.eventBus.publish('agent.apiKeyChanged', { 
        agentId: agent.id,
        name: agent.name
      });
      
      return { apiKey };
    } catch (error) {
      console.error(`Error regenerating API key for agent ${agentId}:`, error);
      throw new Error(`Failed to regenerate API key: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get all agents, with optional filtering
   */
  public async getAgents(options: { 
    workspaceId?: number, 
    agentType?: string,
    serverId?: number,
    status?: string,
    implementsA2A?: boolean,
    search?: string,
    limit?: number,
    offset?: number
  } = {}): Promise<{ agents: McpAgent[], total: number }> {
    try {
      let query = db.select().from(mcpAgents);
      
      // Apply filters
      if (options.workspaceId !== undefined) {
        query = query.where(eq(mcpAgents.workspaceId, options.workspaceId));
      }
      
      if (options.agentType) {
        query = query.where(eq(mcpAgents.agentType, options.agentType));
      }
      
      if (options.serverId) {
        query = query.where(eq(mcpAgents.serverId, options.serverId));
      }
      
      if (options.status) {
        query = query.where(eq(mcpAgents.status, options.status));
      }
      
      if (options.implementsA2A !== undefined) {
        query = query.where(eq(mcpAgents.implementsA2A, options.implementsA2A));
      }
      
      if (options.search) {
        query = query.where(
          sql`${mcpAgents.name} ILIKE ${'%' + options.search + '%'} 
          OR ${mcpAgents.description} ILIKE ${'%' + options.search + '%'}`
        );
      }
      
      // Get total count for pagination
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(query.as('filtered_agents'));
      const total = countResult[0]?.count || 0;
      
      // Apply pagination
      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }
      
      if (options.offset !== undefined) {
        query = query.offset(options.offset);
      }
      
      // Order by latest first
      query = query.orderBy(desc(mcpAgents.createdAt));
      
      const agents = await query;
      
      return { agents, total };
    } catch (error) {
      console.error('Error getting agents:', error);
      throw new Error(`Failed to get agents: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get a single agent by ID
   */
  public async getAgent(agentId: number): Promise<McpAgent | null> {
    try {
      const agent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, agentId),
        with: {
          tools: {
            with: {
              tool: true
            }
          }
        }
      });
      
      return agent;
    } catch (error) {
      console.error(`Error getting agent ${agentId}:`, error);
      throw new Error(`Failed to get agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Associate tools with an agent
   */
  public async assignToolsToAgent(agentId: number, toolIds: number[]): Promise<number> {
    try {
      // Begin a transaction
      return await db.transaction(async (tx) => {
        // Get existing tool assignments for this agent
        const existingTools = await tx.select()
          .from(agentTools)
          .where(eq(agentTools.agentId, agentId));
        
        const existingToolIds = existingTools.map(t => t.toolId);
        
        // Determine which tools need to be added
        const toolsToAdd = toolIds.filter(id => !existingToolIds.includes(id));
        
        if (toolsToAdd.length === 0) {
          return 0; // No new tools to add
        }
        
        // Insert new tool assignments
        const insertValues = toolsToAdd.map(toolId => ({
          agentId,
          toolId,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        
        const result = await tx.insert(agentTools)
          .values(insertValues)
          .returning();
        
        return result.length;
      });
    } catch (error) {
      console.error(`Error assigning tools to agent ${agentId}:`, error);
      throw new Error(`Failed to assign tools to agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Remove tools from an agent
   */
  public async removeToolsFromAgent(agentId: number, toolIds: number[]): Promise<number> {
    try {
      const result = await db.delete(agentTools)
        .where(
          and(
            eq(agentTools.agentId, agentId),
            inArray(agentTools.toolId, toolIds)
          )
        )
        .returning();
      
      return result.length;
    } catch (error) {
      console.error(`Error removing tools from agent ${agentId}:`, error);
      throw new Error(`Failed to remove tools from agent: ${(error as Error).message}`);
    }
  }
  
  /**
   * Create a new workflow for orchestrating agents
   */
  public async createWorkflow(workflowData: Omit<InsertAgentWorkflow, 'id'>): Promise<AgentWorkflow> {
    try {
      const [workflow] = await db.insert(agentWorkflows)
        .values(workflowData)
        .returning();
      
      // Emit workflow created event
      this.eventBus.publish('agent.workflow.created', { 
        workflowId: workflow.id,
        name: workflow.name
      });
      
      return workflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new Error(`Failed to create workflow: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get all workflows, with optional filtering
   */
  public async getWorkflows(options: {
    workspaceId?: number,
    status?: string,
    isTemplate?: boolean,
    search?: string,
    limit?: number,
    offset?: number
  } = {}): Promise<{ workflows: AgentWorkflow[], total: number }> {
    try {
      let query = db.select().from(agentWorkflows);
      
      // Apply filters
      if (options.workspaceId !== undefined) {
        query = query.where(eq(agentWorkflows.workspaceId, options.workspaceId));
      }
      
      if (options.status) {
        query = query.where(eq(agentWorkflows.status, options.status));
      }
      
      if (options.isTemplate !== undefined) {
        query = query.where(eq(agentWorkflows.isTemplate, options.isTemplate));
      }
      
      if (options.search) {
        query = query.where(
          sql`${agentWorkflows.name} ILIKE ${'%' + options.search + '%'} 
          OR ${agentWorkflows.description} ILIKE ${'%' + options.search + '%'}`
        );
      }
      
      // Get total count for pagination
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(query.as('filtered_workflows'));
      const total = countResult[0]?.count || 0;
      
      // Apply pagination
      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }
      
      if (options.offset !== undefined) {
        query = query.offset(options.offset);
      }
      
      // Order by latest first
      query = query.orderBy(desc(agentWorkflows.createdAt));
      
      const workflows = await query;
      
      return { workflows, total };
    } catch (error) {
      console.error('Error getting workflows:', error);
      throw new Error(`Failed to get workflows: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get a single workflow with all its steps and connections
   */
  public async getWorkflow(workflowId: number): Promise<AgentWorkflow | null> {
    try {
      const workflow = await db.query.agentWorkflows.findFirst({
        where: eq(agentWorkflows.id, workflowId),
        with: {
          steps: {
            with: {
              agent: true
            }
          },
          connections: true
        }
      });
      
      return workflow;
    } catch (error) {
      console.error(`Error getting workflow ${workflowId}:`, error);
      throw new Error(`Failed to get workflow: ${(error as Error).message}`);
    }
  }
  
  /**
   * Update an existing workflow
   */
  public async updateWorkflow(workflowId: number, workflowData: Partial<InsertAgentWorkflow>): Promise<AgentWorkflow | null> {
    try {
      const [workflow] = await db.update(agentWorkflows)
        .set({
          ...workflowData,
          updatedAt: new Date()
        })
        .where(eq(agentWorkflows.id, workflowId))
        .returning();
      
      if (!workflow) {
        return null;
      }
      
      // Emit workflow updated event
      this.eventBus.publish('agent.workflow.updated', { 
        workflowId: workflow.id,
        name: workflow.name
      });
      
      return workflow;
    } catch (error) {
      console.error(`Error updating workflow ${workflowId}:`, error);
      throw new Error(`Failed to update workflow: ${(error as Error).message}`);
    }
  }
  
  /**
   * Delete an existing workflow and all its steps and connections
   */
  public async deleteWorkflow(workflowId: number): Promise<boolean> {
    try {
      // Get workflow info for the event
      const workflow = await db.query.agentWorkflows.findFirst({
        where: eq(agentWorkflows.id, workflowId)
      });
      
      if (!workflow) {
        return false;
      }
      
      return await db.transaction(async (tx) => {
        // Delete connections first due to foreign key constraints
        await tx.delete(agentWorkflowConnections)
          .where(eq(agentWorkflowConnections.workflowId, workflowId));
        
        // Delete steps
        await tx.delete(agentWorkflowSteps)
          .where(eq(agentWorkflowSteps.workflowId, workflowId));
        
        // Delete the workflow
        const result = await tx.delete(agentWorkflows)
          .where(eq(agentWorkflows.id, workflowId))
          .returning();
        
        if (result.length === 0) {
          return false;
        }
        
        // Emit workflow deleted event
        this.eventBus.publish('agent.workflow.deleted', { 
          workflowId,
          name: workflow.name
        });
        
        return true;
      });
    } catch (error) {
      console.error(`Error deleting workflow ${workflowId}:`, error);
      throw new Error(`Failed to delete workflow: ${(error as Error).message}`);
    }
  }
  
  /**
   * Log an agent execution event
   */
  public async logExecution(executionData: Omit<InsertAgentExecutionLog, 'id'>): Promise<number> {
    try {
      const [log] = await db.insert(agentExecutionLogs)
        .values(executionData)
        .returning({ id: agentExecutionLogs.id });
      
      return log.id;
    } catch (error) {
      console.error('Error logging agent execution:', error);
      throw new Error(`Failed to log execution: ${(error as Error).message}`);
    }
  }
  
  /**
   * Log an agent-to-agent communication event
   */
  public async logA2ACommunication(communicationData: Omit<InsertAgentCommunicationLog, 'id'>): Promise<number> {
    try {
      const [log] = await db.insert(agentCommunicationLogs)
        .values(communicationData)
        .returning({ id: agentCommunicationLogs.id });
      
      return log.id;
    } catch (error) {
      console.error('Error logging A2A communication:', error);
      throw new Error(`Failed to log communication: ${(error as Error).message}`);
    }
  }
  
  /**
   * Generate a new API key for an agent
   */
  private generateApiKey(): string {
    return `mcpa_${randomBytes(32).toString('hex')}`;
  }
  
  /**
   * Hash an API key for secure storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
  
  // Event handlers
  private async handleAgentRegistered(data: any): Promise<void> {
    console.log(`Agent registered event: ${data.name} (${data.agentType})`);
    // Add any additional logic here, like notifying admins, etc.
  }
  
  private async handleAgentUpdated(data: any): Promise<void> {
    console.log(`Agent updated event: ${data.name} (ID: ${data.agentId})`);
    // Add any additional logic here
  }
  
  private async handleAgentDeregistered(data: any): Promise<void> {
    console.log(`Agent deregistered event: ${data.name} (ID: ${data.agentId})`);
    // Add any additional logic here, like cleaning up resources, etc.
  }
  
  private async handleAgentExecutionStarted(data: any): Promise<void> {
    console.log(`Agent execution started: ${data.executionId}`);
    // Add any additional logic here
  }
  
  private async handleAgentExecutionCompleted(data: any): Promise<void> {
    console.log(`Agent execution completed: ${data.executionId}`);
    // Add any additional logic here
  }
  
  private async handleA2AMessage(data: any): Promise<void> {
    console.log(`A2A message: ${data.messageId}`);
    // Add any additional logic here, like pushing to analytics, etc.
  }
}

// Export a singleton instance
export const agentManagementService = new AgentManagementService(EventBus.getInstance());