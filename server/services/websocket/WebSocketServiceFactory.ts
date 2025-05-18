/**
 * WebSocket Service Factory
 * 
 * A factory for creating and managing WebSocket services and endpoints.
 * This allows for consistent configuration and management of multiple WebSocket endpoints
 * in the enterprise application.
 */

import { Server as HttpServer } from 'http';
import EnterpriseWebSocketManager, { WebSocketManagerConfig, MessageHandler, WebSocketMessage } from './EnterpriseWebSocketManager';
import { eventBus } from '../../eventBus';
import { WebSocketUpgradeHandler } from './WebSocketUpgradeHandler';
import { UserStatus } from '../../../shared/types/collaboration';

/**
 * WebSocket service types
 */
export enum WebSocketServiceType {
  MCP_PROXY = 'mcp-proxy',
  EVENTS = 'events',
  AGENT = 'agent',
  COLLABORATION = 'collaboration',
  MONITORING = 'monitoring',
  TEST = 'test'  // Used for basic WebSocket test endpoint
}

/**
 * WebSocket Service Factory
 */
export class WebSocketServiceFactory {
  private httpServer: HttpServer;
  private services: Map<string, EnterpriseWebSocketManager> = new Map();
  
  constructor(httpServer: HttpServer) {
    this.httpServer = httpServer;
    
    // Listen for process shutdown events
    process.on('SIGINT', () => this.shutdownAllServices());
    process.on('SIGTERM', () => this.shutdownAllServices());
    
    console.log('WebSocket Service Factory initialized');
  }
  
  /**
   * Create a WebSocket service
   */
  public createService(
    serviceType: WebSocketServiceType,
    config: Partial<WebSocketManagerConfig> = {}
  ): EnterpriseWebSocketManager {
    // Get default configuration for this service type
    const defaultConfig = this.getDefaultConfig(serviceType);
    
    // Merge with provided config
    const mergedConfig = { ...defaultConfig, ...config };
    
    // Get WebSocketUpgradeHandler instance
    const upgradeHandler = WebSocketUpgradeHandler.getInstance();
    
    // Initialize the upgrade handler
    upgradeHandler.initialize(this.httpServer);
    
    // Create the service with custom upgrade handler
    const wsServer = upgradeHandler.registerServer(mergedConfig.path || '/ws', {
      maxPayload: mergedConfig.maxPayload, 
      perMessageDeflate: mergedConfig.compression
    });
    
    // Create the service using the registered server
    const service = new EnterpriseWebSocketManager(wsServer, mergedConfig);
    
    // Register default message handlers
    this.registerDefaultHandlers(service, serviceType);
    
    // Store the service
    this.services.set(serviceType, service);
    
    console.log(`WebSocket service created: ${serviceType} at ${mergedConfig.path}`);
    
    // Emit event
    eventBus.emit('system.config.changed', {
      component: 'websocket',
      action: 'service_created',
      serviceType
    });
    
    return service;
  }
  
  /**
   * Get a WebSocket service
   */
  public getService(serviceType: WebSocketServiceType): EnterpriseWebSocketManager | undefined {
    return this.services.get(serviceType);
  }
  
  /**
   * Shutdown a specific service
   */
  public shutdownService(serviceType: WebSocketServiceType): Promise<void> {
    const service = this.services.get(serviceType);
    if (!service) {
      return Promise.resolve();
    }
    
    console.log(`Shutting down WebSocket service: ${serviceType}`);
    
    return service.close().then(() => {
      this.services.delete(serviceType);
      
      // Emit event
      eventBus.emit('system.config.changed', {
        component: 'websocket',
        action: 'service_shutdown',
        serviceType
      });
    });
  }
  
  /**
   * Shutdown all services
   */
  public shutdownAllServices(): Promise<void> {
    console.log('Shutting down all WebSocket services');
    
    const promises = Array.from(this.services.entries()).map(([serviceType, service]) => {
      return service.close().then(() => {
        // Emit event
        eventBus.emit('system.config.changed', {
          component: 'websocket',
          action: 'service_shutdown',
          serviceType
        });
      });
    });
    
    return Promise.all(promises).then(() => {
      this.services.clear();
    });
  }
  
  /**
   * Get all services
   */
  public getAllServices(): Map<string, EnterpriseWebSocketManager> {
    return new Map(this.services);
  }
  
  /**
   * Broadcast a message to all clients of a service type
   */
  public broadcast(serviceType: WebSocketServiceType, message: WebSocketMessage): void {
    const service = this.services.get(serviceType);
    if (service) {
      service.broadcast(message);
    }
  }
  
