import { EventBus } from './eventBusService';
import { McpProxyService } from '../mcp-proxy';
import { agentManagementService } from './agentManagementService';
import WebSocket from 'ws';
import { db } from '@db';
import { eq } from 'drizzle-orm';
import { mcpAgents } from '@shared/schema_agents';
import { v4 as uuidv4 } from 'uuid';

/**
 * Agent MCP Proxy Service
 * 
 * Handles Model Context Protocol interactions for agents, including:
 * - Proxying tool requests from agents to MCP servers
 * - Managing agent-to-agent (A2A) communication
 * - Tracking agent execution metrics
 */
export class AgentMcpProxyService {
  private eventBus: EventBus;
  private mcpProxyService: McpProxyService;
  private agentClients: Map<number, WebSocket> = new Map();
  private agentPendingRequests: Map<string, { agentId: number, startTime: number }> = new Map();
  
  constructor(eventBus: EventBus, mcpProxyService: McpProxyService) {
    this.eventBus = eventBus;
    this.mcpProxyService = mcpProxyService;
    
    // Register event handlers
    this.eventBus.subscribe('agent.registered', this.handleAgentRegistered.bind(this));
    this.eventBus.subscribe('agent.deregistered', this.handleAgentDeregistered.bind(this));
    this.eventBus.subscribe('agent.a2a.message', this.handleA2AMessage.bind(this));
    
    console.log('Agent MCP Proxy Service initialized');
  }
  
  /**
   * Initialize the WebSocket server for agent connections
   */
  public initialize(wsServer: WebSocket.Server): void {
    wsServer.on('connection', (ws: WebSocket, request) => {
      // Parse URL to extract agent authentication info
      const urlParams = new URLSearchParams(request.url?.split('?')[1] || '');
      const agentId = parseInt(urlParams.get('agentId') || '0');
      const apiKey = urlParams.get('apiKey') || '';
      
      if (!agentId || !apiKey) {
        ws.close(4000, 'Missing agent ID or API key');
        return;
      }
      
      // Authenticate the agent
      this.authenticateAgent(agentId, apiKey)
        .then(authenticated => {
          if (!authenticated) {
            ws.close(4001, 'Invalid agent credentials');
            return;
          }
          
          console.log(`Agent ${agentId} connected via WebSocket`);
          
          // Store the WebSocket connection for this agent
          this.agentClients.set(agentId, ws);
          
          // Update agent status to active
          this.updateAgentStatus(agentId, 'active');
          
          // Setup WebSocket event handlers
          ws.on('message', (message: WebSocket.Data) => {
            this.handleAgentMessage(agentId, message);
          });
          
          ws.on('close', () => {
            console.log(`Agent ${agentId} WebSocket connection closed`);
            this.agentClients.delete(agentId);
            this.updateAgentStatus(agentId, 'registered');
          });
          
          ws.on('error', (error) => {
            console.error(`Agent ${agentId} WebSocket error:`, error);
          });
          
          // Send welcome message
          ws.send(JSON.stringify({
            type: 'welcome',
            agentId,
            timestamp: new Date().toISOString()
          }));
        })
        .catch(error => {
          console.error(`Error authenticating agent ${agentId}:`, error);
          ws.close(4500, 'Authentication error');
        });
    });
    
    console.log('Agent WebSocket server initialized');
  }
  
  /**
   * Authenticate an agent with its API key
   */
  private async authenticateAgent(agentId: number, apiKey: string): Promise<boolean> {
    return await agentManagementService.authenticateAgent(agentId, apiKey);
  }
  
