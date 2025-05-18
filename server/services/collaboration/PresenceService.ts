import { WebSocket } from 'ws';
import { 
  UserPresence, 
  PresenceMessage, 
  UserStatus, 
  CollaborationMessageType,
  CollaborationMessage,
  UserConnectedMessage,
  UserDisconnectedMessage
} from '../../../shared/types/collaboration';
import EventEmitter from 'events';

/**
 * Service to track and manage real-time user presence 
 * across the application
 */
export class PresenceService {
  private static instance: PresenceService;
  private users: Map<number, UserPresence> = new Map();
  private connections: Map<number, Set<WebSocket>> = new Map();
  private workspaceUsers: Map<number, Set<number>> = new Map();
  private events: EventEmitter = new EventEmitter();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private inactivityTimeout = 120000; // 2 minutes without activity = away
  private offlineTimeout = 300000; // 5 minutes without activity = offline

  private constructor() {
    // Initialize heartbeat cleanup
    this.heartbeatInterval = setInterval(() => {
      this.checkInactiveUsers();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Register a user as being online and active
   */
  public registerUser(user: UserPresence, connection: WebSocket): boolean {
    try {
      const userId = user.userId;
      const workspaceId = user.workspaceId;

      // Store user data
      this.users.set(userId, user);
      
      // Store connection
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)?.add(connection);
      
      // Track user in workspace if applicable
      if (workspaceId !== undefined) {
        if (!this.workspaceUsers.has(workspaceId)) {
          this.workspaceUsers.set(workspaceId, new Set());
        }
        this.workspaceUsers.get(workspaceId)?.add(userId);
      }
      
      // Broadcast join event
      const userConnectedMessage: UserConnectedMessage = {
        type: CollaborationMessageType.USER_CONNECTED,
        userId: user.userId,
        timestamp: new Date().toISOString(),
        workspaceId: workspaceId,
        payload: user
      };
      this.broadcastToWorkspace(workspaceId, userConnectedMessage);
      
      this.events.emit('user:join', user);
      
      return true;
    } catch (error) {
      console.error('Error registering user for presence:', error);
      return false;
    }
  }
  
  /**
   * Update a user's presence information
   */
  public updateUserPresence(userId: number, presenceData: Partial<UserPresence>): boolean {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }
      
      // Update user data
      const updatedUser: UserPresence = {
        ...user,
        ...presenceData,
        lastSeen: new Date().toISOString()
      };
      
      this.users.set(userId, updatedUser);
      
      // Broadcast update
      this.broadcastToWorkspace(updatedUser.workspaceId, {
        type: CollaborationMessageType.PRESENCE_UPDATE,
        userId: updatedUser.userId,
        timestamp: new Date().toISOString(),
        workspaceId: updatedUser.workspaceId,
        payload: presenceData
      });
      
      this.events.emit('user:update', updatedUser);
      
      return true;
    } catch (error) {
      console.error('Error updating user presence:', error);
      return false;
    }
  }
  
  /**
   * Process a user heartbeat to keep them active
   */
  public heartbeat(userId: number): boolean {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }
    
    // If status was away or offline, set it back to online
    if (user.status !== UserStatus.ONLINE) {
      return this.updateUserPresence(userId, { 
        status: UserStatus.ONLINE,
        lastSeen: new Date().toISOString()
      });
    }
    
