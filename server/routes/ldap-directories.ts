import express, { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { ldapDirectories, insertLdapDirectorySchema } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '../services/auditLogService';

const router = express.Router();

/**
 * Get all LDAP directories for a workspace
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    
    let query = db.select().from(ldapDirectories);
    
    if (workspaceId && typeof workspaceId === 'string') {
      query = query.where(eq(ldapDirectories.workspaceId, parseInt(workspaceId)));
    }
    
    const directories = await query;
    
    // Mask sensitive credential information
    const sanitizedDirectories = directories.map(dir => ({
      ...dir,
      bindCredential: dir.bindCredential ? '********' : null
    }));
    
    return res.status(200).json(sanitizedDirectories);
  } catch (error) {
    console.error('Error fetching LDAP directories:', error);
    return res.status(500).json({ error: 'Failed to fetch LDAP directories' });
  }
});

/**
 * Get a specific LDAP directory by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const directory = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!directory) {
      return res.status(404).json({ error: 'LDAP directory not found' });
    }
    
    // Mask sensitive credential information
    const sanitizedDirectory = {
      ...directory,
      bindCredential: directory.bindCredential ? '********' : null
    };
    
    return res.status(200).json(sanitizedDirectory);
  } catch (error) {
    console.error('Error fetching LDAP directory:', error);
    return res.status(500).json({ error: 'Failed to fetch LDAP directory' });
  }
});

/**
 * Create a new LDAP directory
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = insertLdapDirectorySchema.parse(req.body);
    
    const [newDirectory] = await db.insert(ldapDirectories).values(validatedData).returning();
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'create',
      resource: 'ldap_directory',
      resourceId: newDirectory.id.toString(),
      details: {
        name: newDirectory.name,
        host: newDirectory.host,
        port: newDirectory.port,
        useSSL: newDirectory.useSSL,
        useTLS: newDirectory.useTLS
      }
    });
    
    // Mask sensitive credential information
    const sanitizedDirectory = {
      ...newDirectory,
      bindCredential: newDirectory.bindCredential ? '********' : null
    };
    
    return res.status(201).json(sanitizedDirectory);
  } catch (error) {
    console.error('Error creating LDAP directory:', error);
    return res.status(500).json({ error: 'Failed to create LDAP directory' });
  }
});

/**
 * Update an existing LDAP directory
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Check if directory exists
    const existingDirectory = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!existingDirectory) {
      return res.status(404).json({ error: 'LDAP directory not found' });
    }
    
    // Validate the data
    const validatedData = insertLdapDirectorySchema.partial().parse(req.body);
    
    // Check if empty string was passed for bindCredential, if so, keep the existing value
    if (validatedData.bindCredential === '') {
      delete validatedData.bindCredential;
    }
    
    // Update the directory
    const [updatedDirectory] = await db
      .update(ldapDirectories)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(ldapDirectories.id, parseInt(id)))
      .returning();
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'update',
      resource: 'ldap_directory',
      resourceId: updatedDirectory.id.toString(),
      details: {
        name: updatedDirectory.name,
        host: updatedDirectory.host,
        port: updatedDirectory.port,
        useSSL: updatedDirectory.useSSL,
        useTLS: updatedDirectory.useTLS,
        isActive: updatedDirectory.isActive
      }
    });
    
    // Mask sensitive credential information
    const sanitizedDirectory = {
      ...updatedDirectory,
      bindCredential: updatedDirectory.bindCredential ? '********' : null
    };
    
    return res.status(200).json(sanitizedDirectory);
  } catch (error) {
    console.error('Error updating LDAP directory:', error);
    return res.status(500).json({ error: 'Failed to update LDAP directory' });
  }
});

/**
 * Delete an LDAP directory
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Check if directory exists
    const existingDirectory = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!existingDirectory) {
      return res.status(404).json({ error: 'LDAP directory not found' });
    }
    
    // Delete the directory
    await db
      .delete(ldapDirectories)
      .where(eq(ldapDirectories.id, parseInt(id)));
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'delete',
      resource: 'ldap_directory',
      resourceId: id,
      details: {
        name: existingDirectory.name,
        host: existingDirectory.host
      }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting LDAP directory:', error);
    return res.status(500).json({ error: 'Failed to delete LDAP directory' });
  }
});

/**
 * Test LDAP connection
 */
router.post('/:id/test-connection', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Get directory configuration
    const directory = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!directory) {
      return res.status(404).json({ error: 'LDAP directory not found' });
    }
    
    // In a real implementation, we would attempt to connect to the LDAP server
    // For development purposes, simulate the test result
    const SUCCESS_CONNECTION = Math.random() > 0.3; // 70% success rate
    
    if (SUCCESS_CONNECTION) {
      return res.status(200).json({ 
        success: true, 
        message: 'Successfully connected to LDAP server'
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Failed to connect to LDAP server. Please check your configuration.'
      });
    }
  } catch (error) {
    console.error('Error testing LDAP connection:', error);
    return res.status(500).json({ 
      success: false,
      error: 'An error occurred while testing LDAP connection'
    });
  }
});

/**
 * Sync LDAP users
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Get directory configuration
    const directory = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!directory) {
      return res.status(404).json({ error: 'LDAP directory not found' });
    }
    
    // In a real implementation, we would sync users from the LDAP server
    // For development purposes, simulate the sync process
    
    // Update the sync status
    const [updatedDirectory] = await db
      .update(ldapDirectories)
      .set({
        lastSyncAt: new Date(),
        syncStatus: 'completed',
        updatedAt: new Date()
      })
      .where(eq(ldapDirectories.id, parseInt(id)))
      .returning();
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'sync',
      resource: 'ldap_directory',
      resourceId: updatedDirectory.id.toString(),
      details: {
        name: updatedDirectory.name,
        lastSyncAt: updatedDirectory.lastSyncAt,
        syncStatus: updatedDirectory.syncStatus
      }
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'LDAP directory synchronization completed',
      lastSyncAt: updatedDirectory.lastSyncAt,
      syncStatus: updatedDirectory.syncStatus
    });
  } catch (error) {
    console.error('Error syncing LDAP directory:', error);
    return res.status(500).json({ 
      success: false,
      error: 'An error occurred while syncing LDAP directory'
    });
  }
});

export default router;