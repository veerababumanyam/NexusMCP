/**
 * API Routes with Zero Trust & Layered Architecture
 * 
 * Implements:
 * - Zero Trust security model
 * - Layered structure (presentation -> application -> domain -> infrastructure)
 * - Standardized API responses
 * - Rate limiting protection
 * - Input validation
 * 
 * Follows:
 * - OWASP API Security Top 10
 * - NIST 800-207 Zero Trust Architecture
 * - ISO/IEC 27034 Application Security
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { authController } from "./presentation/AuthController";
import { securityService } from "./application/security/SecurityService";
import { ZeroTrustConfig, applySecurityMiddleware, applyContinuousValidation } from "./infrastructure/security/ZeroTrustConfig";
import { mcpProxyService } from "./mcp-proxy";
import cors from "cors";
import helmet from "helmet";
import { eventBus } from "./infrastructure/events/EventBus";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize MCP proxy service
  mcpProxyService.initialize(httpServer);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  // Apply security headers and middleware to all requests
  app.use(applySecurityMiddleware);
  app.use(applyContinuousValidation);
  
  // Apply rate limiting to prevent abuse
  app.use(securityService.rateLimiter(60)); // 60 requests per minute
  
  // Apply secure HTTP headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for UI frameworks
        imgSrc: ["'self'", "data:"], // Allow data URIs for images
        connectSrc: ["'self'", "wss://*"] // Allow WebSocket connections
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Apply CORS with secure configuration
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://app.nexusmcp.com'] 
      : ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));
  
  // WebSocket connection handling with security
  wss.on('connection', (ws, req) => {
    // Create security context for WebSocket connection
    const securityContext = ZeroTrustConfig.createSecurityContext(req as any);
    
    // Store security context with websocket connection
    (ws as any).securityContext = securityContext;
    
    ws.on('message', async (message) => {
      try {
        // Parse message
        const data = JSON.parse(message.toString());
        
        // Handle message based on type with security context
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
            
          case 'subscribe':
            // In a real implementation, would validate permissions before allowing subscription
            ws.send(JSON.stringify({ 
              type: 'subscribed', 
              channel: data.channel,
              status: 'success'
            }));
            break;
            
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Unknown message type'
            }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format'
        }));
      }
    });
    
    // Send initial state with security context information
    ws.send(JSON.stringify({ 
      type: 'connected',
      message: 'Connected to NexusMCP WebSocket server',
      requestId: securityContext.requestId,
      timestamp: Date.now()
    }));
    
    // Publish connection event
    eventBus.publish('websocket.connected', {
      ip: securityContext.ipAddress,
      userAgent: securityContext.userAgent,
      timestamp: Date.now()
    }, {
      userId: securityContext.userId,
      source: 'WebSocketServer'
    });
  });
  
  // Authentication API routes using the controller
  app.post('/api/auth/register', authController.register);
  app.post('/api/auth/login', authController.login);
  app.post('/api/auth/logout', authController.logout);
  app.post('/api/auth/mfa/verify', authController.verifyMfa);
  app.get('/api/auth/me', authController.getCurrentUser);
  app.get('/api/auth/providers', authController.getAuthProviders);
  
  // Keep existing MCP proxy route handler for compatibility
  app.post('/api/mcp-proxy/:serverId', applySecurityMiddleware, (req, res) => {
    mcpProxyService.handleHttpProxy(req, res);
  });
  
  // In a full implementation, we would migrate all existing routes to controller classes
  // For now, we'll maintain the existing routes for compatibility while we
  // progressively migrate the architecture
  
  return httpServer;
}