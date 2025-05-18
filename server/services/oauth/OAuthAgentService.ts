/**
 * OAuth 2.1 Agent Service
 * 
 * Implements OAuth 2.1 for AI Agent authentication:
 * - Dynamic client registration (RFC 7591)
 * - Token issuance & refresh (RFC 6749 with OAuth 2.1 updates)
 * - Token introspection (RFC 7662)
 * - Token revocation (RFC 7009)
 * - Scoped access control
 * 
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-09
 */

import { db } from '@db';
import { randomBytes, createHash } from "crypto";
import { 
  agentOAuthClients, 
  agentOAuthTokens, 
  mcpAgents
} from "@shared/schema_agents";
import { permissionSets } from "@shared/schema";
import type { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Create insert schemas
const agentOAuthClientInsertSchema = createInsertSchema(agentOAuthClients);
const agentOAuthTokenInsertSchema = createInsertSchema(agentOAuthTokens);

// Define types from schemas
type AgentOAuthClientInsert = z.infer<typeof agentOAuthClientInsertSchema>;
type AgentOAuthTokenInsert = z.infer<typeof agentOAuthTokenInsertSchema>;
import { eq, and, desc, sql, like, inArray } from "drizzle-orm";
import { EventBus } from "../eventBusService";
// Import the policy service to validate permissions
import { PolicyManagementService } from "../policyManagementService";

// Client registration options
interface ClientRegistrationOptions {
  client_name: string;
  client_uri?: string;
  redirect_uris: string[];
  scope?: string;
  contacts?: string[];
  logo_uri?: string;
  grant_types?: string[];
  token_endpoint_auth_method?: string;
}

// Token response interface
interface TokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

// Token introspection interface
interface TokenIntrospection {
  client_id: string;
  agent_id: number;
  exp: number;
  iat: number;
  scope: string[];
  token_type: string;
  jti: string;
}

class OAuthAgentService {
  private readonly eventBus = EventBus.getInstance();
  private readonly policyService = new PolicyManagementService();
  
  /**
   * Generate a secure random string for various OAuth usages
   */
  private generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
  
  /**
   * Generate a client ID for OAuth client registration
   */
  private generateClientId(): string {
    return 'client_' + this.generateSecureToken(16);
  }
  
  /**
   * Generate a client secret for OAuth client registration
   */
  private generateClientSecret(): string {
    return 'secret_' + this.generateSecureToken(32);
  }
  
  /**
   * Generate a token ID
   */
  private generateTokenId(): string {
    return 'jti_' + this.generateSecureToken(12);
  }
  
  /**
   * Generate an access token
   */
  private generateAccessToken(): string {
    return 'at_' + this.generateSecureToken(32);
  }
  
  /**
   * Generate a refresh token
   */
  private generateRefreshToken(): string {
    return 'rt_' + this.generateSecureToken(32);
  }
  
  /**
   * Calculate token fingerprint (for storage and verification)
   */
  private calculateTokenFingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  
  /**
   * Get permission sets associated with requested OAuth scopes
   * This links OAuth scopes with permission sets for policy evaluation
   * and filters by workspace context when appropriate
   */
  private async getPermissionSetsByScopes(
    scopes: string[], 
    workspaceId?: number
  ): Promise<any[]> {
    try {
      if (!scopes.length) {
        return [];
      }
      
      // Find permission sets with matching OAuth scopes
      const permissionSetsList = await db.query.permissionSets.findMany({
        where: (sets, { eq, like, or, and }) => {
          // Base condition: match OAuth scopes
          const scopeConditions = scopes.map(scope => 
            sql`${sets.oauthScopes}::jsonb @> ${JSON.stringify([scope])}::jsonb`
          );
          
          // Build where conditions
          if (workspaceId) {
            // If workspaceId provided, get permission sets for that workspace + global sets
            return and(
              or(...scopeConditions),
              or(
                eq(sets.workspaceId, workspaceId),
                eq(sets.isGlobal, true)
              )
            );
          } else {
            // If no workspaceId, get only global permission sets
            return and(
              or(...scopeConditions),
              eq(sets.isGlobal, true)
            );
          }
        },
        with: {
          workspace: true
        }
      });
      
      return permissionSetsList;
    } catch (error) {
      console.error('Error fetching permission sets by scopes:', error);
      return [];
    }
  }
  
  /**
   * Validate permission sets against relevant policies
   * This enforces ABAC conditions for OAuth scopes with workspace-aware context
   */
  private async validatePermissionSets(
    permissionSets: any[],
    context: {
      user?: any,
      agent?: any,
      client?: any,
      resource?: any,
      action?: string,
      workspaceId?: number
    }
  ): Promise<{
    valid: boolean,
    failedPermissions: string[],
    reasons: string[]
  }> {
    const failedPermissions = [];
    const reasons = [];
    
    // If no permission sets to validate, consider it valid
    if (!permissionSets.length) {
      return { valid: true, failedPermissions: [], reasons: [] };
    }
    
    // First validate workspace boundary - permission sets must belong to the workspace or be global
    const invalidWorkspacePermissions = permissionSets.filter(permSet => {
      // Skip workspace validation for global permission sets
      if (permSet.isGlobal) {
        return false;
      }
      
      // For workspace-specific sets, they must match the request context workspace
      return permSet.workspaceId !== context.workspaceId;
    });
    
    // If any permission sets don't match workspace boundaries, reject immediately
    if (invalidWorkspacePermissions.length > 0) {
      return {
        valid: false,
        failedPermissions: invalidWorkspacePermissions.map(p => p.name),
        reasons: [`Permission sets from different workspaces cannot be used: ${
          invalidWorkspacePermissions.map(p => p.name).join(', ')
        }`]
      };
    }
    
    // Proceed with ABAC condition evaluation for valid workspace permission sets
    for (const permSet of permissionSets) {
      // Skip if no ABAC conditions to evaluate
      if (!permSet.abacConditions) {
        continue;
      }
      
      // Create a temporary policy for evaluation
      const tempPolicy = {
        id: permSet.id,
        name: permSet.name,
        description: permSet.description,
        content: JSON.stringify({
          rules: [
            {
              resource_type: context.resource?.type || "agent",
              action: context.action || "access",
              condition: permSet.abacConditions,
              effect: "allow"
            }
          ]
        }),
        policyType: "json",
        status: "active",
        workspaceId: permSet.workspaceId || context.workspaceId, // Use the permission set's workspace ID
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isSystem: false,
        requiresApproval: false,
        appliesTo: "agent",
        tags: [],
        createdBy: 1,
        approvedBy: 1,
        lastEvaluatedAt: null,
        publishedAt: null
      };
      
      try {
        // Compile the policy
        await this.policyService.compileAndCachePolicy(tempPolicy);
        
        // Evaluate the policy against the context
        const evaluation = await this.policyService.evaluatePolicy(
          tempPolicy.id,
          context,
          {
            userId: context.user?.id,
            workspaceId: context.workspaceId,
            resourceType: context.resource?.type || "agent",
            resourceId: context.resource?.id?.toString() || undefined,
            action: context.action || "access"
          }
        );
        
        // If denied, add to failed permissions
        if (evaluation.decision === 'deny') {
          failedPermissions.push(permSet.name);
          reasons.push(evaluation.reason || 'Permission set conditions not satisfied');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error evaluating policy for permission set ${permSet.name}:`, error);
        failedPermissions.push(permSet.name);
        reasons.push(`Error evaluating policy: ${errorMessage}`);
      }
    }
    
    return {
      valid: failedPermissions.length === 0,
      failedPermissions,
      reasons
    };
  }
  
  /**
   * Register a new OAuth client for an AI agent
   * Implements RFC 7591 - OAuth 2.0 Dynamic Client Registration
   */
  public async registerClient(
    agentId: number,
    options: ClientRegistrationOptions
  ): Promise<{
    client_id: string;
    client_secret: string;
    client_id_issued_at: number;
    client_secret_expires_at: number;
    redirect_uris: string[];
    scope: string;
    grant_types: string[];
    token_endpoint_auth_method: string;
  }> {
    // Verify that the agent exists
    const agent = await db.query.mcpAgents.findFirst({
      where: eq(mcpAgents.id, agentId)
    });
    
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // Generate client credentials
    const client_id = this.generateClientId();
    const client_secret = this.generateClientSecret();
    const issuedAt = Math.floor(Date.now() / 1000);
    
    // Default values for optional parameters
    const grant_types = options.grant_types || ['client_credentials', 'refresh_token'];
    const scope = options.scope || 'agent:basic';
    const token_endpoint_auth_method = options.token_endpoint_auth_method || 'client_secret_basic';
    
    // Store client in database
    const clientData: AgentOAuthClientInsert = {
      clientId: client_id,
      clientSecret: this.calculateTokenFingerprint(client_secret),
      agentId,
      name: options.client_name,
      description: `OAuth client for agent ${agent.name}`,
      clientUri: options.client_uri,
      redirectUris: options.redirect_uris,
      scopes: scope.split(' '),
      grantTypes: grant_types,
      tokenEndpointAuthMethod: token_endpoint_auth_method,
      contacts: options.contacts || [],
      logoUri: options.logo_uri,
      registrationAccessToken: this.generateSecureToken(24),
      issuedAt: new Date(issuedAt * 1000),
      expiresAt: null // Non-expiring
    };
    
    const [insertedClient] = await db.insert(agentOAuthClients).values(clientData).returning();
    
    // Publish event
    this.eventBus.publish('agent.oauth.client_registered', {
      agentId,
      clientId: client_id,
      timestamp: new Date().toISOString()
    }, {
      source: 'OAuthAgentService'
    });
    
    // Return client registration information
    // Note: We return the actual secret here once, then only store the fingerprint
    return {
      client_id,
      client_secret, // Only time the full secret is returned
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0, // 0 means non-expiring
      redirect_uris: options.redirect_uris,
      scope,
      grant_types,
      token_endpoint_auth_method
    };
  }
  
  /**
   * Issue an OAuth token
   */
  public async issueToken(
    clientId: string,
    scopes: string[],
    grantType: 'authorization_code' | 'refresh_token' | 'client_credentials',
    code?: string
  ): Promise<TokenResponse> {
    // Verify client exists and is active
    const client = await db.query.agentOAuthClients.findFirst({
      where: and(
        eq(agentOAuthClients.clientId, clientId),
        eq(agentOAuthClients.status, 'active')
      )
    });
    
    if (!client) {
      throw new Error(`Invalid client: ${clientId}`);
    }
    
    // Verify requested scopes are allowed
    const allowedScopes = client.scopes;
    for (const scope of scopes) {
      if (!allowedScopes.includes(scope)) {
        throw new Error(`Requested scope "${scope}" not allowed for this client`);
      }
    }
    
    // Verify grant type is allowed
    if (!client.grantTypes.includes(grantType)) {
      throw new Error(`Grant type "${grantType}" not allowed for this client`);
    }
    
    // Get the agent data
    const agent = await db.query.mcpAgents.findFirst({
      where: eq(mcpAgents.id, client.agentId)
    });
    
    if (!agent) {
      throw new Error(`Agent not found: ${client.agentId}`);
    }
    
    // Get the permission sets for the requested scopes, filtered by workspace
    const permissionSets = await this.getPermissionSetsByScopes(
      scopes,
      agent.workspaceId // Pass the agent's workspaceId for proper filtering
    );
    
    // Log the permission sets that will be evaluated
    console.info(`Evaluating ${permissionSets.length} permission sets for token issuance`, {
      clientId: client.clientId,
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      permissionSets: permissionSets.map(p => ({
        id: p.id,
        name: p.name,
        isGlobal: p.isGlobal,
        workspaceId: p.workspaceId
      }))
    });
    
    // Validate permissions against ABAC policies with workspace context
    const validationResult = await this.validatePermissionSets(
      permissionSets,
      {
        agent,
        client,
        resource: { type: "mcp_server", id: agent.mcpServerId },
        action: "access",
        workspaceId: agent.workspaceId
      }
    );
    
    // If validation fails, deny the token
    if (!validationResult.valid) {
      throw new Error(`Permission validation failed: ${validationResult.reasons.join(', ')}`);
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken();
    const refreshToken = this.generateRefreshToken();
    const tokenId = this.generateTokenId();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour
    const expiresAt = issuedAt + expiresIn;
    
    // Store token in database
    const tokenData: AgentOAuthTokenInsert = {
      clientId: client.clientId,
      agentId: client.agentId,
      accessToken: this.calculateTokenFingerprint(accessToken),
      refreshToken: this.calculateTokenFingerprint(refreshToken),
      scopes: scopes,
      grantType,
      issuedAt: new Date(issuedAt * 1000),
      accessTokenExpiresAt: new Date(expiresAt * 1000),
      refreshTokenExpiresAt: new Date(issuedAt + 7 * 24 * 3600 * 1000) // 7 days
    };
    
    await db.insert(agentOAuthTokens).values(tokenData);
    
    // Add audit log
    this.eventBus.publish('policy.abac.evaluation', {
      permissionSets: permissionSets.map(p => p.name),
      decision: 'allow',
      scopes,
      grantType,
      agentId: client.agentId,
      clientId,
      timestamp: new Date()
    });
    
    // Publish event
    this.eventBus.publish('agent.oauth.token_issued', {
      clientId,
      agentId: client.agentId,
      grantType,
      scope: scopes.join(' '),
      timestamp: new Date().toISOString()
    }, {
      source: 'OAuthAgentService'
    });
    
    // Return token response
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      refresh_token: refreshToken,
      expires_in: expiresIn,
      scope: scopes.join(' ')
    };
  }
  
  /**
   * Validate an access token
   */
  public async validateToken(token: string): Promise<TokenIntrospection> {
    const tokenHash = this.calculateTokenFingerprint(token);
    
    // Find token by fingerprint
    const storedToken = await db.query.agentOAuthTokens.findFirst({
      where: eq(agentOAuthTokens.accessToken, tokenHash),
      with: {
        client: true
      }
    });
    
    if (!storedToken) {
      throw new Error('Invalid token');
    }
    
    // Check if token has expired
    if (storedToken.accessTokenExpiresAt.getTime() < Date.now()) {
      // Token is expired, no need to update its status
      throw new Error('Token expired');
    }
    
    // Get agent data
    const agent = await db.query.mcpAgents.findFirst({
      where: eq(mcpAgents.id, storedToken.agentId)
    });
    
    if (!agent) {
      throw new Error(`Agent not found for token`);
    }
    
    // Get the permission sets for the scopes in the token, filtered by workspace
    const permissionSets = await this.getPermissionSetsByScopes(
      storedToken.scopes,
      agent.workspaceId // Pass the agent's workspaceId for proper filtering
    );
    
    // Log the permission sets for this validation
    console.info(`Evaluating ${permissionSets.length} permission sets for token validation`, {
      clientId: storedToken.client.clientId,
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      permissionSets: permissionSets.map(p => ({
        id: p.id,
        name: p.name,
        isGlobal: p.isGlobal,
        workspaceId: p.workspaceId
      }))
    });
    
    // Validate permissions for current state (permissions might have changed since token was issued)
    // For example, if permission sets have been reassigned to different workspaces or modified
    const validationResult = await this.validatePermissionSets(
      permissionSets,
      {
        agent,
        client: storedToken.client,
        resource: { type: "mcp_server", id: agent.mcpServerId },
        action: "access",
        workspaceId: agent.workspaceId
      }
    );
    
    // If validation fails, invalidate the token
    if (!validationResult.valid) {
      // Audit the failure
      this.eventBus.publish('policy.abac.evaluation', {
        permissionSets: permissionSets.map(p => p.name),
        decision: 'deny',
        scopes: storedToken.scopes,
        clientId: storedToken.client.clientId,
        agentId: storedToken.agentId,
        timestamp: new Date(),
        reasons: validationResult.reasons
      });
      
      // Throw error with details
      throw new Error(`Permission validation failed: ${validationResult.reasons.join(', ')}`);
    }
    
    // Add audit for successful validation
    this.eventBus.publish('policy.abac.evaluation', {
      permissionSets: permissionSets.map(p => p.name || 'unnamed'),
      decision: 'allow',
      scopes: storedToken.scopes,
      clientId: storedToken.client.clientId,
      agentId: storedToken.agentId,
      timestamp: new Date()
    });
    
    // Return token information
    return {
      client_id: storedToken.client.clientId,
      agent_id: storedToken.agentId,
      exp: Math.floor(storedToken.accessTokenExpiresAt.getTime() / 1000),
      iat: Math.floor(storedToken.issuedAt.getTime() / 1000),
      scope: storedToken.scopes,
      token_type: 'bearer',
      jti: 'token-' + storedToken.id
    };
  }
  
  /**
   * Revoke a token
   */
  public async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token'
  ): Promise<boolean> {
    const tokenHash = this.calculateTokenFingerprint(token);
    
    // Try to find and revoke the token based on the hint
    if (tokenTypeHint === 'access_token' || !tokenTypeHint) {
      // Mark the token as expired by setting expiration dates to now
      const now = new Date();
      const result = await db.update(agentOAuthTokens)
        .set({ 
          accessTokenExpiresAt: now,
          refreshTokenExpiresAt: now
        })
        .where(eq(agentOAuthTokens.accessToken, tokenHash))
        .returning({ id: agentOAuthTokens.id });
      
      if (result.length > 0) {
        // Publish event
        this.eventBus.publish('agent.oauth.token_revoked', {
          tokenId: result[0].id,
          type: 'access_token',
          timestamp: new Date().toISOString()
        }, {
          source: 'OAuthAgentService'
        });
        
        return true;
      }
    }
    
    if (tokenTypeHint === 'refresh_token' || !tokenTypeHint) {
      // Mark the token as expired by setting expiration dates to now
      const now = new Date();
      const result = await db.update(agentOAuthTokens)
        .set({ 
          accessTokenExpiresAt: now,
          refreshTokenExpiresAt: now
        })
        .where(eq(agentOAuthTokens.refreshToken, tokenHash))
        .returning({ id: agentOAuthTokens.id });
      
      if (result.length > 0) {
        // Publish event
        this.eventBus.publish('agent.oauth.token_revoked', {
          tokenId: result[0].id,
          type: 'refresh_token',
          timestamp: new Date().toISOString()
        }, {
          source: 'OAuthAgentService'
        });
        
        return true;
      }
    }
    
    // If we get here, no token was found to revoke
    return false;
  }
  
  /**
   * Get OAuth client information
   */
  public async getClientInfo(clientId: string): Promise<any> {
    const client = await db.query.agentOAuthClients.findFirst({
      where: eq(agentOAuthClients.clientId, clientId)
    });
    
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }
    
    // Do not return client secret hash
    const { clientSecret, ...safeClientInfo } = client;
    
    return safeClientInfo;
  }
}

// Export singleton instance
export const oauthAgentService = new OAuthAgentService();