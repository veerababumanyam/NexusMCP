import { apiRequest } from "./queryClient";

/**
 * Get system status information
 */
export async function getSystemStatus() {
  const res = await apiRequest("GET", "/api/system/status");
  return await res.json();
}

/**
 * Get all MCP servers with their status
 */
export async function getServerStatuses() {
  const res = await apiRequest("GET", "/api/mcp-servers/status");
  return await res.json();
}

/**
 * Get all workspaces
 */
export async function getWorkspaces() {
  const res = await apiRequest("GET", "/api/workspaces");
  return await res.json();
}

/**
 * Create a new MCP server
 */
export async function createServer(serverData: any) {
  const res = await apiRequest("POST", "/api/mcp-servers", serverData);
  return await res.json();
}

/**
 * Connect to an MCP server
 */
export async function connectServer(serverId: number) {
  const res = await apiRequest("POST", `/api/mcp-servers/${serverId}/connect`);
  return await res.json();
}

/**
 * Disconnect from an MCP server
 */
export async function disconnectServer(serverId: number) {
  const res = await apiRequest("POST", `/api/mcp-servers/${serverId}/disconnect`);
  return await res.json();
}

/**
 * Create a new workspace
 */
export async function createWorkspace(workspaceData: any) {
  const res = await apiRequest("POST", "/api/workspaces", workspaceData);
  return await res.json();
}

/**
 * Get tools for a server
 */
export async function getServerTools(serverId: number) {
  const res = await apiRequest("GET", `/api/mcp-servers/${serverId}/tools`);
  return await res.json();
}

/**
 * Get all tools
 */
export async function getAllTools() {
  const res = await apiRequest("GET", "/api/tools");
  return await res.json();
}

/**
 * Get audit logs with optional limit
 */
export async function getAuditLogs(limit: number = 100) {
  const res = await apiRequest("GET", `/api/audit-logs?limit=${limit}`);
  return await res.json();
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(userId: number, limit: number = 100) {
  const res = await apiRequest("GET", `/api/users/${userId}/audit-logs?limit=${limit}`);
  return await res.json();
}
