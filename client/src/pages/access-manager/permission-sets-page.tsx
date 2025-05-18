import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Search, Edit, Trash2, ShieldCheck, Shield, Lock, Eye, FileText, Users, Database, Server, Network, AlertTriangle } from "lucide-react";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageHeader from "@/components/page-header";

// Schema Definitions
const permissionSetSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(["auth", "data", "tool", "system", "admin"]),
  oauthScopes: z.array(z.string()).optional(),
  permissions: z.array(z.string()).min(1, "At least one permission must be selected"),
  attributes: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    })
  ).optional(),
  abacConditions: z.string().optional(),
});

// Mock data - will be replaced with real API integration
const mockCategories = [
  { id: "auth", name: "Authentication & Authorization", icon: <ShieldCheck className="h-5 w-5" /> },
  { id: "data", name: "Data Access", icon: <Database className="h-5 w-5" /> },
  { id: "tool", name: "Tool Execution", icon: <Server className="h-5 w-5" /> },
  { id: "system", name: "System Resources", icon: <Network className="h-5 w-5" /> },
  { id: "admin", name: "Administrative Actions", icon: <Shield className="h-5 w-5" /> },
];

const mockPermissionsByCategory = {
  auth: [
    { id: "auth:login", name: "Log in to the system", description: "Allow users to authenticate" },
    { id: "auth:refresh", name: "Refresh tokens", description: "Allow users to refresh authentication tokens" },
    { id: "auth:mfa", name: "Use MFA", description: "Use multi-factor authentication" },
    { id: "auth:impersonate", name: "Impersonate users", description: "Impersonate other users (admin only)" },
  ],
  data: [
    { id: "data:read", name: "Read data", description: "Read data from the system" },
    { id: "data:write", name: "Write data", description: "Write data to the system" },
    { id: "data:delete", name: "Delete data", description: "Delete data from the system" },
    { id: "data:export", name: "Export data", description: "Export data from the system" },
    { id: "data:import", name: "Import data", description: "Import data into the system" },
    { id: "data:sensitive-read", name: "Read sensitive data", description: "Read sensitive/PII data" },
  ],
  tool: [
    { id: "tool:list", name: "List available tools", description: "List all available MCP tools" },
    { id: "tool:execute", name: "Execute tools", description: "Execute MCP tools" },
    { id: "tool:create", name: "Create custom tools", description: "Create custom MCP tools" },
    { id: "tool:edit", name: "Edit tools", description: "Edit existing MCP tools" },
    { id: "tool:delete", name: "Delete tools", description: "Delete MCP tools" },
  ],
  system: [
    { id: "system:read", name: "View system information", description: "View system status and configuration" },
    { id: "system:write", name: "Modify system configuration", description: "Modify system configuration" },
    { id: "system:logs", name: "View system logs", description: "View system logs and metrics" },
    { id: "system:restart", name: "Restart services", description: "Restart system services" },
  ],
  admin: [
    { id: "admin:users", name: "Manage users", description: "Create, update, and delete users" },
    { id: "admin:roles", name: "Manage roles", description: "Create, update, and delete roles" },
    { id: "admin:permissions", name: "Manage permissions", description: "Create, update, and delete permissions" },
    { id: "admin:settings", name: "Manage settings", description: "Modify system settings" },
    { id: "admin:audit", name: "View audit logs", description: "View audit logs of system actions" },
  ],
};

const mockOAuthScopes = [
  { id: "openid", name: "OpenID", description: "OpenID Connect authentication" },
  { id: "profile", name: "Profile", description: "Access to user profile information" },
  { id: "email", name: "Email", description: "Access to user email" },
  { id: "mcp.tools.read", name: "MCP Tools Read", description: "Read MCP tool metadata" },
  { id: "mcp.tools.execute", name: "MCP Tools Execute", description: "Execute MCP tools" },
  { id: "mcp.data.read", name: "MCP Data Read", description: "Read data from MCP sources" },
  { id: "mcp.data.write", name: "MCP Data Write", description: "Write data to MCP sources" },
  { id: "offline_access", name: "Offline Access", description: "Access without user presence" },
];

