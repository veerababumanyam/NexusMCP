import { apiRequest } from '@/lib/queryClient';

// Types for MCP servers
export interface MCPServer {
  id: number;
  name: string;
  endpoint: string;
  apiVersion: string;
  authType: string;
  status: 'active' | 'inactive' | 'degraded' | 'maintenance';
  rateLimit: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
  capabilities?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

// API functions for MCP servers
async function getServers() {
  const response = await apiRequest('GET', '/api/mcp-servers');
  return response.json();
}

async function getServerById(id: string) {
  const response = await apiRequest('GET', `/api/mcp-servers/${id}`);
  return response.json();
}

async function getServerStatus(id: string) {
  const response = await apiRequest('GET', `/api/mcp-servers/${id}/status`);
  return response.json();
}

async function getServerMetrics(id: string) {
  const response = await apiRequest('GET', `/api/mcp-servers/metrics`);
  return response.json();
}

async function addServer(data: Omit<MCPServer, 'id' | 'createdAt' | 'updatedAt'>) {
  const response = await apiRequest('POST', '/api/mcp-servers', data);
  return response.json();
}

async function updateServer(id: string, data: Partial<Omit<MCPServer, 'id' | 'createdAt' | 'updatedAt'>>) {
  const response = await apiRequest('PATCH', `/api/mcp-servers/${id}`, data);
  return response.json();
}

async function deleteServer(id: string) {
  const response = await apiRequest('DELETE', `/api/mcp-servers/${id}`);
  return response.json();
}

async function connectServer(id: string) {
  const response = await apiRequest('POST', `/api/mcp-servers/${id}/connect`);
  return response.json();
}

async function disconnectServer(id: string) {
  const response = await apiRequest('POST', `/api/mcp-servers/${id}/disconnect`);
  return response.json();
}

async function getServerTools(id: string) {
  const response = await apiRequest('GET', `/api/mcp-servers/${id}/tools`);
  return response.json();
}

export const mcpServersApi = {
  getServers,
  getServerById,
  getServerStatus,
  getServerMetrics,
  addServer,
  updateServer,
  deleteServer,
  connectServer,
  disconnectServer,
  getServerTools
};