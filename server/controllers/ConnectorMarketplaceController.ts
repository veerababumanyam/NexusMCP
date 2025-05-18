import { Request, Response } from 'express';
import { 
  connectorMarketplaceService, 
  ConnectorSearchOptions, 
  ConnectorType, 
  ConnectorStatus 
} from '../services/marketplace/ConnectorMarketplaceService';
import { 
  connectorInsertSchema, 
  connectorVersionInsertSchema, 
  connectorCategoryInsertSchema, 
  connectorPublisherInsertSchema,
  connectorReviewInsertSchema
} from '@shared/schema_marketplace';
import { z } from 'zod';
import { secureAuditService, AuditEventType, AuditEventSeverity } from '../services/audit/SecureAuditService';

/**
 * Controller for connector marketplace APIs
 */
export class ConnectorMarketplaceController {
  /**
   * Search connectors
   */
  public async searchConnectors(req: Request, res: Response): Promise<void> {
    try {
      const options: ConnectorSearchOptions = {
        query: req.query.query as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort: req.query.sort as string,
        order: (req.query.order as 'asc' | 'desc') || 'desc'
      };

      // Parse categories if provided
      if (req.query.categories) {
        try {
          options.categories = Array.isArray(req.query.categories)
            ? (req.query.categories as string[]).map(id => parseInt(id))
            : [(req.query.categories as string).split(',')].map(id => parseInt(id));
        } catch (e) {
          res.status(400).json({ error: 'Invalid categories parameter' });
          return;
        }
      }

      // Parse publishers if provided
      if (req.query.publishers) {
        try {
          options.publishers = Array.isArray(req.query.publishers)
            ? (req.query.publishers as string[]).map(id => parseInt(id))
            : [(req.query.publishers as string).split(',')].map(id => parseInt(id));
        } catch (e) {
          res.status(400).json({ error: 'Invalid publishers parameter' });
          return;
        }
      }

      // Parse tags if provided
      if (req.query.tags) {
        options.tags = Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : (req.query.tags as string).split(',');
      }

      // Parse type if provided
      if (req.query.type) {
        if (Object.values(ConnectorType).includes(req.query.type as ConnectorType)) {
          options.type = req.query.type as ConnectorType;
        } else {
          res.status(400).json({ error: 'Invalid connector type' });
          return;
        }
      }

      // Parse status if provided
      if (req.query.status) {
        if (Object.values(ConnectorStatus).includes(req.query.status as ConnectorStatus)) {
          options.status = req.query.status as ConnectorStatus;
        } else {
          res.status(400).json({ error: 'Invalid connector status' });
          return;
        }
      }

      // Parse boolean flags
      if (req.query.featured) {
        options.featured = req.query.featured === 'true';
      }

      if (req.query.verified) {
        options.verified = req.query.verified === 'true';
      }

      if (req.query.official) {
        options.official = req.query.official === 'true';
      }

      // Parse workspace ID if provided
      if (req.query.workspaceId) {
        try {
          options.workspaceId = parseInt(req.query.workspaceId as string);
        } catch (e) {
          res.status(400).json({ error: 'Invalid workspace ID' });
          return;
        }
      }

      const result = await connectorMarketplaceService.searchConnectors(options);
      res.json(result);
    } catch (error) {
      console.error('Error in searchConnectors:', error);
      res.status(500).json({ error: 'Failed to search connectors', message: error.message });
    }
  }

  /**
   * Get connector by ID or slug
   */
  public async getConnector(req: Request, res: Response): Promise<void> {
    try {
      const idOrSlug = req.params.idOrSlug;
      
      // Determine if ID or slug
      const id = !isNaN(parseInt(idOrSlug)) ? parseInt(idOrSlug) : null;
      
      const connector = await connectorMarketplaceService.getConnector(id || idOrSlug);
      
      if (!connector) {
        res.status(404).json({ error: 'Connector not found' });
        return;
      }
      
      res.json(connector);
    } catch (error) {
      console.error('Error in getConnector:', error);
      res.status(500).json({ error: 'Failed to retrieve connector', message: error.message });
    }
  }

