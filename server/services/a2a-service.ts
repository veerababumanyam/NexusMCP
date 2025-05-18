import { db } from "@db";
import {
  agents,
  a2aFlows,
  a2aExecutions,
  users,
  workspaces
} from "@shared/schema_a2a";
import { eq, and, desc, sql } from "drizzle-orm";
import { EventBus } from "./eventBusService";
import { v4 as uuidv4 } from "uuid";

/**
 * Service for Agent-to-Agent (A2A) orchestration
 * Handles the creation, execution, and management of agent flows
 */
class A2AService {
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
    
    // Subscribe to relevant events
    this.eventBus.subscribe("agent.a2a.message", this.handleAgentMessage.bind(this));
    
    console.log("A2A Orchestration Service initialized");
  }

  /**
   * Handle agent-to-agent messages
   */
  private async handleAgentMessage(data: any) {
    console.log("A2A message received:", data);
    
    try {
      // If this is an execution-related message, update the execution status
      if (data.executionId) {
        const execution = await this.getExecutionById(data.executionId);
        
        if (execution) {
          // Update execution with new message data
          await this.updateExecutionData(execution.id, {
            ...execution,
            lastMessageAt: new Date(),
            lastMessage: data.message,
            status: data.status || execution.status
          });
          
          // If execution is complete, finalize it
          if (data.status === "completed" || data.status === "failed") {
            await this.finalizeExecution(execution.id, {
              status: data.status,
              result: data.result || execution.result,
              error: data.error || execution.error,
              completedAt: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error("Error handling A2A message:", error);
    }
  }
  
  /**
   * Get all registered agents
   */
  async getAgents() {
    try {
      const result = await db.query.agents.findMany({
        orderBy: desc(agents.updatedAt)
      });
      
      return result || [];
    } catch (error) {
      console.error("Error fetching agents:", error);
      throw error;
    }
  }
  
  /**
   * Get agent by ID
   */
  async getAgentById(id: number) {
    try {
      const result = await db.query.agents.findFirst({
        where: eq(agents.id, id)
      });
      
      return result || null;
    } catch (error) {
      console.error(`Error fetching agent ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new agent
   */
  async createAgent(data: any) {
    try {
      // Validate agent data
      if (!data.name) {
        throw new Error("Agent name is required");
      }
      
      if (!data.type) {
        throw new Error("Agent type is required");
      }
      
      // Default capabilities to empty array if not provided
      const capabilities = data.capabilities || [];
      
      // Insert new agent into database
      const [result] = await db.insert(agents).values({
        name: data.name,
        type: data.type,
        description: data.description,
        capabilities: capabilities,
        status: data.status || "inactive",
        workspaceId: data.workspaceId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Emit agent created event
      this.eventBus.publish("agent.registered", {
        agentId: result.id,
        name: result.name,
        type: result.type
      });
      
      return result;
    } catch (error) {
      console.error("Error creating agent:", error);
      throw error;
    }
  }
  
  /**
   * Update an existing agent
   */
  async updateAgent(id: number, data: any) {
    try {
      const agent = await this.getAgentById(id);
      
      if (!agent) {
        throw new Error(`Agent with ID ${id} not found`);
      }
      
      // Update agent in database
      const [result] = await db.update(agents)
        .set({
          name: data.name !== undefined ? data.name : agent.name,
          type: data.type !== undefined ? data.type : agent.type,
          description: data.description !== undefined ? data.description : agent.description,
          capabilities: data.capabilities !== undefined ? data.capabilities : agent.capabilities,
          status: data.status !== undefined ? data.status : agent.status,
          workspaceId: data.workspaceId !== undefined ? data.workspaceId : agent.workspaceId,
          updatedAt: new Date()
        })
        .where(eq(agents.id, id))
        .returning();
      
      // Emit agent updated event
      this.eventBus.publish("agent.updated", {
        agentId: result.id,
        name: result.name,
        type: result.type,
        status: result.status
      });
      
      return result;
    } catch (error) {
      console.error(`Error updating agent ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete an agent
   */
  async deleteAgent(id: number) {
    try {
      const agent = await this.getAgentById(id);
      
      if (!agent) {
        throw new Error(`Agent with ID ${id} not found`);
      }
      
      // Delete agent from database
      await db.delete(agents).where(eq(agents.id, id));
      
      // Emit agent deleted event
      this.eventBus.publish("agent.deregistered", {
        agentId: id,
        name: agent.name,
        type: agent.type
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting agent ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all flows
   */
  async getFlows() {
    try {
      const result = await db.query.a2aFlows.findMany({
        orderBy: desc(a2aFlows.updatedAt)
      });
      
      return result || [];
    } catch (error) {
      console.error("Error fetching flows:", error);
      throw error;
    }
  }
  
  /**
   * Get flow by ID
   */
  async getFlowById(id: number) {
    try {
      const result = await db.query.a2aFlows.findFirst({
        where: eq(a2aFlows.id, id)
      });
      
      return result || null;
    } catch (error) {
      console.error(`Error fetching flow ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new flow
   */
  async createFlow(data: any) {
    try {
      // Validate flow data
      if (!data.name) {
        throw new Error("Flow name is required");
      }
      
      if (!data.definition || typeof data.definition !== "object") {
        throw new Error("Flow definition is required and must be an object");
      }
      
      // Insert new flow into database
      const [result] = await db.insert(a2aFlows).values({
        name: data.name,
        description: data.description,
        definition: data.definition,
        status: data.status || "draft",
        workspaceId: data.workspaceId || null,
        createdBy: data.createdBy || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Emit flow created event
      this.eventBus.publish("a2a.flow.created", {
        flowId: result.id,
        name: result.name,
        status: result.status
      });
      
      return result;
    } catch (error) {
      console.error("Error creating flow:", error);
      throw error;
    }
  }
  
  /**
   * Update an existing flow
   */
  async updateFlow(id: number, data: any) {
    try {
      const flow = await this.getFlowById(id);
      
      if (!flow) {
        throw new Error(`Flow with ID ${id} not found`);
      }
      
      // Update flow in database
      const [result] = await db.update(a2aFlows)
        .set({
          name: data.name !== undefined ? data.name : flow.name,
          description: data.description !== undefined ? data.description : flow.description,
          definition: data.definition !== undefined ? data.definition : flow.definition,
          status: data.status !== undefined ? data.status : flow.status,
          workspaceId: data.workspaceId !== undefined ? data.workspaceId : flow.workspaceId,
          updatedAt: new Date()
        })
        .where(eq(a2aFlows.id, id))
        .returning();
      
      // Emit flow updated event
      this.eventBus.publish("a2a.flow.updated", {
        flowId: result.id,
        name: result.name,
        status: result.status
      });
      
      return result;
    } catch (error) {
      console.error(`Error updating flow ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a flow
   */
  async deleteFlow(id: number) {
    try {
      const flow = await this.getFlowById(id);
      
      if (!flow) {
        throw new Error(`Flow with ID ${id} not found`);
      }
      
      // Check if there are any active executions
      const activeExecutions = await db.query.a2aExecutions.findMany({
        where: and(
          eq(a2aExecutions.flowId, id),
          eq(a2aExecutions.status, "running")
        )
      });
      
      if (activeExecutions && activeExecutions.length > 0) {
        throw new Error(`Flow has ${activeExecutions.length} active executions and cannot be deleted`);
      }
      
      // Delete flow from database
      await db.delete(a2aFlows).where(eq(a2aFlows.id, id));
      
      // Emit flow deleted event
      this.eventBus.publish("a2a.flow.deleted", {
        flowId: id,
        name: flow.name
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting flow ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Execute a flow
   */
  async executeFlow(flowId: number, userId: number | null = null) {
    try {
      const flow = await this.getFlowById(flowId);
      
      if (!flow) {
        throw new Error(`Flow with ID ${flowId} not found`);
      }
      
      if (flow.status !== "active") {
        throw new Error(`Flow ${flowId} is not active and cannot be executed`);
      }
      
      // Create execution record
      const [execution] = await db.insert(a2aExecutions).values({
        flowId: flowId,
        status: "running",
        startedAt: new Date(),
        completedAt: null,
        result: null,
        error: null,
        initiatedBy: userId,
        workspaceId: flow.workspaceId,
        created_at: new Date(),
        updated_at: new Date()
      }).returning();
      
      // Emit execution started event
      this.eventBus.publish("a2a.execution.started", {
        executionId: execution.id,
        flowId: flow.id,
        flowName: flow.name,
        initiatedBy: userId
      });
      
      // Start the flow execution (async)
      setImmediate(() => {
        this.processExecution(execution.id, flow).catch(err => {
          console.error(`Error executing flow ${flowId}:`, err);
          
          // Update execution with error
          this.finalizeExecution(execution.id, {
            status: "failed",
            error: err.message,
            completedAt: new Date()
          }).catch(updateErr => {
            console.error(`Error updating failed execution ${execution.id}:`, updateErr);
          });
        });
      });
      
      return execution;
    } catch (error) {
      console.error(`Error executing flow ${flowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process a flow execution
   * This is the main method that runs the flow logic
   */
  private async processExecution(executionId: number, flow: any) {
    try {
      // Get execution details
      const execution = await this.getExecutionById(executionId);
      
      if (!execution) {
        throw new Error(`Execution with ID ${executionId} not found`);
      }
      
      // Simplified mock execution for now
      // In reality, this would use the flow definition to orchestrate agents
      console.log(`Executing flow ${flow.id} (${flow.name}), execution ID: ${executionId}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update execution status to show progress
      await this.updateExecutionData(executionId, {
        ...execution,
        status: "processing",
        updated_at: new Date()
      });
      
      // Extract steps from flow definition
      const steps = (flow.definition && flow.definition.steps) || [];
      let stepResults = [];
      
      // Execute each step in sequence (simplified)
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Executing step ${i + 1}/${steps.length}: ${step.name}`);
        
        // Simulate step execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Add step result
        stepResults.push({
          stepId: i + 1,
          agentId: step.agentId,
          status: "completed",
          output: `Simulated output for step ${i + 1}`
        });
        
        // Update execution with progress
        await this.updateExecutionData(executionId, {
          ...execution,
          status: "processing",
          result: {
            progress: Math.floor(((i + 1) / steps.length) * 100),
            completedSteps: i + 1,
            totalSteps: steps.length,
            stepResults
          },
          updated_at: new Date()
        });
      }
      
      // Finalize execution
      await this.finalizeExecution(executionId, {
        status: "completed",
        result: {
          success: true,
          stepResults,
          summary: `Successfully executed flow with ${steps.length} steps`
        },
        completedAt: new Date()
      });
      
      // Emit execution completed event
      this.eventBus.publish("a2a.execution.completed", {
        executionId,
        flowId: flow.id,
        flowName: flow.name,
        status: "completed"
      });
      
    } catch (error) {
      console.error(`Error processing execution ${executionId}:`, error);
      
      // Update execution with error status
      await this.finalizeExecution(executionId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date()
      });
      
      // Emit execution failed event
      this.eventBus.publish("a2a.execution.failed", {
        executionId,
        flowId: execution.flowId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Update execution data (internal method)
   */
  private async updateExecutionData(executionId: number, data: any) {
    try {
      const [result] = await db.update(a2aExecutions)
        .set({
          ...data,
          updated_at: new Date()
        })
        .where(eq(a2aExecutions.id, executionId))
        .returning();
      
      return result;
    } catch (error) {
      console.error(`Error updating execution ${executionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Finalize an execution (mark as completed or failed)
   */
  private async finalizeExecution(executionId: number, data: any) {
    try {
      const [result] = await db.update(a2aExecutions)
        .set({
          status: data.status,
          result: data.result || null,
          error: data.error || null,
          completedAt: data.completedAt || new Date(),
          updated_at: new Date()
        })
        .where(eq(a2aExecutions.id, executionId))
        .returning();
      
      return result;
    } catch (error) {
      console.error(`Error finalizing execution ${executionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get execution by ID
   */
  async getExecutionById(id: number) {
    try {
      const result = await db.query.a2aExecutions.findFirst({
        where: eq(a2aExecutions.id, id)
      });
      
      return result || null;
    } catch (error) {
      console.error(`Error fetching execution ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get executions for a flow
   */
  async getFlowExecutions(flowId: number) {
    try {
      const result = await db.query.a2aExecutions.findMany({
        where: eq(a2aExecutions.flowId, flowId),
        orderBy: desc(a2aExecutions.startedAt)
      });
      
      return result || [];
    } catch (error) {
      console.error(`Error fetching executions for flow ${flowId}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const a2aService = new A2AService();