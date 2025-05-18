import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle2, 
  Loader2, 
  MoreVertical, 
  Network, 
  Plus, 
  RefreshCw, 
  Server, 
  ShieldAlert, 
  UserCog, 
  Users 
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";

// Define validation schema for LDAP directory form
const ldapDirectoryFormSchema = z.object({
  workspaceId: z.coerce.number(),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  serverUrl: z.string().min(1, "Server URL is required").max(255, "Server URL is too long"),
  bindDn: z.string().min(1, "Bind DN is required").max(255, "Bind DN is too long"),
  bindPassword: z.string().min(1, "Bind password is required"),
  searchBase: z.string().min(1, "Search base is required").max(255, "Search base is too long"),
  searchFilter: z.string().min(1, "Search filter is required").max(255, "Search filter is too long"),
  userAttributes: z.string().min(1, "User attributes are required"),
  connectionTimeout: z.coerce.number().int().positive("Timeout must be a positive number"),
  active: z.boolean().default(true),
  useTLS: z.boolean().default(true),
  verifySSL: z.boolean().default(true),
  syncSchedule: z.string().optional(),
  adminGroupDn: z.string().optional(),
});

type LdapDirectory = z.infer<typeof ldapDirectoryFormSchema> & {
  id: number;
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  userCount: number;
};