// ABAC Helper Functions
const abacTemplates = [
  { 
    id: "time-based", 
    name: "Time-Based Access", 
    template: 'access.time >= "08:00:00" AND access.time <= "18:00:00"',
    description: "Restrict access to business hours"
  },
  { 
    id: "network-based", 
    name: "Network Location", 
    template: 'access.ipAddress STARTSWITH "10.0" OR access.location == "office"',
    description: "Restrict access to corporate network" 
  },
  { 
    id: "mfa-based", 
    name: "Require MFA", 
    template: 'user.mfaVerified == true',
    description: "Require MFA for access"
  },
  {
    id: "sensitivity-based",
    name: "Data Sensitivity Level",
    template: 'request.dataClassification <= user.clearanceLevel',
    description: "Match user clearance with data sensitivity"
  },
  {
    id: "resource-owner",
    name: "Resource Owner",
    template: 'resource.ownerId == user.id OR user.isAdmin == true',
    description: "Allow access only to resource owners or admins"
  }
];

// Permission Set Management Page
export default function PermissionSetsPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSet, setSelectedSet] = useState<any>(null);
  const [selectedAbacTemplate, setSelectedAbacTemplate] = useState<string | null>(null);

  // Fetch permission sets
  const { data: permissionSets = [], isLoading } = useQuery({
    queryKey: ["/api/permission-sets"],
  });

  // Filter permission sets based on category and search query
  const filteredPermissionSets = useMemo(() => {
    let filtered = permissionSets;
    
    if (selectedCategory !== "all") {
      filtered = filtered.filter(set => set.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(set => 
        set.name.toLowerCase().includes(query) || 
        set.description.toLowerCase().includes(query) ||
        (set.permissions && set.permissions.some((p: string) => p.toLowerCase().includes(query)))
      );
    }
    
    return filtered;
  }, [permissionSets, selectedCategory, searchQuery]);

  // Create form
  const createForm = useForm<z.infer<typeof permissionSetSchema>>({
    resolver: zodResolver(permissionSetSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "tool",
      permissions: [],
      oauthScopes: [],
      attributes: [],
      abacConditions: "",
    },
  });

  // Edit form - initialize with selected set
  const editForm = useForm<z.infer<typeof permissionSetSchema>>({
    resolver: zodResolver(permissionSetSchema),
    defaultValues: {
      name: selectedSet?.name || "",
      description: selectedSet?.description || "",
      category: selectedSet?.category || "tool",
      permissions: selectedSet?.permissions || [],
      oauthScopes: selectedSet?.oauthScopes || [],
      attributes: selectedSet?.attributes || [],
      abacConditions: selectedSet?.abacConditions || "",
    },
  });

  // Update edit form when selected set changes
  useMemo(() => {
    if (selectedSet) {
      editForm.reset({
        name: selectedSet.name,
        description: selectedSet.description,
        category: selectedSet.category,
        permissions: selectedSet.permissions,
        oauthScopes: selectedSet.oauthScopes || [],
        attributes: selectedSet.attributes || [],
        abacConditions: selectedSet.abacConditions || "",
      });
    }
  }, [selectedSet, editForm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof permissionSetSchema>) => {
      const response = await fetch('/api/permission-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create permission set');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Permission set created",
        description: "The permission set has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error creating permission set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof permissionSetSchema> & { id: number }) => {
      const response = await fetch(`/api/permission-sets/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update permission set');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Permission set updated",
        description: "The permission set has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      editForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error updating permission set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/permission-sets/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete permission set');
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Permission set deleted",
        description: "The permission set has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting permission set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onCreateSubmit = (data: z.infer<typeof permissionSetSchema>) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof permissionSetSchema>) => {
    if (selectedSet) {
      updateMutation.mutate({ ...data, id: selectedSet.id });
    }
  };

  const handleDelete = () => {
    if (selectedSet) {
      deleteMutation.mutate(selectedSet.id);
    }
  };

  // Apply ABAC template
  const applyAbacTemplate = () => {
    if (!selectedAbacTemplate) return;
    
    const template = abacTemplates.find(t => t.id === selectedAbacTemplate);
    if (template) {
      if (isCreateDialogOpen) {
        createForm.setValue("abacConditions", template.template);
      } else if (isEditDialogOpen) {
        editForm.setValue("abacConditions", template.template);
      }
    }
  };

  // Render category badge
  const renderCategoryBadge = (category: string) => {
    switch (category) {
      case "auth":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Authentication</Badge>;
      case "data":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Data Access</Badge>;
      case "tool":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Tool Execution</Badge>;
      case "system":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">System</Badge>;
      case "admin":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Administrative</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="Permission Sets" 
        description="Define and manage permission sets for the OAuth flow and RBAC/ABAC policy engine"
        icon={<Lock className="h-6 w-6" />}
      />

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search permission sets..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {mockCategories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    {category.icon}
                    <span>{category.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Permission Set
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Permission Set</DialogTitle>
              <DialogDescription>
                Define a new permission set for the OAuth flow and RBAC/ABAC policy engine
              </DialogDescription>
            </DialogHeader>
            
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
                <Tabs defaultValue="basic">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                    <TabsTrigger value="oauth">OAuth Scopes</TabsTrigger>
                    <TabsTrigger value="abac">ABAC Rules</TabsTrigger>
                  </TabsList>
                  
                  {/* Basic Information Tab */}
                  <TabsContent value="basic" className="space-y-4 py-4">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Permission Set Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Basic User Access" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the purpose and scope of this permission set"
                              className="min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockCategories.map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex items-center gap-2">
                                    {category.icon}
                                    <span>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  {/* Permissions Tab */}
                  <TabsContent value="permissions" className="space-y-4 py-4">
                    <FormField
                      control={createForm.control}
                      name="permissions"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Permissions</FormLabel>
                            <FormDescription>
                              Select the permissions that will be granted by this permission set
                            </FormDescription>
                          </div>
                          
                          <div className="space-y-6">
                            {Object.entries(mockPermissionsByCategory).map(([category, permissions]) => (
                              <div key={category} className="space-y-2">
                                <h3 className="font-medium flex items-center gap-2">
                                  {mockCategories.find(c => c.id === category)?.icon}
                                  {mockCategories.find(c => c.id === category)?.name}
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                  {permissions.map(permission => (
                                    <FormField
                                      key={permission.id}
                                      control={createForm.control}
                                      name="permissions"
                                      render={({ field }) => (
                                        <FormItem
                                          key={permission.id}
                                          className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(permission.id)}
                                              onCheckedChange={(checked) => {
                                                const updatedValue = checked
                                                  ? [...(field.value || []), permission.id]
                                                  : (field.value || []).filter((value) => value !== permission.id);
                                                field.onChange(updatedValue);
                                              }}
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel className="font-normal text-sm">
                                              {permission.name}
                                            </FormLabel>
                                            <FormDescription className="text-xs">
                                              {permission.description}
                                            </FormDescription>
                                          </div>
                                        </FormItem>
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  {/* OAuth Scopes Tab */}
                  <TabsContent value="oauth" className="space-y-4 py-4">
                    <FormField
                      control={createForm.control}
                      name="oauthScopes"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">OAuth Scopes</FormLabel>
                            <FormDescription>
                              Select the OAuth scopes that will be requested during authorization
                            </FormDescription>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            {mockOAuthScopes.map(scope => (
                              <FormField
                                key={scope.id}
                                control={createForm.control}
                                name="oauthScopes"
                                render={({ field }) => (
                                  <FormItem
                                    key={scope.id}
                                    className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(scope.id)}
                                        onCheckedChange={(checked) => {
                                          const updatedValue = checked
                                            ? [...(field.value || []), scope.id]
                                            : (field.value || []).filter((value) => value !== scope.id);
                                          field.onChange(updatedValue);
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="font-normal text-sm">
                                        {scope.name}
                                      </FormLabel>
                                      <FormDescription className="text-xs">
                                        {scope.description}
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  {/* ABAC Rules Tab */}
                  <TabsContent value="abac" className="space-y-4 py-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-base">Attribute-Based Access Control Rules</FormLabel>
                        <div className="flex items-center space-x-2">
                          <Select onValueChange={setSelectedAbacTemplate}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                              {abacTemplates.map(template => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" onClick={applyAbacTemplate}>
                            Apply
                          </Button>
                        </div>
                      </div>
                      
                      <FormField
                        control={createForm.control}
                        name="abacConditions"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder='Enter conditions e.g., "resource.ownerId == user.id OR user.isAdmin == true"'
                                className="font-mono min-h-[120px]" 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Define attribute-based conditions for advanced access control policies.
                              These conditions will be evaluated at runtime against the user, resource, and context attributes.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="bg-muted/50 p-4 rounded-md">
                        <h4 className="font-medium mb-2 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                          Available Context Variables
                        </h4>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <h5 className="font-medium mb-1">User Context</h5>
                            <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                              <li>user.id</li>
                              <li>user.name</li>
                              <li>user.email</li>
                              <li>user.roles[]</li>
                              <li>user.groups[]</li>
                              <li>user.clearanceLevel</li>
                              <li>user.mfaVerified</li>
                            </ul>
                          </div>
                          <div>
                            <h5 className="font-medium mb-1">Resource Context</h5>
                            <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                              <li>resource.id</li>
                              <li>resource.type</li>
                              <li>resource.ownerId</li>
                              <li>resource.visibility</li>
                              <li>resource.tags[]</li>
                              <li>resource.createdAt</li>
                              <li>resource.workspaceId</li>
                            </ul>
                          </div>
                          <div>
                            <h5 className="font-medium mb-1">Access Context</h5>
                            <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                              <li>access.time</li>
                              <li>access.date</li>
                              <li>access.dayOfWeek</li>
                              <li>access.ipAddress</li>
                              <li>access.location</li>
                              <li>access.deviceType</li>
                              <li>access.browserFingerprint</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Permission Set"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border shadow">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        ) : filteredPermissionSets.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No permission sets found</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              {searchQuery 
                ? `No permission sets match your search query "${searchQuery}"`
                : selectedCategory !== "all"
                  ? `No permission sets in the ${selectedCategory} category`
                  : "Get started by creating a new permission set"}
            </p>
            <Button onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[150px]">Category</TableHead>
                <TableHead className="w-[200px]">Permissions</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissionSets.map((set) => (
                <TableRow key={set.id}>
                  <TableCell className="font-medium">{set.name}</TableCell>
                  <TableCell>{set.description}</TableCell>
                  <TableCell>{renderCategoryBadge(set.category)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {set.permissions.slice(0, 3).map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                      {set.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{set.permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSet(set);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSet(set);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Permission Set</DialogTitle>
            <DialogDescription>
              Modify the permission set configuration
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="oauth">OAuth Scopes</TabsTrigger>
                  <TabsTrigger value="abac">ABAC Rules</TabsTrigger>
                </TabsList>
                
                {/* Basic Information Tab */}
                <TabsContent value="basic" className="space-y-4 py-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permission Set Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Basic User Access" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the purpose and scope of this permission set"
                            className="min-h-[100px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mockCategories.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  {category.icon}
                                  <span>{category.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                {/* Permissions Tab */}
                <TabsContent value="permissions" className="space-y-4 py-4">
                  <FormField
                    control={editForm.control}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Permissions</FormLabel>
                          <FormDescription>
                            Select the permissions that will be granted by this permission set
                          </FormDescription>
                        </div>
                        
                        <div className="space-y-6">
                          {Object.entries(mockPermissionsByCategory).map(([category, permissions]) => (
                            <div key={category} className="space-y-2">
                              <h3 className="font-medium flex items-center gap-2">
                                {mockCategories.find(c => c.id === category)?.icon}
                                {mockCategories.find(c => c.id === category)?.name}
                              </h3>
                              <div className="grid grid-cols-2 gap-2">
                                {permissions.map(permission => (
                                  <FormField
                                    key={permission.id}
                                    control={editForm.control}
                                    name="permissions"
                                    render={({ field }) => (
                                      <FormItem
                                        key={permission.id}
                                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              const updatedValue = checked
                                                ? [...(field.value || []), permission.id]
                                                : (field.value || []).filter((value) => value !== permission.id);
                                              field.onChange(updatedValue);
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="font-normal text-sm">
                                            {permission.name}
                                          </FormLabel>
                                          <FormDescription className="text-xs">
                                            {permission.description}
                                          </FormDescription>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                {/* OAuth Scopes Tab */}
                <TabsContent value="oauth" className="space-y-4 py-4">
                  <FormField
                    control={editForm.control}
                    name="oauthScopes"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">OAuth Scopes</FormLabel>
                          <FormDescription>
                            Select the OAuth scopes that will be requested during authorization
                          </FormDescription>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          {mockOAuthScopes.map(scope => (
                            <FormField
                              key={scope.id}
                              control={editForm.control}
                              name="oauthScopes"
                              render={({ field }) => (
                                <FormItem
                                  key={scope.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(scope.id)}
                                      onCheckedChange={(checked) => {
                                        const updatedValue = checked
                                          ? [...(field.value || []), scope.id]
                                          : (field.value || []).filter((value) => value !== scope.id);
                                        field.onChange(updatedValue);
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="font-normal text-sm">
                                      {scope.name}
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      {scope.description}
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                {/* ABAC Rules Tab */}
                <TabsContent value="abac" className="space-y-4 py-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-base">Attribute-Based Access Control Rules</FormLabel>
                      <div className="flex items-center space-x-2">
                        <Select onValueChange={setSelectedAbacTemplate}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {abacTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={applyAbacTemplate}>
                          Apply
                        </Button>
                      </div>
                    </div>
                    
                    <FormField
                      control={editForm.control}
                      name="abacConditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea 
                              placeholder='Enter conditions e.g., "resource.ownerId == user.id OR user.isAdmin == true"'
                              className="font-mono min-h-[120px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Define attribute-based conditions for advanced access control policies.
                            These conditions will be evaluated at runtime against the user, resource, and context attributes.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="bg-muted/50 p-4 rounded-md">
                      <h4 className="font-medium mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                        Available Context Variables
                      </h4>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <h5 className="font-medium mb-1">User Context</h5>
                          <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                            <li>user.id</li>
                            <li>user.name</li>
                            <li>user.email</li>
                            <li>user.roles[]</li>
                            <li>user.groups[]</li>
                            <li>user.clearanceLevel</li>
                            <li>user.mfaVerified</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium mb-1">Resource Context</h5>
                          <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                            <li>resource.id</li>
                            <li>resource.type</li>
                            <li>resource.ownerId</li>
                            <li>resource.visibility</li>
                            <li>resource.tags[]</li>
                            <li>resource.createdAt</li>
                            <li>resource.workspaceId</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium mb-1">Access Context</h5>
                          <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                            <li>access.time</li>
                            <li>access.date</li>
                            <li>access.dayOfWeek</li>
                            <li>access.ipAddress</li>
                            <li>access.location</li>
                            <li>access.deviceType</li>
                            <li>access.browserFingerprint</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{selectedSet?.name}</strong> permission set?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permission Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}