  /**
   * Create a new connector
   */
  public async createConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      // Validate request body
      try {
        connectorInsertSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: validationError.errors });
          return;
        }
      }
      
      const connector = await connectorMarketplaceService.createConnector(req.body, req.user.id);
      res.status(201).json(connector);
    } catch (error) {
      console.error('Error in createConnector:', error);
      res.status(error.message.includes('Permission denied') ? 403 : 500)
        .json({ error: 'Failed to create connector', message: error.message });
    }
  }

  /**
   * Update a connector
   */
  public async updateConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      // Validate request body (partial validation for update)
      try {
        connectorInsertSchema.partial().parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: validationError.errors });
          return;
        }
      }
      
      const connector = await connectorMarketplaceService.updateConnector(id, req.body, req.user.id);
      res.json(connector);
    } catch (error) {
      console.error('Error in updateConnector:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update connector', message: error.message });
      }
    }
  }

  /**
   * Delete a connector
   */
  public async deleteConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      const result = await connectorMarketplaceService.deleteConnector(id, req.user.id);
      
      if (result) {
        res.status(204).end(); // Successfully deleted
      } else {
        res.status(200).json({ message: 'Connector was marked as deprecated instead of being deleted because it has active installations' });
      }
    } catch (error) {
      console.error('Error in deleteConnector:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete connector', message: error.message });
      }
    }
  }

  /**
   * Create a new connector version
   */
  public async createConnectorVersion(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const connectorId = parseInt(req.params.connectorId);
      if (isNaN(connectorId)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      // Validate request body
      try {
        connectorVersionInsertSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: validationError.errors });
          return;
        }
      }
      
      const version = await connectorMarketplaceService.createConnectorVersion(
        connectorId,
        req.body,
        req.user.id
      );
      
      res.status(201).json(version);
    } catch (error) {
      console.error('Error in createConnectorVersion:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else if (error.message.includes('already exists')) {
        res.status(409).json({ error: 'Version conflict', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create connector version', message: error.message });
      }
    }
  }

  /**
   * Install a connector
   */
  public async installConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const connectorId = parseInt(req.params.connectorId);
      if (isNaN(connectorId)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      // Parse options from request body
      const options = {
        userId: req.user.id,
        workspaceId: req.body.workspaceId ? parseInt(req.body.workspaceId) : undefined,
        versionId: req.body.versionId ? parseInt(req.body.versionId) : undefined,
        settings: req.body.settings
      };
      
      const installation = await connectorMarketplaceService.installConnector(connectorId, options);
      res.status(201).json(installation);
    } catch (error) {
      console.error('Error in installConnector:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector or version not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to install connector', message: error.message });
      }
    }
  }

  /**
   * Get user installations
   */
  public async getUserInstallations(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const workspaceId = req.query.workspaceId 
        ? parseInt(req.query.workspaceId as string)
        : undefined;
      
      const installations = await connectorMarketplaceService.getUserInstallations(
        req.user.id,
        workspaceId
      );
      
      res.json(installations);
    } catch (error) {
      console.error('Error in getUserInstallations:', error);
      res.status(500).json({ error: 'Failed to retrieve installations', message: error.message });
    }
  }

  /**
   * Get marketplace statistics
   */
  public async getMarketplaceStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await connectorMarketplaceService.getMarketplaceStats();
      res.json(stats);
    } catch (error) {
      console.error('Error in getMarketplaceStats:', error);
      res.status(500).json({ error: 'Failed to retrieve marketplace statistics', message: error.message });
    }
  }

  /**
   * Submit review for a connector
   */
  public async reviewConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const connectorId = parseInt(req.params.connectorId);
      if (isNaN(connectorId)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      // Validate request body
      try {
        connectorReviewInsertSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: validationError.errors });
          return;
        }
      }
      
      const review = await connectorMarketplaceService.reviewConnector(connectorId, {
        userId: req.user.id,
        rating: req.body.rating,
        title: req.body.title,
        content: req.body.content
      });
      
      res.status(201).json(review);
    } catch (error) {
      console.error('Error in reviewConnector:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to submit review', message: error.message });
      }
    }
  }

  /**
   * Approve a connector
   */
  public async approveConnector(req: Request, res: Response): Promise<void> {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const connectorId = parseInt(req.params.connectorId);
      if (isNaN(connectorId)) {
        res.status(400).json({ error: 'Invalid connector ID' });
        return;
      }
      
      const connector = await connectorMarketplaceService.approveConnector(connectorId, req.user.id);
      res.json(connector);
    } catch (error) {
      console.error('Error in approveConnector:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
      } else if (error.message.includes('Permission denied')) {
        res.status(403).json({ error: 'Permission denied', message: error.message });
      } else {
        res.status(500).json({ error: 'Failed to approve connector', message: error.message });
      }
    }
  }
}

// Export singleton instance
export const connectorMarketplaceController = new ConnectorMarketplaceController();