export default function LdapDirectoriesPage() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<LdapDirectory | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1); // Default to first workspace

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['/api/workspaces'],
    retry: false,
  });

  // Fetch LDAP directories for the selected workspace
  const {
    data: directories,
    isLoading: isLoadingDirectories,
    isError: isErrorDirectories,
    refetch: refetchDirectories,
  } = useQuery({
    queryKey: ['/api/ldap-directories', { workspaceId: selectedWorkspaceId }],
    enabled: !!selectedWorkspaceId,
  });

  // Create directory mutation
  const createDirectoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ldapDirectoryFormSchema>) => {
      const response = await fetch('/api/ldap-directories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create LDAP directory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "LDAP directory created successfully",
      });
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ldap-directories'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create LDAP directory",
        variant: "destructive",
      });
    },
  });

  // Update directory mutation
  const updateDirectoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ldapDirectoryFormSchema> & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/ldap-directories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update LDAP directory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "LDAP directory updated successfully",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ldap-directories'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update LDAP directory",
        variant: "destructive",
      });
    },
  });

  // Delete directory mutation
  const deleteDirectoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/ldap-directories/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete LDAP directory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "LDAP directory deleted successfully",
      });
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ldap-directories'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete LDAP directory",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/ldap-directories/${id}/test-connection`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to test LDAP connection');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Successful",
        description: `Successfully connected to LDAP server. Found ${data.userCount || 0} users.`,
      });
      setIsTesting(false);
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to LDAP server",
        variant: "destructive",
      });
      setIsTesting(false);
    },
  });

  // Sync users mutation
  const syncUsersMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/ldap-directories/${id}/sync`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync LDAP users');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronization Successful",
        description: `Successfully synchronized ${data.userCount || 0} users from LDAP directory.`,
      });
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ldap-directories'] });
    },
    onError: (error) => {
      toast({
        title: "Synchronization Failed",
        description: error.message || "Failed to synchronize LDAP users",
        variant: "destructive",
      });
      setIsSyncing(false);
    },
  });

  // Create form
  const createForm = useForm<z.infer<typeof ldapDirectoryFormSchema>>({
    resolver: zodResolver(ldapDirectoryFormSchema),
    defaultValues: {
      workspaceId: selectedWorkspaceId,
      name: '',
      serverUrl: '',
      bindDn: '',
      bindPassword: '',
      searchBase: '',
      searchFilter: '(objectClass=person)',
      userAttributes: 'givenName,sn,mail,telephoneNumber',
      connectionTimeout: 30,
      active: true,
      useTLS: true,
      verifySSL: true,
      syncSchedule: '0 0 * * *', // Daily at midnight
      adminGroupDn: '',
    },
  });

  // Edit form
  const editForm = useForm<z.infer<typeof ldapDirectoryFormSchema>>({
    resolver: zodResolver(ldapDirectoryFormSchema),
    defaultValues: {
      workspaceId: selectedWorkspaceId,
      name: '',
      serverUrl: '',
      bindDn: '',
      bindPassword: '',
      searchBase: '',
      searchFilter: '',
      userAttributes: '',
      connectionTimeout: 30,
      active: true,
      useTLS: true,
      verifySSL: true,
      syncSchedule: '',
      adminGroupDn: '',
    },
  });

  // Update the form values when selectedDirectory changes
  useEffect(() => {
    if (selectedDirectory) {
      editForm.reset({
        workspaceId: selectedDirectory.workspaceId,
        name: selectedDirectory.name,
        serverUrl: selectedDirectory.serverUrl,
        bindDn: selectedDirectory.bindDn,
        bindPassword: selectedDirectory.bindPassword,
        searchBase: selectedDirectory.searchBase,
        searchFilter: selectedDirectory.searchFilter,
        userAttributes: selectedDirectory.userAttributes,
        connectionTimeout: selectedDirectory.connectionTimeout,
        active: selectedDirectory.active,
        useTLS: selectedDirectory.useTLS,
        verifySSL: selectedDirectory.verifySSL,
        syncSchedule: selectedDirectory.syncSchedule || '',
        adminGroupDn: selectedDirectory.adminGroupDn || '',
      });
    }
  }, [selectedDirectory, editForm]);

  // Update workspaceId in create form when selectedWorkspaceId changes
  useEffect(() => {
    createForm.setValue('workspaceId', selectedWorkspaceId);
  }, [selectedWorkspaceId, createForm]);

  // Handle form submissions
  const onCreateSubmit = createForm.handleSubmit((data) => {
    createDirectoryMutation.mutate(data);
  });

  const onEditSubmit = editForm.handleSubmit((data) => {
    if (selectedDirectory) {
      updateDirectoryMutation.mutate({ ...data, id: selectedDirectory.id });
    }
  });

  const handleDelete = () => {
    if (selectedDirectory) {
      deleteDirectoryMutation.mutate(selectedDirectory.id);
    }
  };

  const handleTestConnection = () => {
    if (selectedDirectory) {
      setIsTesting(true);
      testConnectionMutation.mutate(selectedDirectory.id);
    }
  };

  const handleSyncUsers = () => {
    if (selectedDirectory) {
      setIsSyncing(true);
      syncUsersMutation.mutate(selectedDirectory.id);
    }
  };

  const handleRefresh = () => {
    refetchDirectories();
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">LDAP Directories</h1>
          <p className="text-muted-foreground">Configure LDAP integration for user authentication and synchronization</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoadingDirectories}>
            {isLoadingDirectories ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add LDAP Directory
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New LDAP Directory</DialogTitle>
                <DialogDescription>
                  Configure a new LDAP directory for user authentication and synchronization.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={onCreateSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="workspaceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workspace</FormLabel>
                          <Select
                            disabled={isLoadingWorkspaces || !workspaces?.length}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a workspace" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {workspaces?.map((workspace: any) => (
                                <SelectItem key={workspace.id} value={workspace.id.toString()}>
                                  {workspace.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Directory Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Corporate LDAP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="serverUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Server URL</FormLabel>
                          <FormControl>
                            <Input placeholder="ldap://ldap.example.com:389" {...field} />
                          </FormControl>
                          <FormDescription>
                            Use ldap:// or ldaps:// prefix
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="connectionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="bindDn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bind DN</FormLabel>
                          <FormControl>
                            <Input placeholder="cn=admin,dc=example,dc=com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Distinguished name for binding to LDAP
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="bindPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bind Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="searchBase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Base</FormLabel>
                          <FormControl>
                            <Input placeholder="ou=users,dc=example,dc=com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="searchFilter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Filter</FormLabel>
                          <FormControl>
                            <Input placeholder="(objectClass=person)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="userAttributes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Attributes</FormLabel>
                        <FormControl>
                          <Input placeholder="givenName,sn,mail,telephoneNumber" {...field} />
                        </FormControl>
                        <FormDescription>
                          Comma-separated list of attributes to fetch
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="adminGroupDn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Group DN (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="cn=admins,ou=groups,dc=example,dc=com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Users in this group will be granted admin privileges
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="syncSchedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sync Schedule (Cron Expression)</FormLabel>
                        <FormControl>
                          <Input placeholder="0 0 * * *" {...field} />
                        </FormControl>
                        <FormDescription>
                          When to automatically sync users (default: daily at midnight)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={createForm.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                          <div className="space-y-0.5">
                            <FormLabel>Active</FormLabel>
                            <FormDescription>
                              Enable this LDAP directory
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="useTLS"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                          <div className="space-y-0.5">
                            <FormLabel>Use TLS</FormLabel>
                            <FormDescription>
                              Use TLS for connection
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="verifySSL"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                          <div className="space-y-0.5">
                            <FormLabel>Verify SSL</FormLabel>
                            <FormDescription>
                              Verify SSL certificates
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createDirectoryMutation.isPending}
                    >
                      {createDirectoryMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                        </>
                      ) : (
                        "Create Directory"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LDAP Directories</CardTitle>
          <CardDescription>
            Connect to your organization's LDAP directories for user authentication and synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Workspace</Label>
            <Select
              disabled={isLoadingWorkspaces || !workspaces?.length}
              value={selectedWorkspaceId.toString()}
              onValueChange={(value) => setSelectedWorkspaceId(parseInt(value))}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces?.map((workspace: any) => (
                  <SelectItem key={workspace.id} value={workspace.id.toString()}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {isLoadingDirectories ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isErrorDirectories ? (
            <div className="py-8 text-center text-destructive">
              <p>Error loading LDAP directories</p>
              <Button variant="outline" onClick={handleRefresh} className="mt-2">
                Try again
              </Button>
            </div>
          ) : directories?.length === 0 ? (
            <div className="py-12 text-center">
              <Server className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No LDAP directories found</p>
              <p className="text-muted-foreground">Create a directory to connect to your LDAP server</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directories?.map((directory: LdapDirectory) => (
                  <TableRow key={directory.id}>
                    <TableCell>
                      <div className="font-medium">{directory.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {directory.searchBase}
                      </div>
                    </TableCell>
                    <TableCell>{directory.serverUrl}</TableCell>
                    <TableCell>
                      {directory.active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {directory.lastSyncAt ? (
                        <div>
                          <div className="text-sm">{new Date(directory.lastSyncAt).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(directory.lastSyncAt).toLocaleTimeString()}
                          </div>
                          {directory.lastSyncStatus && (
                            <Badge 
                              variant="outline" 
                              className={
                                directory.lastSyncStatus === 'success' 
                                  ? "mt-1 bg-green-50 text-green-700 border-green-200" 
                                  : "mt-1 bg-red-50 text-red-700 border-red-200"
                              }
                            >
                              {directory.lastSyncStatus}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{directory.userCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDirectory(directory);
                              handleTestConnection();
                            }}
                          >
                            <Network className="h-4 w-4 mr-2" />
                            Test Connection
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDirectory(directory);
                              handleSyncUsers();
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Sync Users
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDirectory(directory);
                              setIsEditing(true);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDirectory(directory);
                              setIsDeleting(true);
                            }}
                            className="text-destructive"
                          >
                            <ShieldAlert className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit LDAP Directory</DialogTitle>
            <DialogDescription>
              Update the LDAP directory configuration.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={onEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="workspaceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace</FormLabel>
                      <Select
                        disabled={isLoadingWorkspaces || !workspaces?.length}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a workspace" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workspaces?.map((workspace: any) => (
                            <SelectItem key={workspace.id} value={workspace.id.toString()}>
                              {workspace.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Directory Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Corporate LDAP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="serverUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server URL</FormLabel>
                      <FormControl>
                        <Input placeholder="ldap://ldap.example.com:389" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="connectionTimeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Timeout</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="bindDn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bind DN</FormLabel>
                      <FormControl>
                        <Input placeholder="cn=admin,dc=example,dc=com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="bindPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bind Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Leave empty to keep current password" 
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="searchBase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Base</FormLabel>
                      <FormControl>
                        <Input placeholder="ou=users,dc=example,dc=com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="searchFilter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Filter</FormLabel>
                      <FormControl>
                        <Input placeholder="(objectClass=person)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="userAttributes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Attributes</FormLabel>
                    <FormControl>
                      <Input placeholder="givenName,sn,mail,telephoneNumber" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="adminGroupDn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Group DN (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="cn=admins,ou=groups,dc=example,dc=com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="syncSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sync Schedule (Cron Expression)</FormLabel>
                    <FormControl>
                      <Input placeholder="0 0 * * *" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Enable this LDAP directory
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="useTLS"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                      <div className="space-y-0.5">
                        <FormLabel>Use TLS</FormLabel>
                        <FormDescription>
                          Use TLS for connection
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="verifySSL"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-3 border rounded-md">
                      <div className="space-y-0.5">
                        <FormLabel>Verify SSL</FormLabel>
                        <FormDescription>
                          Verify SSL certificates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateDirectoryMutation.isPending}
                >
                  {updateDirectoryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    "Update Directory"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the LDAP directory "{selectedDirectory?.name}".
              This action cannot be undone and will affect user authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDirectoryMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteDirectoryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDirectoryMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Connection Dialog */}
      <Dialog open={isTesting && testConnectionMutation.isPending} onOpenChange={() => {
        if (!testConnectionMutation.isPending) setIsTesting(false);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Testing Connection</DialogTitle>
            <DialogDescription>
              Attempting to connect to LDAP server...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync Users Dialog */}
      <Dialog open={isSyncing && syncUsersMutation.isPending} onOpenChange={() => {
        if (!syncUsersMutation.isPending) setIsSyncing(false);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Syncing Users</DialogTitle>
            <DialogDescription>
              Synchronizing users from LDAP directory. This may take a few moments...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}