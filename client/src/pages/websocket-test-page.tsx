import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createStableWebSocketUrl, generatePingId, checkConnectionQuality } from "@/lib/websocketUtil";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, CheckCircle2, Activity, Send, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Detect if running in Replit
const isReplit = typeof window !== 'undefined' && window.location.hostname.includes('replit');

// Connection status type
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Message type for logging
interface LogMessage {
  type: 'sent' | 'received' | 'error' | 'info';
  timestamp: number;
  message: string;
  data?: any;
}

/**
 * WebSocket Test Page
 * Allows testing WebSocket connections and diagnosing issues
 */
export default function WebSocketTestPage() {
  // WebSocket connection
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionQuality, setConnectionQuality] = useState(100);
  const [pingTimes, setPingTimes] = useState<number[]>([]);
  const [successRatio, setSuccessRatio] = useState(1);
  const [issues, setIssues] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isAutoReconnect, setIsAutoReconnect] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [customPath, setCustomPath] = useState('/ws/mcp-proxy');
  
  // Ping/pong tracking
  const pendingPings = useRef<Map<string, number>>(new Map());
  const pingStats = useRef<{
    sent: number;
    received: number;
    avgTime: number;
  }>({ sent: 0, received: 0, avgTime: 0 });
  
  // Reference to socket for use in callbacks
  const socketRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  
  useEffect(() => {
    socketRef.current = socket;
    statusRef.current = status;
  }, [socket, status]);
  
  // Handle log messages
  const addLog = (type: LogMessage['type'], message: string, data?: any) => {
    setLogs(prev => [...prev, {
      type,
      timestamp: Date.now(),
      message,
      data
    }]);
  };
  
  // Connect to WebSocket
  const connect = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      addLog('info', 'WebSocket already connected');
      return;
    }
    
    try {
      setStatus('connecting');
      const wsUrl = createStableWebSocketUrl(customPath);
      addLog('info', `Connecting to WebSocket at ${wsUrl}`);
      
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        setStatus('connected');
        addLog('info', 'WebSocket connected successfully');
        startPinging(newSocket);
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog('received', `Received: ${data.type || 'message'}`, data);
          
          // Handle pong responses
          if (data.type === 'pong' && data.id && pendingPings.current.has(data.id)) {
            const sentTime = pendingPings.current.get(data.id)!;
            const latency = Date.now() - sentTime;
            pendingPings.current.delete(data.id);
            
            // Update ping statistics
            pingStats.current.received++;
            pingStats.current.avgTime = (pingStats.current.avgTime * (pingStats.current.received - 1) + latency) / pingStats.current.received;
            
            // Update ping times array for quality calculation
            setPingTimes(prev => {
              const newPingTimes = [...prev, latency];
              if (newPingTimes.length > 10) {
                newPingTimes.shift();
              }
              return newPingTimes;
            });
            
            // Update success ratio
            setSuccessRatio(pingStats.current.received / pingStats.current.sent);
            
            // Check connection quality
            updateConnectionQuality();
          }
        } catch (err) {
          addLog('error', 'Error parsing message', event.data);
        }
      };
      
      newSocket.onclose = (event) => {
        setStatus('disconnected');
        addLog('info', `WebSocket closed: ${event.code} ${event.reason}`);
        
        if (isAutoReconnect && event.code !== 1000) {
          setTimeout(() => {
            if (statusRef.current !== 'connected') {
              addLog('info', 'Auto-reconnecting...');
              connect();
            }
          }, 3000);
        }
      };
      
      newSocket.onerror = (error) => {
        setStatus('error');
        addLog('error', 'WebSocket error', error);
      };
      
      setSocket(newSocket);
    } catch (error) {
      setStatus('error');
      addLog('error', 'Failed to create WebSocket connection', error);
    }
  };
  
  // Disconnect WebSocket
  const disconnect = () => {
    if (socket) {
      socket.close(1000, 'User initiated close');
      setSocket(null);
      setStatus('disconnected');
      addLog('info', 'WebSocket disconnected by user');
    }
  };
  
  // Start pinging the server
  const startPinging = (ws: WebSocket) => {
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const pingId = generatePingId();
        const timestamp = Date.now();
        
        try {
          // Send ping message
          ws.send(JSON.stringify({
            type: 'ping',
            id: pingId,
            timestamp
          }));
          
          // Track pending ping
          pendingPings.current.set(pingId, timestamp);
          pingStats.current.sent++;
          
          addLog('sent', 'Sent ping', { id: pingId, timestamp });
        } catch (error) {
          addLog('error', 'Error sending ping', error);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 5000);
    
    // Clean up interval on component unmount
    return () => clearInterval(pingInterval);
  };
  
  // Send custom message
  const sendCustomMessage = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'message',
          content: customMessage,
          timestamp: Date.now()
        };
        
        socket.send(JSON.stringify(message));
        addLog('sent', 'Sent custom message', message);
        setCustomMessage('');
      } catch (error) {
        addLog('error', 'Error sending message', error);
      }
    } else {
      addLog('error', 'WebSocket not connected');
    }
  };
  
  // Update connection quality
  const updateConnectionQuality = () => {
    const qualityResult = checkConnectionQuality(pingTimes, successRatio);
    setConnectionQuality(qualityResult.quality);
    setIssues(qualityResult.issues);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  };
  
  // Reset ping statistics
  const resetPingStats = () => {
    pendingPings.current.clear();
    pingStats.current = { sent: 0, received: 0, avgTime: 0 };
    setPingTimes([]);
    setSuccessRatio(1);
    addLog('info', 'Ping statistics reset');
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // Get connection status badge
  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500">Connecting</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Error</Badge>;
      case 'disconnected':
      default:
        return <Badge className="bg-gray-500">Disconnected</Badge>;
    }
  };
  
  // Get connection quality indicator
  const getQualityIndicator = () => {
    if (connectionQuality >= 80) {
      return <Badge className="bg-green-500">Excellent ({connectionQuality}%)</Badge>;
    } else if (connectionQuality >= 60) {
      return <Badge className="bg-green-700">Good ({connectionQuality}%)</Badge>;
    } else if (connectionQuality >= 40) {
      return <Badge className="bg-yellow-500">Fair ({connectionQuality}%)</Badge>;
    } else if (connectionQuality >= 20) {
      return <Badge className="bg-orange-500">Poor ({connectionQuality}%)</Badge>;
    } else {
      return <Badge className="bg-red-500">Critical ({connectionQuality}%)</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">WebSocket Test Page</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Test and diagnose WebSocket connections in {isReplit ? 'Replit' : 'standard'} environment
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>WebSocket Connection</span>
                {getStatusBadge()}
              </CardTitle>
              <CardDescription>
                Control and monitor WebSocket connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="connect">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="connect">Connection</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="connect">
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center space-x-2">
                      <Button 
                        onClick={connect} 
                        disabled={status === 'connecting' || status === 'connected'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {status === 'connecting' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                      <Button 
                        onClick={disconnect} 
                        disabled={status !== 'connected'}
                        variant="destructive"
                      >
                        Disconnect
                      </Button>
                      <Button 
                        onClick={resetPingStats} 
                        variant="outline"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset Stats
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Connection Quality</span>
                        {getQualityIndicator()}
                      </div>
                      <Progress value={connectionQuality} className="h-2" />
                      
                      {issues.length > 0 && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Connection Issues Detected</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc pl-5">
                              {issues.map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Ping Statistics</span>
                        <div className="flex items-center justify-between">
                          <span>Sent:</span>
                          <span>{pingStats.current.sent}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Received:</span>
                          <span>{pingStats.current.received}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Success Rate:</span>
                          <span>{(successRatio * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Latency</span>
                        <div className="flex items-center justify-between">
                          <span>Average:</span>
                          <span>{pingStats.current.avgTime.toFixed(1)} ms</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last:</span>
                          <span>{pingTimes.length > 0 ? pingTimes[pingTimes.length - 1].toFixed(1) : 'N/A'} ms</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder="Type a message to send..."
                          disabled={status !== 'connected'}
                        />
                        <Button 
                          onClick={sendCustomMessage} 
                          disabled={status !== 'connected' || !customMessage.trim()}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="settings">
                  <div className="space-y-4 mt-4">
                    <div className="flex flex-col space-y-2">
                      <label className="text-sm font-medium">WebSocket Path</label>
                      <div className="flex items-center space-x-2">
                        <Input
                          value={customPath}
                          onChange={(e) => setCustomPath(e.target.value)}
                          placeholder="/ws"
                          disabled={status === 'connected'}
                        />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Current URL: {createStableWebSocketUrl(customPath)}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="auto-reconnect"
                        checked={isAutoReconnect}
                        onCheckedChange={(checked) => setIsAutoReconnect(!!checked)}
                      />
                      <label
                        htmlFor="auto-reconnect"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Auto-reconnect on disconnection
                      </label>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Environment</span>
                      <div className="text-sm">
                        Detected: {isReplit ? 'Replit' : 'Standard Browser'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isReplit 
                          ? 'Using Replit-optimized WebSocket connection with special handling'
                          : 'Using standard WebSocket connection'}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>Connection Logs</span>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  Clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border">
                <div className="p-4 space-y-2">
                  {logs.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      No logs yet. Connect to get started.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div 
                        key={index}
                        className={`p-2 rounded-md text-sm ${
                          log.type === 'error' 
                            ? 'bg-red-500/10 text-red-500' 
                            : log.type === 'sent' 
                              ? 'bg-blue-500/10 text-blue-500' 
                              : log.type === 'received' 
                                ? 'bg-green-500/10 text-green-500' 
                                : 'bg-gray-500/10'
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="text-xs opacity-70">{formatTimestamp(log.timestamp)}</span>
                          <span className="ml-2 break-all">{log.message}</span>
                        </div>
                        {log.data && (
                          <div className="mt-1 text-xs font-mono bg-black/10 p-1 rounded overflow-x-auto">
                            {typeof log.data === 'object'
                              ? JSON.stringify(log.data, null, 2)
                              : String(log.data)
                            }
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}