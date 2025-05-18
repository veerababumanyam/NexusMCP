import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Loader2, MoreVertical, Plus, RefreshCw, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Define validation schema for IP access rule form
const ipAccessRuleFormSchema = z.object({
  workspaceId: z.coerce.number(),
  ipAddress: z.string().min(7, "IP address is required").max(45, "IP address is too long"),
  type: z.enum(["allow", "block"]),
  description: z.string().max(255, "Description cannot exceed 255 characters").optional(),
  expiresAt: z.string().optional(),
});

type IpAccessRule = z.infer<typeof ipAccessRuleFormSchema> & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export default function IpAccessRulesPage() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRule, setSelectedRule] = useState<IpAccessRule | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1); // Default to first workspace

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['/api/workspaces'],
    retry: false,
  });

  // Fetch IP access rules for the selected workspace
  const {
    data: ipRules,
    isLoading: isLoadingRules,
    isError: isErrorRules,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['/api/ip-access-rules', { workspaceId: selectedWorkspaceId }],
    enabled: !!selectedWorkspaceId,
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ipAccessRuleFormSchema>) => {
      const response = await fetch('/api/ip-access-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create IP access rule');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "IP access rule created successfully",
      });
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ip-access-rules'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create IP access rule",
        variant: "destructive",
      });
    },
  });

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ipAccessRuleFormSchema> & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await fetch(`/api/ip-access-rules/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update IP access rule');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "IP access rule updated successfully",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ip-access-rules'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update IP access rule",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/ip-access-rules/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete IP access rule');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "IP access rule deleted successfully",
      });
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ip-access-rules'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete IP access rule",
        variant: "destructive",
      });
    },
  });

  // Create form
  const createForm = useForm<z.infer<typeof ipAccessRuleFormSchema>>({
    resolver: zodResolver(ipAccessRuleFormSchema),
    defaultValues: {
      workspaceId: selectedWorkspaceId,
      ipAddress: '',
      type: 'allow',
      description: '',
      expiresAt: '',
    },
  });

  // Edit form
  const editForm = useForm<z.infer<typeof ipAccessRuleFormSchema>>({
    resolver: zodResolver(ipAccessRuleFormSchema),
    defaultValues: {
      workspaceId: selectedWorkspaceId,
      ipAddress: '',
      type: 'allow',
      description: '',
      expiresAt: '',
    },
  });

  // Update the form values when selectedRule changes
  useEffect(() => {
    if (selectedRule) {
      editForm.reset({
        workspaceId: selectedRule.workspaceId,
        ipAddress: selectedRule.ipAddress,
        type: selectedRule.type as "allow" | "block",
        description: selectedRule.description || '',
        expiresAt: selectedRule.expiresAt || '',
      });
    }
  }, [selectedRule, editForm]);

  // Update workspaceId in create form when selectedWorkspaceId changes
  useEffect(() => {
    createForm.setValue('workspaceId', selectedWorkspaceId);
  }, [selectedWorkspaceId, createForm]);

  // Handle form submissions
  const onCreateSubmit = createForm.handleSubmit((data) => {
    createRuleMutation.mutate(data);
  });

  const onEditSubmit = editForm.handleSubmit((data) => {
    if (selectedRule) {
      updateRuleMutation.mutate({ ...data, id: selectedRule.id });
    }
  });

  const handleDelete = () => {
    if (selectedRule) {
      deleteRuleMutation.mutate(selectedRule.id);
    }
  };

  const handleRefresh = () => {
    refetchRules();
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">IP Access Rules</h1>
          <p className="text-muted-foreground">Manage IP allowlists and blocklists for your workspaces</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoadingRules}>
            {isLoadingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New IP Access Rule</DialogTitle>
                <DialogDescription>
                  Create a new rule to allow or block access from specific IP addresses.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={onCreateSubmit} className="space-y-4">
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
                        <FormDescription>
                          The workspace this rule will apply to
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.1 or 10.0.0.0/24" {...field} />
                        </FormControl>
                        <FormDescription>
                          Single IP address or CIDR notation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select rule type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="block">Block</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Whether to allow or block access from this IP
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Office network" {...field} />
                        </FormControl>
                        <FormDescription>
                          A brief description of this rule
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration (Optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormDescription>
                          When this rule should expire (leave empty for permanent rules)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createRuleMutation.isPending}
                    >
                      {createRuleMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                        </>
                      ) : (
                        "Create Rule"
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
          <CardTitle>IP Access Rules</CardTitle>
          <CardDescription>
            Rules are evaluated in order of creation. More specific rules take precedence.
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
          
          {isLoadingRules ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isErrorRules ? (
            <div className="py-8 text-center text-destructive">
              <p>Error loading IP access rules</p>
              <Button variant="outline" onClick={handleRefresh} className="mt-2">
                Try again
              </Button>
            </div>
          ) : ipRules?.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-lg font-medium">No IP access rules found</p>
              <p className="text-muted-foreground">Create a rule to restrict access to your workspace</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipRules?.map((rule: IpAccessRule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono">{rule.ipAddress}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {rule.type === "allow" ? (
                          <>
                            <ShieldCheck className="h-4 w-4 mr-2 text-green-500" />
                            <span className="text-green-600 font-medium">Allow</span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                            <span className="text-red-600 font-medium">Block</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{rule.description || "-"}</TableCell>
                    <TableCell>{new Date(rule.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {rule.expiresAt 
                        ? new Date(rule.expiresAt).toLocaleString() 
                        : <span className="text-muted-foreground">Never</span>}
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
                              setSelectedRule(rule);
                              setIsEditing(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRule(rule);
                              setIsDeleting(true);
                            }}
                            className="text-destructive"
                          >
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit IP Access Rule</DialogTitle>
            <DialogDescription>
              Update this IP access rule.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={onEditSubmit} className="space-y-4">
              <FormField
                control={editForm.control}
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
                control={editForm.control}
                name="ipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Address</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1 or 10.0.0.0/24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rule type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="block">Block</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Office network" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration (Optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateRuleMutation.isPending}
                >
                  {updateRuleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    "Update Rule"
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
              This will permanently delete the IP access rule for{" "}
              <span className="font-semibold">{selectedRule?.ipAddress}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRuleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRuleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRuleMutation.isPending ? (
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
    </div>
  );
}