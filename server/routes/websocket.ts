/**
 * WebSocket Routes
 * 
 * Registers and configures WebSocket endpoints using the new Enterprise WebSocket implementation.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServiceFactory, WebSocketServiceType } from '../services/websocket/WebSocketServiceFactory';
import { EnterpriseWebSocketManager } from '../services/websocket/EnterpriseWebSocketManager';
import { eventBus } from '../eventBus';

// Import mcpProxyService at the correct position to avoid circular references
let mcpProxyServiceImport: any;
try {
  mcpProxyServiceImport = require('../mcp-proxy').mcpProxyService;
} catch (e) {
  console.warn('MCP Proxy Service not available, using mock implementation');
  mcpProxyServiceImport = {
    getServerStatuses: () => [],
    getServerTools: () => []
  };
}

/**
 * Initialize WebSocket services
 */
export default function initializeWebSocketServices(
  httpServer: HttpServer, 
  mcpProxyServiceInstance = mcpProxyServiceImport
): WebSocketServiceFactory {
  // Create WebSocket service factory
  const factory = new WebSocketServiceFactory(httpServer);
  
  // Create MCP Proxy WebSocket service
  const mcpProxyWebSocketService = factory.createService(WebSocketServiceType.MCP_PROXY, {
    path: '/ws/mcp-proxy',
    maxPayload: 1024 * 1024, // 1MB
    compression: true,
    enableRateLimiting: true
  });
  
  // Create Events WebSocket service
  const eventsService = factory.createService(WebSocketServiceType.EVENTS, {
    path: '/ws/events',
    maxPayload: 512 * 1024, // 512KB
    compression: true,
    enableRateLimiting: true
  });
  
  // Create Agent WebSocket service
  const agentService = factory.createService(WebSocketServiceType.AGENT, {
    path: '/ws/agents',
    maxPayload: 5 * 1024 * 1024, // 5MB
    compression: true,
    enableRateLimiting: true
  });
  
  // Create Collaboration WebSocket service
  const collaborationService = factory.createService(WebSocketServiceType.COLLABORATION, {
    path: '/ws/collaboration',
    maxPayload: 1024 * 1024, // 1MB
    compression: true,
    enableRateLimiting: true
  });
  
  // Create Monitoring WebSocket service
  const monitoringService = factory.createService(WebSocketServiceType.MONITORING, {
    path: '/ws/monitoring',
    maxPayload: 256 * 1024, // 256KB
    compression: true,
    enableRateLimiting: true
  });
  
  // Create Basic Test WebSocket service
  // This handles the basic `/ws` endpoint that was being attempted by the client
  const basicService = factory.createService(WebSocketServiceType.TEST, {
    path: '/ws',
    maxPayload: 64 * 1024, // 64KB
    compression: false, 
    enableRateLimiting: false
  });
  
  // Register event handlers
  registerEventBusHandlers(factory);
  
  // Register MCP Proxy event handlers
  registerMcpProxyEventHandlers(factory, mcpProxyServiceInstance);
  
  // Register basic WebSocket test handler for the '/ws' endpoint
  const testService = factory.getService(WebSocketServiceType.TEST);
  if (testService) {
    console.log('Registering message handlers for TEST WebSocket service at /ws');
    
    // Echo any message back to the client
    testService.addMessageHandler('*', (message, client) => {
      console.log('Basic WebSocket test received message:', message);
      
      // Echo the message back to the client
      testService.sendToClient(client.id, {
        type: 'echo',
        originalMessage: message,
        timestamp: new Date().toISOString()
      });
    });
    
    // We don't need a separate connect handler since the EnterpriseWebSocketManager 
    // already sends a welcome message on connection
  }
  
  return factory;
}

/**
 * Register MCP Proxy event handlers
 */
function registerMcpProxyEventHandlers(
  factory: WebSocketServiceFactory,
  mcpProxyServiceInstance: any
): void {
  const mcpService = factory.getService(WebSocketServiceType.MCP_PROXY);
  if (!mcpService) return;
  
  // Add message handlers for MCP proxy
  mcpService.addMessageHandler('getServerStatus', (message, client) => {
    const statuses = mcpProxyServiceInstance.getServerStatuses();
    mcpService.sendToClient(client.id, {
      type: 'serverStatus',
      servers: statuses,
      timestamp: new Date().toISOString()
    });
  });
  
  mcpService.addMessageHandler('getServerTools', (message, client) => {
    try {
      const tools = mcpProxyServiceInstance.getServerTools(message.serverId);
      mcpService.sendToClient(client.id, {
        type: 'serverTools',
        serverId: message.serverId,
        tools,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      mcpService.sendToClient(client.id, {
        type: 'error',
        message: 'Failed to get server tools',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  mcpService.addMessageHandler('connectServer', async (message, client) => {
    try {
      const success = await mcpProxyServiceInstance.connectToServer(message.serverId);
      mcpService.sendToClient(client.id, {
        type: 'connectServerResult',
        serverId: message.serverId,
        success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      mcpService.sendToClient(client.id, {
        type: 'error',
        message: 'Failed to connect to server',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  mcpService.addMessageHandler('disconnectServer', (message, client) => {
    try {
      mcpProxyServiceInstance.disconnectFromServer(message.serverId);
      mcpService.sendToClient(client.id, {
        type: 'disconnectServerResult',
        serverId: message.serverId,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      mcpService.sendToClient(client.id, {
        type: 'error',
        message: 'Failed to disconnect from server',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Subscribe to MCP server events
  eventBus.on('mcp.server.status.changed', (event) => {
    const statuses = mcpProxyServiceInstance.getServerStatuses();
    mcpService.broadcast({
      type: 'serverStatus',
      servers: statuses,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Register event bus handlers
 */
function registerEventBusHandlers(factory: WebSocketServiceFactory): void {
  const eventsService = factory.getService(WebSocketServiceType.EVENTS);
  if (!eventsService) return;
  
  // Handle ping messages
  eventsService.addMessageHandler('ping', (message, client) => {
    eventsService.sendToClient(client.id, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle event subscription
  eventsService.addMessageHandler('subscribe', (message, client, manager) => {
    const subscriptionId = `${client.id}_${Date.now()}`;
    
    // Store subscription in client attributes
    const subscriptions = client.attributes.get('subscriptions') || [];
    subscriptions.push({
      id: subscriptionId,
      events: message.events || []
    });
    manager.setClientAttribute(client.id, 'subscriptions', subscriptions);
    
    // Confirm subscription
    eventsService.sendToClient(client.id, {
      type: 'subscription_confirmed',
      subscriptionId,
      events: message.events || [],
      timestamp: new Date().toISOString()
    });
  });
}

// Export WebSocketServiceType for use in other files
export { WebSocketServiceType } from '../services/websocket/WebSocketServiceFactory';