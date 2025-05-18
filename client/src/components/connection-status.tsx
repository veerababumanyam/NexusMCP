import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // Check network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Check WebSocket connection status
  useEffect(() => {
    // Check for WebSocket messages in console logs
    const checkWebSocketStatus = () => {
      // If we're offline, don't check WebSocket status
      if (!isOnline) {
        setWsStatus('disconnected');
        return;
      }
      
      // Simulate WebSocket status check
      // In a real implementation, you would check the actual WebSocket connection
      // This is a temporary solution that would be replaced by actual WebSocket status monitoring
      fetch('/api/health/websocket')
        .then(response => {
          if (response.ok) {
            setWsStatus('connected');
          } else {
            setWsStatus('disconnected');
          }
        })
        .catch(() => {
          // If the health check fails, assume WebSocket is disconnected
          // but don't change network status, as the fetch failure could be due to other reasons
          setWsStatus('disconnected');
        });
    };
    
    // Check immediately and then every 30 seconds
    checkWebSocketStatus();
    const interval = setInterval(checkWebSocketStatus, 30000);
    
    return () => clearInterval(interval);
  }, [isOnline]);
  
  // Check MCP server health
  const { data: mcpServers } = useQuery({
    queryKey: ['/api/mcp/servers/health'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/mcp/servers/health');
        if (response.ok) {
          return await response.json();
        }
        return { servers: [] };
      } catch (error) {
        console.error('Failed to fetch MCP server health:', error);
        return { servers: [] };
      }
    },
    // Refresh every 60 seconds
    refetchInterval: 60000
  });
  
  // Calculate health status
  const healthyServers = mcpServers?.servers?.filter((s: { status: string }) => s.status === 'healthy')?.length || 0;
  const totalServers = mcpServers?.servers?.length || 0;
  const healthPercentage = totalServers > 0 ? (healthyServers / totalServers) * 100 : 0;
  
  let healthStatus: 'good' | 'degraded' | 'poor' = 'good';
  if (healthPercentage < 50) {
    healthStatus = 'poor';
  } else if (healthPercentage < 80) {
    healthStatus = 'degraded';
  }
  
  // Generate status message
  const getStatusMessage = () => {
    if (!isOnline) {
      return 'Network offline. Please check your internet connection.';
    }
    
    if (wsStatus !== 'connected') {
      return 'WebSocket connection unavailable. Real-time updates may be delayed.';
    }
    
    if (healthStatus === 'poor') {
      return `MCP server health critical: ${healthyServers}/${totalServers} servers healthy.`;
    }
    
    if (healthStatus === 'degraded') {
      return `MCP server health degraded: ${healthyServers}/${totalServers} servers healthy.`;
    }
    
    return `All systems operational. ${healthyServers}/${totalServers} MCP servers healthy.`;
  };
  
  // Determine badge color
  const getBadgeVariant = () => {
    if (!isOnline || wsStatus === 'disconnected' || healthStatus === 'poor') {
      return 'destructive';
    }
    
    if (wsStatus === 'connecting' || healthStatus === 'degraded') {
      return 'outline';
    }
    
    return 'default';
  };
  
  // Determine icon
  const getStatusIcon = () => {
    if (!isOnline || wsStatus === 'disconnected') {
      return <WifiOff className="h-3 w-3 mr-1" />;
    }
    
    if (healthStatus === 'poor' || healthStatus === 'degraded') {
      return <AlertCircle className="h-3 w-3 mr-1" />;
    }
    
    return <Wifi className="h-3 w-3 mr-1" />;
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={getBadgeVariant()} className="cursor-help">
            {getStatusIcon()}
            Connection Status
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}