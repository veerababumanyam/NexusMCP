import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { presenceService } from './PresenceService';
import { 
  UserPresence, 
  UserStatus, 
  PresenceMessage, 
  PresenceRequest, 
  CollaborationMessageType 
} from '../../../shared/types/collaboration';

/**
 * WebSocket handler for real-time collaboration events
 */
export class WebSocketCollaborationHandler {
  private wss: WebSocketServer;
  
  constructor(server: Server, path: string = '/ws/collaboration') {
    // Create WebSocket server with the path
    this.wss = new WebSocketServer({ 
      server,
      path
    });
    
    console.log(`WebSocket collaboration service initialized at ${path}`);
    
    // Initialize connection handling
    this.init();
  }
  
  /**
   * Initialize WebSocket server event handlers
   */
  private init(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('New collaboration connection established');
      
      // Associate connection with a user if authenticated
      let userId: number | null = null;
      
      // Set up message handling
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message, ws, userId);
        } catch (error) {
          console.error('Error handling collaboration message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: 'Invalid message format' 
          }));
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        console.log('Collaboration connection closed');
        if (userId !== null) {
          presenceService.removeConnection(userId, ws);
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('Collaboration WebSocket error:', error);
        if (userId !== null) {
          presenceService.removeConnection(userId, ws);
        }
      });
    });
  }
  
  /**
   * Handle WebSocket messages
   */
  private handleMessage(message: any, ws: WebSocket, userId: number | null): void {
    // Handle join/auth message first to establish identity
    if (message.type === 'auth') {
      // Validate the auth - in a real implementation, verify token or session
      if (!message.userId || typeof message.userId !== 'number') {
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Invalid authentication' 
        }));
        return;
      }
      
      // Set userId for this connection
      userId = message.userId;
      
      // Create or update user presence
      const userPresence: UserPresence = {
        userId: message.userId,
        username: message.username || `User-${message.userId}`,
        fullName: message.fullName,
        avatarUrl: message.avatarUrl,
        workspaceId: message.workspaceId,
        currentPage: message.currentPage || 'home',
        currentView: message.currentView,
        status: UserStatus.ONLINE,
        lastSeen: new Date().toISOString(),
        metadata: message.metadata || {}
      };
      
      // Register user in presence service
      presenceService.registerUser(userPresence, ws);
      
      // Send current users in the workspace
      if (message.workspaceId) {
        const workspaceUsers = presenceService.getWorkspaceUsers(message.workspaceId);
        const currentUsersMessage = {
          type: CollaborationMessageType.WORKSPACE_UPDATE,
          timestamp: new Date().toISOString(),
          userId: message.userId,
          workspaceId: message.workspaceId,
          payload: {
            users: workspaceUsers
          }
        };
        ws.send(JSON.stringify(currentUsersMessage));
      }
      
      return;
    }
    
    // For all other messages, require authentication
    if (userId === null) {
      ws.send(JSON.stringify({ 
        type: CollaborationMessageType.ERROR, 
        userId: 0,
        timestamp: new Date().toISOString(),
        payload: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      }));
      return;
    }
    
    // Handle different message types
    switch (message.type) {
      case 'heartbeat':
        presenceService.heartbeat(userId);
        break;
        
      case 'update':
        if (message.presence) {
          presenceService.updateUserPresence(userId, message.presence);
        }
        break;
        
      case 'request_users':
        const request = message as PresenceRequest;
        let users: UserPresence[];
        
        if (request.workspaceId) {
          users = presenceService.getWorkspaceUsers(request.workspaceId);
        } else {
          users = presenceService.getAllUsers();
        }
        
        const response = {
          type: CollaborationMessageType.WORKSPACE_UPDATE,
          userId,
          timestamp: new Date().toISOString(),
          workspaceId: request.workspaceId,
          payload: {
            users
          }
        };
        
        ws.send(JSON.stringify(response));
        break;
        
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Unknown message type' 
        }));
        break;
    }
  }
  
  /**
   * Shut down the WebSocket server
   */
  public close(): void {
    this.wss.close();
  }
}