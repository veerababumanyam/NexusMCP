import React, { useEffect, useState } from 'react';
import { ReliableWebSocketProvider, useReliableWebSocket } from './ReliableWebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCw, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

/**
 * MCP WebSocket Status Display Component
 * Shows the current status of the WebSocket connection
 */
export const MCPWebSocketStatus: React.FC = () => {
  const { status, connectionStats, send, socket } = useReliableWebSocket();
  const [lastPingResponse, setLastPingResponse] = useState<number | null>(null);
  
  useEffect(() => {
    // Send a ping every 5 seconds to test connection
    const pingInterval = setInterval(() => {
      if (status === 'connected') {
        const pingStart = Date.now();
        const pingId = `manual-ping-${pingStart}`;
        
        send({
          type: 'ping',
          id: pingId,
          timestamp: pingStart
        });
        
        // Set a timeout to update ping response time
        setTimeout(() => {
          setLastPingResponse(prev => {
            if (prev === null) return 0;
            return Date.now() - pingStart;
          });
        }, 500);
      }
    }, 5000);
    
    return () => clearInterval(pingInterval);
  }, [status, send]);
  
  // Force reconnect function
  const handleReconnect = () => {
    if (socket) {
      socket.reconnect();
    }
  };
  
  // Get statusColor based on connection status
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Get status icon based on connection status
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'connecting':
        return <RotateCw className="h-6 w-6 text-yellow-500 animate-spin" />;
      case 'reconnecting':
        return <RotateCw className="h-6 w-6 text-yellow-500 animate-spin" />;
      case 'disconnected':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-gray-500" />;
    }
  };
  
  // Calculate connection quality (0-100)
  const connectionQuality = (() => {
    if (status !== 'connected') return 0;
    
    // Base quality starts at 100
    let quality = 100;
    
    // If we have ping responses, use them to affect quality
    if (lastPingResponse !== null) {
      // Ping time degrades quality (>300ms starts to reduce quality)
      if (lastPingResponse > 300) {
        quality -= Math.min(50, Math.floor((lastPingResponse - 300) / 20));
      }
    }
    
    // Use reconnect attempts to reduce quality
    quality -= Math.min(30, connectionStats.reconnectAttempts * 5);
    
    return Math.max(0, quality);
  })();
  
  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">WebSocket Connection</CardTitle>
          <Badge className={getStatusColor()}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        <CardDescription>MCP Gateway Connection Status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection Quality:</span>
          <div className="flex items-center space-x-2 w-2/3">
            <Progress value={connectionQuality} className="h-2" />
            <span className="text-sm font-medium">{connectionQuality}%</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{status}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Reconnect Attempts:</span>
          <span className="text-sm font-medium">{connectionStats.reconnectAttempts}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ping/Pong:</span>
          <span className="text-sm font-medium">
            {connectionStats.pingsSent} / {connectionStats.pongsReceived}
          </span>
        </div>
        
        {lastPingResponse !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Ping:</span>
            <span className="text-sm font-medium">
              {lastPingResponse}ms
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleReconnect}
          variant="outline"
          className="w-full"
          disabled={status === 'connecting' || status === 'reconnecting'}
        >
          Force Reconnect
        </Button>
      </CardFooter>
    </Card>
  );
};

/**
 * MCP WebSocket Provider Component
 * Provides WebSocket connection for the MCP application
 */
export const MCPWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ReliableWebSocketProvider debug={true} maxReconnectAttempts={10}>
      {children}
    </ReliableWebSocketProvider>
  );
};

/**
 * MCP WebSocket Test Panel
 * Displays WebSocket connection status and controls
 */
export const MCPWebSocketTestPanel: React.FC = () => {
  return (
    <MCPWebSocketProvider>
      <div className="flex flex-col items-center justify-center p-4 space-y-4 min-h-screen">
        <h1 className="text-2xl font-bold">MCP WebSocket Test Panel</h1>
        <MCPWebSocketStatus />
      </div>
    </MCPWebSocketProvider>
  );
};

export default MCPWebSocketTestPanel;