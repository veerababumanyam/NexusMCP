import { loadPolicy } from "@open-policy-agent/opa-wasm";
import { Policy } from "@shared/schema_policies";
import { storage } from "../storage";
import { db } from "../../db";
import { 
  policies, 
  policyVersions, 
  policyEvaluationLogs 
} from "@shared/schema_policies";
import { eq, and, desc, inArray } from "drizzle-orm";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";

/**
 * Policy Management Service
 * 
 * Provides functionality for:
 * - OPA policy compilation and loading
 * - Policy evaluation and enforcement
 * - Policy version management
 * - Policy audit logging
 */
export class PolicyManagementService {
  // Cache compiled policies for performance
  private compiledPolicies: Map<string, {
    policy: any;
    hash: string;
    lastUpdated: Date;
  }> = new Map();

  // Track active policy evaluations
  private activeEvaluations: Map<string, Date> = new Map();
  
  constructor() {
    console.log('Policy Management Service initialized');
    this.initService();
  }

  /**
   * Initialize service and load system policies
   */
  private async initService() {
    try {
      // Create temp directory for policy compilation if it doesn't exist
      const tempDir = path.join(os.tmpdir(), 'opa-policies');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Load system policies
      await this.loadSystemPolicies();
    } catch (error) {
      console.error('Error initializing Policy Management Service:', error);
    }
  }

  /**
   * Load all system policies into cache
   */
  private async loadSystemPolicies() {
    try {
      // Using direct SQL query instead of querying through the ORM since the table is in a different schema
      const systemPolicies = await db.execute(
        'SELECT * FROM policies WHERE is_system = true'
      );
      
      console.log(`Loading ${systemPolicies.rows.length} system policies...`);
      
      for (const policy of systemPolicies.rows) {
        await this.compileAndCachePolicy(policy);
      }
    } catch (error) {
      console.error('Error loading system policies:', error);
    }
  }

