import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { 
  Loader2, 
  MoreVertical, 
  Plus, 
  Trash, 
  Edit, 
  Shield, 
  ShieldCheck, 
  UserCog,
  Users,
  Lock,
  Check,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Role {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
  isSystem: boolean;
}

const roleSchema = z.object({
  name: z.string().min(3, 'Role name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  permissions: z.array(z.string()).min(1, 'At least one permission must be selected'),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export default function RoleManagementPage() {
  const { toast } = useToast();
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissionFilter, setPermissionFilter] = useState('');
  
  // Form for creating/editing roles
  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    }
  });
  
  // Reset form when dialog closes
  const resetAndCloseForm = () => {
    roleForm.reset();
    setIsCreateRoleDialogOpen(false);
    setIsEditRoleDialogOpen(false);
    setSelectedRole(null);
  };
  
  // Set form values when editing a role
  const editRole = (role: Role) => {
    roleForm.reset({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
    setSelectedRole(role);
    setIsEditRoleDialogOpen(true);
  };
  
  // Query roles
  const { 
    data: roles, 
    isLoading: rolesLoading, 
    error: rolesError 
  } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    // We need to enable this so roles are actually fetched
  });
  
  // Query permissions
  const { 
    data: permissionsData, 
    isLoading: permissionsLoading, 
    error: permissionsError 
  } = useQuery<{permissions: Permission[]}|null>({
    queryKey: ['/api/roles/permissions/all'],
    // We need to enable this so permissions are actually fetched
  });
  
  // Extract permissions array safely from the response
  const permissions = permissionsData?.permissions || [];
  
  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormValues) => {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          permissions: data.permissions
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create role');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      resetAndCloseForm();
      // Invalidate the roles query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({
        title: 'Role created',
        description: 'Role has been created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create role',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: RoleFormValues }) => {
      const response = await fetch(`/api/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          permissions: data.permissions
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      resetAndCloseForm();
      // Invalidate the roles query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({
        title: 'Role updated',
        description: 'Role has been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/roles/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete role');
      }
      
      return true;
    },
    onSuccess: () => {
      // Invalidate the roles query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({
        title: 'Role deleted',
        description: 'Role has been deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete role',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle form submission for creating a role
  const handleCreateRole = (data: RoleFormValues) => {
    createRoleMutation.mutate(data);
  };
  
  // Handle form submission for editing a role
  const handleUpdateRole = (data: RoleFormValues) => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data });
    }
  };
  
  // Handle deleting a role
  const handleDeleteRole = (id: number) => {
    deleteRoleMutation.mutate(id);
  };
  
  // Filter permissions by search term
  const filteredPermissions = Array.isArray(permissions) ? permissions.filter(permission => 
    permission.name.toLowerCase().includes(permissionFilter.toLowerCase()) ||
    permission.description.toLowerCase().includes(permissionFilter.toLowerCase()) ||
    permission.category.toLowerCase().includes(permissionFilter.toLowerCase())
  ) : [];
  
  // Group permissions by category
  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
  
  // Sample data for demonstration
  const sampleRoles: Role[] = [
    {
      id: 1,
      name: 'Administrator',
      description: 'Full system access with all permissions',
      isSystem: true,
      permissions: ['admin:*', 'user:*', 'oauth:*', 'mcp:*'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'MCP Manager',
      description: 'Manages MCP servers and tools',
      isSystem: false,
      permissions: ['mcp:server:read', 'mcp:server:write', 'mcp:tool:read', 'mcp:tool:write'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 3,
      name: 'Client Developer',
      description: 'Can create and manage OAuth clients',
      isSystem: false,
      permissions: ['oauth:client:read', 'oauth:client:create', 'oauth:client:update'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 4,
      name: 'Auditor',
      description: 'Read-only access for audit purposes',
      isSystem: true,
      permissions: ['audit:read', 'oauth:client:read', 'user:read', 'mcp:server:read'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 5,
      name: 'User Manager',
      description: 'Manages user accounts',
      isSystem: false,
      permissions: ['user:read', 'user:create', 'user:update'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];
  
  const samplePermissions: Permission[] = [
    // Admin permissions
    { id: 1, name: 'admin:*', description: 'All administrative permissions', category: 'Administration', isSystem: true },
    { id: 2, name: 'admin:system:read', description: 'View system settings', category: 'Administration', isSystem: true },
    { id: 3, name: 'admin:system:write', description: 'Modify system settings', category: 'Administration', isSystem: true },
    
    // User permissions
    { id: 4, name: 'user:read', description: 'View user information', category: 'User Management', isSystem: true },
    { id: 5, name: 'user:create', description: 'Create new users', category: 'User Management', isSystem: true },
    { id: 6, name: 'user:update', description: 'Update user information', category: 'User Management', isSystem: true },
    { id: 7, name: 'user:delete', description: 'Delete users', category: 'User Management', isSystem: true },
    
    // OAuth permissions
    { id: 8, name: 'oauth:client:read', description: 'View OAuth clients', category: 'OAuth & Access', isSystem: true },
    { id: 9, name: 'oauth:client:create', description: 'Create OAuth clients', category: 'OAuth & Access', isSystem: true },
    { id: 10, name: 'oauth:client:update', description: 'Update OAuth clients', category: 'OAuth & Access', isSystem: true },
    { id: 11, name: 'oauth:client:delete', description: 'Delete OAuth clients', category: 'OAuth & Access', isSystem: true },
    { id: 12, name: 'oauth:token:manage', description: 'Manage OAuth tokens', category: 'OAuth & Access', isSystem: true },
    
    // MCP permissions
    { id: 13, name: 'mcp:server:read', description: 'View MCP servers', category: 'MCP Management', isSystem: true },
    { id: 14, name: 'mcp:server:write', description: 'Manage MCP servers', category: 'MCP Management', isSystem: true },
    { id: 15, name: 'mcp:tool:read', description: 'View MCP tools', category: 'MCP Management', isSystem: true },
    { id: 16, name: 'mcp:tool:write', description: 'Manage MCP tools', category: 'MCP Management', isSystem: true },
    
    // Audit permissions
    { id: 17, name: 'audit:read', description: 'View audit logs', category: 'Audit & Compliance', isSystem: true },
    { id: 18, name: 'audit:export', description: 'Export audit logs', category: 'Audit & Compliance', isSystem: true },
    
    // Agent permissions
    { id: 19, name: 'agent:read', description: 'View agents', category: 'Agent Management', isSystem: true },
    { id: 20, name: 'agent:write', description: 'Manage agents', category: 'Agent Management', isSystem: true },
    { id: 21, name: 'agent:execute', description: 'Execute agent actions', category: 'Agent Management', isSystem: true },
    
    // Module-specific permissions
    { id: 22, name: 'financial:read', description: 'View financial data', category: 'Financial Module', isSystem: true },
    { id: 23, name: 'financial:write', description: 'Manage financial data', category: 'Financial Module', isSystem: true },
    { id: 24, name: 'healthcare:read', description: 'View healthcare data', category: 'Healthcare Module', isSystem: true },
    { id: 25, name: 'healthcare:phi:access', description: 'Access protected health information', category: 'Healthcare Module', isSystem: true }
  ];
  
  // Group sample permissions by category
  const sampleGroupedPermissions = samplePermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);
  
  return (
    <div className="container py-8 px-4">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Role & Permission Management</h1>
        <p className="text-muted-foreground">
          Configure role-based access control for enterprise security
        </p>
      </div>
      
      <Tabs defaultValue="roles">
        <TabsList className="mb-6">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="roles">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">System Roles</h2>
              <p className="text-sm text-muted-foreground">
                Manage roles and their assigned permissions
              </p>
            </div>
            <Button onClick={() => setIsCreateRoleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolesLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {!rolesLoading && roles && roles.length > 0 && roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>
                        {role.isSystem ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions && role.permissions.length <= 3 ? (
                            role.permissions.map((permission: any, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {typeof permission === 'string' ? permission : permission.name}
                              </Badge>
                            ))
                          ) : role.permissions && role.permissions.length > 0 ? (
                            <>
                              {role.permissions.slice(0, 2).map((permission: any, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {typeof permission === 'string' ? permission : permission.name}
                                </Badge>
                              ))}
                              <Badge variant="outline" className="text-xs">
                                +{role.permissions.length - 2} more
                              </Badge>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">No permissions</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => editRole(role)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Users className="h-4 w-4 mr-2" />
                              View Users
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!role.isSystem && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-red-500 focus:text-red-500"
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete Role
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the role "{role.name}" and remove it from all users.
                                      Users will lose any permissions granted by this role.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRole(role.id)}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {!rolesLoading && (!roles || roles.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No roles found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="permissions">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">System Permissions</h2>
                <p className="text-sm text-muted-foreground">
                  View available permissions that can be assigned to roles
                </p>
              </div>
              <div className="w-1/3">
                <Input 
                  placeholder="Search permissions..."
                  value={permissionFilter}
                  onChange={(e) => setPermissionFilter(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-6">
              {Object.entries(sampleGroupedPermissions).map(([category, permissions]) => (
                <Card key={category}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-lg">{category}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Permission Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissions.map((permission) => (
                          <TableRow key={permission.id}>
                            <TableCell className="font-mono text-sm">{permission.name}</TableCell>
                            <TableCell>{permission.description}</TableCell>
                            <TableCell>
                              {permission.isSystem ? (
                                <Badge variant="secondary">System</Badge>
                              ) : (
                                <Badge variant="outline">Custom</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Create Role Dialog */}
      <Dialog open={isCreateRoleDialogOpen} onOpenChange={setIsCreateRoleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a new role with specific permissions
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={roleForm.handleSubmit(handleCreateRole)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input 
                  id="name"
                  placeholder="e.g., API Manager"
                  {...roleForm.register('name')}
                />
                {roleForm.formState.errors.name && (
                  <p className="text-sm font-medium text-destructive">
                    {roleForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description"
                  placeholder="Brief description of this role's purpose"
                  {...roleForm.register('description')}
                />
                {roleForm.formState.errors.description && (
                  <p className="text-sm font-medium text-destructive">
                    {roleForm.formState.errors.description.message}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border rounded-md">
                <div className="p-4 border-b bg-muted/30">
                  <Input 
                    placeholder="Search permissions..." 
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                  />
                </div>
                
                <div className="p-4 space-y-6 max-h-[300px] overflow-y-auto">
                  {Object.entries(sampleGroupedPermissions).map(([category, permissions]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-sm">{category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <Controller
                              control={roleForm.control}
                              name="permissions"
                              render={({ field }) => (
                                <Checkbox
                                  id={`permission-${permission.id}`}
                                  checked={field.value.includes(permission.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, permission.name]);
                                    } else {
                                      field.onChange(field.value.filter(val => val !== permission.name));
                                    }
                                  }}
                                />
                              )}
                            />
                            <div className="space-y-1">
                              <Label 
                                htmlFor={`permission-${permission.id}`}
                                className="font-mono text-sm"
                              >
                                {permission.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {roleForm.formState.errors.permissions && (
                <p className="text-sm font-medium text-destructive">
                  {roleForm.formState.errors.permissions.message}
                </p>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={resetAndCloseForm}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createRoleMutation.isPending}
              >
                {createRoleMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Role: {selectedRole?.name}</DialogTitle>
            <DialogDescription>
              Modify role details and permissions
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={roleForm.handleSubmit(handleUpdateRole)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input 
                  id="name"
                  placeholder="e.g., API Manager"
                  {...roleForm.register('name')}
                  disabled={selectedRole?.isSystem}
                />
                {roleForm.formState.errors.name && (
                  <p className="text-sm font-medium text-destructive">
                    {roleForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description"
                  placeholder="Brief description of this role's purpose"
                  {...roleForm.register('description')}
                />
                {roleForm.formState.errors.description && (
                  <p className="text-sm font-medium text-destructive">
                    {roleForm.formState.errors.description.message}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border rounded-md">
                <div className="p-4 border-b bg-muted/30">
                  <Input 
                    placeholder="Search permissions..." 
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                  />
                </div>
                
                <div className="p-4 space-y-6 max-h-[300px] overflow-y-auto">
                  {Object.entries(sampleGroupedPermissions).map(([category, permissions]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-sm">{category}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <Controller
                              control={roleForm.control}
                              name="permissions"
                              render={({ field }) => (
                                <Checkbox
                                  id={`edit-permission-${permission.id}`}
                                  checked={field.value.includes(permission.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, permission.name]);
                                    } else {
                                      field.onChange(field.value.filter(val => val !== permission.name));
                                    }
                                  }}
                                />
                              )}
                            />
                            <div className="space-y-1">
                              <Label 
                                htmlFor={`edit-permission-${permission.id}`}
                                className="font-mono text-sm"
                              >
                                {permission.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {roleForm.formState.errors.permissions && (
                <p className="text-sm font-medium text-destructive">
                  {roleForm.formState.errors.permissions.message}
                </p>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={resetAndCloseForm}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}