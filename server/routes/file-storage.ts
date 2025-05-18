/**
 * Enterprise File Storage API Routes
 * 
 * Provides endpoints for:
 * - Managing file storage integrations (create, update, delete, list)
 * - Browse file directories
 * - Search files
 * - Download files
 * - Upload files
 * - View file metadata
 * 
 * Supported providers:
 * - SharePoint (Microsoft 365)
 * - Box
 * - Dropbox Business
 * - Google Drive (Google Workspace)
 * - OneDrive for Business
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { fileStorageService } from '../services/integrations/FileStorageService';
import {
  fileStorageIntegrationInsertSchema,
  supportedProviders,
  authTypes
} from '@shared/schema_file_storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger, getChildLogger } from '../utils/logger';
import { db } from '@db';
import { fileStorageIntegrations, fileReferences, fileOperationsLog } from '@shared/schema_file_storage';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();
const routeLogger = getChildLogger(logger, { component: 'file-storage-routes' });

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// Middleware to ensure authenticated users only
router.use(requireAuth);

/**
 * List all integrations
 */
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const integrations = await fileStorageService.listIntegrations();
    res.json(integrations);
  } catch (error) {
    routeLogger.error('Failed to list integrations', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to list integrations', message: errorMessage });
  }
});

/**
 * Get integration by ID
 */
router.get('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const integration = await fileStorageService.getIntegration(id);
    res.json(integration);
  } catch (error) {
    routeLogger.error(`Failed to get integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to get integration', message: errorMessage });
  }
});

/**
 * Create new integration
 */
router.post('/integrations', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsedData = fileStorageIntegrationInsertSchema.parse(req.body);
    
    // Add user info if available
    if (req.user) {
      parsedData.createdBy = req.user.id;
    }
    
    const integration = await fileStorageService.createIntegration(parsedData);
    res.status(201).json(integration);
  } catch (error) {
    routeLogger.error('Failed to create integration', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to create integration', message: errorMessage });
  }
});

/**
 * Update integration
 */
router.put('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate request body
    const updateData = req.body;
    
    // Add user info if available
    if (req.user) {
      updateData.updatedBy = req.user.id;
    }
    
    const integration = await fileStorageService.updateIntegration(id, updateData);
    res.json(integration);
  } catch (error) {
    routeLogger.error(`Failed to update integration: ${req.params.id}`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to update integration', message: errorMessage });
  }
});

/**
 * Delete integration
 */
router.delete('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    await fileStorageService.deleteIntegration(id);
    res.status(204).end();
  } catch (error) {
    routeLogger.error(`Failed to delete integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to delete integration', message: errorMessage });
  }
});

/**
 * Test integration connection
 */
router.post('/integrations/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const result = await fileStorageService.testConnection(id);
    res.json(result);
  } catch (error) {
    routeLogger.error(`Failed to test integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to test integration', message: errorMessage });
  }
});

/**
 * List files in a folder
 */
router.get('/integrations/:id/files', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const folderId = req.query.folderId as string;
    const files = await fileStorageService.listFiles(id, folderId);
    res.json(files);
  } catch (error) {
    routeLogger.error(`Failed to list files for integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to list files', message: errorMessage });
  }
});

/**
 * Get file metadata
 */
router.get('/integrations/:id/files/:fileId', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const fileId = req.params.fileId;
    const file = await fileStorageService.getFile(id, fileId);
    res.json(file);
  } catch (error) {
    routeLogger.error(`Failed to get file metadata: ${req.params.fileId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to get file metadata', message: errorMessage });
  }
});

/**
 * Download a file
 */
router.get('/integrations/:id/files/:fileId/download', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const fileId = req.params.fileId;
    
    // Get file metadata for name and type
    const file = await fileStorageService.getFile(id, fileId);
    
    // Temporary path to download the file
    const tempPath = path.join('tmp', `download_${fileId}_${Date.now()}`);
    
    // Download the file
    const downloadedPath = await fileStorageService.downloadFile(id, fileId, tempPath);
    
    // Set content disposition and type
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    if (file.mimeType) {
      res.setHeader('Content-Type', file.mimeType);
    }
    
    // Stream the file and delete on completion
    const fileStream = fs.createReadStream(downloadedPath);
    fileStream.pipe(res);
    
    // Cleanup after sending
    fileStream.on('end', () => {
      fs.unlink(downloadedPath, (err) => {
        if (err) routeLogger.error(`Failed to delete temp file: ${downloadedPath}`, err);
      });
    });
  } catch (error) {
    routeLogger.error(`Failed to download file: ${req.params.fileId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: 'Failed to download file', message: errorMessage });
  }
});

/**
 * Upload a file
 */
router.post('/integrations/:id/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const folderPath = req.body.folderPath || '/';
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    
    // Upload the file
    const fileMetadata = await fileStorageService.uploadFile(id, folderPath, req.file.path, metadata);
    
    // Cleanup uploaded temp file
    fs.unlink(req.file.path, (err) => {
      if (err) routeLogger.error(`Failed to delete temp file: ${req.file.path}`, err);
    });
    
    res.status(201).json(fileMetadata);
  } catch (error) {
    routeLogger.error(`Failed to upload file to integration: ${req.params.id}`, error);
    
    // Cleanup uploaded temp file if exists
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) routeLogger.error(`Failed to delete temp file: ${req.file.path}`, err);
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to upload file', message: errorMessage });
  }
});

/**
 * Create folder
 */
router.post('/integrations/:id/folders', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const { parentFolderId, folderName } = req.body;
    
    if (!parentFolderId || !folderName) {
      return res.status(400).json({ error: 'Parent folder ID and folder name are required' });
    }
    
    const folder = await fileStorageService.createFolder(id, parentFolderId, folderName);
    res.status(201).json(folder);
  } catch (error) {
    routeLogger.error(`Failed to create folder in integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to create folder', message: errorMessage });
  }
});

/**
 * Delete file or folder
 */
router.delete('/integrations/:id/files/:fileId', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const fileId = req.params.fileId;
    const success = await fileStorageService.deleteFile(id, fileId);
    
    if (success) {
      res.status(204).end();
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } catch (error) {
    routeLogger.error(`Failed to delete file: ${req.params.fileId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to delete file', message: errorMessage });
  }
});

/**
 * Move a file or folder
 */
router.post('/integrations/:id/files/:fileId/move', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const fileId = req.params.fileId;
    const { newParentFolderId } = req.body;
    
    if (!newParentFolderId) {
      return res.status(400).json({ error: 'New parent folder ID is required' });
    }
    
    const file = await fileStorageService.moveFile(id, fileId, newParentFolderId);
    res.json(file);
  } catch (error) {
    routeLogger.error(`Failed to move file: ${req.params.fileId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to move file', message: errorMessage });
  }
});

/**
 * Search files
 */
router.get('/integrations/:id/search', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const files = await fileStorageService.searchFiles(id, query);
    res.json(files);
  } catch (error) {
    routeLogger.error(`Failed to search files in integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to search files', message: errorMessage });
  }
});

/**
 * Get operations log
 */
router.get('/integrations/:id/logs', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = await fileStorageService.getOperationsLog(id, limit);
    res.json(logs);
  } catch (error) {
    routeLogger.error(`Failed to get operation logs for integration: ${req.params.id}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to get operation logs', message: errorMessage });
  }
});

/**
 * Get supported providers and auth types
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    res.json({
      providers: supportedProviders,
      authTypes: authTypes
    });
  } catch (error) {
    routeLogger.error('Failed to get providers', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to get providers', message: errorMessage });
  }
});

export default router;