  /**
   * Compile a policy and cache it
   * Public method for external use by other services (like permission-sets)
   */
  public async compileAndCachePolicy(policy: any): Promise<boolean> {
    try {
      const policyHash = this.hashPolicyContent(policy.content);
      const cacheKey = `${policy.id}:${policy.version}`;
      
      // Skip if already cached and hash matches
      const cached = this.compiledPolicies.get(cacheKey);
      if (cached && cached.hash === policyHash) {
        return true;
      }
      
      // For Rego policies, we need to compile them to WASM
      if (policy.policyType === 'rego') {
        // This is where OPA compilation would occur
        // For now, we'll just cache the policy content
        this.compiledPolicies.set(cacheKey, {
          policy: policy.content,
          hash: policyHash,
          lastUpdated: new Date()
        });
        return true;
      } 
      // For JSON and YAML policies, just parse and cache
      else if (policy.policyType === 'json' || policy.policyType === 'yaml') {
        this.compiledPolicies.set(cacheKey, {
          policy: policy.content,
          hash: policyHash,
          lastUpdated: new Date()
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error compiling policy:', error);
      return false;
    }
  }

  /**
   * Create a hash of the policy content for cache invalidation
   */
  private hashPolicyContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Evaluate a policy for a given request
   */
  public async evaluatePolicy(
    policyId: number, 
    input: any, 
    options: { 
      userId?: number, 
      workspaceId?: number, 
      serverId?: number,
      resourceType: string,
      resourceId?: string,
      action: string
    }
  ): Promise<{
    decision: 'allow' | 'deny',
    reason?: string,
    evaluationId?: number
  }> {
    const startTime = Date.now();
    const evaluationId = `${policyId}:${options.resourceType}:${Date.now()}`;
    
    try {
      // Track active evaluation
      this.activeEvaluations.set(evaluationId, new Date());
      
      // Get policy
      const sql = `SELECT * FROM policies WHERE id = ${policyId}`;
      const result = await db.execute(sql);
      const policy = result.rows.length > 0 ? result.rows[0] as unknown as Policy : undefined;
      
      if (!policy) {
        return { decision: 'deny', reason: 'Policy not found' };
      }
      
      // Compile and cache policy if needed
      const cacheKey = `${policy.id}:${policy.version}`;
      if (!this.compiledPolicies.has(cacheKey)) {
        await this.compileAndCachePolicy(policy);
      }
      
      // Get compiled policy
      const compiledPolicy = this.compiledPolicies.get(cacheKey);
      if (!compiledPolicy) {
        return { decision: 'deny', reason: 'Failed to load policy' };
      }
      
      // Simple evaluation for now
      let decision: 'allow' | 'deny' = 'deny';
      let reason = 'Default deny';
      
      // In a real implementation, we'd use OPA WASM evaluation here
      // For now, we'll use a simple mock evaluation
      if (policy.policyType === 'json') {
        try {
          const policyJson = JSON.parse(policy.content);
          
          // Simple rule matching
          if (policyJson.rules && Array.isArray(policyJson.rules)) {
            for (const rule of policyJson.rules) {
              if (
                (!rule.resource_type || rule.resource_type === options.resourceType) &&
                (!rule.action || rule.action === options.action)
              ) {
                decision = rule.effect === 'allow' ? 'allow' : 'deny';
                reason = rule.reason || (decision === 'allow' ? 'Explicit allow rule matched' : 'Explicit deny rule matched');
                break;
              }
            }
          }
        } catch (e) {
          console.error('Error parsing policy JSON:', e);
          decision = 'deny';
          reason = 'Error evaluating policy';
        }
      }
      
      // Record evaluation in database
      const evaluationTime = Date.now() - startTime;
      
      const logEntry = await db.insert(policyEvaluationLogs).values({
        policyId: policyId,
        userId: options.userId,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        action: options.action,
        decision: decision,
        decisionReason: reason,
        requestContext: input,
        evaluationTime: evaluationTime,
        workspaceId: options.workspaceId,
        serverId: options.serverId
      }).returning();
      
      // Update policy last evaluated time
      await db.update(policies)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(policies.id, policyId));
      
      return {
        decision,
        reason,
        evaluationId: logEntry[0].id
      };
    } catch (error) {
      console.error('Error evaluating policy:', error);
      return { decision: 'deny', reason: 'Error during policy evaluation' };
    } finally {
      // Remove from active evaluations
      this.activeEvaluations.delete(evaluationId);
    }
  }

  /**
   * Get policies based on filters
   */
  public async getPolicies(filters: {
    workspaceId?: number,
    policyType?: string,
    status?: string,
    appliesTo?: string,
    tags?: string[],
    isSystem?: boolean,
    page?: number,
    limit?: number
  }): Promise<{ policies: Policy[], total: number }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;
      
      // Build the SQL query with conditions
      let conditions = [];
      let params = [];
      
      if (filters.workspaceId !== undefined) {
        conditions.push(`workspace_id = ${filters.workspaceId}`);
      }
      
      if (filters.policyType) {
        conditions.push(`policy_type = '${filters.policyType}'`);
      }
      
      if (filters.status) {
        conditions.push(`status = '${filters.status}'`);
      }
      
      if (filters.isSystem !== undefined) {
        conditions.push(`is_system = ${filters.isSystem}`);
      }
      
      // Build the WHERE clause
      let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM policies ${whereClause}`;
      const countResult = await db.execute(countSql);
      const total = parseInt(countResult.rows[0].count as string) || 0;
      
      // Get paginated results
      const sql = `
        SELECT * FROM policies 
        ${whereClause}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await db.execute(sql);
      const policies = result.rows.map(row => row as unknown as Policy);
      
      return { policies, total };
    } catch (error) {
      console.error('Error fetching policies:', error);
      throw error;
    }
  }

  /**
   * Get a single policy by ID
   */
  public async getPolicy(id: number): Promise<Policy | undefined> {
    try {
      const sql = `SELECT * FROM policies WHERE id = ${id}`;
      const result = await db.execute(sql);
      return result.rows.length > 0 ? result.rows[0] as unknown as Policy : undefined;
    } catch (error) {
      console.error('Error fetching policy:', error);
      throw error;
    }
  }

