import { Router, Request, Response, NextFunction } from 'express';
import { connectorMarketplaceController } from '../controllers/ConnectorMarketplaceController';

// Extend Express User type
declare global {
  namespace Express {
    interface User {
      id: number;
      role: string;
    }
  }
}

const router = Router();

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Role check middleware
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userRole = req.user?.role;
    
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    
    next();
  };
}

/**
 * Connector Marketplace Routes
 * Provides an enterprise-grade connector and plugin ecosystem for
 * extending platform functionality and integrating with external systems
 */

// Public routes - available without authentication

// Search connectors
router.get('/connectors', connectorMarketplaceController.searchConnectors.bind(connectorMarketplaceController));

// Get single connector by ID or slug
router.get('/connectors/:idOrSlug', connectorMarketplaceController.getConnector.bind(connectorMarketplaceController));

// Get marketplace statistics
router.get('/stats', connectorMarketplaceController.getMarketplaceStats.bind(connectorMarketplaceController));

// Protected routes - require authentication

// Create new connector
router.post('/connectors', 
  requireAuth,
  connectorMarketplaceController.createConnector.bind(connectorMarketplaceController)
);

// Update a connector
router.put('/connectors/:id', 
  requireAuth,
  connectorMarketplaceController.updateConnector.bind(connectorMarketplaceController)
);

// Delete a connector
router.delete('/connectors/:id', 
  requireAuth,
  connectorMarketplaceController.deleteConnector.bind(connectorMarketplaceController)
);

// Create a new connector version
router.post('/connectors/:connectorId/versions', 
  requireAuth,
  connectorMarketplaceController.createConnectorVersion.bind(connectorMarketplaceController)
);

// Install a connector
router.post('/connectors/:connectorId/install', 
  requireAuth,
  connectorMarketplaceController.installConnector.bind(connectorMarketplaceController)
);

// Get user's connector installations
router.get('/installations', 
  requireAuth, 
  connectorMarketplaceController.getUserInstallations.bind(connectorMarketplaceController)
);

// Submit review for a connector
router.post('/connectors/:connectorId/reviews', 
  requireAuth,
  connectorMarketplaceController.reviewConnector.bind(connectorMarketplaceController)
);

// Admin routes - require admin role
router.post('/connectors/:connectorId/approve',
  requireAuth,
  requireRole(['admin', 'marketplace_admin']),
  connectorMarketplaceController.approveConnector.bind(connectorMarketplaceController)
);

export default router;