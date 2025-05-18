import { db } from "@db";
import { 
  users, workspaces, mcpServers, tools, auditLogs, 
  roles, userRoles, workspaceMembers, authProviders
} from "@shared/schema";
import { 
  type User, type InsertUser, type Workspace, type McpServer, 
  type Tool, type AuditLog, type Role, type UserRole, 
  type WorkspaceMember, type AuthProvider
} from "@shared/schema";
import { eq, and, desc, asc, sql, isNull, not } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByExternalId(providerId: number, externalId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithRoles(): Promise<(User & { roles: Role[] })[]>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getUserRoles(userId: number): Promise<Role[]>;
  assignRoleToUser(userId: number, roleId: number): Promise<UserRole>;
  removeRoleFromUser(userId: number, roleId: number): Promise<void>;
  removeAllUserRoles(userId: number): Promise<void>;
  getUserWorkspaces(userId: number): Promise<Workspace[]>;
  addUserToWorkspace(userId: number, workspaceId: number): Promise<WorkspaceMember>;
  removeUserFromWorkspace(userId: number, workspaceId: number): Promise<void>;
  removeUserFromAllWorkspaces(userId: number): Promise<void>;
  
  // Role methods
  getAllRoles(): Promise<Role[]>;
  getRole(id: number): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(roleData: Partial<Role>): Promise<Role>;
  updateRole(id: number, roleData: Partial<Role>): Promise<Role | undefined>;
  deleteRole(id: number): Promise<void>;
  getUsersByRole(roleId: number): Promise<User[]>;
  
  // Auth provider methods
  getAllAuthProviders(): Promise<AuthProvider[]>;
  getAuthProvider(id: number): Promise<AuthProvider | undefined>;
  getAuthProviderByName(name: string): Promise<AuthProvider | undefined>;
  createAuthProvider(providerData: Partial<AuthProvider>): Promise<AuthProvider>;
  updateAuthProvider(id: number, providerData: Partial<AuthProvider>): Promise<AuthProvider | undefined>;
  
  // Workspace methods
  getAllWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  createWorkspace(workspaceData: Partial<Workspace>): Promise<Workspace>;
  updateWorkspace(id: number, workspaceData: Partial<Workspace>): Promise<Workspace | undefined>;
  getWorkspaceMembers(workspaceId: number): Promise<User[]>;
  
  // MCP Server methods
  getAllMcpServers(): Promise<McpServer[]>;
  getMcpServer(id: number): Promise<McpServer | undefined>;
  getMcpServersByWorkspace(workspaceId: number): Promise<McpServer[]>;
  createMcpServer(serverData: Partial<McpServer>): Promise<McpServer>;
  updateMcpServer(id: number, serverData: Partial<McpServer>): Promise<McpServer | undefined>;
  
  // Tool methods
  getAllTools(): Promise<Tool[]>;
  getToolsByServer(serverId: number): Promise<Tool[]>;
  createTool(toolData: Partial<Tool>): Promise<Tool>;
  updateTool(id: number, toolData: Partial<Tool>): Promise<Tool | undefined>;
  
  // Audit log methods
  createAuditLog(logData: Partial<AuditLog>): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: number, limit?: number): Promise<AuditLog[]>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: "session" 
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }
  
  async getUserByExternalId(providerId: number, externalId: string): Promise<User | undefined> {
    const result = await db.select()
      .from(users)
      .where(
        and(
          eq(users.authProviderId, providerId),
          eq(users.externalId, externalId)
        )
      )
      .limit(1);
    return result[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .orderBy(asc(users.username));
  }
  
  async getAllUsersWithRoles(): Promise<(User & { roles: Role[] })[]> {
    const allUsers = await this.getAllUsers();
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const userRoles = await this.getUserRoles(user.id);
        return {
          ...user,
          roles: userRoles
        };
      })
    );
    return usersWithRoles;
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
  
  async getUserRoles(userId: number): Promise<Role[]> {
    const userRolesList = await db.select()
      .from(userRoles)
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    
    return userRolesList.map(ur => ur.roles);
  }
  
  async assignRoleToUser(userId: number, roleId: number): Promise<UserRole> {
    // Check if the user already has this role
    const existingRole = await db.select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      )
      .limit(1);
    
    if (existingRole.length > 0) {
      return existingRole[0];
    }
    
    const result = await db.insert(userRoles)
      .values({
        userId,
        roleId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return result[0];
  }
  
  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    await db.delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );
  }
  
  async removeAllUserRoles(userId: number): Promise<void> {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
  }
  
  async getUserWorkspaces(userId: number): Promise<Workspace[]> {
    try {
      const userWorkspaces = await db.execute(sql`
        SELECT w.id, w.name, w.description, w.status, w.is_private, 
               w.custom_domain, w.logo_url, w.created_at, w.updated_at
        FROM workspace_members wm
        LEFT JOIN workspaces w ON wm.workspace_id = w.id
        WHERE wm.user_id = ${userId}
      `);
      
      return userWorkspaces.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        isPrivate: row.is_private,
        customDomain: row.custom_domain,
        logoUrl: row.logo_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Add sensible defaults for missing columns
        isolationLevel: "standard",
      } as Workspace));
    } catch (error) {
      console.error('Error fetching user workspaces:', error);
      return []; // Return an empty array instead of failing completely
    }
  }
  
  async addUserToWorkspace(userId: number, workspaceId: number): Promise<WorkspaceMember> {
    // Check if the user is already a member of this workspace
    const existingMembership = await db.select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      )
      .limit(1);
    
    if (existingMembership.length > 0) {
      return existingMembership[0];
    }
    
    const result = await db.insert(workspaceMembers)
      .values({
        userId,
        workspaceId,
        role: 'member', // Default role
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return result[0];
  }
  
  async removeUserFromWorkspace(userId: number, workspaceId: number): Promise<void> {
    await db.delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId)
        )
      );
  }
  
  async removeUserFromAllWorkspaces(userId: number): Promise<void> {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));
  }
  
  // Role methods
  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(asc(roles.name));
  }
  
  async getRole(id: number): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return result[0];
  }
  
  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return result[0];
  }
  
  async createRole(roleData: Partial<Role>): Promise<Role> {
    const result = await db.insert(roles).values(roleData).returning();
    return result[0];
  }
  
  async updateRole(id: number, roleData: Partial<Role>): Promise<Role | undefined> {
    const result = await db.update(roles)
      .set({ ...roleData, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return result[0];
  }
  
  async deleteRole(id: number): Promise<void> {
    // First remove all user associations with this role
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    // Then delete the role
    await db.delete(roles).where(eq(roles.id, id));
  }
  
  async getUsersByRole(roleId: number): Promise<User[]> {
    const usersWithRole = await db.select()
      .from(userRoles)
      .leftJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.roleId, roleId));
    
    return usersWithRole.map(ur => ur.user);
  }
  
  // Auth provider methods
  async getAllAuthProviders(): Promise<AuthProvider[]> {
    return await db.select().from(authProviders).orderBy(asc(authProviders.name));
  }
  
  async getAuthProvider(id: number): Promise<AuthProvider | undefined> {
    const result = await db.select().from(authProviders).where(eq(authProviders.id, id)).limit(1);
    return result[0];
  }
  
  async getAuthProviderByName(name: string): Promise<AuthProvider | undefined> {
    const result = await db.select().from(authProviders).where(eq(authProviders.name, name)).limit(1);
    return result[0];
  }
  
  async createAuthProvider(providerData: Partial<AuthProvider>): Promise<AuthProvider> {
    const result = await db.insert(authProviders).values(providerData).returning();
    return result[0];
  }
  
  async updateAuthProvider(id: number, providerData: Partial<AuthProvider>): Promise<AuthProvider | undefined> {
    const result = await db.update(authProviders)
      .set({ ...providerData, updatedAt: new Date() })
      .where(eq(authProviders.id, id))
      .returning();
    return result[0];
  }
  
  // Workspace methods
  async getWorkspaceMembers(workspaceId: number): Promise<User[]> {
    const workspaceUsers = await db.select()
      .from(workspaceMembers)
      .leftJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    
    return workspaceUsers.map(wu => wu.user);
  }
  
  // Workspace methods
  async getAllWorkspaces(): Promise<Workspace[]> {
    try {
      const allWorkspaces = await db.execute(sql`
        SELECT id, name, description, status, created_at, updated_at
        FROM workspaces
        ORDER BY name ASC
      `);
      
      return allWorkspaces.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Add sensible defaults for missing columns
        isPrivate: false,
        isolationLevel: "standard",
      } as Workspace));
    } catch (error) {
      console.error('Error fetching all workspaces:', error);
      return []; // Return an empty array instead of failing completely
    }
  }
  
  async getWorkspace(id: number): Promise<Workspace | undefined> {
    try {
      const workspace = await db.execute(sql`
        SELECT id, name, description, status, created_at, updated_at
        FROM workspaces
        WHERE id = ${id}
        LIMIT 1
      `);
      
      if (workspace.rows.length === 0) {
        return undefined;
      }
      
      const row = workspace.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Add sensible defaults for missing columns
        isPrivate: false,
        isolationLevel: "standard",
      } as Workspace;
    } catch (error) {
      console.error(`Error fetching workspace with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async createWorkspace(workspaceData: Partial<Workspace>): Promise<Workspace> {
    const result = await db.insert(workspaces).values(workspaceData).returning();
    return result[0];
  }
  
  async updateWorkspace(id: number, workspaceData: Partial<Workspace>): Promise<Workspace | undefined> {
    const result = await db.update(workspaces)
      .set({ ...workspaceData, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return result[0];
  }
  
  // MCP Server methods
  async getAllMcpServers(): Promise<McpServer[]> {
    return await db.select().from(mcpServers).orderBy(asc(mcpServers.name));
  }
  
  async getMcpServer(id: number): Promise<McpServer | undefined> {
    const result = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
    return result[0];
  }
  
  async getMcpServersByWorkspace(workspaceId: number): Promise<McpServer[]> {
    return await db.select().from(mcpServers)
      .where(eq(mcpServers.workspaceId, workspaceId))
      .orderBy(asc(mcpServers.name));
  }
  
  async createMcpServer(serverData: Partial<McpServer>): Promise<McpServer> {
    const result = await db.insert(mcpServers).values(serverData).returning();
    return result[0];
  }
  
  async updateMcpServer(id: number, serverData: Partial<McpServer>): Promise<McpServer | undefined> {
    const result = await db.update(mcpServers)
      .set({ ...serverData, updatedAt: new Date() })
      .where(eq(mcpServers.id, id))
      .returning();
    return result[0];
  }
  
  // Tool methods
  async getAllTools(): Promise<Tool[]> {
    return await db.select().from(tools).orderBy(asc(tools.name));
  }
  
  async getToolsByServer(serverId: number): Promise<Tool[]> {
    return await db.select().from(tools)
      .where(eq(tools.serverId, serverId))
      .orderBy(asc(tools.name));
  }
  
  async createTool(toolData: Partial<Tool>): Promise<Tool> {
    const result = await db.insert(tools).values(toolData).returning();
    return result[0];
  }
  
  async updateTool(id: number, toolData: Partial<Tool>): Promise<Tool | undefined> {
    const result = await db.update(tools)
      .set({ ...toolData, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning();
    return result[0];
  }
  
  // Audit log methods
  async createAuditLog(logData: Partial<AuditLog>): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(logData).returning();
    return result[0];
  }
  
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
  
  async getAuditLogsByUser(userId: number, limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

// Singleton instance of the storage interface
export const storage = new DatabaseStorage();
