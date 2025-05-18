import express from 'express';
import { McpSettingsService } from '../services/mcp-settings-service';
import { registerMcpSettingsRoutes } from '../routes/mcp-settings-routes';

export function initMcpSettingsRoutes(mcpSettingsService: McpSettingsService): express.Router {
  const router = express.Router();
  
  // Register MCP settings routes
  registerMcpSettingsRoutes(router, mcpSettingsService);
  
  return router;
}