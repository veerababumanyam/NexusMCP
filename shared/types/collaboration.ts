/**
 * Collaboration Types
 * 
 * This file defines the types used for real-time collaboration features
 * including user presence, status management, and collaboration events.
 */

/**
 * User status options for presence
 */
export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

/**
 * User presence information
 */
export interface UserPresence {
  userId: number;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  workspaceId?: number;
  status: UserStatus;
  currentPage?: string;
  currentView?: string;
  lastSeen?: Date | string;
  metadata?: Record<string, any>;
}

/**
 * Presence update information
 */
export interface PresenceUpdate {
  status?: UserStatus;
  currentPage?: string;
  currentView?: string;
  metadata?: Record<string, any>;
}

/**
 * Collaboration message types
 */
export enum CollaborationMessageType {
  PRESENCE_UPDATE = 'presence_update',
  USER_CONNECTED = 'user_connected',
  USER_DISCONNECTED = 'user_disconnected',
  WORKSPACE_UPDATE = 'workspace_update',
  CURSOR_POSITION = 'cursor_position',
  SELECTION_CHANGE = 'selection_change',
  DOCUMENT_CHANGE = 'document_change',
  ERROR = 'error'
}

/**
 * Base structure for collaboration messages
 */
export interface CollaborationMessage {
  type: CollaborationMessageType;
  timestamp: Date | string;
  userId: number;
  workspaceId?: number;
  payload: any;
}

/**
 * Presence WebSocket message
 */
export interface PresenceMessage extends CollaborationMessage {
  type: CollaborationMessageType.PRESENCE_UPDATE;
  payload: PresenceUpdate;
}

/**
 * User connected WebSocket message
 */
export interface UserConnectedMessage extends CollaborationMessage {
  type: CollaborationMessageType.USER_CONNECTED;
  payload: UserPresence;
}

/**
 * User disconnected WebSocket message
 */
export interface UserDisconnectedMessage extends CollaborationMessage {
  type: CollaborationMessageType.USER_DISCONNECTED;
  payload: {
    userId: number;
    workspaceId?: number;
  };
}

/**
 * Collaboration error message
 */
export interface CollaborationErrorMessage extends CollaborationMessage {
  type: CollaborationMessageType.ERROR;
  payload: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Configuration for the collaboration WebSocket
 */
export interface CollaborationSocketConfig {
  url: string;
  heartbeatInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableLogging?: boolean;
}

/**
 * Request to update presence information
 */
export interface PresenceRequest {
  userId: number;
  username: string;
  fullName?: string; 
  avatarUrl?: string;
  workspaceId?: number;
  currentPage?: string;
  currentView?: string;
  status?: UserStatus;
  metadata?: Record<string, any>;
}

/**
 * Type guards for message types
 */
export function isPresenceMessage(message: CollaborationMessage): message is PresenceMessage {
  return message.type === CollaborationMessageType.PRESENCE_UPDATE;
}

export function isUserConnectedMessage(message: CollaborationMessage): message is UserConnectedMessage {
  return message.type === CollaborationMessageType.USER_CONNECTED;
}

export function isUserDisconnectedMessage(message: CollaborationMessage): message is UserDisconnectedMessage {
  return message.type === CollaborationMessageType.USER_DISCONNECTED;
}

export function isErrorMessage(message: CollaborationMessage): message is CollaborationErrorMessage {
  return message.type === CollaborationMessageType.ERROR;
}