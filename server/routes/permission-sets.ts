import { Router } from "express";
import { z } from "zod";
import { db } from "@db";
import { permissionSets } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

const router = Router();

// Validation schema for permission sets
const permissionSetInsertSchema = createInsertSchema(permissionSets, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  category: (schema) => schema.refine(
    (val) => ["auth", "data", "tool", "system", "admin"].includes(val),
    { message: "Category must be one of: auth, data, tool, system, admin" }
  ),
  permissions: (schema) => schema,
  oauthScopes: (schema) => schema.optional(),
  abacConditions: (schema) => schema.optional(),
  attributes: (schema) => schema.optional(),
});

// Update schema is the same but makes permissions optional
const permissionSetUpdateSchema = permissionSetInsertSchema.extend({
  permissions: z.array(z.string()).optional(),
});

// Get all permission sets
router.get("/", async (req, res) => {
  try {
    const { workspaceId, includeGlobal, category } = req.query;
    const whereConditions = [];
    
    // If user has a current workspace and no specific workspace is requested,
    // default to the user's current workspace
    let targetWorkspaceId = workspaceId ? parseInt(workspaceId as string) : null;
    
    if (!targetWorkspaceId && req.user?.currentWorkspaceId) {
      targetWorkspaceId = req.user.currentWorkspaceId;
    }
    
    // Check if user has access to the requested workspace
    if (targetWorkspaceId && 
        req.user?.currentWorkspaceId && 
        targetWorkspaceId !== req.user.currentWorkspaceId) {
      return res.status(403).json({ 
        error: "You can only view permission sets from your current workspace" 
      });
    }
    
    // Include global parameter handling
    const shouldIncludeGlobal = includeGlobal === undefined || includeGlobal === "true";
    
    if (targetWorkspaceId) {
      // Filter by specific workspace
      if (shouldIncludeGlobal) {
        // Include both workspace-specific and global sets
        whereConditions.push(
          or(
            eq(permissionSets.workspaceId, targetWorkspaceId),
            eq(permissionSets.isGlobal, true)
          )
        );
      } else {
        // Only include workspace-specific sets
        whereConditions.push(eq(permissionSets.workspaceId, targetWorkspaceId));
      }
    } else {
      // No workspace specified, show only global sets
      whereConditions.push(eq(permissionSets.isGlobal, true));
    }
    
    // Filter by category if specified
    if (category) {
      whereConditions.push(eq(permissionSets.category, category as string));
    }
    
    // Execute the query
    const sets = await db.query.permissionSets.findMany({
      where: whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0],
      orderBy: (sets, { desc }) => [desc(sets.updatedAt)],
      with: {
        workspace: true
      }
    });
    
    console.info("Permission sets fetched", {
      count: sets.length,
      workspaceId: targetWorkspaceId,
      includeGlobal: shouldIncludeGlobal,
      category: category || "all",
      userId: req.user?.id
    });
    
    return res.json(sets);
  } catch (error) {
    console.error("Error fetching permission sets", error);
    return res.status(500).json({ error: "Failed to fetch permission sets" });
  }
});

// Get a single permission set by ID
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    const set = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
      with: {
        workspace: true
      }
    });
    
    if (!set) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // Check access based on workspace if the user has a current workspace context
    if (req.user?.currentWorkspaceId && 
        set.workspaceId && 
        set.workspaceId !== req.user.currentWorkspaceId && 
        !set.isGlobal) {
      return res.status(403).json({ 
        error: "Access denied. This permission set belongs to a different workspace." 
      });
    }
    
    return res.json(set);
  } catch (error) {
    console.error(`Error fetching permission set ${req.params.id}`, error);
    return res.status(500).json({ error: "Failed to fetch permission set" });
  }
});

