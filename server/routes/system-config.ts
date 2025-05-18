import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db'; 
import { systemModules, aiProviders } from '../../shared/schema_system';
import { eq } from 'drizzle-orm';
import { rbacService } from '../services/rbac-service';

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

// Permission middleware
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const hasPermission = await rbacService.hasPermission(req.user.id, permission);
      if (hasPermission) {
        return next();
      } else {
        return res.status(403).json({ message: `Missing required permission: ${permission}` });
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: 'Error checking permissions' });
    }
  };
}

const router = Router();

// Get all system modules
router.get('/modules', requireAuth, requirePermission('system:config:read'), async (req, res) => {
  try {
    const modules = await db.select().from(systemModules).orderBy(systemModules.displayName);
    return res.json(modules);
  } catch (error) {
    console.error('Error fetching system modules:', error);
    return res.status(500).json({ error: 'Failed to fetch system modules' });
  }
});

// Update module status (enable/disable)
router.patch('/modules/:id/toggle', requireAuth, requirePermission('system:config:write'), async (req, res) => {
  const { id } = req.params;
  
  try {
    const moduleId = parseInt(id);
    if (isNaN(moduleId)) {
      return res.status(400).json({ error: 'Invalid module ID' });
    }
    
    // Get current module status
    const module = await db.select().from(systemModules).where(eq(systemModules.id, moduleId)).limit(1);
    
    if (!module || module.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }
    
    // Toggle the enabled status
    const newStatus = !module[0].enabled;
    
    // Update the module
    const updatedModule = await db
      .update(systemModules)
      .set({ 
        enabled: newStatus,
        updatedAt: new Date()
      })
      .where(eq(systemModules.id, moduleId))
      .returning();
    
    return res.json(updatedModule[0]);
  } catch (error) {
    console.error('Error updating module status:', error);
    return res.status(500).json({ error: 'Failed to update module status' });
  }
});

// Get all AI providers
router.get('/ai-providers', requireAuth, requirePermission('system:config:read'), async (req, res) => {
  try {
    const providers = await db.select().from(aiProviders).orderBy(aiProviders.displayName);
    return res.json(providers);
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    return res.status(500).json({ error: 'Failed to fetch AI providers' });
  }
});

// Update AI provider configuration
router.patch('/ai-providers/:id', requireAuth, requirePermission('system:config:write'), async (req, res) => {
  const { id } = req.params;
  const { enabled, isDefault, configData } = req.body;
  
  try {
    const providerId = parseInt(id);
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    // Get current provider
    const provider = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).limit(1);
    
    if (!provider || provider.length === 0) {
      return res.status(404).json({ error: 'AI provider not found' });
    }
    
    // If setting this provider as default, unset any existing default
    if (isDefault) {
      await db
        .update(aiProviders)
        .set({ isDefault: false })
        .where(eq(aiProviders.isDefault, true));
    }
    
    // Update the provider
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (enabled !== undefined) updateData.enabled = enabled;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (configData !== undefined) updateData.configData = configData;
    
    const updatedProvider = await db
      .update(aiProviders)
      .set(updateData)
      .where(eq(aiProviders.id, providerId))
      .returning();
    
    return res.json(updatedProvider[0]);
  } catch (error) {
    console.error('Error updating AI provider:', error);
    return res.status(500).json({ error: 'Failed to update AI provider' });
  }
});

// Set API key for AI provider
router.post('/ai-providers/:id/api-key', requireAuth, requirePermission('system:config:write'), async (req, res) => {
  const { id } = req.params;
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }
  
  try {
    const providerId = parseInt(id);
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    // Get current provider config
    const provider = await db.select().from(aiProviders).where(eq(aiProviders.id, providerId)).limit(1);
    
    if (!provider || provider.length === 0) {
      return res.status(404).json({ error: 'AI provider not found' });
    }
    
    // Update config with new API key
    const currentConfig = provider[0].configData || {};
    const updatedConfig = { ...currentConfig, apiKey };
    
    const updatedProvider = await db
      .update(aiProviders)
      .set({ 
        configData: updatedConfig,
        updatedAt: new Date()
      })
      .where(eq(aiProviders.id, providerId))
      .returning();
    
    // Don't return the API key in the response for security
    const result = { ...updatedProvider[0] };
    if (result.configData && result.configData.apiKey) {
      result.configData = { ...result.configData, apiKey: '••••••••' };
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error updating AI provider API key:', error);
    return res.status(500).json({ error: 'Failed to update AI provider API key' });
  }
});

export default router;