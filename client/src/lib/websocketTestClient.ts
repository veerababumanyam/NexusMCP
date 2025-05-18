/**
 * WebSocket Test Client
 * 
 * This file provides a simple test client for debugging WebSocket connections.
 * It's designed to test various WebSocket paths and ensure proper connection.
 */

// Import WebSocket utilities
import { createStableWebSocketUrl } from './websocketUtils';

/**
 * Test a WebSocket connection to a specific path
 */
export function testWebSocketConnection(path: string = '/ws/mcp-proxy'): void {
  console.log(`[WebSocket Test] Testing WebSocket connection to ${path}...`);
  
  try {
    // Create direct WebSocket connection using the WebSocket fix utility
    
    // Generate a unique URL with cache-busting parameter
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const cacheBuster = `_=${timestamp}-${randomString}`;
    
    // Use the stable URL constructor with the cache buster parameter
    const baseUrl = createStableWebSocketUrl(path);
    const wsUrl = `${baseUrl}?${cacheBuster}`;
    
    console.log(`[WebSocket Test] Using URL: ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = (event) => {
      console.log(`[WebSocket Test] Connection to ${path} opened successfully!`);
      
      // Send a test message
      const testMessage = { 
        type: 'test',
        message: 'Hello from test client',
        timestamp: new Date().toISOString()
      };
      
      console.log(`[WebSocket Test] Sending test message:`, testMessage);
      socket.send(JSON.stringify(testMessage));
    };
    
    socket.onmessage = (event) => {
      console.log(`[WebSocket Test] Received message from ${path}:`, event.data);
      try {
        const data = JSON.parse(event.data);
        console.log(`[WebSocket Test] Parsed message:`, data);
      } catch (error) {
        console.log(`[WebSocket Test] Message is not valid JSON:`, event.data);
      }
    };
    
    socket.onclose = (event) => {
      console.log(`[WebSocket Test] Connection to ${path} closed:`, event.code, event.reason);
    };
    
    socket.onerror = (event) => {
      console.error(`[WebSocket Test] Error for ${path}:`, event);
    };
    
    // Return cleanup function
    return () => {
      console.log(`[WebSocket Test] Closing test connection to ${path}...`);
      socket.close();
    };
  } catch (error) {
    console.error(`[WebSocket Test] Error creating WebSocket to ${path}:`, error);
  }
}

/**
 * Test all WebSocket endpoints
 */
export function testAllWebSocketEndpoints(): void {
  console.log('Testing all WebSocket endpoints...');
  
  // Test the general events endpoint
  const cleanupEvents = testWebSocketConnection('/ws/events');
  
  // Test the MCP proxy endpoint
  const cleanupMcp = testWebSocketConnection('/ws/mcp-proxy');
  
  // Cleanup after 10 seconds
  setTimeout(() => {
    console.log('Cleaning up test connections...');
    if (cleanupEvents) cleanupEvents();
    if (cleanupMcp) cleanupMcp();
  }, 10000);
}

export default {
  testWebSocketConnection,
  testAllWebSocketEndpoints
};