// Create a new permission set
router.post("/", async (req, res) => {
  try {
    // Add workspaceId validation to the schema
    const permissionSetInsertWithWorkspaceSchema = permissionSetInsertSchema.extend({
      workspaceId: z.number().optional(),
      isGlobal: z.boolean().default(false).optional()
    });
    
    // Get and validate the data
    const validatedData = permissionSetInsertWithWorkspaceSchema.parse(req.body);
    
    // If workspaceId not specified but user has currentWorkspaceId, use that
    if (!validatedData.workspaceId && req.user?.currentWorkspaceId && !validatedData.isGlobal) {
      validatedData.workspaceId = req.user.currentWorkspaceId;
    }
    
    // Set the isGlobal flag based on presence of workspaceId
    if (!validatedData.workspaceId && validatedData.isGlobal !== true) {
      validatedData.isGlobal = true;
    }
    
    // Block creating workspace-specific sets outside user's current workspace
    if (validatedData.workspaceId && 
        req.user?.currentWorkspaceId && 
        validatedData.workspaceId !== req.user.currentWorkspaceId) {
      return res.status(403).json({ 
        error: "You can only create permission sets for your current workspace" 
      });
    }
    
    // Create the permission set
    const [newSet] = await db.insert(permissionSets)
      .values(validatedData)
      .returning();
    
    console.info(`Permission set created: ${newSet.name}`, {
      userId: req.user?.id,
      permissionSetId: newSet.id,
      workspaceId: newSet.workspaceId,
      isGlobal: newSet.isGlobal
    });
    
    return res.status(201).json(newSet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    
    console.error("Error creating permission set", { error });
    return res.status(500).json({ error: "Failed to create permission set" });
  }
});

// Update a permission set
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Add workspaceId validation to the schema
    const permissionSetUpdateWithWorkspaceSchema = permissionSetUpdateSchema.extend({
      workspaceId: z.number().optional(),
      isGlobal: z.boolean().optional()
    });
    
    // Validate incoming data
    const validatedData = permissionSetUpdateWithWorkspaceSchema.parse(req.body);
    
    // Check if the permission set exists with workspace info
    const existingSet = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
      with: {
        workspace: true
      }
    });
    
    if (!existingSet) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // Check workspace permissions
    if (existingSet.workspaceId && 
        req.user?.currentWorkspaceId && 
        existingSet.workspaceId !== req.user.currentWorkspaceId && 
        !existingSet.isGlobal) {
      return res.status(403).json({ 
        error: "You cannot modify permission sets from other workspaces" 
      });
    }
    
    // Block changing a set from one workspace to another
    if (validatedData.workspaceId && 
        existingSet.workspaceId && 
        validatedData.workspaceId !== existingSet.workspaceId) {
      return res.status(400).json({ 
        error: "Cannot change the workspace association of an existing permission set" 
      });
    }
    
    // Handle isGlobal flag logic
    if (validatedData.isGlobal === true && existingSet.workspaceId) {
      // If changing to global, remove workspace association
      validatedData.workspaceId = null;
    } else if (validatedData.isGlobal === false && !existingSet.workspaceId && !validatedData.workspaceId) {
      // If removing global flag but no workspace specified, assign to user's current workspace
      if (req.user?.currentWorkspaceId) {
        validatedData.workspaceId = req.user.currentWorkspaceId;
      } else {
        return res.status(400).json({ 
          error: "Cannot remove global flag without specifying a workspace" 
        });
      }
    }
    
    // Update the permission set
    const [updatedSet] = await db.update(permissionSets)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(permissionSets.id, id))
      .returning();
    
    console.info(`Permission set updated: ${updatedSet.name}`, {
      userId: req.user?.id,
      permissionSetId: updatedSet.id,
      workspaceId: updatedSet.workspaceId,
      isGlobal: updatedSet.isGlobal
    });
    
    return res.json(updatedSet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    
    console.error(`Error updating permission set ${req.params.id}`, { error });
    return res.status(500).json({ error: "Failed to update permission set" });
  }
});

