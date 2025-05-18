#!/usr/bin/env node

/**
 * MCP STDIO Proxy
 * 
 * This companion tool allows local clients to connect to the MCP Gateway
 * via standard input/output (STDIO) pipes. It handles:
 * 
 * 1. Authentication to the MCP Gateway using API key
 * 2. JSON-RPC request formatting and forwarding
 * 3. SSE Event handling and response streaming
 * 4. Error handling and reconnection
 * 
 * Usage:
 *   npx ts-node stdio-proxy.ts --api-key=YOUR_API_KEY --endpoint=https://your-mcp-gateway.com
 * 
 * The proxy reads JSON-RPC requests from stdin and outputs responses to stdout.
 */

import * as readline from 'readline';
import axios from 'axios';
import * as https from 'https';
import * as EventSource from 'eventsource';
import { v4 as uuidv4 } from 'uuid';
import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs';
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Configuration with defaults
const DEFAULT_CONFIG = {
  endpoint: 'http://localhost:5000',
  apiKey: '',
  timeout: 60000,
  reconnectDelay: 3000,
  maxReconnects: 5
};

// Setup CLI arguments
const argv = yargs(hideBin(process.argv))
  .option('api-key', {
    alias: 'k',
    description: 'API key for authentication with MCP Gateway',
    type: 'string'
  })
  .option('endpoint', {
    alias: 'e',
    description: 'MCP Gateway endpoint URL',
    type: 'string'
  })
  .option('timeout', {
    alias: 't',
    description: 'Request timeout in milliseconds',
    type: 'number',
    default: DEFAULT_CONFIG.timeout
  })
  .option('config', {
    alias: 'c',
    description: 'Path to config file',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Load configuration from file if specified
let config = { ...DEFAULT_CONFIG };
if (argv.config) {
  try {
    const configPath = path.resolve(argv.config as string);
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...fileConfig };
    } else {
      console.error(`Config file not found: ${configPath}`);
    }
  } catch (error) {
    console.error(`Error loading config file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Override with command line arguments
if (argv['api-key']) config.apiKey = argv['api-key'] as string;
if (argv.endpoint) config.endpoint = argv.endpoint as string;
if (argv.timeout) config.timeout = argv.timeout as number;

// Validate configuration
if (!config.apiKey) {
  console.error('Error: API key is required. Use --api-key or set in config file.');
  process.exit(1);
}

if (!config.endpoint) {
  console.error('Error: Endpoint URL is required. Use --endpoint or set in config file.');
  process.exit(1);
}

// Setup HTTP client
const httpClient = axios.create({
  baseURL: config.endpoint,
  timeout: config.timeout,
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: process.env.NODE_ENV !== 'development'
  })
});

// Create interface for reading from stdin
const rlInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Track pending requests
const pendingRequests = new Map<string, {
  id: string | number;
  startTime: number;
  chunks: any[];
}>();

// SSE connection state
let eventSource: EventSource | null = null;
let connected = false;
let reconnectCount = 0;
let connectionId: string | null = null;

/**
 * Connect to the SSE endpoint
 */
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  const sseUrl = `${config.endpoint}/sse/mcp`;
  console.error(`Connecting to SSE endpoint: ${sseUrl}`);

  eventSource = new EventSource(sseUrl, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`
    }
  });

  eventSource.onopen = () => {
    connected = true;
    reconnectCount = 0;
    console.error('SSE connection established');
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    
    if (connected) {
      connected = false;
      eventSource?.close();
      eventSource = null;
      
      if (reconnectCount < config.maxReconnects) {
        reconnectCount++;
        console.error(`Reconnecting in ${config.reconnectDelay}ms (attempt ${reconnectCount}/${config.maxReconnects})...`);
        setTimeout(connectSSE, config.reconnectDelay);
      } else {
        console.error(`Maximum reconnect attempts (${config.maxReconnects}) reached. Exiting.`);
        process.exit(1);
      }
    }
  };

  // Handle connection event
  eventSource.addEventListener('connection', (event) => {
    try {
      const data = JSON.parse(event.data);
      connectionId = data.clientId;
      console.error(`Connection established with ID: ${connectionId}`);
    } catch (error) {
      console.error('Error parsing connection event:', error);
    }
  });

  // Handle server status updates
  eventSource.addEventListener('server_status', (event) => {
    try {
      const data = JSON.parse(event.data);
      const serverCount = data.servers?.length || 0;
      console.error(`Received server status: ${serverCount} servers available`);
    } catch (error) {
      console.error('Error parsing server status event:', error);
    }
  });

  // Handle chunks
  eventSource.addEventListener('chunk', (event) => {
    try {
      const data = JSON.parse(event.data);
      const requestId = data.request_id;
      
      if (pendingRequests.has(requestId.toString())) {
        const request = pendingRequests.get(requestId.toString())!;
        request.chunks.push(data.chunk);
      }
    } catch (error) {
      console.error('Error handling chunk:', error);
    }
  });

  // Handle result
  eventSource.addEventListener('result', (event) => {
    try {
      const data = JSON.parse(event.data);
      const requestId = data.request_id;
      
      if (pendingRequests.has(requestId.toString())) {
        const request = pendingRequests.get(requestId.toString())!;
        
        // Construct full JSON-RPC response
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: data.result
        };
        
        // Output to stdout
        console.log(JSON.stringify(response));
        
        // Clean up request tracking
        pendingRequests.delete(requestId.toString());
      }
    } catch (error) {
      console.error('Error handling result:', error);
    }
  });

  // Handle errors
  eventSource.addEventListener('error', (event) => {
    try {
      const data = JSON.parse(event.data);
      const requestId = data.request_id;
      
      if (pendingRequests.has(requestId.toString())) {
        const request = pendingRequests.get(requestId.toString())!;
        
        // Construct JSON-RPC error response
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: data.error
        };
        
        // Output to stdout
        console.log(JSON.stringify(response));
        
        // Clean up request tracking
        pendingRequests.delete(requestId.toString());
      }
    } catch (error) {
      console.error('Error handling error event:', error);
    }
  });

  // Handle end of stream
  eventSource.addEventListener('end', (event) => {
    try {
      const data = JSON.parse(event.data);
      const requestId = data.request_id;
      
      // Just clean up if not already handled
      if (pendingRequests.has(requestId.toString())) {
        pendingRequests.delete(requestId.toString());
      }
    } catch (error) {
      console.error('Error handling end event:', error);
    }
  });

  // Handle keepalive heartbeats
  eventSource.addEventListener('heartbeat', () => {
    // Silent handling of heartbeats
  });
}

