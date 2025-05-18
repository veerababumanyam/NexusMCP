import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, SendIcon, ArrowDownUp, RadioTower, Plus, X, RotateCw, Waves } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

/**
 * Enterprise-grade WebSocket test component
 * 
 * This component provides comprehensive testing capabilities for the WebSocket
 * infrastructure with enhanced features for debugging and diagnostics.
 */
export function BasicWebsocketTest() {
  // Connection state
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<{
    id: string;
    type: 'sent' | 'received' | 'system' | 'error';
    content: string;
    timestamp: Date;
    data?: any;
  }[]>([]);
  
  // Message input state
  const [inputMessage, setInputMessage] = useState<string>('Hello, world!');
  const [messageType, setMessageType] = useState<string>('text');
  const [pingInterval, setPingInterval] = useState<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Connection details
  const [connectionDetails, setConnectionDetails] = useState<{
    id?: string;
    startTime?: Date;
    serverInfo?: any;
    roundTripTime?: number;
    messagesSent: number;
    messagesReceived: number;
  }>({
    messagesSent: 0,
    messagesReceived: 0
  });
  
  // Connect to WebSocket with enterprise capabilities
  const connect = () => {
    try {
      setStatus('connecting');
      addSystemMessage('Connecting to Enterprise WebSocket test endpoint...');
      
      // Create the WebSocket URL with proper enterprise path
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // Connect to the dedicated enterprise-grade test endpoint
      const wsUrl = `${protocol}//${host}/ws`;
      
      addSystemMessage(`Establishing secure connection to ${wsUrl}`);
      
      // Create WebSocket instance with enterprise capabilities
      const ws = new WebSocket(wsUrl);
      
      // Set up comprehensive event handlers
      ws.onopen = () => {
        setStatus('connected');
        const connStartTime = new Date();
        setConnectionDetails(prev => ({
          ...prev,
          startTime: connStartTime
        }));
        addSystemMessage('✅ Connection established successfully');
        
        // Send an initial test message to verify bidirectional communication
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const testMessage = JSON.stringify({
              type: 'test',
              messageId: `init-${Date.now()}`,
              clientTime: Date.now()
            });
            ws.send(testMessage);
            addSentMessage('Initial handshake', testMessage);
          }
        }, 500);
      };
      
      // Handle incoming messages with proper parsing and formatting
      ws.onmessage = (event) => {
        try {
          // Try to parse as JSON first
          const data = JSON.parse(event.data);
          setConnectionDetails(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            serverInfo: data.serverInfo || prev.serverInfo
          }));
          
          // Handle special message types
          if (data.type === 'welcome') {
            setConnectionDetails(prev => ({
              ...prev,
              id: data.connectionId || 'unknown'
            }));
            addSystemMessage(`Connected to ${data.message} (ID: ${data.connectionId || 'unknown'})`);
          } else if (data.type === 'pong') {
            const rtt = data.roundTripTime || (data.serverTimestamp - data.clientTimestamp);
            setConnectionDetails(prev => ({
              ...prev,
              roundTripTime: rtt
            }));
            addReceivedMessage(`Pong (${rtt}ms)`, data);
          } else if (data.type === 'error') {
            addErrorMessage(`Server error: ${data.message}`, data);
          } else {
            // Standard message
            addReceivedMessage(
              `${data.type || 'Message'}: ${
                data.content || 
                (data.originalMessage ? JSON.stringify(data.originalMessage).substring(0, 50) : 'No content')
              }${data.content?.length > 50 ? '...' : ''}`,
              data
            );
          }
        } catch (e) {
          // Handle as plain text if not JSON
          setConnectionDetails(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1
          }));
          addReceivedMessage(`${event.data}`, event.data);
        }
      };
      
      // Handle connection closure with detailed diagnostics
      ws.onclose = (event) => {
        setStatus('disconnected');
        addSystemMessage(`❌ Connection closed: Code=${event.code}, Reason=${event.reason || 'No reason provided'}, Clean=${event.wasClean}`);
        
        // Clear any active ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
          setPingInterval(null);
        }
        
        // Add detailed guidance for common error codes
        if (event.code === 1000) {
          addSystemMessage('ℹ️ Normal closure: The connection successfully completed its purpose');
        } else if (event.code === 1001) {
          addSystemMessage('ℹ️ Going away: The server is going down or the client navigated away');
        } else if (event.code === 1006) {
          addErrorMessage('💡 Abnormal closure: The connection was terminated unexpectedly (possible network issues, server restart, or connection timeout)');
        } else if (event.code === 1011) {
          addErrorMessage('💡 Internal server error: The server encountered an unexpected condition');
        } else if (event.code === 1012) {
          addErrorMessage('💡 Service restart: The server is restarting and will be available soon');
        } else if (event.code === 1013) {
          addErrorMessage('💡 Try again later: The server is temporarily unable to handle the connection');
        }
        
        wsRef.current = null;
      };
      
      // Enhanced error handling
      ws.onerror = (event) => {
        setStatus('error');
        addErrorMessage('⚠️ WebSocket connection error occurred');
        
        // Check for specific error types (if available)
        if (event.error) {
          addErrorMessage(`Error details: ${event.error.toString()}`);
        }
      };
      
      // Store WebSocket reference
      wsRef.current = ws;
    } catch (err) {
      setStatus('error');
      addErrorMessage(`⚠️ Error creating WebSocket: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Disconnect from WebSocket with clean shutdown
  const disconnect = () => {
    if (wsRef.current) {
      // Clear any ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
        setPingInterval(null);
      }
      
      // Send a proper close message if possible
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          const closeMessage = JSON.stringify({
            type: 'client_disconnect',
            reason: 'User initiated disconnect',
            messageId: `close-${Date.now()}`
          });
          wsRef.current.send(closeMessage);
          addSentMessage('Disconnect notification', closeMessage);
        }
      } catch (e) {
        console.error('Error sending disconnect message:', e);
      }
      
      // Close with standard code
      wsRef.current.close(1000, 'User initiated disconnect');
      addSystemMessage('Initiated clean disconnect from server');
      setStatus('disconnected');
    }
  };
  
  // Start periodic ping to measure latency
  const startPing = (interval: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      addErrorMessage('Cannot start ping: WebSocket is not connected');
      return;
    }
    
    // Clear any existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    // Set up new ping interval
    setPingInterval(interval);
    addSystemMessage(`Starting ping every ${interval}ms`);
    
    const intervalId = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingMessage = JSON.stringify({
          type: 'ping',
          messageId: `ping-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          timestamp: Date.now()
        });
        wsRef.current.send(pingMessage);
        setConnectionDetails(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1
        }));
      } else {
        // Auto-clear if connection lost
        clearInterval(intervalId);
        setPingInterval(null);
        pingIntervalRef.current = null;
        addErrorMessage('Ping stopped: Connection lost');
      }
    }, interval);
    
    pingIntervalRef.current = intervalId;
  };
  
  // Stop periodic ping
  const stopPing = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      addSystemMessage('Ping stopped');
      pingIntervalRef.current = null;
      setPingInterval(null);
    }
  };
  
  // Send a single message with advanced options
  const sendMessage = () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      addErrorMessage('Cannot send: WebSocket is not connected');
      return;
    }
    
    try {
      // Format message based on type
      let message: string;
      
      if (messageType === 'text') {
        // Send as plain text
        message = inputMessage;
      } else if (messageType === 'echo') {
        // Format as echo JSON
        message = JSON.stringify({
          type: 'echo',
          content: inputMessage,
          messageId: `echo-${Date.now()}`,
          clientTime: Date.now()
        });
      } else if (messageType === 'ping') {
        // Format as ping JSON
        message = JSON.stringify({
          type: 'ping',
          messageId: `manual-ping-${Date.now()}`,
          timestamp: Date.now()
        });
      } else if (messageType === 'test') {
        // Format as test JSON
        message = JSON.stringify({
          type: 'test',
          content: inputMessage,
          messageId: `test-${Date.now()}`,
          clientTime: Date.now()
        });
      } else if (messageType === 'json') {
        // Try to parse as custom JSON
        try {
          // Validate it's proper JSON
          JSON.parse(inputMessage);
          message = inputMessage;
        } catch (e) {
          addErrorMessage(`Invalid JSON: ${e.message}`);
          return;
        }
      } else {
        // Default JSON format with type
        message = JSON.stringify({
          type: messageType,
          content: inputMessage,
          messageId: `${messageType}-${Date.now()}`,
          clientTime: Date.now()
        });
      }
      
      // Send the message
      wsRef.current.send(message);
      setConnectionDetails(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1
      }));
      
      // Log the sent message
      addSentMessage(
        messageType === 'text' 
          ? message 
          : `${messageType}: ${inputMessage.length > 50 ? inputMessage.substring(0, 50) + '...' : inputMessage}`,
        message
      );
    } catch (err) {
      addErrorMessage(`Error sending message: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Message logging helpers with proper typing
  const addSystemMessage = (content: string) => {
    addMessage('system', content);
  };
  
  const addErrorMessage = (content: string, data?: any) => {
    addMessage('error', content, data);
  };
  
  const addSentMessage = (content: string, data?: any) => {
    addMessage('sent', content, data);
  };
  
  const addReceivedMessage = (content: string, data?: any) => {
    addMessage('received', content, data);
  };
  
  const addMessage = (type: 'sent' | 'received' | 'system' | 'error', content: string, data?: any) => {
    setMessages(prev => [
      ...prev, 
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        type,
        content,
        timestamp: new Date(),
        data
      }
    ]);
  };
  
  // Clear message log
  const clearMessages = () => {
    setMessages([]);
    addSystemMessage('Message log cleared');
  };
  
  // Reset connection statistics
  const resetStats = () => {
    setConnectionDetails({
      ...connectionDetails,
      messagesSent: 0,
      messagesReceived: 0
    });
    addSystemMessage('Connection statistics reset');
  };
  
  // Force a reconnection
  const reconnect = () => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  };
  
  // Clean up all resources on unmount
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Calculate connection duration
  const getConnectionDuration = () => {
    if (!connectionDetails.startTime || status !== 'connected') return '--';
    const diff = new Date().getTime() - connectionDetails.startTime.getTime();
    
    // Format as seconds/minutes
    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}s`;
    } else {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  };
  
  // Delete a message from the log
  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          Enterprise WebSocket Diagnostics
          <Badge variant={
            status === 'connected' ? 'success' :
            status === 'connecting' ? 'warning' :
            status === 'error' ? 'destructive' : 'outline'
          }>
            {status === 'connecting' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Enterprise-grade WebSocket testing for the dedicated '/ws' endpoint with comprehensive diagnostics
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="messages" className="space-y-4">
            {/* Connection controls */}
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={connect} 
                disabled={status === 'connected' || status === 'connecting'}
                variant="default"
                size="sm"
                className="gap-1"
              >
                <RadioTower className="h-4 w-4" />
                Connect
              </Button>
              
              <Button 
                onClick={disconnect} 
                disabled={status !== 'connected'}
                variant="secondary"
                size="sm"
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Disconnect
              </Button>
              
              <Button 
                onClick={reconnect} 
                disabled={status === 'connecting'}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <RotateCw className="h-4 w-4" />
                Reconnect
              </Button>
              
              <Button 
                onClick={clearMessages} 
                variant="ghost"
                size="sm"
                className="ml-auto gap-1"
              >
                Clear Log
              </Button>
            </div>
            
            {/* Connection stats */}
            {status === 'connected' && (
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1 pb-1">
                <div className="bg-secondary/50 rounded p-1">
                  <div className="font-semibold">Connection ID</div>
                  <div className="truncate" title={connectionDetails.id || 'Unknown'}>
                    {connectionDetails.id || 'Unknown'}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded p-1">
                  <div className="font-semibold">Duration</div>
                  <div>{getConnectionDuration()}</div>
                </div>
                <div className="bg-secondary/50 rounded p-1">
                  <div className="font-semibold">Sent</div>
                  <div>{connectionDetails.messagesSent}</div>
                </div>
                <div className="bg-secondary/50 rounded p-1">
                  <div className="font-semibold">Received</div>
                  <div>{connectionDetails.messagesReceived}</div>
                </div>
              </div>
            )}
            
            {/* Message input */}
            <div className="flex flex-wrap md:flex-nowrap gap-2">
              <Select
                value={messageType}
                onValueChange={setMessageType}
                disabled={status !== 'connected'}
              >
                <SelectTrigger className="w-[140px] flex-shrink-0">
                  <SelectValue placeholder="Message Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Plain Text</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="ping">Ping</SelectItem>
                  <SelectItem value="message">Generic</SelectItem>
                  <SelectItem value="json">Custom JSON</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex-grow flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Enter message to send"
                  disabled={status !== 'connected'}
                  className="flex-grow"
                />
                
                <Button 
                  onClick={sendMessage} 
                  disabled={status !== 'connected'}
                  variant="default"
                  size="icon"
                >
                  <SendIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Message log */}
            <div className="border rounded-md">
              <ScrollArea className="h-[340px] w-full">
                <div className="p-4 font-mono text-sm">
                  {messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`whitespace-pre-wrap mb-2 pb-2 border-b border-border/40 flex gap-2 ${
                        msg.type === 'sent' ? 'text-blue-500' : 
                        msg.type === 'received' ? 'text-green-500' : 
                        msg.type === 'error' ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}
                    >
                      <div className="flex-grow">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          {msg.type === 'sent' && <SendIcon className="h-3 w-3" />}
                          {msg.type === 'received' && <ArrowDownUp className="h-3 w-3" />}
                          {msg.type === 'error' && <X className="h-3 w-3" />}
                          {msg.type === 'system' && <Waves className="h-3 w-3" />}
                          
                          <span>
                            {msg.timestamp.toLocaleTimeString()} - {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}
                          </span>
                        </div>
                        <div>{msg.content}</div>
                        {msg.data && typeof msg.data === 'object' && (
                          <div className="text-xs text-muted-foreground mt-1 pl-1 overflow-hidden">
                            {JSON.stringify(msg.data).length > 100 
                              ? JSON.stringify(msg.data).substring(0, 100) + '...' 
                              : JSON.stringify(msg.data)}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => deleteMessage(msg.id)}
                        className="text-muted-foreground hover:text-destructive h-4 w-4"
                        title="Remove message"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-muted-foreground italic">No messages yet</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
          
          <TabsContent value="diagnostics" className="space-y-4">
            {/* Connection controls */}
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={connect} 
                disabled={status === 'connected' || status === 'connecting'}
                variant="default"
                size="sm"
                className="gap-1"
              >
                <RadioTower className="h-4 w-4" />
                Connect
              </Button>
              
              <Button 
                onClick={disconnect} 
                disabled={status !== 'connected'}
                variant="secondary"
                size="sm"
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Disconnect
              </Button>
              
              <Button 
                onClick={resetStats} 
                disabled={status !== 'connected'}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                Reset Stats
              </Button>
            </div>
            
            {/* Ping tools */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Latency Monitoring</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => startPing(1000)}
                  disabled={status !== 'connected' || !!pingInterval}
                  variant="outline"
                  size="sm"
                >
                  Ping 1s
                </Button>
                <Button
                  onClick={() => startPing(5000)}
                  disabled={status !== 'connected' || !!pingInterval}
                  variant="outline"
                  size="sm"
                >
                  Ping 5s
                </Button>
                <Button
                  onClick={stopPing}
                  disabled={status !== 'connected' || !pingInterval}
                  variant="secondary"
                  size="sm"
                >
                  Stop Ping
                </Button>
                
                {connectionDetails.roundTripTime !== undefined && (
                  <div className="ml-auto flex items-center">
                    <span className="text-sm mr-2">Last RTT:</span>
                    <Badge variant={
                      connectionDetails.roundTripTime < 100 ? 'success' :
                      connectionDetails.roundTripTime < 300 ? 'warning' : 'destructive'
                    }>
                      {connectionDetails.roundTripTime}ms
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            
            <Separator />
            
            {/* Connection metrics */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Connection Metrics</div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border rounded p-3">
                  <div className="text-xs text-muted-foreground">Connection State</div>
                  <div className="font-semibold">{status}</div>
                </div>
                <div className="bg-card border rounded p-3">
                  <div className="text-xs text-muted-foreground">Messages Sent</div>
                  <div className="font-semibold">{connectionDetails.messagesSent}</div>
                </div>
                <div className="bg-card border rounded p-3">
                  <div className="text-xs text-muted-foreground">Messages Received</div>
                  <div className="font-semibold">{connectionDetails.messagesReceived}</div>
                </div>
                <div className="bg-card border rounded p-3">
                  <div className="text-xs text-muted-foreground">Connection Duration</div>
                  <div className="font-semibold">{getConnectionDuration()}</div>
                </div>
              </div>
              
              {/* Connection details for connected state */}
              {status === 'connected' && (
                <>
                  <div className="bg-card border rounded p-3 space-y-3">
                    <div className="text-sm font-medium">Connection Details</div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Connection ID:</div>
                      <div className="font-mono">{connectionDetails.id || 'Unknown'}</div>
                      
                      <div className="text-muted-foreground">Started:</div>
                      <div>{connectionDetails.startTime?.toLocaleString() || 'Unknown'}</div>
                      
                      <div className="text-muted-foreground">WebSocket State:</div>
                      <div>{wsRef.current ? ['Connecting', 'Open', 'Closing', 'Closed'][wsRef.current.readyState] : 'Unknown'}</div>
                      
                      <div className="text-muted-foreground">Ping Interval:</div>
                      <div>{pingInterval ? `${pingInterval}ms` : 'Not active'}</div>
                    </div>
                  </div>
                  
                  {/* Server info */}
                  {connectionDetails.serverInfo && (
                    <div className="bg-card border rounded p-3 space-y-3">
                      <div className="text-sm font-medium">Server Information</div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {Object.entries(connectionDetails.serverInfo).map(([key, value]: [string, any]) => (
                          <React.Fragment key={key}>
                            <div className="text-muted-foreground">{key}:</div>
                            <div className="font-mono overflow-hidden text-ellipsis">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="text-xs text-muted-foreground border-t pt-4">
        <div className="w-full">
          <p>
            Enterprise WebSocket diagnostics tool connects to the dedicated '/ws' endpoint to test the WebSocket infrastructure.
            This endpoint supports JSON message types: echo, test, ping, and message.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}