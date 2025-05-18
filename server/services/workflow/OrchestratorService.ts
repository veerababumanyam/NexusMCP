import { db } from '../../../db';
import { 
  workflowTemplates, workflowNodes, workflowConnections, 
  workflowInstances, workflowNodeExecutions, workflowVariables,
  toolManifests, workflowApprovals, workflowDeployments,
  WorkflowTemplate, WorkflowNode, WorkflowConnection,
  WorkflowInstance, WorkflowNodeExecution,
  ToolManifest, WorkflowTemplateInsert, WorkflowNodeInsert,
  WorkflowConnectionInsert, WorkflowInstanceInsert,
  ToolManifestInsert
} from '../../../shared/schema_orchestrator';
import { and, eq, desc, inArray, sql, or } from 'drizzle-orm';
import { EventBus, EventPayload } from '../eventBusService';
import { validateWorkflow } from './validator';
import { logger } from '../../utils/logger';
import { storage } from '../../storage';

/**
 * MCP Orchestrator Service
 * 
 * Provides enterprise-grade workflow orchestration capabilities:
 * - Visual pipeline builder
 * - Context routing engine
 * - Conditional logic & branching
 * - Plugin & manifest management
 * - Governance features
 */
export class OrchestratorService {
  private eventBus: EventBus;
  
  constructor() {
    this.eventBus = new EventBus();
    
    // Subscribe to relevant events
    this.eventBus.subscribe('workflow.instance.created', this.onWorkflowInstanceCreated.bind(this));
    this.eventBus.subscribe('workflow.node.execution.completed', this.onNodeExecutionCompleted.bind(this));
    this.eventBus.subscribe('workflow.template.deployed', this.onTemplateDeployed.bind(this));
    this.eventBus.subscribe('mcp.tool.discovered', this.onToolDiscovered.bind(this));
  }

  /**
   * Initialize the service on application startup
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing MCP Orchestrator Service');
    
    try {
      // Synchronize tool manifests on startup
      await this.syncAllToolManifests();
      
      // Resume any in-progress workflow executions
      await this.resumeInProgressWorkflows();
      
      logger.info('MCP Orchestrator Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Orchestrator Service', error);
      throw error;
    }
  }

  /*********************
   * Template Management
   *********************/
  
  /**
   * Create a new workflow template
   */
  public async createWorkflowTemplate(
    data: WorkflowTemplateInsert,
    userId: number
  ): Promise<WorkflowTemplate> {
    // Add created_by field
    const templateData = {
      ...data,
      createdBy: userId,
    };
    
    const [template] = await db.insert(workflowTemplates)
      .values(templateData)
      .returning();
    
    // Publish event
    this.eventBus.publish('workflow.template.created', {
      templateId: template.id,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return template;
  }
  
  /**
   * Get a workflow template by ID with associated nodes and connections
   */
  public async getWorkflowTemplate(
    templateId: number,
    options: { includeNodes?: boolean; includeConnections?: boolean; includeVariables?: boolean } = {}
  ): Promise<WorkflowTemplate & { nodes?: WorkflowNode[], connections?: WorkflowConnection[] }> {
    // Default options
    const opts = {
      includeNodes: true,
      includeConnections: true,
      includeVariables: false,
      ...options
    };
    
    // Get template
    const template = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, templateId)
    });
    
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`);
    }
    
    // Extend with related data if requested
    const result: any = { ...template };
    
    if (opts.includeNodes) {
      result.nodes = await db.query.workflowNodes.findMany({
        where: eq(workflowNodes.templateId, templateId)
      });
    }
    
    if (opts.includeConnections) {
      result.connections = await db.query.workflowConnections.findMany({
        where: eq(workflowConnections.templateId, templateId)
      });
    }
    
    if (opts.includeVariables) {
      result.variables = await db.query.workflowVariables.findMany({
        where: eq(workflowVariables.templateId, templateId)
      });
    }
    
    return result;
  }
  
  /**
   * Update a workflow template
   */
  public async updateWorkflowTemplate(
    templateId: number,
    data: Partial<WorkflowTemplate>,
    userId: number
  ): Promise<WorkflowTemplate> {
    // Add updated_at field
    const templateData = {
      ...data,
      updatedAt: new Date()
    };
    
    const [updatedTemplate] = await db.update(workflowTemplates)
      .set(templateData)
      .where(eq(workflowTemplates.id, templateId))
      .returning();
    
    if (!updatedTemplate) {
      throw new Error(`Workflow template not found: ${templateId}`);
    }
    
    // Publish event
    this.eventBus.publish('workflow.template.updated', {
      templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return updatedTemplate;
  }
  
  /**
   * Delete a workflow template and its associated nodes and connections
   */
  public async deleteWorkflowTemplate(
    templateId: number,
    userId: number
  ): Promise<boolean> {
    // Transaction is not needed as we use ON DELETE CASCADE
    await db.delete(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId));
    
    // Publish event
    this.eventBus.publish('workflow.template.deleted', {
      templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
  
  /**
   * List all workflow templates with filtering and pagination
   */
  public async listWorkflowTemplates(
    filters: {
      workspaceId?: number;
      status?: string;
      isPublic?: boolean;
      category?: string;
      createdBy?: number;
      search?: string;
    } = {},
    pagination: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ templates: WorkflowTemplate[]; total: number }> {
    // Default pagination
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const sortBy = pagination.sortBy || 'updatedAt';
    const sortDirection = pagination.sortDirection || 'desc';
    
    // Build query conditions
    let conditions = [];
    
    if (filters.workspaceId !== undefined) {
      conditions.push(eq(workflowTemplates.workspaceId, filters.workspaceId));
    }
    
    if (filters.status) {
      conditions.push(eq(workflowTemplates.status, filters.status));
    }
    
    if (filters.isPublic !== undefined) {
      conditions.push(eq(workflowTemplates.isPublic, filters.isPublic));
    }
    
    if (filters.category) {
      conditions.push(eq(workflowTemplates.category, filters.category));
    }
    
    if (filters.createdBy) {
      conditions.push(eq(workflowTemplates.createdBy, filters.createdBy));
    }
    
    if (filters.search) {
      // Simple search for name or description
      conditions.push(
        sql`(${workflowTemplates.name} ILIKE ${`%${filters.search}%`} OR 
             ${workflowTemplates.description} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    // Combined condition
    const whereCondition = conditions.length > 0 
      ? and(...conditions) 
      : undefined;
    
    // Count total records
    const countResult = await db.select({ count: sql`count(*)` })
      .from(workflowTemplates)
      .where(whereCondition);
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get templates with ordering and pagination
    const templates = await db.select()
      .from(workflowTemplates)
      .where(whereCondition)
      .orderBy(
        sortDirection === 'desc' 
          ? desc(workflowTemplates[sortBy as keyof typeof workflowTemplates])
          : workflowTemplates[sortBy as keyof typeof workflowTemplates]
      )
      .limit(pageSize)
      .offset(offset);
    
    return { templates, total };
  }
  
