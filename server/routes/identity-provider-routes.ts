/**
 * Identity Provider Routes
 * 
 * Implements routes for managing identity providers that support OAuth 2.1 Client Credentials flow
 * and other authentication/authorization methods.
 */

import { Express } from 'express';
import { requireAuth, requireAdmin } from '../auth';
import { authProviderController } from '../presentation/AuthProviderController';

export function registerIdentityProviderRoutes(app: Express) {
  const apiPrefix = '/api';
  
  // Provider management routes (admin access required)
  app.get(`${apiPrefix}/auth-providers`, requireAdmin, authProviderController.getAllProviders);
  app.get(`${apiPrefix}/auth-providers/:id`, requireAdmin, authProviderController.getProviderById);
  app.post(`${apiPrefix}/auth-providers`, requireAdmin, authProviderController.createProvider);
  app.put(`${apiPrefix}/auth-providers/:id`, requireAdmin, authProviderController.updateProvider);
  app.delete(`${apiPrefix}/auth-providers/:id`, requireAdmin, authProviderController.deleteProvider);
  app.patch(`${apiPrefix}/auth-providers/:id/toggle`, requireAdmin, authProviderController.toggleProviderStatus);
  
  // Scope management routes
  app.get(`${apiPrefix}/oauth/providers/:id/scopes`, requireAuth, authProviderController.getProviderScopes);
  
  // Provider connection test routes
  app.post(`${apiPrefix}/auth-providers/:id/test`, requireAdmin, authProviderController.testProviderConnection);
}