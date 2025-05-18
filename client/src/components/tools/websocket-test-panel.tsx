/**
 * WebSocket Test Panel Component
 * 
 * This component provides a UI for testing WebSocket connections
 * and debugging WebSocket-related issues.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  AlertCircle, 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Info,
  AlertTriangle
} from "lucide-react";
import { testWebSocketConnection, testAllWebSocketEndpoints } from "@/lib/websocketTestClient";
import { createStableWebSocketUrl } from "@/lib/websocketUtils";
import { mcpClient as mcpWebSocketClient } from "@/lib/mcpWebsocketClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface LogMessage {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
  timestamp: Date;
}

export function WebSocketTestPanel() {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  
  // Add a log message
  const addLog = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      text,
      type,
      timestamp: new Date()
    }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Test MCP WebSocket connection
  const testMcpConnection = () => {
    setTesting(true);
    addLog('Testing MCP WebSocket connection...', 'info');
    
    // Override console.log to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'info');
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'error');
    };
    
    try {
      // Test the MCP WebSocket connection
      const cleanup = testWebSocketConnection('/ws/mcp-proxy');
      
      // Restore console functions after 5 seconds
      setTimeout(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        if (cleanup) cleanup();
        setTesting(false);
        addLog('MCP WebSocket test completed', 'info');
      }, 5000);
    } catch (error) {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      addLog(`Error testing WebSocket: ${error}`, 'error');
      setTesting(false);
    }
  };
  
  // Test Events WebSocket connection
  const testEventsConnection = () => {
    setTesting(true);
    addLog('Testing Events WebSocket connection...', 'info');
    
    // Override console.log to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'info');
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'error');
    };
    
    try {
      // Test the Events WebSocket connection
      const cleanup = testWebSocketConnection('/ws/events');
      
      // Restore console functions after 5 seconds
      setTimeout(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        if (cleanup) cleanup();
        setTesting(false);
        addLog('Events WebSocket test completed', 'info');
      }, 5000);
    } catch (error) {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      addLog(`Error testing WebSocket: ${error}`, 'error');
      setTesting(false);
    }
  };
  
  // Test all WebSocket connections
  const testAll = () => {
    setTesting(true);
    addLog('Testing all WebSocket connections...', 'info');
    
    // Override console.log to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'info');
    };
    
    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
      addLog(message, 'error');
    };
    
    try {
      // Test all WebSocket connections
      testAllWebSocketEndpoints();
      
      // Restore console functions after 15 seconds
      setTimeout(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        setTesting(false);
        addLog('All WebSocket tests completed', 'info');
      }, 15000);
    } catch (error) {
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      addLog(`Error testing WebSockets: ${error}`, 'error');
      setTesting(false);
    }
  };
  
  // Check if WebSockets are supported
  useEffect(() => {
    const isSupported = 'WebSocket' in window;
    
    addLog(`WebSocket support: ${isSupported ? 'Yes' : 'No'}`, isSupported ? 'success' : 'error');
    
    if (isSupported) {
      // Check if the environment is secure (HTTPS or localhost)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      
      addLog(`Secure context: ${isSecure ? 'Yes' : 'No'}`, isSecure ? 'success' : 'info');
      
      // Check WebSocket URL formation
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      
      const mcpUrl = `${protocol}//${host}/ws/mcp-proxy`;
      addLog(`MCP WebSocket URL: ${mcpUrl}`, 'info');
      
      const eventsUrl = `${protocol}//${host}/ws/events`;
      addLog(`Events WebSocket URL: ${eventsUrl}`, 'info');
    }
  }, []);
  
  // Add state for storing connection status and diagnostic info
  const [connectionStatus, setConnectionStatus] = useState<{
    mcp: 'connected' | 'disconnected' | 'connecting' | 'error';
    events: 'connected' | 'disconnected' | 'connecting' | 'error';
  }>({
    mcp: 'disconnected',
    events: 'disconnected'
  });
  
  // Add state for tracking reconnection attempts
  const [reconnectAttempts, setReconnectAttempts] = useState<{
    mcp: number;
    events: number;
  }>({
    mcp: 0,
    events: 0
  });
  
  // Monitor for "Attempting to reconnect" log messages to track reconnection attempts
  useEffect(() => {
    const mcpReconnectPattern = /Attempting to reconnect.*?attempt (\d+)/i;
    
    // Check the most recent logs for reconnection attempts
    const recentLogs = logs.slice(-10);
    
    recentLogs.forEach(log => {
      const mcpMatch = log.text.match(mcpReconnectPattern);
      if (mcpMatch && mcpMatch[1]) {
        const attemptNumber = parseInt(mcpMatch[1], 10);
        setReconnectAttempts(prev => ({
          ...prev,
          mcp: Math.max(prev.mcp, attemptNumber)
        }));
      }
    });
    
    // Also check for connection status indicators
    recentLogs.forEach(log => {
      if (log.text.includes('MCP WebSocket connected')) {
        setConnectionStatus(prev => ({
          ...prev,
          mcp: 'connected'
        }));
        setConnected(true);
      } else if (log.text.includes('MCP WebSocket closed')) {
        setConnectionStatus(prev => ({
          ...prev,
          mcp: 'disconnected'
        }));
        setConnected(false);
      } else if (log.text.includes('MCP WebSocket error')) {
        setConnectionStatus(prev => ({
          ...prev,
          mcp: 'error'
        }));
        setConnected(false);
      }
    });
  }, [logs]);
  
  // Function to manually reconnect MCP WebSocket
  const forceReconnectMcp = () => {
    if (mcpWebSocketClient) {
      addLog("Starting manual reconnection of MCP WebSocket", "info");
      
      // Update UI state
      setConnectionStatus(prev => ({ ...prev, mcp: 'connecting' }));
      
      // First disconnect if connected
      mcpWebSocketClient.disconnect();
      
      // Short delay before connecting again
      setTimeout(() => {
        try {
          // Reset reconnect attempts counter
          setReconnectAttempts(prev => ({ ...prev, mcp: 0 }));
          
          // Attempt to reconnect
          mcpWebSocketClient.connect();
          addLog("Manually triggered MCP WebSocket reconnection", "info");
          
          // Add a message about expected behavior
          addLog("WebSocket should establish connection within a few seconds", "info");
          
          // Register one-time event handler for connection success
          const unsubscribe = mcpWebSocketClient.subscribe((event) => {
            if (event.type === 'connected') {
              addLog("Manual reconnection successful!", "success");
              unsubscribe(); // Remove this one-time handler
            }
          });
          
          // Set timeout to report if connection wasn't successful
          setTimeout(() => {
            if (connectionStatus.mcp !== 'connected') {
              addLog("WebSocket reconnection may not have succeeded. Check network conditions.", "error");
            }
          }, 3000);
        } catch (error) {
          addLog(`Error during manual reconnection: ${error}`, "error");
          setConnectionStatus(prev => ({ ...prev, mcp: 'error' }));
        }
      }, 500);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>WebSocket Diagnostics</span>
          <Badge variant={connected ? "default" : "destructive"} className={connected ? "bg-green-100 text-green-800" : ""}>
            {connected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Disconnected</>
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          Test and debug WebSocket connections for the MCP platform
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="test" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="test">Test Connections</TabsTrigger>
            <TabsTrigger value="diagnostic">Connection Diagnostics</TabsTrigger>
            <TabsTrigger value="logs">Connection Logs</TabsTrigger>
          </TabsList>
          
          {/* Test Connections Tab */}
          <TabsContent value="test">
            <div className="flex space-x-2 mb-4">
              <Button 
                onClick={testMcpConnection} 
                disabled={testing}
                variant="outline"
                size="sm"
              >
                Test MCP Connection
              </Button>
              
              <Button 
                onClick={testEventsConnection} 
                disabled={testing}
                variant="outline"
                size="sm"
              >
                Test Events Connection
              </Button>
              
              <Button 
                onClick={testAll} 
                disabled={testing}
                variant="default"
                size="sm"
              >
                Test All Endpoints
              </Button>
              
              <Button 
                onClick={clearLogs} 
                variant="ghost"
                size="sm"
                className="ml-auto"
              >
                Clear Logs
              </Button>
            </div>
            
            <Separator className="my-2" />
            
            <ScrollArea className="h-80">
              <div className="space-y-2 p-1">
                {logs.map(log => (
                  <Alert key={log.id} variant={log.type === 'error' ? 'destructive' : 'default'}>
                    <div className="flex items-start">
                      {log.type === 'error' ? (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      ) : log.type === 'success' ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : null}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </p>
                        <AlertDescription className="mt-1 text-sm whitespace-pre-wrap font-mono">
                          {log.text}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
                
                {logs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs yet. Click one of the test buttons to begin.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          {/* Connection Diagnostics Tab */}
          <TabsContent value="diagnostic">
            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">MCP WebSocket Connection Status</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Status */}
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">Current Status</Label>
                      <div className="flex items-center">
                        <Badge 
                          variant={
                            connectionStatus.mcp === 'connected' ? 'default' : 
                            connectionStatus.mcp === 'error' ? 'destructive' : 
                            'outline'
                          }
                          className={
                            connectionStatus.mcp === 'connected' ? 'bg-green-100 text-green-800' : 
                            connectionStatus.mcp === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                            connectionStatus.mcp === 'error' ? 'bg-red-100 text-red-800' : ''
                          }
                        >
                          {connectionStatus.mcp === 'connected' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {connectionStatus.mcp === 'disconnected' && <WifiOff className="h-3 w-3 mr-1" />}
                          {connectionStatus.mcp === 'connecting' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                          {connectionStatus.mcp === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {connectionStatus.mcp.charAt(0).toUpperCase() + connectionStatus.mcp.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Reconnection Attempts */}
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">Reconnection Attempts</Label>
                      <div className="flex items-center">
                        <Badge 
                          variant={
                            reconnectAttempts.mcp === 0 ? 'outline' : 
                            reconnectAttempts.mcp < 3 ? 'default' : 
                            'destructive'
                          }
                        >
                          {reconnectAttempts.mcp} {reconnectAttempts.mcp === 1 ? 'attempt' : 'attempts'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Alert variant="default" className={
                      reconnectAttempts.mcp >= 3 ? 'border-red-500 bg-red-50' :
                      reconnectAttempts.mcp > 0 ? 'border-yellow-500 bg-yellow-50' :
                      'border-green-500 bg-green-50'
                    }>
                      <div className="flex items-start">
                        {reconnectAttempts.mcp >= 3 ? (
                          <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                        ) : reconnectAttempts.mcp > 0 ? (
                          <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        )}
                        <div>
                          <AlertTitle className="text-sm">
                            {reconnectAttempts.mcp >= 3 
                              ? 'Connection Issues Detected' 
                              : reconnectAttempts.mcp > 0 
                                ? 'Connection Instability Detected'
                                : 'Connection Status Healthy'}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {reconnectAttempts.mcp >= 3 
                              ? 'Multiple reconnection attempts suggest a persistent connection issue. Check server logs for more details.'
                              : reconnectAttempts.mcp > 0
                                ? 'The connection has been unstable. Keep monitoring for additional reconnections.'
                                : 'No reconnection attempts have been detected.'}
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  </div>
                  
                  <div className="mt-4 flex justify-between">
                    <Button 
                      onClick={forceReconnectMcp} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Force Reconnect
                    </Button>
                    
                    <Button
                      onClick={testMcpConnection}
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                      disabled={testing}
                    >
                      <Info className="h-4 w-4 mr-1" />
                      Test Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Browser WebSocket Support</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">WebSocket API</Label>
                      <div className="flex items-center">
                        <Badge 
                          variant={typeof WebSocket !== 'undefined' ? 'default' : 'destructive'}
                          className={typeof WebSocket !== 'undefined' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {typeof WebSocket !== 'undefined' ? 'Available' : 'Not Available'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">Environment</Label>
                      <div className="flex items-center">
                        <Badge variant="outline">
                          {import.meta.env.DEV ? 'Development' : 'Production'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">Secure Context</Label>
                      <div className="flex items-center">
                        <Badge 
                          variant={
                            window.location.protocol === 'https:' || 
                            window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' 
                              ? 'default' : 'outline'
                          }
                          className={
                            window.location.protocol === 'https:' || 
                            window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' 
                              ? 'bg-green-100 text-green-800' : ''
                          }
                        >
                          {window.location.protocol === 'https:' || 
                           window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' 
                            ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <Label className="text-xs text-muted-foreground">Protocol</Label>
                      <div className="flex items-center">
                        <Badge variant="outline">
                          {window.location.protocol === 'https:' ? 'HTTPS (wss://)' : 'HTTP (ws://)'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground">MCP WebSocket URL</Label>
                    <Input 
                      value={websocketFix.createStableWebSocketUrl('/ws/mcp-proxy')} 
                      readOnly 
                      className="font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Connection Logs Tab */}
          <TabsContent value="logs">
            <div className="flex justify-end mb-4">
              <Button 
                onClick={clearLogs} 
                variant="ghost"
                size="sm"
              >
                Clear Logs
              </Button>
            </div>
            
            <ScrollArea className="h-[380px]">
              <div className="space-y-2 p-1">
                {logs.map(log => (
                  <Alert key={log.id} variant="outline" className={
                    log.type === 'error' ? 'border-red-500 bg-red-50' :
                    log.type === 'success' ? 'border-green-500 bg-green-50' :
                    log.text.includes('reconnect') ? 'border-yellow-500 bg-yellow-50' :
                    log.text.includes('connected') ? 'border-green-500 bg-green-50' :
                    log.text.includes('closed') ? 'border-red-500 bg-red-50' :
                    ''
                  }>
                    <div className="flex items-start">
                      {log.type === 'error' || log.text.includes('error') ? (
                        <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                      ) : log.type === 'success' || log.text.includes('connected') ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : log.text.includes('reconnect') ? (
                        <RefreshCw className="h-4 w-4 mr-2 text-yellow-500" />
                      ) : null}
                      <div className="w-full">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-semibold">
                            {log.text.includes('MCP') ? 'MCP WebSocket' : 
                             log.text.includes('Events') ? 'Events WebSocket' : 'System'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <AlertDescription className="mt-1 text-xs whitespace-pre-wrap font-mono overflow-x-auto">
                          {log.text}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
                
                {logs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs yet. Click one of the test buttons to begin.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <div>WebSocket API: {typeof WebSocket !== 'undefined' ? 'Available' : 'Not Available'}</div>
        <div>Protocol: {window.location.protocol === 'https:' ? 'HTTPS (WSS)' : 'HTTP (WS)'}</div>
      </CardFooter>
    </Card>
  );
}

export default WebSocketTestPanel;