  /**
   * Update agent status
   */
  private async updateAgentStatus(agentId: number, status: string): Promise<void> {
    try {
      await db.update(mcpAgents)
        .set({
          status,
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(mcpAgents.id, agentId));
    } catch (error) {
      console.error(`Error updating agent ${agentId} status:`, error);
    }
  }
  
  /**
   * Handle messages from agents
   */
  private async handleAgentMessage(agentId: number, message: WebSocket.Data): Promise<void> {
    try {
      const msgData = JSON.parse(message.toString());
      
      // Handle different message types
      switch (msgData.type) {
        case 'runTool':
          await this.handleRunToolRequest(agentId, msgData);
          break;
          
        case 'a2aMessage':
          await this.handleAgentToAgentMessage(agentId, msgData);
          break;
          
        case 'ping':
          this.sendToAgent(agentId, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;
          
        default:
          console.warn(`Unhandled agent message type: ${msgData.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from agent ${agentId}:`, error);
      this.sendToAgent(agentId, {
        type: 'error',
        error: 'Failed to process message',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle a request to run a tool
   */
  private async handleRunToolRequest(agentId: number, msgData: any): Promise<void> {
    const { requestId, serverId, toolName, inputs } = msgData;
    
    if (!requestId || !serverId || !toolName) {
      this.sendToAgent(agentId, {
        type: 'error',
        requestId,
        error: 'Missing required fields',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    try {
      // Get agent to check if it has access to the server
      const agent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, agentId),
        with: {
          tools: true
        }
      });
      
      if (!agent) {
        this.sendToAgent(agentId, {
          type: 'error',
          requestId,
          error: 'Agent not found',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Create execution log entry
      const executionId = uuidv4();
      await agentManagementService.logExecution({
        agentId,
        executionId,
        startedAt: new Date(),
        status: 'started',
        workspaceId: agent.workspaceId,
        workflowId: msgData.workflowId,
        requestData: { toolName, inputs },
        traceId: msgData.traceId
      });
      
      // Emit execution started event
      this.eventBus.publish('agent.execution.started', {
        agentId,
        executionId,
        toolName,
        workspaceId: agent.workspaceId
      });
      
      // Store the pending request
      this.agentPendingRequests.set(requestId, {
        agentId,
        startTime: Date.now()
      });
      
      // Forward the request to the MCP proxy
      this.mcpProxyService.executeTool(serverId, toolName, inputs, 
        async (response) => {
          // Process the response
          await this.handleToolResponse(agentId, requestId, executionId, response);
        }, 
        async (error) => {
          // Process the error
          await this.handleToolError(agentId, requestId, executionId, error);
        }
      );
    } catch (error) {
      console.error(`Error handling tool request from agent ${agentId}:`, error);
      this.sendToAgent(agentId, {
        type: 'error',
        requestId,
        error: 'Failed to process tool request',
        timestamp: new Date().toISOString()
      });
      
      // Update the execution log with error
      try {
        await agentManagementService.logExecution({
          agentId,
          executionId: uuidv4(), // Generate a new ID since we didn't create one earlier
          startedAt: new Date(),
          completedAt: new Date(),
          status: 'failed',
          error: `Internal error: ${(error as Error).message}`,
          workspaceId: undefined, // We don't have this info since the agent lookup failed
          requestData: { toolName, inputs }
        });
      } catch (logError) {
        console.error('Failed to log execution error:', logError);
      }
    }
  }
  
  /**
   * Handle successful tool execution response
   */
  private async handleToolResponse(agentId: number, requestId: string, executionId: string, response: any): Promise<void> {
    try {
      // Remove from pending requests
      const pendingRequest = this.agentPendingRequests.get(requestId);
      this.agentPendingRequests.delete(requestId);
      
      // Calculate latency
      const latency = pendingRequest ? Date.now() - pendingRequest.startTime : 0;
      
      // Send response to agent
      this.sendToAgent(agentId, {
        type: 'toolResponse',
        requestId,
        result: response,
        executionId,
        latency,
        timestamp: new Date().toISOString()
      });
      
      // Update execution log with success
      await agentManagementService.logExecution({
        agentId,
        executionId,
        completedAt: new Date(),
        status: 'completed',
        responseData: response
      });
      
      // Emit execution completed event
      this.eventBus.publish('agent.execution.completed', {
        agentId,
        executionId,
        success: true,
        latency
      });
    } catch (error) {
      console.error(`Error handling tool response for agent ${agentId}:`, error);
    }
  }
  
  /**
   * Handle tool execution error
   */
  private async handleToolError(agentId: number, requestId: string, executionId: string, error: Error): Promise<void> {
    try {
      // Remove from pending requests
      const pendingRequest = this.agentPendingRequests.get(requestId);
      this.agentPendingRequests.delete(requestId);
      
      // Calculate latency
      const latency = pendingRequest ? Date.now() - pendingRequest.startTime : 0;
      
      // Send error to agent
      this.sendToAgent(agentId, {
        type: 'toolError',
        requestId,
        error: error.message,
        executionId,
        latency,
        timestamp: new Date().toISOString()
      });
      
      // Update execution log with failure
      await agentManagementService.logExecution({
        agentId,
        executionId,
        completedAt: new Date(),
        status: 'failed',
        error: error.message
      });
      
      // Emit execution completed event
      this.eventBus.publish('agent.execution.completed', {
        agentId,
        executionId,
        success: false,
        error: error.message,
        latency
      });
    } catch (error) {
      console.error(`Error handling tool error for agent ${agentId}:`, error);
    }
  }
  
  /**
   * Handle agent-to-agent messages
   */
  private async handleAgentToAgentMessage(sourceAgentId: number, msgData: any): Promise<void> {
    const { targetAgentId, content, messageId } = msgData;
    
    if (!targetAgentId || !content || !messageId) {
      this.sendToAgent(sourceAgentId, {
        type: 'error',
        messageId,
        error: 'Missing required fields for A2A message',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    try {
      // Get source agent to check if it has A2A capability
      const sourceAgent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, sourceAgentId)
      });
      
      if (!sourceAgent) {
        this.sendToAgent(sourceAgentId, {
          type: 'error',
          messageId,
          error: 'Source agent not found',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      if (!sourceAgent.implementsA2A) {
        this.sendToAgent(sourceAgentId, {
          type: 'error',
          messageId,
          error: 'Source agent does not support A2A communication',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Get target agent
      const targetAgent = await db.query.mcpAgents.findFirst({
        where: eq(mcpAgents.id, targetAgentId)
      });
      
      if (!targetAgent) {
        this.sendToAgent(sourceAgentId, {
          type: 'error',
          messageId,
          error: 'Target agent not found',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      if (!targetAgent.implementsA2A) {
        this.sendToAgent(sourceAgentId, {
          type: 'error',
          messageId,
          error: 'Target agent does not support A2A communication',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Log the communication
      await agentManagementService.logA2ACommunication({
        sourceAgentId,
        targetAgentId,
        messageId,
        messageType: msgData.messageType || 'message',
        content,
        sentAt: new Date(),
        status: 'sent',
        workspaceId: sourceAgent.workspaceId,
        executionId: msgData.executionId,
        traceId: msgData.traceId
      });
      
      // Emit A2A message event
      this.eventBus.publish('agent.a2a.message', {
        sourceAgentId,
        targetAgentId,
        messageId,
        messageType: msgData.messageType || 'message'
      });
      
      // Forward the message to the target agent
      const delivered = this.forwardA2AMessage(
        sourceAgentId,
        targetAgentId,
        messageId,
        msgData.messageType || 'message',
        content,
        msgData.executionId,
        msgData.traceId
      );
      
      // Acknowledge receipt to source agent
      this.sendToAgent(sourceAgentId, {
        type: 'a2aAck',
        messageId,
        delivered,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error handling A2A message from agent ${sourceAgentId}:`, error);
      this.sendToAgent(sourceAgentId, {
        type: 'error',
        messageId,
        error: 'Failed to process A2A message',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Forward a message from one agent to another
   */
  private forwardA2AMessage(
    sourceAgentId: number,
    targetAgentId: number,
    messageId: string,
    messageType: string,
    content: any,
    executionId?: string,
    traceId?: string
  ): boolean {
    const targetWs = this.agentClients.get(targetAgentId);
    
    if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
      console.warn(`Target agent ${targetAgentId} is not connected, cannot deliver A2A message`);
      return false;
    }
    
    try {
      // Send the message to the target agent
      targetWs.send(JSON.stringify({
        type: 'a2aMessage',
        sourceAgentId,
        messageId,
        messageType,
        content,
        executionId,
        traceId,
        timestamp: new Date().toISOString()
      }));
      
      // Update the communication log with received status
      agentManagementService.logA2ACommunication({
        sourceAgentId,
        targetAgentId,
        messageId,
        messageType,
        content,
        sentAt: new Date(),
        receivedAt: new Date(),
        status: 'received',
        executionId,
        traceId
      }).catch(error => {
        console.error('Failed to update A2A communication log:', error);
      });
      
      return true;
    } catch (error) {
      console.error(`Error forwarding A2A message to agent ${targetAgentId}:`, error);
      return false;
    }
  }
  
  /**
   * Send a message to a specific agent
   */
  private sendToAgent(agentId: number, message: any): boolean {
    const ws = this.agentClients.get(agentId);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`Agent ${agentId} is not connected, cannot send message`);
      return false;
    }
    
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to agent ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected agents
   */
  public broadcastToAgents(message: any): void {
    this.agentClients.forEach((ws, agentId) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error broadcasting message to agent ${agentId}:`, error);
        }
      }
    });
  }
  
  // Event handlers
  private async handleAgentRegistered(data: any): Promise<void> {
    console.log(`Agent registered event: ${data.name} (${data.agentType})`);
    // Additional logic as needed
  }
  
  private async handleAgentDeregistered(data: any): Promise<void> {
    console.log(`Agent deregistered event: ${data.name} (ID: ${data.agentId})`);
    
    // Close any WebSocket connection
    const ws = this.agentClients.get(data.agentId);
    if (ws) {
      try {
        ws.close(1000, 'Agent deregistered');
      } catch (error) {
        console.error(`Error closing WebSocket for agent ${data.agentId}:`, error);
      }
      this.agentClients.delete(data.agentId);
    }
  }
  
  private async handleA2AMessage(data: any): Promise<void> {
    console.log(`A2A message: ${data.messageId} from ${data.sourceAgentId} to ${data.targetAgentId}`);
    // Additional logging or analytics as needed
  }
}

// Export factory function to create the service
export function createAgentMcpProxyService(eventBus: EventBus, mcpProxyService: McpProxyService): AgentMcpProxyService {
  return new AgentMcpProxyService(eventBus, mcpProxyService);
}