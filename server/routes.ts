import { Express } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { createWebSocketServer } from './websocket/websocket-server';
import { setupAuth } from './auth';
import { registerEnhancedBreachDetectionRoutes } from './routes/enhanced-breach-detection-route-register';
import securityRoutes from './routes/security-routes';

/**
 * Register routes and set up the server
 * @param app Express application
 * @returns HTTP server
 */
export function registerRoutes(app: Express): HttpServer {
  // Set up HTTP server
  const httpServer = createServer(app);
  
  // Setup authentication
  setupAuth(app);
  
  // Set up WebSocket server
  const wsServer = createWebSocketServer(httpServer, {
    path: '/ws/mcp-proxy',
    debug: true
  });

  // API routes
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      connectedClients: wsServer ? 'active' : 'inactive'
    });
  });

  // Public branding route (no auth required)
  app.get('/api/public-branding', (req, res) => {
    res.json({
      appName: 'NexusMCP',
      logo: '/logo.png',
      primaryColor: '#3b5998',
      secondaryColor: '#1877f2',
      accentColor: '#4bb543',
      companyName: 'NexusMCP Enterprise',
      darkMode: true,
      loginBackgroundUrl: ''
    });
  });

  // Register Enhanced Breach Detection Routes
  registerEnhancedBreachDetectionRoutes(app);
  
  // Register Security Scanner Routes
  app.use('/api/security', securityRoutes);

  // Add more API routes here...

  return httpServer;
}