/**
 * Send a JSON-RPC request to the MCP Gateway
 */
async function sendRequest(request: any) {
  try {
    // Add metadata for tracking
    const requestId = request.id || uuidv4();
    request.id = requestId;
    
    // Store request in pending requests
    pendingRequests.set(requestId.toString(), {
      id: requestId,
      startTime: Date.now(),
      chunks: []
    });
    
    // Send the request
    await httpClient.post('/api/mcp/request', request);
    
    // Request has been sent successfully,
    // responses will come back through the SSE connection
  } catch (error) {
    // Handle HTTP error (not MCP protocol error)
    console.error('Error sending request:', error);
    
    // Remove from pending
    if (request.id) {
      pendingRequests.delete(request.id.toString());
    }
    
    // Output error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: request.id || null,
      error: {
        code: -32603,
        message: `Error sending request: ${error instanceof Error ? error.message : String(error)}`
      }
    };
    
    console.log(JSON.stringify(errorResponse));
  }
}

// Connect to SSE endpoint
connectSSE();

// Process input from stdin
rlInterface.on('line', async (line) => {
  try {
    // Skip empty lines
    if (!line.trim()) return;
    
    // Parse JSON input
    const request = JSON.parse(line);
    
    // Validate as JSON-RPC request
    if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid JSON-RPC request'
        }
      };
      console.log(JSON.stringify(errorResponse));
      return;
    }
    
    // Send the request
    await sendRequest(request);
  } catch (error) {
    // Handle JSON parsing errors
    console.error('Error processing input:', error);
    
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      }
    };
    
    console.log(JSON.stringify(errorResponse));
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('Received SIGINT, closing connections...');
  if (eventSource) {
    eventSource.close();
  }
  rlInterface.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, closing connections...');
  if (eventSource) {
    eventSource.close();
  }
  rlInterface.close();
  process.exit(0);
});

// Initial message
console.error(`MCP STDIO Proxy initialized`);
console.error(`Endpoint: ${config.endpoint}`);
console.error(`Waiting for JSON-RPC requests on stdin...`);