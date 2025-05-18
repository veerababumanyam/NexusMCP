import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  Shield, 
  Edit, 
  Trash2, 
  Check,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  LockIcon,
  ScrollText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Form validation schema
const policyFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  type: z.string(),
  content: z.string(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(100).default(10),
  scope: z.string().default("global"),
  workspaceId: z.number().optional(),
});

type PolicyFormValues = z.infer<typeof policyFormSchema>;

// API functions
async function getPolicies() {
  const res = await apiRequest("GET", "/api/policies");
  return await res.json();
}

async function getWorkspaces() {
  const res = await apiRequest("GET", "/api/workspaces");
  return await res.json();
}

async function createPolicy(data: PolicyFormValues) {
  const res = await apiRequest("POST", "/api/policies", data);
  return await res.json();
}

export default function PoliciesPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isAddPolicyOpen, setIsAddPolicyOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("none");

  // Fetch policies
  const {
    data: policies,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/policies"],
    queryFn: getPolicies,
  });

  // Fetch workspaces for dropdown
  const {
    data: workspaces,
    isLoading: isLoadingWorkspaces,
  } = useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: getWorkspaces,
  });

  // Create new policy mutation
  const createPolicyMutation = useMutation({
    mutationFn: createPolicy,
    onSuccess: () => {
      toast({
        title: "Policy created",
        description: "The policy has been created successfully",
      });
      setIsAddPolicyOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to create policy",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Policy form definition
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "content_filter",
      content: "",
      isActive: true,
      priority: 10,
      scope: "global",
    },
  });

  // Form submission handler
  const onSubmit = (data: PolicyFormValues) => {
    if (data.scope !== "workspace") {
      // If scope is not workspace, remove workspaceId
      delete data.workspaceId;
    }
    
    createPolicyMutation.mutate(data);
  };

  // Policy templates
  const policyTemplates = {
    none: "",
    contentFilter: JSON.stringify({
      filter_categories: [
        {
          category: "hate_speech",
          threshold: "medium",
          action: "block"
        },
        {
          category: "sexual_content",
          threshold: "high",
          action: "flag"
        },
        {
          category: "violence",
          threshold: "medium",
          action: "warn"
        }
      ],
      default_action: "allow"
    }, null, 2),
    dataAccess: JSON.stringify({
      allowed_data_sources: [
        "public_knowledge_base",
        "company_documents"
      ],
      restricted_data: [
        "financial_records",
        "employee_personal_info"
      ],
      logging: {
        level: "all_access",
        retention: "90_days"
      }
    }, null, 2),
    usagePolicy: JSON.stringify({
      rate_limits: {
        requests_per_minute: 60,
        tokens_per_day: 100000
      },
      service_hours: {
        start: "00:00",
        end: "23:59",
        timezone: "UTC"
      },
      overage_action: "queue"
    }, null, 2)
  };

  // Refresh policy data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Policy data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh policy data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive 
      ? "bg-success/10 text-success" 
      : "bg-muted text-muted-foreground";
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "content_filter":
        return "bg-orange-500/10 text-orange-500";
      case "data_access":
        return "bg-blue-500/10 text-blue-500";
      case "usage_policy":
        return "bg-violet-600/10 text-violet-600";
      case "security_policy":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Handle template selection
  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const templateContent = policyTemplates[templateKey as keyof typeof policyTemplates];
    form.setValue("content", templateContent);
    
    // Set type based on template
    switch (templateKey) {
      case "contentFilter":
        form.setValue("type", "content_filter");
        form.setValue("name", "Content Filtering Policy");
        form.setValue("description", "Controls what content is allowed through the system");
        break;
      case "dataAccess":
        form.setValue("type", "data_access");
        form.setValue("name", "Data Access Policy");
        form.setValue("description", "Defines which data sources are accessible");
        break;
      case "usagePolicy":
        form.setValue("type", "usage_policy");
        form.setValue("name", "Usage Policy");
        form.setValue("description", "Controls usage limits and service availability");
        break;
    }
  };

  // Format scope name
  const formatScopeName = (scope: string) => {
    if (scope === "global") return "Global";
    if (scope === "workspace") return "Workspace";
    return scope.charAt(0).toUpperCase() + scope.slice(1);
  };

  // Get workspace name from ID
  const getWorkspaceName = (workspaceId: number) => {
    const workspace = workspaces?.find(w => w.id === workspaceId);
    return workspace ? workspace.name : `Workspace #${workspaceId}`;
  };

  return (
    <>
      <DashboardHeader
        title="Policies"
        subtitle="Manage AI usage policies, content filters, and security controls"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex justify-end mb-6">
        {hasPermission('policies:create') && (
          <Button
            onClick={() => setIsAddPolicyOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Policy
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">AI Governance Policies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">
                          Loading policies...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : policies?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No policies found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddPolicyOpen(true)}
                          className="mt-2"
                        >
                          Add your first policy
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  policies?.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white">
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="ml-3">
                            <div className="font-medium">{policy.name}</div>
                            <div className="text-xs text-muted-foreground">{policy.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeClass(
                            policy.type
                          )}`}
                        >
                          {policy.type.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatScopeName(policy.scope)}
                        {policy.scope === "workspace" && (
                          <div className="text-xs text-muted-foreground">
                            {getWorkspaceName(policy.workspaceId)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {policy.priority}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            policy.isActive
                          )}`}
                        >
                          {policy.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {hasPermission('policies:view') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Policy"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          {hasPermission('policies:edit') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Policy"
                            >
                              <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          {hasPermission('policies:delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Policy"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                          {hasPermission('policies:toggle') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={policy.isActive ? "Disable Policy" : "Enable Policy"}
                            >
                              {policy.isActive ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {policies?.length ? (
              <>
                Total: <span className="font-medium">{policies.length}</span>{" "}
                policies
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {/* Add Policy Dialog */}
      <Dialog open={isAddPolicyOpen} onOpenChange={setIsAddPolicyOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Policy</DialogTitle>
            <DialogDescription>
              Create a new policy to govern AI usage and security within your organization.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Content Filtering Policy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="content_filter">Content Filter</SelectItem>
                          <SelectItem value="data_access">Data Access</SelectItem>
                          <SelectItem value="usage_policy">Usage Policy</SelectItem>
                          <SelectItem value="security_policy">Security Policy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a description for this policy"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset workspaceId if scope is not workspace
                          if (value !== "workspace") {
                            form.setValue("workspaceId", undefined);
                          }
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select scope" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="global">Global</SelectItem>
                          <SelectItem value="workspace">Workspace</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch("scope") === "workspace" && (
                  <FormField
                    control={form.control}
                    name="workspaceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select workspace" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingWorkspaces ? (
                              <div className="flex justify-center items-center py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : (
                              workspaces?.map((workspace) => (
                                <SelectItem
                                  key={workspace.id}
                                  value={workspace.id.toString()}
                                >
                                  {workspace.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (1-100)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1}
                          max={100}
                          placeholder="10"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Higher numbers take precedence
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Enable or disable this policy
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Content</FormLabel>
                    <div className="mb-2 flex space-x-2">
                      <Select
                        onValueChange={handleTemplateChange}
                        value={selectedTemplate}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Policy templates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Template</SelectItem>
                          <SelectItem value="contentFilter">Content Filter Template</SelectItem>
                          <SelectItem value="dataAccess">Data Access Template</SelectItem>
                          <SelectItem value="usagePolicy">Usage Policy Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm"
                        rows={10}
                        placeholder="Enter JSON content for the policy"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPolicyOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPolicyMutation.isPending}
                >
                  {createPolicyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Policy"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}