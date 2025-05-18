import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ReplitWebSocket, createReplitWebSocket, isReplitEnvironment } from '@/lib/replitWebSocket';

interface WebSocketContextType {
  socket: ReplitWebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  send: (data: string | object) => boolean;
  lastMessage: any;
  connectionStats: {
    reconnectAttempts: number;
    connectionDuration: number;
    pingsSent: number;
    pongsReceived: number;
  };
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  status: 'disconnected',
  send: () => false,
  lastMessage: null,
  connectionStats: {
    reconnectAttempts: 0,
    connectionDuration: 0,
    pingsSent: 0,
    pongsReceived: 0
  }
});

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export const ReliableWebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url: propUrl,
  autoConnect = true,
  reconnectDelay,
  maxReconnectAttempts,
  debug = false
}) => {
  const [socket, setSocket] = useState<ReplitWebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connectionStats, setConnectionStats] = useState({
    reconnectAttempts: 0,
    connectionDuration: 0,
    pingsSent: 0,
    pongsReceived: 0
  });
  const statsInterval = useRef<NodeJS.Timeout | null>(null);

  // Create websocket URL based on current page URL
  const getWebSocketUrl = () => {
    if (propUrl) return propUrl;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.host;
    let path = '/ws/mcp-proxy';
    
    // Special case for Replit
    if (isReplitEnvironment()) {
      console.log('Replit environment detected, optimizing WebSocket URL');
      return `${protocol}//${hostname}${path}`;
    }
    
    return `${protocol}//${hostname}${path}`;
  };

  useEffect(() => {
    if (!autoConnect) return;
    
    const wsUrl = getWebSocketUrl();
    console.log(`Creating WebSocket connection to ${wsUrl}`);
    
    const newSocket = createReplitWebSocket(wsUrl, {
      reconnectDelayMs: reconnectDelay,
      maxReconnectAttempts: maxReconnectAttempts,
      debug,
      onOpen: () => {
        console.log('WebSocket connected successfully');
        setStatus('connected');
      },
      onMessage: (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          // Ignore ping/pong messages
          if (data.type !== 'ping' && data.type !== 'pong') {
            setLastMessage(data);
          }
        } catch (err) {
          console.warn('Error parsing WebSocket message:', err);
          setLastMessage(event.data);
        }
      },
      onClose: () => {
        setStatus('disconnected');
      },
      onError: () => {
        console.warn('WebSocket connection error');
      },
      onReconnect: (attempt) => {
        console.log(`WebSocket reconnecting, attempt ${attempt}`);
        setStatus('reconnecting');
        setConnectionStats(prev => ({
          ...prev,
          reconnectAttempts: attempt
        }));
      }
    });
    
    setSocket(newSocket);
    
    // Update connection stats periodically
    statsInterval.current = setInterval(() => {
      if (newSocket) {
        const state = newSocket.getState();
        setConnectionStats({
          reconnectAttempts: state.reconnectAttempts,
          connectionDuration: state.status === 'open' ? Date.now() - (state.lastMessageTime || 0) : 0,
          pingsSent: state.pingsSent,
          pongsReceived: state.pongsReceived
        });
      }
    }, 1000);
    
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
      
      if (newSocket) {
        newSocket.close(1000, 'Component unmounting');
      }
    };
  }, [autoConnect, propUrl, reconnectDelay, maxReconnectAttempts, debug]);

  const send = (data: string | object): boolean => {
    if (!socket || !socket.isOpen()) {
      console.warn('Cannot send message, WebSocket is not open');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      return socket.send(message);
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, status, send, lastMessage, connectionStats }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useReliableWebSocket = () => useContext(WebSocketContext);