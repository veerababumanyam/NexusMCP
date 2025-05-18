import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

/**
 * A simple WebSocket test component that allows direct testing of WebSocket connections
 * without the complexity of the full MCP client implementation.
 */
export function SimpleWebsocketTest() {
  // WebSocket state
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<Array<{ type: 'sent' | 'received' | 'info' | 'error', content: string, timestamp: Date }>>([]);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [messageToSend, setMessageToSend] = useState<string>('{"type":"ping"}');
  
  // We're going to offer several different connection URLs to test
  useEffect(() => {
    // Default is the most basic possible WebSocket URL for this Replit environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Even simpler URL format than before - using root path for maximum compatibility
    const url = `${protocol}//${host}/ws`;
    setWsUrl(url);
  }, []);
  
  // Connect to WebSocket with ultra-simplified error handling
  const connect = () => {
    if (status === 'connecting' || status === 'connected') {
      addInfoMessage('Already connected or connecting to WebSocket');
      return;
    }
    
    try {
      setStatus('connecting');
      addInfoMessage(`Connecting to ${wsUrl}...`);
      
      // Create the WebSocket with minimal configuration
      const socket = new WebSocket(wsUrl);
      
      // Set up minimal event handlers
      socket.onopen = (event) => {
        setStatus('connected');
        addInfoMessage('WebSocket connection established successfully');
        
        // Immediately send a test ping message
        try {
          const pingMessage = JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() });
          socket.send(pingMessage);
          addSentMessage(pingMessage);
          addInfoMessage('Automatically sent test ping message');
        } catch (e) {
          addErrorMessage(`Failed to send automatic ping: ${e.message}`);
        }
      };
      
      socket.onmessage = (event) => {
        try {
          // Try to parse as JSON
          const data = JSON.parse(event.data);
          addReceivedMessage(JSON.stringify(data, null, 2));
        } catch (error) {
          // Fallback to raw data
          addReceivedMessage(event.data);
        }
      };
      
      socket.onclose = (event) => {
        setStatus('disconnected');
        
        // Add detailed information about the close event
        const details = {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        };
        
        addInfoMessage(`WebSocket connection closed with code: ${event.code}`);
        addInfoMessage(`Close details: ${JSON.stringify(details, null, 2)}`);
        
        // Specific guidance for common close codes
        if (event.code === 1006) {
          addErrorMessage('Error 1006 indicates an abnormal closure (the connection was dropped without a proper close frame)');
          addInfoMessage('Possible causes: network issues, server restarting, proxy problems, or client navigation');
        }
      };
      
      socket.onerror = (event) => {
        setStatus('error');
        addErrorMessage('WebSocket error occurred - check console for details');
        console.error('WebSocket error:', event);
      };
      
      setWs(socket);
    } catch (error) {
      setStatus('error');
      addErrorMessage(`Failed to create WebSocket: ${error.message}`);
      console.error('WebSocket creation error:', error);
    }
  };
  
  // Disconnect from WebSocket
  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
      setStatus('disconnected');
      addInfoMessage('Manually disconnected from WebSocket');
    }
  };
  
  // Send a message over the WebSocket
  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageToSend);
        addSentMessage(messageToSend);
      } catch (error) {
        addErrorMessage(`Failed to send message: ${error.message}`);
      }
    } else {
      addErrorMessage('WebSocket is not connected');
    }
  };
  
  // Helper functions to add messages to the log
  const addSentMessage = (content: string) => {
    setMessages(prev => [...prev, { type: 'sent', content, timestamp: new Date() }]);
  };
  
  const addReceivedMessage = (content: string) => {
    setMessages(prev => [...prev, { type: 'received', content, timestamp: new Date() }]);
  };
  
  const addInfoMessage = (content: string) => {
    setMessages(prev => [...prev, { type: 'info', content, timestamp: new Date() }]);
  };
  
  const addErrorMessage = (content: string) => {
    setMessages(prev => [...prev, { type: 'error', content, timestamp: new Date() }]);
  };
  
  // Clear the message log
  const clearMessages = () => {
    setMessages([]);
  };
  
  // Auto-scroll the message container
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>WebSocket Connection Tester</CardTitle>
        <CardDescription>
          A simple tool to test direct WebSocket connections without the full MCP client implementation
        </CardDescription>
        
        <div className="flex items-center space-x-2 mt-2">
          <Badge variant={status === 'connected' ? 'default' : status === 'connecting' ? 'outline' : status === 'error' ? 'destructive' : 'secondary'}>
            {status === 'connecting' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ws-url">WebSocket URL</Label>
            <div className="flex gap-2">
              <Input 
                id="ws-url" 
                value={wsUrl} 
                onChange={(e) => setWsUrl(e.target.value)} 
                placeholder="wss://example.com/ws"
                className="flex-1"
              />
              {status === 'disconnected' || status === 'error' ? (
                <Button onClick={connect}>Connect</Button>
              ) : (
                <Button variant="destructive" onClick={disconnect}>Disconnect</Button>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <div className="flex gap-2">
              <Input 
                id="message" 
                value={messageToSend} 
                onChange={(e) => setMessageToSend(e.target.value)} 
                placeholder='{"type":"ping"}'
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={status !== 'connected'}>Send</Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label>Messages</Label>
              <Button variant="outline" size="sm" onClick={clearMessages}>Clear</Button>
            </div>
            <div className="border rounded-md p-2 h-[300px] overflow-y-auto bg-black/5 dark:bg-white/5">
              {messages.map((msg, index) => (
                <div key={index} className={`my-1 p-2 rounded text-sm ${
                  msg.type === 'sent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                  msg.type === 'received' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                  msg.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                  'bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-300'
                }`}>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold">{msg.type.toUpperCase()}</span>
                    <span className="text-xs opacity-70">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all">{msg.content}</pre>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <div className="text-xs text-muted-foreground">
          {ws && (
            <>
              <span>State: {
                ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                ws.readyState === WebSocket.OPEN ? 'OPEN' :
                ws.readyState === WebSocket.CLOSING ? 'CLOSING' :
                ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN'
              }</span>
              <span className="mx-2">·</span>
            </>
          )}
          <span>Protocol: {window.location.protocol}</span>
          <span className="mx-2">·</span>
          <span>Host: {window.location.host}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

export default SimpleWebsocketTest;