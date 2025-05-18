import express, { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { eq, and, ilike, or } from 'drizzle-orm';
import { users, roles, userRoles, workspaces, workspaceMembers } from '@shared/schema';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const router = express.Router();

/**
 * Hash a password with a salt
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Compare a password with a hashed password
 */
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

/**
 * Get all users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get all users with their roles
    const allUsers = await storage.getAllUsersWithRoles();

    // Add workspace information to each user
    const usersWithWorkspaces = await Promise.all(
      allUsers.map(async (user) => {
        const userWorkspaces = await storage.getUserWorkspaces(user.id);
        return {
          ...user,
          workspaces: userWorkspaces || [],
        };
      })
    );

    return res.status(200).json(usersWithWorkspaces);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get a specific user by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user roles
    const userRolesList = await storage.getUserRoles(userId);
    
    // Get user workspaces
    const userWorkspaces = await storage.getUserWorkspaces(userId);

    // Combine all information
    const userWithDetails = {
      ...user,
      roles: userRolesList || [],
      workspaces: userWorkspaces || [],
    };

    return res.status(200).json(userWithDetails);
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * Create a new user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const userSchema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Invalid email address'),
      fullName: z.string().min(2, 'Full name must be at least 2 characters'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      isActive: z.boolean().default(true),
      roleIds: z.array(z.number()).min(1, 'At least one role is required'),
      workspaceIds: z.array(z.number()).optional(),
      authProviderId: z.number().optional(),
      externalId: z.string().optional(),
    });

    const validatedData = userSchema.parse(req.body);

    // Check if username or email already exists
    const existingUser = await storage.getUserByUsername(validatedData.username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await storage.getUserByEmail(validatedData.email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create user with hashed password
    const hashedPassword = await hashPassword(validatedData.password);
    
    const newUser = await storage.createUser({
      username: validatedData.username,
      email: validatedData.email,
      fullName: validatedData.fullName,
      password: hashedPassword,
      isActive: validatedData.isActive,
      authProviderId: validatedData.authProviderId,
      externalId: validatedData.externalId,
    });

    // Assign roles to user
    for (const roleId of validatedData.roleIds) {
      await storage.assignRoleToUser(newUser.id, roleId);
    }

    // Assign workspaces to user if provided
    if (validatedData.workspaceIds && validatedData.workspaceIds.length > 0) {
      for (const workspaceId of validatedData.workspaceIds) {
        await storage.addUserToWorkspace(newUser.id, workspaceId);
      }
    }

    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.create', {
      userId: newUser.id,
      username: newUser.username,
      roles: validatedData.roleIds,
      workspaces: validatedData.workspaceIds || [],
    });

    // Get complete user data with roles and workspaces
    const userRolesList = await storage.getUserRoles(newUser.id);
    const userWorkspaces = await storage.getUserWorkspaces(newUser.id);

    const userWithDetails = {
      ...newUser,
      roles: userRolesList || [],
      workspaces: userWorkspaces || [],
    };

    return res.status(201).json(userWithDetails);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * Update a user
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists
    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate request body
    const updateUserSchema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters').optional(),
      email: z.string().email('Invalid email address').optional(),
      fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
      password: z.string().min(8, 'Password must be at least 8 characters').optional(),
      isActive: z.boolean().optional(),
      roleIds: z.array(z.number()).min(1, 'At least one role is required').optional(),
      workspaceIds: z.array(z.number()).optional(),
      authProviderId: z.number().optional(),
      externalId: z.string().optional(),
    });

    const validatedData = updateUserSchema.parse(req.body);

    // Check if username is unique if being updated
    if (validatedData.username && validatedData.username !== existingUser.username) {
      const usernameExists = await storage.getUserByUsername(validatedData.username);
      if (usernameExists) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    // Check if email is unique if being updated
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await storage.getUserByEmail(validatedData.email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user
    const updateData: any = { ...validatedData };
    
    // Hash password if provided
    if (validatedData.password) {
      updateData.password = await hashPassword(validatedData.password);
    }

    // Remove roleIds and workspaceIds as they're handled separately
    delete updateData.roleIds;
    delete updateData.workspaceIds;

    const updatedUser = await storage.updateUser(userId, updateData);

    // Update roles if provided
    if (validatedData.roleIds) {
      // Remove existing roles
      await storage.removeAllUserRoles(userId);
      
      // Add new roles
      for (const roleId of validatedData.roleIds) {
        await storage.assignRoleToUser(userId, roleId);
      }
    }

    // Update workspaces if provided
    if (validatedData.workspaceIds) {
      // Remove existing workspace assignments
      await storage.removeUserFromAllWorkspaces(userId);
      
      // Add new workspace assignments
      for (const workspaceId of validatedData.workspaceIds) {
        await storage.addUserToWorkspace(userId, workspaceId);
      }
    }

    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.update', {
      userId,
      updates: Object.keys(validatedData),
      roleUpdated: !!validatedData.roleIds,
      workspacesUpdated: !!validatedData.workspaceIds,
    });

    // Get updated user data with roles and workspaces
    const userRolesList = await storage.getUserRoles(userId);
    const userWorkspaces = await storage.getUserWorkspaces(userId);

    const userWithDetails = {
      ...updatedUser,
      roles: userRolesList || [],
      workspaces: userWorkspaces || [],
    };

    return res.status(200).json(userWithDetails);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error(`Error updating user ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Delete a user
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists
    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deletion of the admin user
    if (existingUser.username === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }

    // Save user details for audit log
    const username = existingUser.username;

    // Remove user from all workspaces
    await storage.removeUserFromAllWorkspaces(userId);
    
    // Remove all user roles
    await storage.removeAllUserRoles(userId);
    
    // Delete user
    await storage.deleteUser(userId);

    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.delete', {
      userId,
      username,
    });

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(`Error deleting user ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * Toggle user active status
 */
router.put('/:id/toggle-status', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists
    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent toggling the admin user
    if (existingUser.username === 'admin') {
      return res.status(403).json({ error: 'Cannot change status of admin user' });
    }

    // Toggle isActive status
    const newStatus = !existingUser.isActive;
    const updatedUser = await storage.updateUser(userId, { isActive: newStatus });

    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.toggle_status', {
      userId,
      username: existingUser.username,
      newStatus,
    });

    // Get complete user data with roles and workspaces
    const userRolesList = await storage.getUserRoles(userId);
    const userWorkspaces = await storage.getUserWorkspaces(userId);

    const userWithDetails = {
      ...updatedUser,
      roles: userRolesList || [],
      workspaces: userWorkspaces || [],
    };

    return res.status(200).json(userWithDetails);
  } catch (error) {
    console.error(`Error toggling user status ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

/**
 * Search users
 */
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const searchQuery = req.params.query.toLowerCase();
    
    const searchResults = await storage.db.query.users.findMany({
      where: or(
        ilike(users.username, `%${searchQuery}%`),
        ilike(users.email, `%${searchQuery}%`),
        ilike(users.fullName, `%${searchQuery}%`)
      ),
    });

    // Enrich search results with roles and workspaces
    const enrichedResults = await Promise.all(
      searchResults.map(async (user) => {
        const userRolesList = await storage.getUserRoles(user.id);
        const userWorkspaces = await storage.getUserWorkspaces(user.id);
        
        return {
          ...user,
          roles: userRolesList || [],
          workspaces: userWorkspaces || [],
        };
      })
    );

    return res.status(200).json(enrichedResults);
  } catch (error) {
    console.error(`Error searching users for ${req.params.query}:`, error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;