// Delete a permission set
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Check if the permission set exists with workspace info
    const existingSet = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
      with: {
        workspace: true
      }
    });
    
    if (!existingSet) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // Check workspace permissions
    if (existingSet.workspaceId && 
        req.user?.currentWorkspaceId && 
        existingSet.workspaceId !== req.user.currentWorkspaceId && 
        !existingSet.isGlobal) {
      return res.status(403).json({ 
        error: "You cannot delete permission sets from other workspaces" 
      });
    }
    
    // Check if this permission set is used by any roles (future enhancement)
    // This would prevent deleting permission sets that are in use
    
    // Delete the permission set
    await db.delete(permissionSets)
      .where(eq(permissionSets.id, id));
    
    console.info(`Permission set deleted: ${existingSet.name}`, {
      userId: req.user?.id,
      permissionSetId: id,
      workspaceId: existingSet.workspaceId,
      isGlobal: existingSet.isGlobal
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting permission set ${req.params.id}`, { error });
    return res.status(500).json({ error: "Failed to delete permission set" });
  }
});

// Evaluate a policy against a permission set (for the ABAC Policy Engine)
router.post("/:id/evaluate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Get the permission set with workspace info
    const permissionSet = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
      with: {
        workspace: true
      }
    });
    
    if (!permissionSet) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // Check workspace permissions (unless it's a global permission set)
    if (permissionSet.workspaceId && 
        req.user?.currentWorkspaceId && 
        permissionSet.workspaceId !== req.user.currentWorkspaceId && 
        !permissionSet.isGlobal) {
      return res.status(403).json({ 
        error: "You cannot evaluate permission sets from other workspaces" 
      });
    }
    
    // Extract context and validate it
    const contextSchema = z.object({
      user: z.object({}).passthrough(),
      resource: z.object({}).passthrough(),
      access: z.object({}).passthrough(),
      workspaceId: z.number().optional(),
      request: z.object({}).passthrough().optional(),
    });
    
    const context = contextSchema.parse(req.body);
    
    // Set workspaceId in context if not provided but permission set has one
    if (!context.workspaceId && permissionSet.workspaceId) {
      context.workspaceId = permissionSet.workspaceId;
    } else if (!context.workspaceId && req.user?.currentWorkspaceId) {
      // Use current user's workspace context if not specified in the request
      context.workspaceId = req.user.currentWorkspaceId;
    }
    
    // Verify workspace match for non-global permission sets
    if (permissionSet.workspaceId && 
        context.workspaceId && 
        permissionSet.workspaceId !== context.workspaceId && 
        !permissionSet.isGlobal) {
      return res.json({
        result: false,
        reason: "Permission set workspace does not match context workspace",
      });
    }
    
    // If no ABAC conditions, just check if the user has the required permissions
    if (!permissionSet.abacConditions) {
      return res.json({
        result: true,
        reason: "No ABAC conditions to evaluate, defaulting to permission-based access",
      });
    }
    
    // Use the real policy evaluation with Open Policy Agent
    const policyEvaluation = await evaluateAbacPolicy(permissionSet.abacConditions, context);
    
    return res.json({
      result: policyEvaluation.result,
      reason: policyEvaluation.reason,
      workspaceId: context.workspaceId,
      permissionSetWorkspace: permissionSet.workspaceId,
      isGlobal: permissionSet.isGlobal
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    
    console.error(`Error evaluating permission set ${req.params.id}`, { error });
    return res.status(500).json({ error: "Failed to evaluate permission set" });
  }
});

import { PolicyManagementService } from "../services/policyManagementService";

// Initialize the policy service
const policyService = new PolicyManagementService();

/**
 * Evaluate ABAC policy using the Policy Management Service
 * Uses the Open Policy Agent for real policy evaluation
 */
async function evaluateAbacPolicy(abacConditions: string, context: any) {
  try {
    // Create a temporary policy from the ABAC conditions
    const tempPolicy = {
      id: 0, // Temporary ID for evaluation purposes
      name: "TempPermissionSetPolicy",
      description: "Dynamically generated policy for permission set evaluation",
      content: JSON.stringify({
        rules: [
          {
            resource_type: context.resource?.type || "default",
            action: context.access?.action || "access",
            condition: abacConditions,
            effect: "allow"
          }
        ]
      }),
      policyType: "json",
      status: "active",
      workspaceId: context.workspaceId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Compile the policy
    await policyService.compileAndCachePolicy(tempPolicy);
    
    // Evaluate the policy against the context
    const evaluation = await policyService.evaluatePolicy(
      tempPolicy.id,
      context,
      {
        userId: context.user?.id,
        workspaceId: context.workspaceId,
        resourceType: context.resource?.type || "unknown",
        resourceId: context.resource?.id?.toString() || undefined,
        action: context.access?.action || "access"
      }
    );
    
    return {
      result: evaluation.decision === 'allow',
      reason: evaluation.reason || (evaluation.decision === 'allow' ? 
        "Policy conditions satisfied" : "Policy conditions not satisfied")
    };
  } catch (error) {
    console.error("Error evaluating ABAC policy:", error);
    return {
      result: false,
      reason: "Error evaluating policy: " + (error instanceof Error ? error.message : String(error))
    };
  }
}

// Assign a permission set to a workspace
router.post("/:id/assign-to-workspace", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // Validate incoming data
    const assignSchema = z.object({
      workspaceId: z.number(),
    });

    const validatedData = assignSchema.parse(req.body);
    
    // Check if the permission set exists
    const existingSet = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
    });
    
    if (!existingSet) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // Check if user has rights to the target workspace
    if (req.user?.currentWorkspaceId !== validatedData.workspaceId) {
      return res.status(403).json({ 
        error: "You can only assign permission sets to your current workspace" 
      });
    }
    
    // Check if the permission set is already assigned to another workspace
    if (existingSet.workspaceId && existingSet.workspaceId !== validatedData.workspaceId) {
      return res.status(400).json({ 
        error: "This permission set is already assigned to a different workspace" 
      });
    }
    
    // If set is global, we need to create a copy for the workspace
    if (existingSet.isGlobal) {
      // Create a new workspace-specific copy
      const [newSet] = await db.insert(permissionSets)
        .values({
          name: `${existingSet.name} (Workspace Copy)`,
          description: existingSet.description,
          category: existingSet.category,
          permissions: existingSet.permissions,
          oauthScopes: existingSet.oauthScopes,
          abacConditions: existingSet.abacConditions,
          attributes: existingSet.attributes,
          workspaceId: validatedData.workspaceId,
          isGlobal: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      console.info(`Created workspace copy of permission set: ${newSet.name}`, {
        userId: req.user?.id,
        permissionSetId: newSet.id,
        sourceSetId: existingSet.id,
        workspaceId: newSet.workspaceId,
      });
      
      return res.status(201).json({
        ...newSet,
        message: "Created a workspace-specific copy of the global permission set"
      });
    } else if (!existingSet.workspaceId) {
      // It's not global but has no workspace, so we can assign it directly
      const [updatedSet] = await db.update(permissionSets)
        .set({
          workspaceId: validatedData.workspaceId,
          isGlobal: false,
          updatedAt: new Date(),
        })
        .where(eq(permissionSets.id, id))
        .returning();
      
      console.info(`Assigned permission set to workspace: ${updatedSet.name}`, {
        userId: req.user?.id,
        permissionSetId: updatedSet.id,
        workspaceId: updatedSet.workspaceId,
      });
      
      return res.json(updatedSet);
    } else {
      // Already assigned to the requested workspace, nothing to do
      return res.json({
        ...existingSet,
        message: "Permission set is already assigned to this workspace"
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    
    console.error(`Error assigning permission set ${req.params.id} to workspace`, { error });
    return res.status(500).json({ error: "Failed to assign permission set to workspace" });
  }
});

// Remove a permission set from a workspace (make it global)
router.post("/:id/make-global", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    // Check if the permission set exists
    const existingSet = await db.query.permissionSets.findFirst({
      where: eq(permissionSets.id, id),
    });
    
    if (!existingSet) {
      return res.status(404).json({ error: "Permission set not found" });
    }
    
    // If already global, nothing to do
    if (existingSet.isGlobal) {
      return res.json({
        ...existingSet,
        message: "Permission set is already global"
      });
    }
    
    // Check if user has rights to the current workspace
    if (existingSet.workspaceId && 
        req.user?.currentWorkspaceId !== existingSet.workspaceId) {
      return res.status(403).json({ 
        error: "You can only manage permission sets in your current workspace" 
      });
    }
    
    // Update to make global
    const [updatedSet] = await db.update(permissionSets)
      .set({
        workspaceId: null,
        isGlobal: true,
        updatedAt: new Date(),
      })
      .where(eq(permissionSets.id, id))
      .returning();
    
    console.info(`Made permission set global: ${updatedSet.name}`, {
      userId: req.user?.id,
      permissionSetId: updatedSet.id,
      previousWorkspaceId: existingSet.workspaceId,
    });
    
    return res.json(updatedSet);
  } catch (error) {
    console.error(`Error making permission set ${req.params.id} global`, { error });
    return res.status(500).json({ error: "Failed to make permission set global" });
  }
});

export default router;