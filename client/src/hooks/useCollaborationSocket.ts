import { useState, useEffect, useRef, useCallback } from 'react';
import { UserPresence, UserStatus, PresenceUpdate, CollaborationMessageType } from '@shared/types/collaboration';

interface CollaborationSocketOptions {
  userId: number;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  workspaceId?: number;
  currentPage?: string;
  currentView?: string;
  metadata?: Record<string, any>;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
}

export function useCollaborationSocket(options: CollaborationSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const socket = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;
  
  // Generate a unique message ID
  const generateMessageId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Connect to the WebSocket server
  const connect = useCallback(() => {
    try {
      // Clean up any existing socket
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/collaboration`;
      
      // Create new socket
      socket.current = new WebSocket(wsUrl);
      
      // Handle connection open
      socket.current.onopen = () => {
        console.log('Collaboration WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Send auth message
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
          socket.current.send(JSON.stringify({
            type: 'auth',
            userId: options.userId,
            username: options.username,
            fullName: options.fullName,
            avatarUrl: options.avatarUrl,
            workspaceId: options.workspaceId,
            currentPage: options.currentPage || window.location.pathname,
            currentView: options.currentView,
            metadata: options.metadata || {},
            messageId: generateMessageId()
          }));
        }
        
        // Set up heartbeat
        if (options.heartbeatInterval !== 0) {
          const interval = options.heartbeatInterval || 30000; // Default: 30 seconds
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
          }
          
          heartbeatInterval.current = setInterval(() => {
            if (socket.current && socket.current.readyState === WebSocket.OPEN) {
              socket.current.send(JSON.stringify({
                type: 'heartbeat',
                userId: options.userId,
                timestamp: new Date().toISOString(),
                messageId: generateMessageId()
              }));
            }
          }, interval);
        }
      };
      
      // Handle messages
      socket.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case CollaborationMessageType.USER_CONNECTED:
              setUsers(prevUsers => {
                // Don't add duplicate users
                if (prevUsers.some(u => u.userId === message.payload.userId)) {
                  return prevUsers.map(u => 
                    u.userId === message.payload.userId ? message.payload : u
                  );
                }
                
                return [...prevUsers, message.payload];
              });
              break;
              
            case CollaborationMessageType.USER_DISCONNECTED:
              setUsers(prevUsers => 
                prevUsers.filter(u => u.userId !== message.payload.userId)
              );
              break;
              
            case CollaborationMessageType.PRESENCE_UPDATE:
              setUsers(prevUsers => {
                const updatedUsers = [...prevUsers];
                const index = updatedUsers.findIndex(u => u.userId === message.userId);
                
                if (index >= 0) {
                  updatedUsers[index] = {
                    ...updatedUsers[index],
                    ...message.payload
                  };
                }
                
                return updatedUsers;
              });
              break;
              
            case 'current_users': // This is a custom message type for our implementation
              if (Array.isArray(message.users)) {
                setUsers(message.users);
              }
              break;
          }
        } catch (err) {
          console.error('Error parsing collaboration message:', err);
        }
      };
      
      // Handle errors
      socket.current.onerror = (event) => {
        console.error('Collaboration WebSocket error:', event);
        setError('Connection error');
      };
      
      // Handle connection close
      socket.current.onclose = (event) => {
        console.log('Collaboration WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Clear heartbeat interval
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
        
        // Attempt to reconnect if enabled
        if (options.autoReconnect !== false && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(baseReconnectDelay * Math.pow(1.5, reconnectAttempts.current), 30000);
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          reconnectTimeout.current = setTimeout(connect, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Maximum reconnection attempts reached. Please refresh the page.');
        }
      };
    } catch (err) {
      console.error('Error connecting to collaboration service:', err);
      setError('Connection failed');
    }
  }, [
    options.userId,
    options.username,
    options.fullName,
    options.avatarUrl,
    options.workspaceId,
    options.currentPage,
    options.currentView,
    options.metadata,
    options.autoReconnect,
    options.heartbeatInterval,
    generateMessageId
  ]);
  
  // Update user presence
  const updatePresence = useCallback((update: Partial<UserPresence>) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    socket.current.send(JSON.stringify({
      type: 'update_presence',
      presence: update,
      messageId: generateMessageId()
    }));
    
    return true;
  }, [generateMessageId]);
  
  // Update current page
  const updateCurrentPage = useCallback((page: string, view?: string) => {
    return updatePresence({
      currentPage: page,
      currentView: view,
      lastSeen: new Date().toISOString()
    });
  }, [updatePresence]);
  
  // Set user status
  const setStatus = useCallback((status: UserStatus) => {
    return updatePresence({
      status,
      lastSeen: new Date().toISOString()
    });
  }, [updatePresence]);
  
  // Request current users
  const requestUsers = useCallback((workspaceId?: number) => {
    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    socket.current.send(JSON.stringify({
      type: 'request_users',
      workspaceId,
      messageId: generateMessageId()
    }));
    
    return true;
  }, [generateMessageId]);
  
  // Connect on initialization
  useEffect(() => {
    connect();
    
    // Cleanup function
    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };
  }, [connect]);
  
  // Update presence when page changes
  useEffect(() => {
    if (isConnected && options.currentPage) {
      updateCurrentPage(options.currentPage, options.currentView);
    }
  }, [isConnected, options.currentPage, options.currentView, updateCurrentPage]);
  
  return {
    isConnected,
    users,
    error,
    updatePresence,
    updateCurrentPage,
    setStatus,
    requestUsers
  };
}