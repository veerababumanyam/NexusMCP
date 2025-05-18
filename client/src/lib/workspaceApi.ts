import { apiRequest } from "./queryClient";

/**
 * Get all workspaces
 */
export async function getWorkspaces() {
  const res = await apiRequest("GET", "/api/workspaces");
  return await res.json();
}

/**
 * Get a specific workspace by ID
 */
export async function getWorkspace(id: number) {
  const res = await apiRequest("GET", `/api/workspaces/${id}`);
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
 * Update an existing workspace
 */
export async function updateWorkspace(id: number, workspaceData: any) {
  const res = await apiRequest("PATCH", `/api/workspaces/${id}`, workspaceData);
  return await res.json();
}

/**
 * Archive (soft delete) a workspace
 */
export async function archiveWorkspace(id: number) {
  const res = await apiRequest("DELETE", `/api/workspaces/${id}`);
  return await res.json();
}

/**
 * Get workspace policy
 */
export async function getWorkspacePolicy(workspaceId: number) {
  const res = await apiRequest("GET", `/api/workspaces/${workspaceId}/policy`);
  return await res.json();
}

/**
 * Update workspace policy
 */
export async function updateWorkspacePolicy(workspaceId: number, policyData: any) {
  const res = await apiRequest("PATCH", `/api/workspaces/${workspaceId}/policy`, policyData);
  return await res.json();
}

/**
 * Get workspace members
 */
export async function getWorkspaceMembers(workspaceId: number) {
  const res = await apiRequest("GET", `/api/workspaces/${workspaceId}/members`);
  return await res.json();
}

/**
 * Add member to workspace
 */
export async function addWorkspaceMember(workspaceId: number, memberData: any) {
  const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/members`, memberData);
  return await res.json();
}

/**
 * Update workspace member status
 */
export async function updateWorkspaceMember(workspaceId: number, userId: number, memberData: any) {
  const res = await apiRequest("PATCH", `/api/workspaces/${workspaceId}/members/${userId}`, memberData);
  return await res.json();
}

/**
 * Remove member from workspace
 */
export async function removeWorkspaceMember(workspaceId: number, userId: number) {
  const res = await apiRequest("DELETE", `/api/workspaces/${workspaceId}/members/${userId}`);
  return await res.json();
}

/**
 * Get user's default workspace
 */
export async function getUserDefaultWorkspace() {
  const res = await apiRequest("GET", `/api/workspaces/user/default`);
  return await res.json();
}

/**
 * Set user's default workspace
 */
export async function setUserDefaultWorkspace(workspaceId: number) {
  const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/default`);
  return await res.json();
}