  /**
   * Broadcast a message to all clients of all services
   */
  public broadcastAll(message: WebSocketMessage): void {
    this.services.forEach(service => {
      service.broadcast(message);
    });
  }
  
  /**
   * Get total client count across all services
   */
  public getTotalClientCount(): number {
    let count = 0;
    this.services.forEach(service => {
      count += service.getClientCount();
    });
    return count;
  }
  
  /**
   * Get metrics for all services
   */
  public getMetrics(): { [serviceType: string]: any } {
    const metrics: { [serviceType: string]: any } = {};
    
    this.services.forEach((service, serviceType) => {
      metrics[serviceType] = service.getMetrics();
    });
    
    return metrics;
  }
  
  /**
   * Get default configuration for a service type
   */
  private getDefaultConfig(serviceType: WebSocketServiceType): Partial<WebSocketManagerConfig> {
    switch (serviceType) {
      case WebSocketServiceType.MCP_PROXY:
        return {
          path: '/ws/mcp-proxy',
          maxPayload: 64 * 1024, // 64KB - conservative for compatibility
          compression: false, // Disable compression for maximum compatibility
          authRequired: false, // No auth required for MCP proxy
          anonymousConnectionsAllowed: true,
          enableRateLimiting: true,
          maxConnectionsPerIp: 10, // Limit connections per IP
          maxMessagesPerMinute: 600, // 10 messages per second
          connectionTimeout: 60000, // 60 seconds
          pingInterval: 15000, // 15 seconds
          pingTimeout: 5000, // 5 seconds
          clientCleanupInterval: 60000, // 60 seconds
          maxBackpressureSize: 1024 * 1024, // 1MB
          serializeMessages: true
        };
        
      case WebSocketServiceType.EVENTS:
        return {
          path: '/ws/events',
          maxPayload: 128 * 1024, // 128KB
          compression: true, // Enable compression for events
          authRequired: true, // Auth required for events
          anonymousConnectionsAllowed: false,
          enableRateLimiting: true,
          maxConnectionsPerIp: 5,
          maxMessagesPerMinute: 300,
          connectionTimeout: 120000, // 2 minutes
          pingInterval: 30000, // 30 seconds
          pingTimeout: 10000, // 10 seconds
          clientCleanupInterval: 60000, // 60 seconds
          maxBackpressureSize: 2 * 1024 * 1024, // 2MB
          serializeMessages: true
        };
        
      case WebSocketServiceType.AGENT:
        return {
          path: '/ws/agent',
          maxPayload: 1024 * 1024, // 1MB
          compression: true, // Enable compression for agent
          authRequired: true, // Auth required for agent
          anonymousConnectionsAllowed: false,
          enableRateLimiting: true,
          maxConnectionsPerIp: 20,
          maxMessagesPerMinute: 1200, // 20 messages per second
          connectionTimeout: 300000, // 5 minutes
          pingInterval: 30000, // 30 seconds
          pingTimeout: 15000, // 15 seconds
          clientCleanupInterval: 120000, // 2 minutes
          maxBackpressureSize: 5 * 1024 * 1024, // 5MB
          serializeMessages: true
        };
        
      case WebSocketServiceType.COLLABORATION:
        return {
          path: '/ws/collaboration',
          maxPayload: 256 * 1024, // 256KB
          compression: true, // Enable compression for collaboration
          authRequired: true, // Auth required for collaboration
          anonymousConnectionsAllowed: false,
          enableRateLimiting: true,
          maxConnectionsPerIp: 5,
          maxMessagesPerMinute: 600, // 10 messages per second
          connectionTimeout: 120000, // 2 minutes
          pingInterval: 15000, // 15 seconds
          pingTimeout: 5000, // 5 seconds
          clientCleanupInterval: 60000, // 60 seconds
          maxBackpressureSize: 2 * 1024 * 1024, // 2MB
          serializeMessages: true
        };
        
      case WebSocketServiceType.MONITORING:
        return {
          path: '/ws/monitoring',
          maxPayload: 128 * 1024, // 128KB
          compression: true, // Enable compression for monitoring
          authRequired: true, // Auth required for monitoring
          anonymousConnectionsAllowed: false,
          enableRateLimiting: true,
          maxConnectionsPerIp: 3,
          maxMessagesPerMinute: 120, // 2 messages per second
          connectionTimeout: 300000, // 5 minutes
          pingInterval: 30000, // 30 seconds
          pingTimeout: 10000, // 10 seconds
          clientCleanupInterval: 120000, // 2 minutes
          maxBackpressureSize: 1 * 1024 * 1024, // 1MB
          serializeMessages: true
        };
        
      case WebSocketServiceType.TEST:
        return {
          path: '/ws',
          maxPayload: 32 * 1024, // 32KB
          compression: false, // Disable compression for test
          authRequired: false, // No auth required for test
          anonymousConnectionsAllowed: true,
          enableRateLimiting: false, // Disable rate limiting for testing
          maxConnectionsPerIp: 50, // Allow many connections for testing
          maxMessagesPerMinute: 600, // 10 messages per second
          connectionTimeout: 60000, // 60 seconds
          pingInterval: 15000, // 15 seconds
          pingTimeout: 5000, // 5 seconds
          clientCleanupInterval: 60000, // 60 seconds
          maxBackpressureSize: 1 * 1024 * 1024, // 1MB
          serializeMessages: true
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Register default message handlers for a service
   */
  private registerDefaultHandlers(
    service: EnterpriseWebSocketManager,
    serviceType: WebSocketServiceType
  ): void {
    // Register common handlers
    service.addMessageHandler('ping', (message, client, manager) => {
      manager.sendToClient(client.id, {
        type: 'pong',
        id: message.id || '',
        serverTime: new Date().toISOString()
      });
    });
    
    service.addMessageHandler('status_request', (message, client, manager) => {
      if (serviceType === WebSocketServiceType.MCP_PROXY) {
        // For MCP proxy, send server status
        manager.sendToClient(client.id, {
          type: 'server_status',
          messageId: message.messageId,
          servers: this.getMockServerStatus(), // Replace with actual server status
          serverTime: new Date().toISOString()
        });
      } else {
        // For other services, send a generic status
        manager.sendToClient(client.id, {
          type: 'status',
          serviceType,
          status: 'running',
          clientCount: manager.getClientCount(),
          serverTime: new Date().toISOString()
        });
      }
    });
    
    // Register service-specific handlers
    switch (serviceType) {
      case WebSocketServiceType.MCP_PROXY:
        this.registerMcpProxyHandlers(service);
        break;
        
      case WebSocketServiceType.EVENTS:
        this.registerEventsHandlers(service);
        break;
        
      case WebSocketServiceType.AGENT:
        this.registerAgentHandlers(service);
        break;
        
      case WebSocketServiceType.COLLABORATION:
        this.registerCollaborationHandlers(service);
        break;
        
      case WebSocketServiceType.MONITORING:
        this.registerMonitoringHandlers(service);
        break;
        
      case WebSocketServiceType.TEST:
        this.registerTestHandlers(service);
        break;
    }
  }
  
  /**
   * Register MCP Proxy handlers
   */
  private registerMcpProxyHandlers(service: EnterpriseWebSocketManager): void {
    service.addMessageHandler('getServerStatus', (message, client, manager) => {
      manager.sendToClient(client.id, {
        type: 'serverStatus',
        messageId: message.messageId,
        servers: this.getMockServerStatus(),
        serverTime: new Date().toISOString()
      });
    });
    
    service.addMessageHandler('getServerTools', (message, client, manager) => {
      manager.sendToClient(client.id, {
        type: 'serverTools',
        messageId: message.messageId,
        serverId: message.serverId,
        tools: this.getMockServerTools(message.serverId),
        serverTime: new Date().toISOString()
      });
    });
    
    // Handle client_pong messages for bidirectional connection quality monitoring
    service.addMessageHandler('client_pong', (message, client, manager) => {
      // Process the client's pong response
      const now = Date.now();
      const clientTimestamp = message.timestamp || now;
      const originalServerTime = message.originalServerTime || '';
      const roundTripTime = message.roundTripTime || (now - clientTimestamp);
      
      // Store RTT metrics in client attributes
      const rttHistory = client.attributes.get('clientRttHistory') || [];
      if (Array.isArray(rttHistory)) {
        // Keep last 10 measurements
        if (rttHistory.length >= 10) rttHistory.shift();
        rttHistory.push(roundTripTime);
        client.attributes.set('clientRttHistory', rttHistory);
        
        // Calculate average RTT
        const avgRtt = rttHistory.reduce((sum, val) => sum + val, 0) / rttHistory.length;
        client.attributes.set('clientAvgRtt', avgRtt);
      } else {
        client.attributes.set('clientRttHistory', [roundTripTime]);
        client.attributes.set('clientAvgRtt', roundTripTime);
      }
      
      // Store client metrics for monitoring
      if (message.metrics) {
        client.attributes.set('clientMetrics', message.metrics);
      }
      
      // Log client metrics occasionally for monitoring
      if (Math.random() < 0.1) { // ~10% of messages
        console.log(`Client ${client.id} connection metrics:
          Avg RTT: ${client.attributes.get('clientAvgRtt') || 0}ms
          Connection Age: ${now - client.connectionStartTime}ms
          Client State: ${message.metrics?.connectionState || 'unknown'}
          Network Type: ${message.metrics?.networkType || 'unknown'}
        `);
      }
    });
    
    service.addMessageHandler('pingServer', (message, client, manager) => {
      // Simulate ping response with random latency
      setTimeout(() => {
        manager.sendToClient(client.id, {
          type: 'pingServerResult',
          messageId: message.messageId,
          serverId: message.serverId,
          success: true,
          latency: Math.floor(Math.random() * 50) + 20, // 20-70ms
          serverTime: new Date().toISOString()
        });
      }, Math.floor(Math.random() * 50) + 20);
    });
  }
  
  /**
   * Register Events handlers
   */
  private registerEventsHandlers(service: EnterpriseWebSocketManager): void {
    // Add event subscription handler
    service.addMessageHandler('subscribe', (message, client, manager) => {
      const events = message.events || [];
      
      if (Array.isArray(events) && events.length > 0) {
        // Store subscribed events in client attributes
        const subscribedEvents = new Set(client.attributes.get('subscribedEvents') || []);
        events.forEach(event => subscribedEvents.add(event));
        client.attributes.set('subscribedEvents', Array.from(subscribedEvents));
        
        manager.sendToClient(client.id, {
          type: 'subscribe_success',
          events: Array.from(subscribedEvents),
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      } else {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_events',
          message: 'No events specified for subscription',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      }
    });
    
    // Add event unsubscription handler
    service.addMessageHandler('unsubscribe', (message, client, manager) => {
      const events = message.events || [];
      
      if (Array.isArray(events) && events.length > 0) {
        // Remove events from subscribed events
        const subscribedEvents = new Set(client.attributes.get('subscribedEvents') || []);
        events.forEach(event => subscribedEvents.delete(event));
        client.attributes.set('subscribedEvents', Array.from(subscribedEvents));
        
        manager.sendToClient(client.id, {
          type: 'unsubscribe_success',
          events: Array.from(subscribedEvents),
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      } else {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_events',
          message: 'No events specified for unsubscription',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      }
    });
  }
  
  /**
   * Register Agent handlers
   */
  private registerAgentHandlers(service: EnterpriseWebSocketManager): void {
    // Agent registration handler
    service.addMessageHandler('register', (message, client, manager) => {
      const agentId = message.agentId;
      const agentName = message.agentName;
      const capabilities = message.capabilities || [];
      
      if (!agentId || !agentName) {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_registration',
          message: 'Agent ID and name are required',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        return;
      }
      
      // Store agent info in client attributes
      client.attributes.set('agentId', agentId);
      client.attributes.set('agentName', agentName);
      client.attributes.set('capabilities', capabilities);
      client.tags.set('agent', 'true');
      client.tags.set('agentId', agentId);
      
      manager.sendToClient(client.id, {
        type: 'registration_success',
        agentId,
        messageId: message.messageId,
        serverTime: new Date().toISOString()
      });
      
      // Emit event
      eventBus.emit('agent.registered', {
        agentId,
        agentName,
        capabilities,
        connectionId: client.id
      });
    });
    
    // Agent heartbeat handler
    service.addMessageHandler('heartbeat', (message, client, manager) => {
      const agentId = client.attributes.get('agentId');
      
      if (!agentId) {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'not_registered',
          message: 'Agent not registered',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        return;
      }
      
      manager.sendToClient(client.id, {
        type: 'heartbeat_ack',
        agentId,
        messageId: message.messageId,
        serverTime: new Date().toISOString()
      });
    });
  }
  
  /**
   * Register Collaboration handlers
   */
  private registerCollaborationHandlers(service: EnterpriseWebSocketManager): void {
    // Import the PresenceService
    import('../collaboration/PresenceService').then(module => {
      const presenceService = module.presenceService;
      
      // The EnterpriseWebSocketManager handles connections internally
      // We'll use the message handler system and events instead of direct connection handlers
      console.log('Registering collaboration handlers');
      
      // Subscribe to connection events via the event bus
      eventBus.on('ws.client.connected', (event: any) => {
        if (event.serviceType === 'collaboration') {
          console.log(`New collaboration connection: ${event.clientId}`);
        }
      });
      
      eventBus.on('ws.client.disconnected', (event: any) => {
        if (event.serviceType === 'collaboration') {
          console.log(`Collaboration connection closed: ${event.clientId}`);
          const client = service.getClient(event.clientId);
          if (client && client.userId) {
            presenceService.removeConnection(Number(client.userId), client.socket);
          }
        }
      });
      
      // Handle user presence registration
      service.addMessageHandler('auth', (message, client, manager) => {
        if (!message.userId || typeof message.userId !== 'number') {
          manager.sendToClient(client.id, {
            type: 'error',
            error: 'invalid_auth',
            message: 'Valid user ID is required',
            messageId: message.messageId,
            serverTime: new Date().toISOString()
          });
          return;
        }
        
        // Store user ID in client (convert to string since WebSocketClient expects string)
        client.userId = String(message.userId);
        
        // Register user presence
        const presence = {
          userId: message.userId,
          username: message.username || `User-${message.userId}`,
          fullName: message.fullName,
          avatarUrl: message.avatarUrl,
          workspaceId: message.workspaceId,
          currentPage: message.currentPage || 'home',
          currentView: message.currentView,
          status: 'online' as UserStatus, // Cast to UserStatus
          lastActive: new Date().toISOString(),
          metadata: message.metadata || {}
        };
        
        // Register the user directly with the presence service
        presenceService.registerUser(presence, client.socket);
        
        manager.sendToClient(client.id, {
          type: 'auth_success',
          userId: message.userId,
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        
        // Send current users in the workspace if applicable
        if (message.workspaceId) {
          const workspaceUsers = presenceService.getWorkspaceUsers(message.workspaceId);
          manager.sendToClient(client.id, {
            type: 'current_users',
            users: workspaceUsers,
            messageId: message.messageId,
            serverTime: new Date().toISOString()
          });
        }
      });
      
      // Handle heartbeat
      service.addMessageHandler('heartbeat', (message, client, manager) => {
        if (client.userId) {
          // Convert string userId to number
          presenceService.heartbeat(parseInt(client.userId, 10));
        }
      });
      
      // Handle presence update
      service.addMessageHandler('update_presence', (message, client, manager) => {
        if (!client.userId) {
          manager.sendToClient(client.id, {
            type: 'error',
            error: 'not_authenticated',
            message: 'Authentication required',
            messageId: message.messageId,
            serverTime: new Date().toISOString()
          });
          return;
        }
        
        // Convert string userId to number
        presenceService.updateUserPresence(parseInt(client.userId, 10), message.presence || {});
        
        manager.sendToClient(client.id, {
          type: 'update_presence_success',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      });
      
      // Handle request for current users
      service.addMessageHandler('request_users', (message, client, manager) => {
        let users;
        
        if (message.workspaceId) {
          users = presenceService.getWorkspaceUsers(message.workspaceId);
        } else {
          users = presenceService.getAllUsers();
        }
        
        manager.sendToClient(client.id, {
          type: 'current_users',
          users,
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      });
    });
    
    // Join workspace handler
    service.addMessageHandler('join_workspace', (message, client, manager) => {
      const workspaceId = message.workspaceId;
      
      if (!workspaceId) {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_workspace',
          message: 'Workspace ID is required',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        return;
      }
      
      // Store workspace info in client attributes
      client.workspaceId = workspaceId;
      client.tags.set('workspace', workspaceId.toString());
      
      manager.sendToClient(client.id, {
        type: 'join_workspace_success',
        workspaceId,
        messageId: message.messageId,
        serverTime: new Date().toISOString()
      });
      
      // Broadcast user joined to workspace
      manager.broadcast(
        {
          type: 'user_joined',
          userId: client.userId,
          workspaceId,
          serverTime: new Date().toISOString()
        },
        c => c.workspaceId === workspaceId && c.id !== client.id
      );
    });
    
    // Send message handler
    service.addMessageHandler('send_message', (message, client, manager) => {
      const workspaceId = client.workspaceId;
      const content = message.content;
      
      if (!workspaceId) {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'not_in_workspace',
          message: 'Not in a workspace',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        return;
      }
      
      if (!content) {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_message',
          message: 'Message content is required',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
        return;
      }
      
      // Broadcast message to workspace
      manager.broadcast(
        {
          type: 'new_message',
          userId: client.userId,
          workspaceId,
          content,
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        },
        c => c.workspaceId === workspaceId
      );
    });
  }
  
  /**
   * Register Monitoring handlers
   */
  private registerMonitoringHandlers(service: EnterpriseWebSocketManager): void {
    // Register metrics subscription
    service.addMessageHandler('subscribe_metrics', (message, client, manager) => {
      const metrics = message.metrics || [];
      
      if (Array.isArray(metrics) && metrics.length > 0) {
        // Store subscribed metrics in client attributes
        client.attributes.set('subscribedMetrics', metrics);
        client.tags.set('metrics_subscriber', 'true');
        
        manager.sendToClient(client.id, {
          type: 'subscribe_metrics_success',
          metrics,
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      } else {
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'invalid_metrics',
          message: 'No metrics specified for subscription',
          messageId: message.messageId,
          serverTime: new Date().toISOString()
        });
      }
    });
    
    // Handle metrics request
    service.addMessageHandler('get_metrics', (message, client, manager) => {
      manager.sendToClient(client.id, {
        type: 'metrics',
        metrics: this.getSystemMetrics(),
        messageId: message.messageId,
        serverTime: new Date().toISOString()
      });
    });
  }
  
  /**
   * Register Test handlers with enterprise-grade capabilities
   */
  private registerTestHandlers(service: EnterpriseWebSocketManager): void {
    console.log("Registering message handlers for TEST WebSocket service at /ws");
    
    // Set up event bus subscriptions for the test service
    this.setupTestServiceEventHandlers(service);

    // Test handler for diagnostics
    service.addMessageHandler('test', (message, client, manager) => {
      try {
        console.log(`Test handler received message from client ${client.id}`);
        
        // Log this event to the event bus for centralized monitoring
        eventBus.emit('ws.message.received', {
          serviceType: WebSocketServiceType.TEST,
          clientId: client.id,
          messageType: 'test',
          timestamp: new Date()
        });
        
        manager.sendToClient(client.id, {
          type: 'test_response',
          messageId: message.messageId || `auto-${Date.now()}`,
          originalMessage: message,
          serverTime: new Date().toISOString(),
          serverInfo: {
            nodeId: process.env.REPL_ID || 'local',
            environment: process.env.NODE_ENV || 'development',
            serverTime: new Date().toISOString(),
            version: "1.0.0",
            uptime: process.uptime(),
            connectedClients: service.getClientCount(),
            capabilities: ['echo', 'test', 'message', 'ping', 'metrics']
          }
        });
      } catch (error) {
        console.error(`Error in test handler: ${error.message}`);
        
        // Log error to the event bus
        eventBus.emit('system.error', {
          source: 'websocket.test.handler',
          message: `Error processing test message: ${error.message}`,
          error
        });
        
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'internal_error',
          message: 'Internal server error processing test message',
          messageId: message.messageId,
          serverTime: new Date().toISOString(),
          errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        });
      }
    });
    
    // Enhanced echo handler with validation, error handling, and metrics
    service.addMessageHandler('echo', (message, client, manager) => {
      try {
        if (!message.content) {
          manager.sendToClient(client.id, {
            type: 'error',
            error: 'invalid_request',
            message: 'Echo requires a content field',
            messageId: message.messageId,
            serverTime: new Date().toISOString()
          });
          return;
        }
        
        console.log(`Echo handler received message from client ${client.id}: ${typeof message.content === 'string' ? message.content.substring(0, 50) : '[non-string content]'}`);
        
        // Log this event to the event bus
        eventBus.emit('ws.message.received', {
          serviceType: WebSocketServiceType.TEST,
          clientId: client.id,
          messageType: 'echo',
          contentSize: typeof message.content === 'string' ? message.content.length : 
                     (typeof message.content === 'object' ? JSON.stringify(message.content).length : 0),
          timestamp: new Date()
        });
        
        const processingTime = Date.now() - (message.clientTime || Date.now());
        
        manager.sendToClient(client.id, {
          type: 'echo_response',
          content: message.content,
          messageId: message.messageId || `auto-${Date.now()}`,
          serverTime: new Date().toISOString(),
          processingTime,
          metrics: {
            processingTime,
            queueTime: message.clientTime ? Date.now() - message.clientTime : null,
            serverLoad: process.cpuUsage().user / 1000,
            activeConnections: service.getClientCount()
          }
        });
      } catch (error) {
        console.error(`Error in echo handler: ${error.message}`);
        
        // Log error to the event bus
        eventBus.emit('system.error', {
          source: 'websocket.echo.handler',
          message: `Error processing echo message: ${error.message}`,
          error
        });
        
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'internal_error',
          message: 'Internal server error processing echo message',
          messageId: message.messageId,
          serverTime: new Date().toISOString(),
          errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        });
      }
    });

    // Enterprise-grade generic message handler with robust error handling
    service.addMessageHandler('message', (message, client, manager) => {
      try {
        // Log the message (with safe truncation for large messages)
        const messageStr = JSON.stringify(message).substring(0, 200);
        console.log(`Generic message handler received from client ${client.id}: ${messageStr}${messageStr.length === 200 ? '...[truncated]' : ''}`);
        
        // Log this event to the event bus
        eventBus.emit('ws.message.received', {
          serviceType: WebSocketServiceType.TEST,
          clientId: client.id,
          messageType: 'generic',
          timestamp: new Date()
        });
        
        // Calculate connection duration
        const connectionDuration = Date.now() - client.connectionStartTime;
        
        // Echo response with metadata
        manager.sendToClient(client.id, {
          type: 'echo',
          originalMessage: message,
          messageId: message.messageId || `auto-${Date.now()}`,
          serverTime: new Date().toISOString(),
          clientInfo: {
            id: client.id,
            ipAddress: client.ipAddress,
            userAgent: client.userAgent,
            isAuthenticated: client.isAuthenticated,
            connectionDuration,
            messagesReceived: client.messagesReceived,
            messagesSent: client.messagesSent
          },
          serverInfo: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            connectedClients: service.getClientCount()
          }
        });
      } catch (error) {
        console.error(`Error in generic message handler: ${error.message}`);
        
        // Log error to the event bus
        eventBus.emit('system.error', {
          source: 'websocket.generic.handler',
          message: `Error processing generic message: ${error.message}`,
          error
        });
        
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'internal_error',
          message: 'Internal server error processing message',
          messageId: message.messageId,
          serverTime: new Date().toISOString(),
          errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        });
      }
    });
    
    // Ping handler for connection testing and latency monitoring
    service.addMessageHandler('ping', (message, client, manager) => {
      try {
        const clientTime = message.timestamp || Date.now();
        const serverTimestamp = Date.now();
        const roundTripTime = message.timestamp ? serverTimestamp - message.timestamp : null;
        
        // Update client tag with latest RTT for monitoring
        if (roundTripTime !== null) {
          manager.setClientTag(client.id, 'lastRtt', roundTripTime.toString());
        }
        
        // Send response with detailed metrics
        manager.sendToClient(client.id, {
          type: 'pong',
          messageId: message.messageId || `auto-${Date.now()}`,
          clientTimestamp: clientTime,
          serverTimestamp,
          roundTripTime,
          serverTime: new Date().toISOString(),
          serverLoad: {
            cpu: process.cpuUsage(),
            memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            uptime: process.uptime()
          },
          connectionStats: {
            duration: Date.now() - client.connectionStartTime,
            messagesReceived: client.messagesReceived,
            messagesSent: client.messagesSent,
            pingCount: client.pingCount,
            pongCount: client.pongCount
          }
        });
        
        // Log latency metrics to event bus
        if (roundTripTime !== null) {
          eventBus.emit('ws.message.sent', {
            serviceType: WebSocketServiceType.TEST,
            clientId: client.id,
            messageType: 'pong',
            metrics: {
              roundTripTime,
              clientTime,
              serverTime: serverTimestamp
            },
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error(`Error in ping handler: ${error.message}`);
        
        // Log error to the event bus
        eventBus.emit('system.error', {
          source: 'websocket.ping.handler',
          message: `Error processing ping message: ${error.message}`,
          error
        });
        
        // Even with errors, try to send a pong response
        manager.sendToClient(client.id, {
          type: 'pong',
          error: true,
          errorMessage: 'Internal server error processing ping',
          serverTime: new Date().toISOString(),
          errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        });
      }
    });
    
    // Add metrics handler for enterprise monitoring
    service.addMessageHandler('metrics', (message, client, manager) => {
      try {
        console.log(`Metrics request from client ${client.id}`);
        
        // Get service metrics
        const metrics = service.getMetrics();
        
        // Get system metrics
        const systemMetrics = this.getSystemMetrics();
        
        // Send comprehensive metrics response
        manager.sendToClient(client.id, {
          type: 'metrics_response',
          messageId: message.messageId || `auto-${Date.now()}`,
          serverTime: new Date().toISOString(),
          serviceMetrics: metrics,
          systemMetrics,
          clientMetrics: {
            connectionDuration: Date.now() - client.connectionStartTime,
            messagesReceived: client.messagesReceived,
            messagesSent: client.messagesSent,
            pingCount: client.pingCount,
            pongCount: client.pongCount,
            lastActivity: client.lastActivity
          }
        });
      } catch (error) {
        console.error(`Error in metrics handler: ${error.message}`);
        
        // Log error to event bus
        eventBus.emit('system.error', {
          source: 'websocket.metrics.handler',
          message: `Error processing metrics request: ${error.message}`,
          error
        });
        
        manager.sendToClient(client.id, {
          type: 'error',
          error: 'internal_error',
          message: 'Internal server error processing metrics request',
          messageId: message.messageId,
          serverTime: new Date().toISOString(),
          errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        });
      }
    });
  }
  
  /**
   * Setup event bus subscriptions for test service
   */
  private setupTestServiceEventHandlers(service: EnterpriseWebSocketManager): void {
    // Handle client connection events
    eventBus.on('ws.client.connected', (event) => {
      // Extract path from event data
      const path = event.data.path;
      
      // Check if this is a client connecting to our test service
      if (path === '/ws') {
        console.log(`Test WebSocket client connected: ${event.data.clientId} from ${event.data.ipAddress}`);
        
        // Get the client by ID
        const client = service.getClient(event.data.clientId);
        if (client) {
          // Send welcome message
          service.sendToClient(client.id, {
            type: 'welcome',
            message: 'Connected to Enterprise WebSocket Test Service',
            capabilities: ['echo', 'test', 'message', 'ping', 'metrics'],
            serverTime: new Date().toISOString(),
            connectionId: event.data.connectionId,
            instanceId: process.env.REPL_ID || this.generateServiceId(),
            clientInfo: {
              id: client.id,
              ipAddress: client.ipAddress,
              userAgent: client.userAgent,
              connectionEstablished: new Date().toISOString()
            },
            serverInfo: {
              uptime: process.uptime(),
              version: "1.0.0",
              environment: process.env.NODE_ENV || 'development',
              connectedClients: service.getClientCount()
            }
          });
        }
      }
    });
    
    // Handle client disconnection events
    eventBus.on('ws.client.disconnected', (event) => {
      // Extract path from event data
      const path = event.data.path;
      
      // Check if this is a client disconnecting from our test service
      if (path === '/ws') {
        console.log(`Test WebSocket client disconnected: ${event.data.clientId} (Code: ${event.data.code}, Reason: ${event.data.reason})`);
        
        // Could implement reconnection tracking, logging, or other cleanup here
      }
    });
    
    // Handle client error events
    eventBus.on('ws.client.error', (event) => {
      // Extract path from event data
      const path = event.data.path;
      
      // Check if this is an error from our test service
      if (path === '/ws') {
        console.error(`Test WebSocket client error: ${event.data.clientId}, Error: ${event.data.error}`);
        
        // Could implement error tracking, alerting, or recovery here
      }
    });
  }
  
  /**
   * Generate a unique service ID when environment ID is not available
   */
  private generateServiceId(): string {
    return `ws-test-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;
  }
  
  /**
   * Get mock server status
   */
  private getMockServerStatus(): any[] {
    return [
      {
        id: 1,
        name: 'Production-MCP-01',
        url: 'https://mcp-prod-01.example.com',
        status: 'online',
        health: 'healthy',
        latency: 27,
        lastSeen: new Date().toISOString(),
        version: '1.2.0',
        toolCount: 2
      },
      {
        id: 2,
        name: 'Production-MCP-02',
        url: 'https://mcp-prod-02.example.com',
        status: 'online',
        health: 'degraded',
        latency: 89,
        lastSeen: new Date().toISOString(),
        version: '1.2.0',
        toolCount: 2
      },
      {
        id: 3,
        name: 'Dev-MCP-01',
        url: 'https://mcp-dev-01.example.com',
        status: 'online',
        health: 'healthy',
        latency: 35,
        lastSeen: new Date().toISOString(),
        version: '1.3.0-beta',
        toolCount: 2
      },
      {
        id: 4,
        name: 'Test-MCP-01',
        url: 'https://mcp-test-01.example.com',
        status: 'online',
        health: 'degraded',
        latency: 127,
        lastSeen: new Date().toISOString(),
        version: '1.1.0',
        toolCount: 2
      },
      {
        id: 5,
        name: 'Staging-MCP-01',
        url: 'https://mcp-staging-01.example.com',
        status: 'online',
        health: 'healthy',
        latency: 47,
        lastSeen: new Date().toISOString(),
        version: '1.2.1',
        toolCount: 2
      }
    ];
  }
  
  /**
   * Get mock server tools
   */
  private getMockServerTools(serverId: number): any[] {
    return [
      {
        id: `${serverId}-1`,
        name: 'mock.echo',
        description: 'Returns the input as output',
        serverTime: new Date().toISOString(),
        isAvailable: true,
        serverId
      },
      {
        id: `${serverId}-2`,
        name: 'mock.generate',
        description: 'Generates random content',
        serverTime: new Date().toISOString(),
        isAvailable: true,
        serverId
      }
    ];
  }
  
  /**
   * Get system metrics
   */
  private getSystemMetrics(): any {
    return {
      system: {
        cpuUsage: Math.random() * 0.5 + 0.1, // 10-60%
        memoryUsage: Math.random() * 0.4 + 0.2, // 20-60%
        uptime: process.uptime(),
        timestamp: Date.now()
      },
      websocket: {
        totalConnections: this.getTotalClientCount(),
        services: Array.from(this.services.entries()).map(([type, service]) => ({
          type,
          connections: service.getClientCount(),
          metrics: service.getMetrics()
        }))
      }
    };
  }
}

export default WebSocketServiceFactory;