  /**
   * Create a new policy
   */
  public async createPolicy(policyData: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    try {
      const [policy] = await db.insert(policies).values(policyData).returning();
      
      // Create initial version
      await db.insert(policyVersions).values({
        policyId: policy.id,
        version: 1,
        content: policy.content,
        description: 'Initial version',
        createdBy: policy.createdBy
      });
      
      // Compile and cache the policy
      await this.compileAndCachePolicy(policy);
      
      return policy;
    } catch (error) {
      console.error('Error creating policy:', error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  public async updatePolicy(id: number, policyData: Partial<Policy>): Promise<Policy | undefined> {
    try {
      // Get current policy
      const currentPolicy = await this.getPolicy(id);
      if (!currentPolicy) {
        throw new Error('Policy not found');
      }
      
      // Check if content changed - if so, increment version
      let newVersion = currentPolicy.version;
      if (policyData.content && policyData.content !== currentPolicy.content) {
        newVersion++;
        
        // Create new version record
        await db.insert(policyVersions).values({
          policyId: id,
          version: newVersion,
          content: policyData.content,
          description: policyData.description || 'Updated version',
          createdBy: policyData.approvedBy || policyData.createdBy || currentPolicy.createdBy,
          diffSummary: 'Content updated' // In a real implementation, compute actual diff
        });
        
        // Update the version in the policy data
        policyData.version = newVersion;
      }
      
      // Update policy
      const [updatedPolicy] = await db.update(policies)
        .set({
          ...policyData,
          updatedAt: new Date()
        })
        .where(eq(policies.id, id))
        .returning();
      
      // If content changed, recompile and cache
      if (policyData.content) {
        await this.compileAndCachePolicy(updatedPolicy);
      }
      
      return updatedPolicy;
    } catch (error) {
      console.error('Error updating policy:', error);
      throw error;
    }
  }

  /**
   * Get policy versions for a policy
   */
  public async getPolicyVersions(policyId: number): Promise<any[]> {
    try {
      const sql = `
        SELECT * FROM policy_versions 
        WHERE policy_id = ${policyId}
        ORDER BY version DESC
      `;
      const result = await db.execute(sql);
      return result.rows;
    } catch (error) {
      console.error('Error fetching policy versions:', error);
      throw error;
    }
  }

  /**
   * Get policy evaluation logs
   */
  public async getPolicyEvaluationLogs(filters: {
    policyId?: number,
    userId?: number,
    resourceType?: string,
    action?: string,
    decision?: 'allow' | 'deny',
    workspaceId?: number,
    serverId?: number,
    startDate?: Date,
    endDate?: Date,
    page?: number,
    limit?: number
  }): Promise<any> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;
      
      // Build the SQL query with conditions
      const conditions = [];
      
      if (filters.policyId !== undefined) {
        conditions.push(`policy_id = ${filters.policyId}`);
      }
      
      if (filters.userId !== undefined) {
        conditions.push(`user_id = ${filters.userId}`);
      }
      
      if (filters.resourceType) {
        conditions.push(`resource_type = '${filters.resourceType}'`);
      }
      
      if (filters.action) {
        conditions.push(`action = '${filters.action}'`);
      }
      
      if (filters.decision) {
        conditions.push(`decision = '${filters.decision}'`);
      }
      
      if (filters.workspaceId !== undefined) {
        conditions.push(`workspace_id = ${filters.workspaceId}`);
      }
      
      if (filters.serverId !== undefined) {
        conditions.push(`server_id = ${filters.serverId}`);
      }
      
      if (filters.startDate) {
        conditions.push(`created_at >= '${filters.startDate.toISOString()}'`);
      }
      
      if (filters.endDate) {
        conditions.push(`created_at <= '${filters.endDate.toISOString()}'`);
      }
      
      // Build the WHERE clause
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM policy_evaluation_logs ${whereClause}`;
      const countResult = await db.execute(countSql);
      const total = parseInt(countResult.rows[0].count as string) || 0;
      
      // Get paginated results
      const sql = `
        SELECT * FROM policy_evaluation_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await db.execute(sql);
      const logs = result.rows;
      
      return { logs, total };
    } catch (error) {
      console.error('Error fetching policy evaluation logs:', error);
      throw error;
    }
  }

  /**
   * Express middleware for policy enforcement
   */
  public createPolicyMiddleware(options: {
    policyId: number,
    resourceType: string,
    actionResolver?: (req: Request) => string,
    resourceIdResolver?: (req: Request) => string | undefined,
    inputResolver?: (req: Request) => any,
    onDeny?: (req: Request, res: Response, reason?: string) => void
  }) {
    return async (req: Request, res: Response, next: Function) => {
      try {
        const userId = req.user?.id;
        const workspaceId = req.params.workspaceId ? parseInt(req.params.workspaceId) : undefined;
        const action = options.actionResolver ? options.actionResolver(req) : req.method;
        const resourceId = options.resourceIdResolver ? options.resourceIdResolver(req) : req.params.id;
        const input = options.inputResolver ? options.inputResolver(req) : {
          user: req.user,
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body,
          params: req.params
        };
        
        const result = await this.evaluatePolicy(options.policyId, input, {
          userId,
          workspaceId,
          resourceType: options.resourceType,
          resourceId,
          action
        });
        
        if (result.decision === 'allow') {
          return next();
        } else {
          if (options.onDeny) {
            return options.onDeny(req, res, result.reason);
          } else {
            return res.status(403).json({
              error: 'Forbidden',
              message: result.reason || 'Access denied by policy'
            });
          }
        }
      } catch (error) {
        console.error('Error in policy middleware:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Error evaluating policy'
        });
      }
    };
  }
}

export const policyManagementService = new PolicyManagementService();