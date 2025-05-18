import { Router } from 'express';
import { connectionPoolService, LoadBalancingStrategy } from '../services/connectionPoolService';
import { z } from 'zod';

export const connectionPoolRouter = Router();

// Schema for updating connection pool configuration
const poolConfigSchema = z.object({
  loadBalancingStrategy: z.enum([
    'round-robin',
    'least-connections',
    'least-failures',
    'weighted-round-robin',
    'random',
    'consistent-hash'
  ] as [string, ...string[]]).optional(),
  healthCheckIntervalMs: z.number().int().positive().optional(),
  healthCheckTimeoutMs: z.number().int().positive().optional(),
  failureThreshold: z.number().int().min(1).optional(),
  recoveryThreshold: z.number().int().min(1).optional(),
  maxConnectionsPerServer: z.number().int().min(1).optional(),
  connectionTimeoutMs: z.number().int().positive().optional(),
  enableCircuitBreaker: z.boolean().optional(),
  retryBackoffMs: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
});

// Schema for adding/updating a server
const serverSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  weight: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  maxConnections: z.number().int().min(1).optional(),
});

// Get connection pool information including stats, servers and config
connectionPoolRouter.get('/', async (req, res) => {
  try {
    // Make sure the service is initialized
    if (!connectionPoolService.isInitialized) {
      await connectionPoolService.initialize();
    }
    
    res.json({
      stats: connectionPoolService.getPoolStats(),
      servers: connectionPoolService.getAllServers(),
      config: connectionPoolService.getConfiguration()
    });
  } catch (error) {
    console.error('Error getting connection pool information:', error);
    res.status(500).json({ 
      error: 'Failed to get connection pool information',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update connection pool configuration
connectionPoolRouter.put('/config', async (req, res) => {
  try {
    const config = poolConfigSchema.parse(req.body);
    await connectionPoolService.updateConfiguration(config);
    
    // Return the updated configuration
    res.json({
      message: 'Connection pool configuration updated successfully',
      config: connectionPoolService.getConfiguration()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid configuration', 
        details: error.errors 
      });
    }
    
    console.error('Error updating connection pool configuration:', error);
    res.status(500).json({ 
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get all servers in pool
connectionPoolRouter.get('/servers', (req, res) => {
  try {
    const servers = connectionPoolService.getAllServers();
    res.json(servers);
  } catch (error) {
    console.error('Error getting servers:', error);
    res.status(500).json({ 
      error: 'Failed to get servers',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get a specific server
connectionPoolRouter.get('/servers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    const server = connectionPoolService.getServer(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json(server);
  } catch (error) {
    console.error('Error getting server:', error);
    res.status(500).json({ 
      error: 'Failed to get server',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Add a new server to the pool
connectionPoolRouter.post('/servers', async (req, res) => {
  try {
    const serverData = serverSchema.parse(req.body);
    
    // Get the highest existing ID to determine the next ID
    const servers = connectionPoolService.getAllServers();
    const maxId = servers.reduce((max, server) => Math.max(max, server.id), 0);
    const newId = maxId + 1;
    
    const server = connectionPoolService.addServer(newId, serverData);
    
    // Create audit log
    await req.storage.createAuditLog({
      userId: req.user!.id,
      action: 'create',
      resourceType: 'server-pool',
      resourceId: server.id.toString(),
      details: { serverName: server.name, url: server.url },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      message: 'Server added to connection pool successfully',
      server
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid server data', 
        details: error.errors 
      });
    }
    
    console.error('Error adding server:', error);
    res.status(500).json({ 
      error: 'Failed to add server',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update an existing server
connectionPoolRouter.put('/servers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Check if server exists
    const existingServer = connectionPoolService.getServer(id);
    if (!existingServer) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Validate update data
    const serverData = serverSchema.parse(req.body);
    
    // Remove server and re-add with updated data
    connectionPoolService.removeServer(id);
    const server = connectionPoolService.addServer(id, serverData);
    
    // Create audit log
    await req.storage.createAuditLog({
      userId: req.user!.id,
      action: 'update',
      resourceType: 'server-pool',
      resourceId: server.id.toString(),
      details: { serverName: server.name, url: server.url },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      message: 'Server updated successfully',
      server
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid server data', 
        details: error.errors 
      });
    }
    
    console.error('Error updating server:', error);
    res.status(500).json({ 
      error: 'Failed to update server',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Remove a server from the pool
connectionPoolRouter.delete('/servers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Check if server exists
    const existingServer = connectionPoolService.getServer(id);
    if (!existingServer) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Remove server
    const success = connectionPoolService.removeServer(id);
    
    if (success) {
      // Create audit log
      await req.storage.createAuditLog({
        userId: req.user!.id,
        action: 'delete',
        resourceType: 'server-pool',
        resourceId: id.toString(),
        details: { serverName: existingServer.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({
        message: 'Server removed successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to remove server' });
    }
  } catch (error) {
    console.error('Error removing server:', error);
    res.status(500).json({ 
      error: 'Failed to remove server',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Toggle server active state
connectionPoolRouter.post('/servers/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Validate body
    const { isActive } = z.object({
      isActive: z.boolean()
    }).parse(req.body);
    
    // Get server
    const server = connectionPoolService.getServer(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Toggle server state
    const success = connectionPoolService.setServerActive(id, isActive);
    
    if (success) {
      // Create audit log
      await req.storage.createAuditLog({
        userId: req.user!.id,
        action: 'update',
        resourceType: 'server-pool',
        resourceId: id.toString(),
        details: { 
          serverName: server.name, 
          action: isActive ? 'activate' : 'deactivate' 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({
        message: `Server ${isActive ? 'activated' : 'deactivated'} successfully`,
        server: connectionPoolService.getServer(id)
      });
    } else {
      res.status(500).json({ error: 'Failed to update server state' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    
    console.error('Error toggling server state:', error);
    res.status(500).json({ 
      error: 'Failed to toggle server state',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update server weight
connectionPoolRouter.put('/servers/:id/weight', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Validate body
    const { weight } = z.object({
      weight: z.number().int().min(1)
    }).parse(req.body);
    
    // Get server
    const server = connectionPoolService.getServer(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Update weight
    const success = connectionPoolService.setServerWeight(id, weight);
    
    if (success) {
      // Create audit log
      await req.storage.createAuditLog({
        userId: req.user!.id,
        action: 'update',
        resourceType: 'server-pool',
        resourceId: id.toString(),
        details: { 
          serverName: server.name, 
          weight: weight,
          previousWeight: server.weight
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({
        message: 'Server weight updated successfully',
        server: connectionPoolService.getServer(id)
      });
    } else {
      res.status(500).json({ error: 'Failed to update server weight' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid weight value', 
        details: error.errors 
      });
    }
    
    console.error('Error updating server weight:', error);
    res.status(500).json({ 
      error: 'Failed to update server weight',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Manually initiate a health check for a server
connectionPoolRouter.post('/servers/:id/health-check', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Get server
    const server = connectionPoolService.getServer(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Perform health check
    const status = await connectionPoolService.checkServerHealth(id);
    
    // Get updated server after health check
    const updatedServer = connectionPoolService.getServer(id);
    
    res.json({
      message: `Server health check completed with status: ${status}`,
      status,
      server: updatedServer
    });
  } catch (error) {
    console.error('Error running health check:', error);
    res.status(500).json({ 
      error: 'Failed to run health check',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Attempt recovery for a server
connectionPoolRouter.post('/servers/:id/recovery', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    // Get server
    const server = connectionPoolService.getServer(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Attempt recovery
    const success = await connectionPoolService.attemptServerRecovery(id);
    
    // Create audit log
    await req.storage.createAuditLog({
      userId: req.user!.id,
      action: 'update',
      resourceType: 'server-pool',
      resourceId: id.toString(),
      details: { 
        serverName: server.name, 
        action: 'recovery-attempt',
        success
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Get updated server after recovery attempt
    const updatedServer = connectionPoolService.getServer(id);
    
    res.json({
      message: success ? 'Server recovery successful' : 'Server recovery failed',
      success,
      server: updatedServer
    });
  } catch (error) {
    console.error('Error attempting server recovery:', error);
    res.status(500).json({ 
      error: 'Failed to attempt recovery',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get next server based on current load balancing strategy
connectionPoolRouter.get('/next-server', (req, res) => {
  try {
    const server = connectionPoolService.getNextServer();
    
    if (!server) {
      return res.status(503).json({ 
        error: 'No available servers',
        message: 'No servers are currently available in the pool' 
      });
    }
    
    res.json({
      message: 'Next server selected based on load balancing strategy',
      server,
      strategy: connectionPoolService.getConfiguration().loadBalancingStrategy
    });
  } catch (error) {
    console.error('Error getting next server:', error);
    res.status(500).json({ 
      error: 'Failed to get next server',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Change load balancing strategy
connectionPoolRouter.put('/load-balancing-strategy', async (req, res) => {
  try {
    const { strategy } = z.object({
      strategy: z.enum([
        'round-robin',
        'least-connections',
        'least-failures',
        'weighted-round-robin',
        'random',
        'consistent-hash'
      ] as [string, ...string[]])
    }).parse(req.body);
    
    connectionPoolService.setLoadBalancingStrategy(strategy as LoadBalancingStrategy);
    
    // Create audit log
    await req.storage.createAuditLog({
      userId: req.user!.id,
      action: 'update',
      resourceType: 'server-pool',
      resourceId: 'load-balancing',
      details: { 
        strategy,
        previousStrategy: connectionPoolService.getConfiguration().loadBalancingStrategy
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      message: 'Load balancing strategy updated successfully',
      strategy,
      config: connectionPoolService.getConfiguration()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid strategy', 
        details: error.errors 
      });
    }
    
    console.error('Error setting load balancing strategy:', error);
    res.status(500).json({ 
      error: 'Failed to set load balancing strategy',
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});