    // Just update the last seen timestamp
    user.lastSeen = new Date().toISOString();
    this.users.set(userId, user);
    return true;
  }
  
  /**
   * Remove a user connection
   */
  public removeConnection(userId: number, connection: WebSocket): boolean {
    try {
      // Remove specific connection
      const userConnections = this.connections.get(userId);
      if (userConnections) {
        userConnections.delete(connection);
        
        // If user has no more connections, mark them as offline
        if (userConnections.size === 0) {
          this.unregisterUser(userId);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error removing user connection:', error);
      return false;
    }
  }
  
  /**
   * Completely unregister a user (all connections)
   */
  public unregisterUser(userId: number): boolean {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return false;
      }
      
      const workspaceId = user.workspaceId;
      
      // Remove from workspace tracking
      if (workspaceId !== undefined) {
        const workspaceUsers = this.workspaceUsers.get(workspaceId);
        if (workspaceUsers) {
          workspaceUsers.delete(userId);
          
          // Broadcast leave event to workspace
          const userDisconnectedMessage: UserDisconnectedMessage = {
            type: CollaborationMessageType.USER_DISCONNECTED,
            userId,
            timestamp: new Date().toISOString(),
            workspaceId,
            payload: {
              userId,
              workspaceId
            }
          };
          this.broadcastToWorkspace(workspaceId, userDisconnectedMessage);
        }
      }
      
      // Clean up user data
      this.users.delete(userId);
      this.connections.delete(userId);
      
      this.events.emit('user:leave', { userId, workspaceId });
      
      return true;
    } catch (error) {
      console.error('Error unregistering user presence:', error);
      return false;
    }
  }
  
  /**
   * Get all active users
   */
  public getAllUsers(): UserPresence[] {
    return Array.from(this.users.values());
  }
  
  /**
   * Get all users in a workspace
   */
  public getWorkspaceUsers(workspaceId: number): UserPresence[] {
    const userIds = this.workspaceUsers.get(workspaceId);
    if (!userIds) {
      return [];
    }
    
    return Array.from(userIds)
      .map(id => this.users.get(id))
      .filter((user): user is UserPresence => !!user);
  }
  
  /**
   * Subscribe to presence events
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
  
  /**
   * Unsubscribe from presence events
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.events.off(event, listener);
  }
  
  /**
   * Send a message to all connections for a specific user
   */
  public sendToUser(userId: number, message: CollaborationMessage): boolean {
    try {
      const connections = this.connections.get(userId);
      if (!connections) {
        return false;
      }
      
      const messageString = JSON.stringify(message);
      
      let sent = false;
      connections.forEach(connection => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(messageString);
          sent = true;
        }
      });
      
      return sent;
    } catch (error) {
      console.error('Error sending message to user:', error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all users in a workspace
   */
  public broadcastToWorkspace(workspaceId: number | undefined, message: CollaborationMessage): boolean {
    try {
      if (workspaceId === undefined) {
        return false;
      }
      
      const userIds = this.workspaceUsers.get(workspaceId);
      if (!userIds) {
        return false;
      }
      
      const messageString = JSON.stringify(message);
      
      let sent = false;
      userIds.forEach(userId => {
        const connections = this.connections.get(userId);
        if (connections) {
          connections.forEach(connection => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(messageString);
              sent = true;
            }
          });
        }
      });
      
      return sent;
    } catch (error) {
      console.error('Error broadcasting to workspace:', error);
      return false;
    }
  }
  
  /**
   * Broadcast a message to all connected users
   */
  public broadcastToAll(message: CollaborationMessage): boolean {
    try {
      const messageString = JSON.stringify(message);
      
      let sent = false;
      this.connections.forEach(connections => {
        connections.forEach(connection => {
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(messageString);
            sent = true;
          }
        });
      });
      
      return sent;
    } catch (error) {
      console.error('Error broadcasting to all users:', error);
      return false;
    }
  }
  
  /**
   * Check for inactive users and update their status
   */
  private checkInactiveUsers(): void {
    const now = Date.now();
    
    this.users.forEach((user, userId) => {
      // Skip users without lastSeen timestamp
      if (!user.lastSeen) {
        return;
      }
      
      const lastSeen = new Date(user.lastSeen).getTime();
      const timeSinceActive = now - lastSeen;
      
      // If away threshold passed and status is online, mark as away
      if (timeSinceActive > this.inactivityTimeout && user.status === UserStatus.ONLINE) {
        this.updateUserPresence(userId, { status: UserStatus.AWAY });
      }
      
      // If offline threshold passed and status is not offline, mark as offline
      if (timeSinceActive > this.offlineTimeout && user.status !== UserStatus.OFFLINE) {
        this.updateUserPresence(userId, { status: UserStatus.OFFLINE });
      }
    });
  }
  
  /**
   * Clean up when service is being destroyed
   */
  public cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Clear all data
    this.users.clear();
    this.connections.clear();
    this.workspaceUsers.clear();
    
    // Remove all event listeners
    this.events.removeAllListeners();
  }
}

// Create the singleton instance
export const presenceService = PresenceService.getInstance();