  /**
   * Clone a workflow template with all its nodes and connections
   */
  public async cloneWorkflowTemplate(
    templateId: number,
    newName: string,
    userId: number
  ): Promise<WorkflowTemplate> {
    // Get the template with all relations
    const template = await this.getWorkflowTemplate(templateId, {
      includeNodes: true,
      includeConnections: true,
      includeVariables: true
    });
    
    // Create a new template
    const [newTemplate] = await db.insert(workflowTemplates)
      .values({
        name: newName,
        description: `Cloned from: ${template.name}`,
        version: template.version,
        category: template.category,
        tags: template.tags,
        status: 'draft', // Always start as draft
        isPublic: false, // Always start as private
        workspaceId: template.workspaceId,
        metadata: template.metadata,
        config: template.config,
        createdBy: userId
      })
      .returning();
    
    // Clone nodes
    if (template.nodes && template.nodes.length > 0) {
      const nodeInserts = template.nodes.map(node => ({
        templateId: newTemplate.id,
        nodeId: node.nodeId,
        type: node.type,
        name: node.name,
        description: node.description,
        position: node.position,
        config: node.config,
        toolId: node.toolId,
        serverId: node.serverId
      }));
      
      await db.insert(workflowNodes).values(nodeInserts);
    }
    
    // Clone connections
    if (template.connections && template.connections.length > 0) {
      const connectionInserts = template.connections.map(conn => ({
        templateId: newTemplate.id,
        sourceNodeId: conn.sourceNodeId,
        targetNodeId: conn.targetNodeId,
        sourcePort: conn.sourcePort,
        targetPort: conn.targetPort,
        label: conn.label,
        condition: conn.condition
      }));
      
      await db.insert(workflowConnections).values(connectionInserts);
    }
    
    // Clone variables
    if (template.variables && template.variables.length > 0) {
      const variableInserts = template.variables.map(variable => ({
        templateId: newTemplate.id,
        name: variable.name,
        type: variable.type,
        defaultValue: variable.defaultValue,
        description: variable.description,
        isSecret: variable.isSecret,
        scope: variable.scope
      }));
      
      await db.insert(workflowVariables).values(variableInserts);
    }
    
    // Publish event
    this.eventBus.publish('workflow.template.cloned', {
      originalTemplateId: templateId,
      newTemplateId: newTemplate.id,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return newTemplate;
  }
  
  /******************
   * Node Management
   ******************/
  
  /**
   * Add a node to a workflow template
   */
  public async addNode(
    node: WorkflowNodeInsert,
    userId: number
  ): Promise<WorkflowNode> {
    const [createdNode] = await db.insert(workflowNodes)
      .values(node)
      .returning();
    
    // Publish event
    this.eventBus.publish('workflow.node.added', {
      nodeId: createdNode.id,
      templateId: createdNode.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return createdNode;
  }
  
  /**
   * Update a node
   */
  public async updateNode(
    nodeId: number,
    data: Partial<WorkflowNode>,
    userId: number
  ): Promise<WorkflowNode> {
    const [updatedNode] = await db.update(workflowNodes)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(workflowNodes.id, nodeId))
      .returning();
    
    if (!updatedNode) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    // Publish event
    this.eventBus.publish('workflow.node.updated', {
      nodeId,
      templateId: updatedNode.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return updatedNode;
  }
  
  /**
   * Delete a node
   */
  public async deleteNode(
    nodeId: number,
    userId: number
  ): Promise<boolean> {
    const node = await db.query.workflowNodes.findFirst({
      where: eq(workflowNodes.id, nodeId)
    });
    
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    // Delete the node
    await db.delete(workflowNodes)
      .where(eq(workflowNodes.id, nodeId));
    
    // Also delete any connections to/from this node
    await db.delete(workflowConnections)
      .where(
        and(
          eq(workflowConnections.templateId, node.templateId),
          or(
            eq(workflowConnections.sourceNodeId, node.nodeId),
            eq(workflowConnections.targetNodeId, node.nodeId)
          )
        )
      );
    
    // Publish event
    this.eventBus.publish('workflow.node.deleted', {
      nodeId,
      templateId: node.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
  
  /***********************
   * Connection Management
   ***********************/
  
  /**
   * Add a connection between nodes
   */
  public async addConnection(
    connection: WorkflowConnectionInsert,
    userId: number
  ): Promise<WorkflowConnection> {
    const [createdConnection] = await db.insert(workflowConnections)
      .values(connection)
      .returning();
    
    // Publish event
    this.eventBus.publish('workflow.connection.added', {
      connectionId: createdConnection.id,
      templateId: createdConnection.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return createdConnection;
  }
  
  /**
   * Update a connection
   */
  public async updateConnection(
    connectionId: number,
    data: Partial<WorkflowConnection>,
    userId: number
  ): Promise<WorkflowConnection> {
    const [updatedConnection] = await db.update(workflowConnections)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(workflowConnections.id, connectionId))
      .returning();
    
    if (!updatedConnection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    
    // Publish event
    this.eventBus.publish('workflow.connection.updated', {
      connectionId,
      templateId: updatedConnection.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return updatedConnection;
  }
  
  /**
   * Delete a connection
   */
  public async deleteConnection(
    connectionId: number,
    userId: number
  ): Promise<boolean> {
    const connection = await db.query.workflowConnections.findFirst({
      where: eq(workflowConnections.id, connectionId)
    });
    
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    
    await db.delete(workflowConnections)
      .where(eq(workflowConnections.id, connectionId));
    
    // Publish event
    this.eventBus.publish('workflow.connection.deleted', {
      connectionId,
      templateId: connection.templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return true;
  }
  
  /***********************
   * Workflow Execution
   ***********************/
  
  /**
   * Validate a workflow template
   */
  public async validateWorkflow(templateId: number): Promise<{ 
    valid: boolean; 
    errors?: string[];
    warnings?: string[];
  }> {
    const template = await this.getWorkflowTemplate(templateId);
    return validateWorkflow(template);
  }
  
  /**
   * Execute a workflow
   */
  public async executeWorkflow(
    templateId: number,
    input: Record<string, any>,
    userId: number,
    options: {
      workspaceId?: number;
      timeout?: number;
      context?: Record<string, any>;
    } = {}
  ): Promise<WorkflowInstance> {
    // Validate the workflow first
    const validation = await this.validateWorkflow(templateId);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors?.join(', ')}`);
    }
    
    // Create a new instance
    const [instance] = await db.insert(workflowInstances)
      .values({
        templateId,
        status: 'pending',
        createdBy: userId,
        workspaceId: options.workspaceId,
        input,
        executionContext: options.context || {}
      })
      .returning();
    
    // Publish event to start execution asynchronously
    this.eventBus.publish('workflow.instance.created', {
      instanceId: instance.id,
      templateId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    return instance;
  }
  
  /**
   * Get workflow instance status
   */
  public async getWorkflowInstance(
    instanceId: number,
    options: { includeNodeExecutions?: boolean } = {}
  ): Promise<WorkflowInstance & { nodeExecutions?: WorkflowNodeExecution[] }> {
    const instance = await db.query.workflowInstances.findFirst({
      where: eq(workflowInstances.id, instanceId)
    });
    
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }
    
    // Extend with related data if requested
    const result: any = { ...instance };
    
    if (options.includeNodeExecutions) {
      result.nodeExecutions = await db.query.workflowNodeExecutions.findMany({
        where: eq(workflowNodeExecutions.instanceId, instanceId),
        orderBy: workflowNodeExecutions.executionOrder
      });
    }
    
    return result;
  }
  
  /**
   * Resume in-progress workflows after service restart
   */
  private async resumeInProgressWorkflows(): Promise<void> {
    const runningInstances = await db.query.workflowInstances.findMany({
      where: eq(workflowInstances.status, 'running')
    });
    
    logger.info(`Found ${runningInstances.length} in-progress workflow executions to resume`);
    
    for (const instance of runningInstances) {
      this.eventBus.publish('workflow.instance.resumed', {
        instanceId: instance.id,
        templateId: instance.templateId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Event handler for workflow instance created
   */
  private async onWorkflowInstanceCreated(payload: EventPayload): Promise<void> {
    const { instanceId } = payload;
    
    try {
      // Update instance status to running
      await db.update(workflowInstances)
        .set({
          status: 'running',
          startedAt: new Date()
        })
        .where(eq(workflowInstances.id, instanceId));
      
      // Get the workflow template with nodes and connections
      const instance = await this.getWorkflowInstance(instanceId);
      const template = await this.getWorkflowTemplate(instance.templateId);
      
      // Find start node(s)
      const startNodes = template.nodes?.filter(node => node.type === 'input' || node.type === 'start');
      
      if (!startNodes || startNodes.length === 0) {
        throw new Error('No start/input nodes found in workflow');
      }
      
      // Initialize execution for each start node
      for (const startNode of startNodes) {
        await this.executeNode(instance.id, startNode, instance.input);
      }
    } catch (error) {
      logger.error(`Error starting workflow execution ${instanceId}:`, error);
      
      // Mark instance as failed
      await db.update(workflowInstances)
        .set({
          status: 'failed',
          error: { message: error.message, details: error.stack },
          completedAt: new Date()
        })
        .where(eq(workflowInstances.id, instanceId));
      
      // Publish failure event
      this.eventBus.publish('workflow.instance.failed', {
        instanceId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Execute a specific node
   */
  private async executeNode(
    instanceId: number,
    node: WorkflowNode,
    input: Record<string, any>
  ): Promise<void> {
    try {
      // Create a node execution record
      const [execution] = await db.insert(workflowNodeExecutions)
        .values({
          instanceId,
          nodeId: node.nodeId,
          status: 'running',
          startedAt: new Date(),
          input,
          executionOrder: await this.getNextExecutionOrder(instanceId)
        })
        .returning();
      
      // Perform the node execution based on its type
      let output;
      
      switch (node.type) {
        case 'tool':
          output = await this.executeToolNode(node, input, instanceId);
          break;
          
        case 'conditional':
          output = await this.executeConditionalNode(node, input, instanceId);
          break;
          
        case 'transformer':
          output = await this.executeTransformerNode(node, input);
          break;
          
        case 'input':
        case 'start':
          output = input; // Just pass through
          break;
          
        case 'output':
        case 'end':
          output = input; // Just pass through and complete workflow
          await this.completeWorkflow(instanceId, input);
          break;
          
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }
      
      // Mark node execution as completed
      const duration = Date.now() - execution.startedAt.getTime();
      await db.update(workflowNodeExecutions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          output,
          duration
        })
        .where(eq(workflowNodeExecutions.id, execution.id));
      
      // Publish node completion event
      this.eventBus.publish('workflow.node.execution.completed', {
        executionId: execution.id,
        instanceId,
        nodeId: node.nodeId,
        output,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error executing node ${node.nodeId} in workflow instance ${instanceId}:`, error);
      
      // Mark node execution as failed
      await db.update(workflowNodeExecutions)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: { message: error.message, details: error.stack }
        })
        .where(and(
          eq(workflowNodeExecutions.instanceId, instanceId),
          eq(workflowNodeExecutions.nodeId, node.nodeId)
        ));
      
      // Fail the whole workflow instance
      await db.update(workflowInstances)
        .set({
          status: 'failed',
          error: { message: `Node ${node.name} (${node.nodeId}) failed: ${error.message}` },
          completedAt: new Date()
        })
        .where(eq(workflowInstances.id, instanceId));
      
      // Publish failure event
      this.eventBus.publish('workflow.instance.failed', {
        instanceId,
        nodeId: node.nodeId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Execute a tool node
   */
  private async executeToolNode(
    node: WorkflowNode,
    input: Record<string, any>,
    instanceId: number
  ): Promise<Record<string, any>> {
    if (!node.toolId || !node.serverId) {
      throw new Error('Tool node is missing required toolId or serverId');
    }
    
    // Get instance for context
    const instance = await this.getWorkflowInstance(instanceId);
    
    // Get tool manifest
    const tool = await db.query.toolManifests.findFirst({
      where: and(
        eq(toolManifests.serverId, node.serverId),
        eq(toolManifests.toolId, node.toolId?.toString() || '')
      )
    });
    
    if (!tool) {
      throw new Error(`Tool not found: ${node.toolId}`);
    }
    
    // Execute the MCP tool
    // TODO: Implement actual MCP tool execution with the proxy service
    const result = await this.executeMcpTool(node.serverId, node.toolId, input, instance.executionContext);
    
    return result;
  }
  
  /**
   * Execute a conditional node
   */
  private async executeConditionalNode(
    node: WorkflowNode,
    input: Record<string, any>,
    instanceId: number
  ): Promise<{ condition: boolean; path: string; input: Record<string, any> }> {
    const condition = node.config?.condition;
    
    if (!condition) {
      throw new Error('Conditional node is missing required condition');
    }
    
    // Evaluate condition
    let result = false;
    
    if (typeof condition === 'string') {
      // Simple expression evaluation 
      // TODO: Implement a secure condition evaluator
      result = await this.evaluateCondition(condition, input);
    } else if (typeof condition === 'object') {
      // Complex condition with structured rules
      result = await this.evaluateComplexCondition(condition, input);
    }
    
    // Get the template to find next nodes
    const instance = await this.getWorkflowInstance(instanceId);
    const template = await this.getWorkflowTemplate(instance.templateId);
    
    // Find the connections from this node
    const connections = template.connections?.filter(conn => conn.sourceNodeId === node.nodeId) || [];
    
    // Find the next node based on condition result (true or false path)
    const nextConnection = connections.find(conn => {
      if (conn.condition) {
        return result ? conn.condition.type === 'true' : conn.condition.type === 'false';
      }
      return conn.label === (result ? 'true' : 'false');
    });
    
    if (nextConnection) {
      const nextNode = template.nodes?.find(n => n.nodeId === nextConnection.targetNodeId);
      if (nextNode) {
        // Schedule execution of the next node
        setTimeout(() => {
          this.executeNode(instanceId, nextNode, input);
        }, 0);
      }
    }
    
    return {
      condition: result,
      path: result ? 'true' : 'false',
      input
    };
  }
  
  /**
   * Execute a transformer node
   */
  private async executeTransformerNode(
    node: WorkflowNode,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    const transform = node.config?.transform;
    
    if (!transform) {
      throw new Error('Transformer node is missing required transform');
    }
    
    // Execute transformation
    if (typeof transform === 'string') {
      // String-based transformation (template)
      // TODO: Implement template-based transformer
      return input;
    } else if (typeof transform === 'object') {
      // Object-based transformation (mapping)
      return this.executeTransformMapping(transform, input);
    }
    
    return input;
  }
  
  /**
   * Complete a workflow instance
   */
  private async completeWorkflow(
    instanceId: number,
    output: Record<string, any>
  ): Promise<void> {
    await db.update(workflowInstances)
      .set({
        status: 'completed',
        completedAt: new Date(),
        output
      })
      .where(eq(workflowInstances.id, instanceId));
    
    // Publish completion event
    this.eventBus.publish('workflow.instance.completed', {
      instanceId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Execute an actual MCP tool
   * This is a placeholder for integration with the MCP Proxy Service
   */
  private async executeMcpTool(
    serverId: number,
    toolId: number,
    input: Record<string, any>,
    context: Record<string, any>
  ): Promise<Record<string, any>> {
    // TODO: Implement integration with MCP Proxy Service
    // This is a mock implementation
    return {
      result: `Mock execution of tool ${toolId} on server ${serverId}`,
      input,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Evaluate a condition expression
   */
  private async evaluateCondition(
    condition: string,
    context: Record<string, any>
  ): Promise<boolean> {
    // TODO: Implement a secure condition evaluator
    // This is a mock implementation
    return true;
  }
  
  /**
   * Evaluate a complex condition
   */
  private async evaluateComplexCondition(
    condition: any,
    context: Record<string, any>
  ): Promise<boolean> {
    // TODO: Implement a secure complex condition evaluator
    // This is a mock implementation
    return true;
  }
  
  /**
   * Execute a transformation mapping
   */
  private executeTransformMapping(
    mapping: any,
    input: Record<string, any>
  ): Record<string, any> {
    // TODO: Implement transformation mapping
    // This is a mock implementation
    return {
      ...input,
      transformed: true
    };
  }
  
  /**
   * Get the next execution order for a node execution
   */
  private async getNextExecutionOrder(instanceId: number): Promise<number> {
    const maxResult = await db.select({
      max: sql`MAX(${workflowNodeExecutions.executionOrder})`
    })
    .from(workflowNodeExecutions)
    .where(eq(workflowNodeExecutions.instanceId, instanceId));
    
    const maxOrder = maxResult[0]?.max || 0;
    return maxOrder + 1;
  }
  
  /**
   * Event handler for node execution completed
   */
  private async onNodeExecutionCompleted(payload: EventPayload): Promise<void> {
    const { instanceId, nodeId, output } = payload;
    
    try {
      // Get the instance and template
      const instance = await this.getWorkflowInstance(instanceId);
      const template = await this.getWorkflowTemplate(instance.templateId);
      
      // Find the node that completed
      const node = template.nodes?.find(n => n.nodeId === nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in template ${template.id}`);
      }
      
      // Find outgoing connections
      const connections = template.connections?.filter(conn => conn.sourceNodeId === nodeId) || [];
      
      // For each outgoing connection, execute the target node
      for (const connection of connections) {
        const targetNode = template.nodes?.find(n => n.nodeId === connection.targetNodeId);
        
        if (targetNode) {
          // Check if there's a condition on the connection
          let shouldExecute = true;
          
          if (connection.condition) {
            // Evaluate the condition
            shouldExecute = await this.evaluateConnectionCondition(connection.condition, output);
          }
          
          if (shouldExecute) {
            // Schedule execution of the target node
            setTimeout(() => {
              this.executeNode(instanceId, targetNode, output);
            }, 0);
          }
        }
      }
      
      // If there are no outgoing connections, check if all nodes are completed
      if (connections.length === 0) {
        await this.checkWorkflowCompletion(instanceId);
      }
    } catch (error) {
      logger.error(`Error handling node completion for ${nodeId} in workflow ${instanceId}:`, error);
    }
  }
  
  /**
   * Evaluate a condition on a connection
   */
  private async evaluateConnectionCondition(
    condition: any,
    context: Record<string, any>
  ): Promise<boolean> {
    // TODO: Implement connection condition evaluation
    // This is a mock implementation
    return true;
  }
  
  /**
   * Check if a workflow has completed
   */
  private async checkWorkflowCompletion(instanceId: number): Promise<void> {
    const instance = await this.getWorkflowInstance(instanceId, { includeNodeExecutions: true });
    
    // If already completed or failed, no need to check
    if (instance.status === 'completed' || instance.status === 'failed') {
      return;
    }
    
    // Get the template
    const template = await this.getWorkflowTemplate(instance.templateId);
    
    // Check if all nodes have been executed
    const executedNodeIds = new Set(instance.nodeExecutions?.map(exec => exec.nodeId) || []);
    const allNodesExecuted = template.nodes?.every(node => executedNodeIds.has(node.nodeId));
    
    // Check if any node failed
    const anyNodeFailed = instance.nodeExecutions?.some(exec => exec.status === 'failed');
    
    if (anyNodeFailed) {
      // Mark workflow as failed
      await db.update(workflowInstances)
        .set({
          status: 'failed',
          error: { message: 'One or more nodes failed during execution' },
          completedAt: new Date()
        })
        .where(eq(workflowInstances.id, instanceId));
      
      this.eventBus.publish('workflow.instance.failed', {
        instanceId,
        timestamp: new Date().toISOString()
      });
    } else if (allNodesExecuted) {
      // Find output nodes
      const outputNodes = template.nodes?.filter(node => node.type === 'output' || node.type === 'end') || [];
      
      // Collect outputs from output nodes
      const outputs: Record<string, any> = {};
      
      for (const outputNode of outputNodes) {
        const execution = instance.nodeExecutions?.find(exec => 
          exec.nodeId === outputNode.nodeId && exec.status === 'completed'
        );
        
        if (execution && execution.output) {
          outputs[outputNode.nodeId] = execution.output;
        }
      }
      
      // Mark workflow as completed
      await db.update(workflowInstances)
        .set({
          status: 'completed',
          completedAt: new Date(),
          output: outputs
        })
        .where(eq(workflowInstances.id, instanceId));
      
      this.eventBus.publish('workflow.instance.completed', {
        instanceId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**************************
   * Tool Manifest Management
   **************************/
  
  /**
   * Sync tool manifests for all servers
   */
  private async syncAllToolManifests(): Promise<void> {
    // Get all MCP servers
    const mcpServers = await storage.getAllMcpServers();
    
    for (const server of mcpServers) {
      try {
        await this.syncToolManifestsForServer(server.id);
      } catch (error) {
        logger.error(`Failed to sync tool manifests for server ${server.id}:`, error);
      }
    }
  }
  
  /**
   * Sync tool manifests for a specific server
   */
  public async syncToolManifestsForServer(serverId: number): Promise<ToolManifest[]> {
    // Get server
    const server = await storage.getMcpServer(serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }
    
    // Get tools from the server
    const tools = await storage.getToolsByServer(serverId);
    
    const manifests: ToolManifest[] = [];
    
    for (const tool of tools) {
      try {
        // Check if manifest already exists
        const existingManifest = await db.query.toolManifests.findFirst({
          where: and(
            eq(toolManifests.serverId, serverId),
            eq(toolManifests.toolId, tool.id.toString())
          )
        });
        
        if (existingManifest) {
          // Update existing manifest if needed
          if (existingManifest.version !== tool.metadata?.version) {
            const versionHistory = existingManifest.versionHistory || [];
            versionHistory.push({
              version: existingManifest.version,
              checkedAt: new Date().toISOString()
            });
            
            const [updatedManifest] = await db.update(toolManifests)
              .set({
                name: tool.name,
                description: tool.description,
                version: tool.metadata?.version as string,
                schema: tool.metadata?.schema,
                versionHistory,
                lastChecked: new Date(),
                updatedAt: new Date()
              })
              .where(eq(toolManifests.id, existingManifest.id))
              .returning();
            
            manifests.push(updatedManifest);
          } else {
            // Just update last checked time
            const [updatedManifest] = await db.update(toolManifests)
              .set({
                lastChecked: new Date()
              })
              .where(eq(toolManifests.id, existingManifest.id))
              .returning();
            
            manifests.push(updatedManifest);
          }
        } else {
          // Create new manifest
          const [newManifest] = await db.insert(toolManifests)
            .values({
              serverId,
              toolId: tool.id.toString(),
              name: tool.name,
              description: tool.description,
              version: tool.metadata?.version as string,
              schema: tool.metadata?.schema,
              versionHistory: [],
              features: [],
              tags: tool.metadata?.tags as string[] || [],
              category: tool.metadata?.category as string
            })
            .returning();
          
          manifests.push(newManifest);
        }
      } catch (error) {
        logger.error(`Failed to sync manifest for tool ${tool.id} on server ${serverId}:`, error);
      }
    }
    
    return manifests;
  }
  
  /**
   * Get tool manifests with filtering and pagination
   */
  public async getToolManifests(
    filters: {
      serverId?: number;
      category?: string;
      search?: string;
      tags?: string[];
      status?: string;
    } = {},
    pagination: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<{ manifests: ToolManifest[]; total: number }> {
    // Default pagination
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const sortBy = pagination.sortBy || 'name';
    const sortDirection = pagination.sortDirection || 'asc';
    
    // Build query conditions
    let conditions = [];
    
    if (filters.serverId !== undefined) {
      conditions.push(eq(toolManifests.serverId, filters.serverId));
    }
    
    if (filters.category) {
      conditions.push(eq(toolManifests.category, filters.category));
    }
    
    if (filters.status) {
      conditions.push(eq(toolManifests.status, filters.status));
    }
    
    if (filters.tags && filters.tags.length > 0) {
      // JSON array contains any of the specified tags
      // This is a simplified implementation
      const tagsCondition = filters.tags.map(tag => 
        sql`${toolManifests.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`
      );
      conditions.push(sql`(${sql.join(tagsCondition, sql` OR `)})`);
    }
    
    if (filters.search) {
      // Simple search for name or description
      conditions.push(
        sql`(${toolManifests.name} ILIKE ${`%${filters.search}%`} OR 
             ${toolManifests.description} ILIKE ${`%${filters.search}%`})`
      );
    }
    
    // Combined condition
    const whereCondition = conditions.length > 0 
      ? and(...conditions) 
      : undefined;
    
    // Count total records
    const countResult = await db.select({ count: sql`count(*)` })
      .from(toolManifests)
      .where(whereCondition);
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get manifests with ordering and pagination
    const manifests = await db.select()
      .from(toolManifests)
      .where(whereCondition)
      .orderBy(
        sortDirection === 'desc' 
          ? desc(toolManifests[sortBy as keyof typeof toolManifests])
          : toolManifests[sortBy as keyof typeof toolManifests]
      )
      .limit(pageSize)
      .offset(offset);
    
    return { manifests, total };
  }
  
  /**
   * Event handler for tool discovered event
   */
  private async onToolDiscovered(payload: EventPayload): Promise<void> {
    const { serverId, toolId } = payload;
    
    if (!serverId || !toolId) {
      return;
    }
    
    try {
      // Sync single tool manifest
      const server = await storage.getMcpServer(Number(serverId));
      const tool = await storage.getToolsByServer(Number(serverId))
        .then(tools => tools.find(t => t.id === Number(toolId)));
      
      if (!server || !tool) {
        logger.warn(`Server ${serverId} or tool ${toolId} not found for manifest sync`);
        return;
      }
      
      // Check if manifest already exists
      const existingManifest = await db.query.toolManifests.findFirst({
        where: and(
          eq(toolManifests.serverId, Number(serverId)),
          eq(toolManifests.toolId, toolId.toString())
        )
      });
      
      if (existingManifest) {
        // Update existing manifest
        const versionHistory = existingManifest.versionHistory || [];
        versionHistory.push({
          version: existingManifest.version,
          checkedAt: new Date().toISOString()
        });
        
        await db.update(toolManifests)
          .set({
            name: tool.name,
            description: tool.description,
            version: tool.metadata?.version as string,
            schema: tool.metadata?.schema,
            versionHistory,
            lastChecked: new Date(),
            updatedAt: new Date()
          })
          .where(eq(toolManifests.id, existingManifest.id));
      } else {
        // Create new manifest
        await db.insert(toolManifests)
          .values({
            serverId: Number(serverId),
            toolId: toolId.toString(),
            name: tool.name,
            description: tool.description,
            version: tool.metadata?.version as string,
            schema: tool.metadata?.schema,
            versionHistory: [],
            features: [],
            tags: tool.metadata?.tags as string[] || [],
            category: tool.metadata?.category as string
          });
      }
      
      logger.info(`Tool manifest synced for tool ${toolId} on server ${serverId}`);
    } catch (error) {
      logger.error(`Failed to handle tool discovery for tool ${toolId} on server ${serverId}:`, error);
    }
  }
  
  /**********************
   * Approval Workflows
   **********************/
  
  /**
   * Create a deployment approval request
   */
  public async createApprovalRequest(
    templateId: number,
    userId: number,
    environment: string,
    changes: { before: any; after: any },
    comments?: string
  ): Promise<any> {
    // Check if pending approvals already exist for this template and environment
    const pendingApprovals = await db.query.workflowApprovals.findMany({
      where: and(
        eq(workflowApprovals.templateId, templateId),
        eq(workflowApprovals.environment, environment),
        eq(workflowApprovals.status, 'pending')
      )
    });
    
    if (pendingApprovals.length > 0) {
      throw new Error(`A pending approval already exists for this template in the ${environment} environment`);
    }
    
    // Create new approval request
    const [approval] = await db.insert(workflowApprovals)
      .values({
        templateId,
        requestedBy: userId,
        environment,
        changes,
        comments,
        status: 'pending',
        // Set expiration time (e.g., 7 days from now)
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
      .returning();
    
    // Publish event
    this.eventBus.publish('workflow.approval.requested', {
      approvalId: approval.id,
      templateId,
      userId,
      environment,
      timestamp: new Date().toISOString()
    });
    
    return approval;
  }
  
  /**
   * Review an approval request (approve or reject)
   */
  public async reviewApprovalRequest(
    approvalId: number,
    userId: number,
    approved: boolean,
    comments?: string
  ): Promise<any> {
    // Get the approval request
    const approval = await db.query.workflowApprovals.findFirst({
      where: eq(workflowApprovals.id, approvalId)
    });
    
    if (!approval) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }
    
    if (approval.status !== 'pending') {
      throw new Error(`Approval request is not pending: ${approvalId}`);
    }
    
    if (approval.requestedBy === userId) {
      throw new Error('You cannot approve your own request');
    }
    
    // Update the approval status
    const [updatedApproval] = await db.update(workflowApprovals)
      .set({
        status: approved ? 'approved' : 'rejected',
        approvedBy: userId,
        respondedAt: new Date(),
        comments: comments ? `${approval.comments || ''}\n\nReview: ${comments}` : approval.comments
      })
      .where(eq(workflowApprovals.id, approvalId))
      .returning();
    
    // Publish event
    this.eventBus.publish(approved ? 'workflow.approval.approved' : 'workflow.approval.rejected', {
      approvalId,
      templateId: approval.templateId,
      userId,
      environment: approval.environment,
      timestamp: new Date().toISOString()
    });
    
    // If approved, deploy the workflow
    if (approved) {
      this.deployWorkflow(approval.templateId, approval.environment, userId, approvalId);
    }
    
    return updatedApproval;
  }
  
  /**
   * Deploy a workflow to an environment
   */
  private async deployWorkflow(
    templateId: number,
    environment: string,
    userId: number,
    approvalId: number
  ): Promise<void> {
    try {
      // Get the template
      const template = await this.getWorkflowTemplate(templateId);
      
      // Create deployment record
      const [deployment] = await db.insert(workflowDeployments)
        .values({
          templateId,
          environment,
          version: template.version,
          deployedBy: userId,
          approvalId,
          status: 'success',
          logs: [{ 
            message: `Deployment started for template: ${template.name}`,
            timestamp: new Date().toISOString(),
            level: 'info'
          }]
        })
        .returning();
      
      // Publish deployment event
      this.eventBus.publish('workflow.template.deployed', {
        templateId,
        environment,
        deploymentId: deployment.id,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Update logs with success
      await db.update(workflowDeployments)
        .set({
          logs: [
            ...(deployment.logs || []),
            { 
              message: `Deployment completed successfully`,
              timestamp: new Date().toISOString(),
              level: 'info'
            }
          ]
        })
        .where(eq(workflowDeployments.id, deployment.id));
    } catch (error) {
      logger.error(`Error deploying workflow ${templateId} to ${environment}:`, error);
      
      // Create failed deployment record
      await db.insert(workflowDeployments)
        .values({
          templateId,
          environment,
          version: 'failed',
          deployedBy: userId,
          approvalId,
          status: 'failed',
          logs: [{ 
            message: `Deployment failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            level: 'error'
          }]
        });
    }
  }
  
  /**
   * Event handler for template deployed event
   */
  private async onTemplateDeployed(payload: EventPayload): Promise<void> {
    // Handle post-deployment actions like notification
    const { templateId, environment, deploymentId } = payload;
    
    logger.info(`Workflow template ${templateId} deployed to ${environment}`);
    
    // Additional post-deployment actions could be added here
  }
}

// Export singleton instance
export const orchestratorService = new OrchestratorService();