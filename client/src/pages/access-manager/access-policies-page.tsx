import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Search, Edit, Trash2, ShieldCheck, Shield, Lock, Eye, FileText, Users, Database, Server, Network, AlertTriangle, FileKey } from "lucide-react";

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

// Schema Definitions
const accessPolicySchema = z.object({
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

// Access Policy Management Page
export default function AccessPoliciesPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  interface AccessPolicy {
    id: number;
    name: string;
    description: string;
    category: string;
    permissions: string[];
    oauthScopes?: string[];
    attributes?: Array<{ key: string; value: string }>;
    abacConditions?: string;
  }
  
  const [selectedSet, setSelectedSet] = useState<AccessPolicy | null>(null);
  const [selectedAbacTemplate, setSelectedAbacTemplate] = useState<string | null>(null);

  // Fetch access policies
  const { data: accessPolicies = [], isLoading } = useQuery<AccessPolicy[]>({
    queryKey: ["/api/permission-sets"],
  });

  // Filter access policies based on category and search query
  const filteredAccessPolicies = useMemo(() => {
    let filtered = [...accessPolicies];
    
    if (selectedCategory !== "all") {
      filtered = filtered.filter((set: AccessPolicy) => set.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((set: AccessPolicy) => 
        set.name.toLowerCase().includes(query) || 
        set.description.toLowerCase().includes(query) ||
        (set.permissions && set.permissions.some((p: string) => p.toLowerCase().includes(query)))
      );
    }
    
    return filtered;
  }, [accessPolicies, selectedCategory, searchQuery]);

  // Create form
  const createForm = useForm<z.infer<typeof accessPolicySchema>>({
    resolver: zodResolver(accessPolicySchema),
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
  const editForm = useForm<z.infer<typeof accessPolicySchema>>({
    resolver: zodResolver(accessPolicySchema),
    defaultValues: {
      name: selectedSet?.name || "",
      description: selectedSet?.description || "",
      category: (selectedSet?.category as "data" | "system" | "auth" | "tool" | "admin") || "tool",
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
        category: selectedSet.category as "data" | "system" | "auth" | "tool" | "admin",
        permissions: selectedSet.permissions,
        oauthScopes: selectedSet.oauthScopes || [],
        attributes: selectedSet.attributes || [],
        abacConditions: selectedSet.abacConditions || "",
      });
    }
  }, [selectedSet, editForm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accessPolicySchema>) => {
      const response = await fetch('/api/permission-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create access policy');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Access policy created",
        description: "The access policy has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error creating access policy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accessPolicySchema> & { id: number }) => {
      const response = await fetch(`/api/permission-sets/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update access policy');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Access policy updated",
        description: "The access policy has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      editForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error updating access policy",
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
        throw new Error(errorData.error || 'Failed to delete access policy');
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permission-sets"] });
      toast({
        title: "Access policy deleted",
        description: "The access policy has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting access policy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onCreateSubmit = (data: z.infer<typeof accessPolicySchema>) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof accessPolicySchema>) => {
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
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center gap-2">
          <FileKey className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Access Policies</h1>
        </div>
        <p className="text-muted-foreground">
          Define and manage access policies for the OAuth flow and RBAC/ABAC policy engine
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search access policies..."
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
        
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Access Policy
        </Button>
      </div>

      {isLoading ? (
        // Loading skeleton
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Display access policies
        <div className="space-y-4">
          {filteredAccessPolicies.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center">No access policies found. Create one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccessPolicies.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-medium">{set.name}</TableCell>
                    <TableCell>{renderCategoryBadge(set.category)}</TableCell>
                    <TableCell>{set.description}</TableCell>
                    <TableCell>
                      {set.permissions?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {set.permissions.length} permission{set.permissions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No permissions</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedSet(set);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedSet(set);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Create Policy Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Access Policy</DialogTitle>
            <DialogDescription>
              Define a new access policy that contains a set of permissions and conditions.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="abac">ABAC Conditions</TabsTrigger>
                  <TabsTrigger value="oauth">OAuth Scopes</TabsTrigger>
                </TabsList>
                
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-4 py-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter policy name" {...field} />
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
                            placeholder="Enter policy description" 
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
                            Select the permissions that will be granted by this access policy
                          </FormDescription>
                        </div>
                        
                        <div className="space-y-6">
                          {Object.entries(mockPermissionsByCategory).map(([category, perms]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="font-medium flex items-center">
                                {mockCategories.find(cat => cat.id === category)?.icon}
                                <span className="ml-2">{mockCategories.find(cat => cat.id === category)?.name}</span>
                              </h4>
                              <Separator />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {perms.map((perm) => (
                                  <FormField
                                    key={perm.id}
                                    control={createForm.control}
                                    name="permissions"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={perm.id}
                                          className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(perm.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, perm.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== perm.id
                                                      )
                                                    );
                                              }}
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel className="font-normal">
                                              {perm.name}
                                            </FormLabel>
                                            <FormDescription>
                                              {perm.description}
                                            </FormDescription>
                                          </div>
                                        </FormItem>
                                      );
                                    }}
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
                
                {/* ABAC Conditions Tab */}
                <TabsContent value="abac" className="space-y-4 py-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-medium mb-1">Attribute-Based Access Control</h4>
                      <p className="text-sm text-muted-foreground">
                        Define conditions for when these permissions should be granted
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select value={selectedAbacTemplate || ""} onValueChange={setSelectedAbacTemplate}>
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
                            placeholder="Enter ABAC conditions using policy language..." 
                            className="font-mono min-h-[200px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Use expressions like: user.role == "admin" OR (resource.owner == user.id AND access.time BETWEEN "09:00" AND "17:00")
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted p-4 rounded-md">
                    <h5 className="font-medium mb-2">Available Attributes</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">User Context</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>user.id - User identifier</li>
                          <li>user.role - User's role</li>
                          <li>user.department - User's department</li>
                          <li>user.clearanceLevel - Security clearance</li>
                          <li>user.mfaVerified - MFA status</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Request Context</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>access.time - Current time</li>
                          <li>access.date - Current date</li>
                          <li>access.ipAddress - Client IP</li>
                          <li>access.location - Physical location</li>
                          <li>resource.type - Resource type</li>
                          <li>resource.ownerId - Resource owner</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* OAuth Tab */}
                <TabsContent value="oauth" className="space-y-4 py-4">
                  <div className="mb-4">
                    <h4 className="font-medium mb-1">OAuth Scopes</h4>
                    <p className="text-sm text-muted-foreground">
                      Map these permissions to OAuth 2.1 scopes for API access
                    </p>
                  </div>
                  
                  <FormField
                    control={createForm.control}
                    name="oauthScopes"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {mockOAuthScopes.map((scope) => (
                            <FormItem
                              key={scope.id}
                              className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(scope.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value || [], scope.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== scope.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-normal">
                                  {scope.name} <code className="text-xs bg-muted rounded px-1">{scope.id}</code>
                                </FormLabel>
                                <FormDescription>
                                  {scope.description}
                                </FormDescription>
                              </div>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Policy"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Policy Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Access Policy</DialogTitle>
            <DialogDescription>
              Modify the access policy settings and permissions.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data: any) => onEditSubmit(data))} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="abac">ABAC Conditions</TabsTrigger>
                  <TabsTrigger value="oauth">OAuth Scopes</TabsTrigger>
                </TabsList>
                
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-4 py-4">
                  <FormField
                    control={editForm.control as any}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter policy name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control as any}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter policy description" 
                            className="min-h-[100px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control as any}
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
                    control={editForm.control as any}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Permissions</FormLabel>
                          <FormDescription>
                            Select the permissions that will be granted by this access policy
                          </FormDescription>
                        </div>
                        
                        <div className="space-y-6">
                          {Object.entries(mockPermissionsByCategory).map(([category, perms]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="font-medium flex items-center">
                                {mockCategories.find(cat => cat.id === category)?.icon}
                                <span className="ml-2">{mockCategories.find(cat => cat.id === category)?.name}</span>
                              </h4>
                              <Separator />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {perms.map((perm) => (
                                  <FormField
                                    key={perm.id}
                                    control={editForm.control}
                                    name="permissions"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={perm.id}
                                          className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(perm.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, perm.id])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== perm.id
                                                      )
                                                    );
                                              }}
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel className="font-normal">
                                              {perm.name}
                                            </FormLabel>
                                            <FormDescription>
                                              {perm.description}
                                            </FormDescription>
                                          </div>
                                        </FormItem>
                                      );
                                    }}
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
                
                {/* ABAC Conditions Tab */}
                <TabsContent value="abac" className="space-y-4 py-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-medium mb-1">Attribute-Based Access Control</h4>
                      <p className="text-sm text-muted-foreground">
                        Define conditions for when these permissions should be granted
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select value={selectedAbacTemplate || ""} onValueChange={setSelectedAbacTemplate}>
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
                    control={editForm.control as any}
                    name="abacConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter ABAC conditions using policy language..." 
                            className="font-mono min-h-[200px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Use expressions like: user.role == "admin" OR (resource.owner == user.id AND access.time BETWEEN "09:00" AND "17:00")
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted p-4 rounded-md">
                    <h5 className="font-medium mb-2">Available Attributes</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">User Context</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>user.id - User identifier</li>
                          <li>user.role - User's role</li>
                          <li>user.department - User's department</li>
                          <li>user.clearanceLevel - Security clearance</li>
                          <li>user.mfaVerified - MFA status</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Request Context</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          <li>access.time - Current time</li>
                          <li>access.date - Current date</li>
                          <li>access.ipAddress - Client IP</li>
                          <li>access.location - Physical location</li>
                          <li>resource.type - Resource type</li>
                          <li>resource.ownerId - Resource owner</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* OAuth Tab */}
                <TabsContent value="oauth" className="space-y-4 py-4">
                  <div className="mb-4">
                    <h4 className="font-medium mb-1">OAuth Scopes</h4>
                    <p className="text-sm text-muted-foreground">
                      Map these permissions to OAuth 2.1 scopes for API access
                    </p>
                  </div>
                  
                  <FormField
                    control={editForm.control as any}
                    name="oauthScopes"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {mockOAuthScopes.map((scope) => (
                            <FormItem
                              key={scope.id}
                              className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(scope.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value || [], scope.id])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== scope.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-normal">
                                  {scope.name} <code className="text-xs bg-muted rounded px-1">{scope.id}</code>
                                </FormLabel>
                                <FormDescription>
                                  {scope.description}
                                </FormDescription>
                              </div>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
            <DialogTitle>Delete Access Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this access policy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-4 rounded-md mb-4">
            <p className="text-destructive font-medium">{selectedSet?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedSet?.description}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}