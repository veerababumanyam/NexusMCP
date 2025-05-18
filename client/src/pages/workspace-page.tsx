import React, { useState } from "react";
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
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Plus, Building, Edit, Trash2, Flag, UserPlus, Settings, 
  Shield, HardDrive, Database, Zap, Code, TestTube, Factory, 
  LucideIcon, ServerCrash, Server, Users, Lock, FileStack, BarChart4, 
  FileHeart, Globe, ShieldCheck, Clock, RefreshCw
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import {
  getWorkspaces,
  createWorkspace,
  archiveWorkspace,
  updateWorkspace,
  setUserDefaultWorkspace,
} from "@/lib/workspaceApi";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

// Form validation schema
const workspaceFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  status: z.string().default("active"),
  isolationLevel: z.enum(["standard", "high", "maximum"]).default("standard"),
  customDomain: z.string().optional(),
  isPrivate: z.boolean().default(false),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  contactEmail: z.string().email().optional(),
  supportEmail: z.string().email().optional(),
  allowAutoProvisioning: z.boolean().default(false),
  allowExternalUsers: z.boolean().default(false),
  enforceIpRestrictions: z.boolean().default(false),
  dataEncryptionEnabled: z.boolean().default(false),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

// Resource interface for resource monitoring
interface Resource {
  id: string;
  name: string;
  type: "server" | "database" | "storage" | "compute" | "other";
  status: "online" | "offline" | "degraded" | "maintenance";
  utilizationPercent: number;
  allocatedAmount: number;
  usedAmount: number;
  unit: string;
  lastUpdated: string;
  details?: {
    [key: string]: any;
  };
}

// Policy interface for workspace policies
interface Policy {
  id: number;
  name: string;
  description: string;
  type: "access" | "security" | "resource" | "compliance";
  status: "active" | "inactive" | "pending";
  lastUpdated: string;
}

// Enhanced workspace interface with resource utilization
interface EnhancedWorkspace {
  id: number;
  name: string;
  description?: string;
  status: string;
  isolationLevel?: string;
  isPrivate?: boolean;
  customDomain?: string;
  createdById?: number;
  createdAt?: string;
  updatedAt?: string;
  logoUrl?: string;
  primaryColor?: string;
  contactEmail?: string;
  supportEmail?: string;
  allowAutoProvisioning?: boolean;
  allowExternalUsers?: boolean;
  enforceIpRestrictions?: boolean;
  dataEncryptionEnabled?: boolean;
  // Resource utilization
  resourceUtilization?: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    overall: number;
  };
  // Metrics
  metrics?: {
    activeUsers: number;
    activeSessions: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export default function WorkspacePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddWorkspaceOpen, setIsAddWorkspaceOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("workspaces");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);

  // Fetch workspaces
  const {
    data: workspaces,
    isLoading,
    refetch,
  } = useQuery<EnhancedWorkspace[]>({
    queryKey: ["/api/workspaces"],
    queryFn: getWorkspaces,
  });

  // Resource filter state
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");
  
  // Function to get filtered resources
  const getFilteredResources = () => {
    if (!resources) return [];
    if (resourceTypeFilter === "all") return resources;
    return resources.filter(resource => resource.type === resourceTypeFilter);
  };
  
  // Fetch resources for a specific workspace when selected
  const {
    data: resources,
    isLoading: isLoadingResources,
    refetch: refetchResources,
  } = useQuery<Resource[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "resources"],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const response = await fetch(`/api/workspaces/${selectedWorkspaceId}/resources`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace resources');
      }
      return response.json();
    },
    enabled: !!selectedWorkspaceId,
  });

  // Fetch policies for a specific workspace when selected
  const {
    data: policies,
    isLoading: isLoadingPolicies,
    refetch: refetchPolicies,
  } = useQuery<Policy[]>({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "policies"],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const response = await fetch(`/api/workspaces/${selectedWorkspaceId}/policies`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace policies');
      }
      return response.json();
    },
    enabled: !!selectedWorkspaceId,
  });
  
  // Fetch metrics for a specific workspace when selected
  const {
    data: workspaceMetrics,
    isLoading: isLoadingMetrics,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["/api/workspaces", selectedWorkspaceId, "metrics"],
    queryFn: async () => {
      if (!selectedWorkspaceId) return null;
      const response = await fetch(`/api/workspaces/${selectedWorkspaceId}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace metrics');
      }
      return response.json();
    },
    enabled: !!selectedWorkspaceId,
  });

  // State for edit dialog
  const [isEditWorkspaceOpen, setIsEditWorkspaceOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<EnhancedWorkspace | null>(null);
  
  // Resource allocation dialog state
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDefaultDialogOpen, setIsDefaultDialogOpen] = useState(false);
  
  // Create new workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      toast({
        title: "Workspace created",
        description: "The workspace has been created successfully",
      });
      setIsAddWorkspaceOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to create workspace",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Update workspace mutation
  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      updateWorkspace(id, data),
    onSuccess: () => {
      toast({
        title: "Workspace updated",
        description: "The workspace has been updated successfully",
      });
      setIsEditWorkspaceOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to update workspace",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Archive workspace mutation
  const archiveWorkspaceMutation = useMutation({
    mutationFn: archiveWorkspace,
    onSuccess: () => {
      toast({
        title: "Workspace archived",
        description: "The workspace has been archived successfully",
      });
      setIsDeleteDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to archive workspace",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Set default workspace mutation
  const setDefaultWorkspaceMutation = useMutation({
    mutationFn: setUserDefaultWorkspace,
    onSuccess: () => {
      toast({
        title: "Default workspace updated",
        description: "Your default workspace has been updated successfully",
      });
      setIsDefaultDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to update default workspace",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Workspace form definition
  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      isolationLevel: "standard",
      customDomain: "",
      isPrivate: false,
      logoUrl: "",
      primaryColor: "",
      contactEmail: "",
      supportEmail: "",
      allowAutoProvisioning: false,
      allowExternalUsers: false,
      enforceIpRestrictions: false,
      dataEncryptionEnabled: false,
    },
  });

  // Form submission handler for adding new workspace
  const onSubmit = (data: WorkspaceFormValues) => {
    createWorkspaceMutation.mutate(data);
  };
  
  // Set form values when edit dialog opens with currentWorkspace data
  React.useEffect(() => {
    if (currentWorkspace && isEditWorkspaceOpen) {
      form.reset({
        name: currentWorkspace.name || "",
        description: currentWorkspace.description || "",
        status: currentWorkspace.status || "active",
        isolationLevel: currentWorkspace.isolationLevel || "standard",
        customDomain: currentWorkspace.customDomain || "",
        isPrivate: currentWorkspace.isPrivate || false,
        logoUrl: currentWorkspace.logoUrl || "",
        primaryColor: currentWorkspace.primaryColor || "",
        contactEmail: currentWorkspace.contactEmail || "",
        supportEmail: currentWorkspace.supportEmail || "",
        allowAutoProvisioning: currentWorkspace.allowAutoProvisioning || false,
        allowExternalUsers: currentWorkspace.allowExternalUsers || false,
        enforceIpRestrictions: currentWorkspace.enforceIpRestrictions || false,
        dataEncryptionEnabled: currentWorkspace.dataEncryptionEnabled || false,
      });
    } else if (!isEditWorkspaceOpen && !isAddWorkspaceOpen) {
      // Reset form when dialogs close
      form.reset({
        name: "",
        description: "",
        status: "active",
        isolationLevel: "standard",
        customDomain: "",
        isPrivate: false,
        logoUrl: "",
        primaryColor: "",
        contactEmail: "",
        supportEmail: "",
        allowAutoProvisioning: false,
        allowExternalUsers: false,
        enforceIpRestrictions: false,
        dataEncryptionEnabled: false,
      });
    }
  }, [currentWorkspace, isEditWorkspaceOpen, isAddWorkspaceOpen, form]);

  // Refresh workspace data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Error refreshing workspace data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success";
      case "inactive":
        return "bg-muted text-muted-foreground";
      case "issues":
        return "bg-warning/10 text-warning";
      case "maintenance":
        return "bg-orange-500/10 text-orange-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  
  const getResourceStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-success";
      case "offline":
        return "bg-destructive";
      case "degraded":
        return "bg-amber-500";
      case "maintenance":
        return "bg-blue-500";
      default:
        return "bg-muted";
    }
  };

  const getResourceTypeIcon = (type: string): JSX.Element => {
    switch (type) {
      case "server":
        return <Server className="h-4 w-4" />;
      case "database":
        return <Database className="h-4 w-4" />;
      case "storage":
        return <HardDrive className="h-4 w-4" />;
      case "compute":
        return <Zap className="h-4 w-4" />;
      default:
        return <FileStack className="h-4 w-4" />;
    }
  };

  const getUtilizationColor = (percent: number) => {
    if (percent > 90) return "bg-destructive";
    if (percent > 75) return "bg-amber-500";
    if (percent > 50) return "bg-yellow-500";
    return "bg-success";
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Function to handle workspace selection
  const handleWorkspaceSelection = (workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    setActiveTab("resources");
    
    // Try to fetch resources data, policies, and metrics
    refetchResources();
    refetchPolicies();
    refetchMetrics();
  };
  
  // Handle resource data that might not exist on the API yet
  const getResourceData = (): Resource[] => {
    if (resources && resources.length > 0) {
      return getFilteredResources();
    }
    
    // Only show placeholder data if we're in the loading state
    if (isLoadingResources) {
      const workspaceId = selectedWorkspaceId;
      if (!workspaceId) return [];
      
      const resourceTypes = ["server", "database", "storage", "compute"];
      const statusOptions = ["online", "offline", "degraded", "maintenance"];
      
      return Array.from({ length: 5 }, (_, i) => ({
        id: `placeholder-${i}`,
        name: `Loading Resource ${i + 1}...`,
        type: resourceTypes[i % resourceTypes.length] as Resource["type"],
        status: "online" as Resource["status"],
        utilizationPercent: 0,
        allocatedAmount: 0,
        usedAmount: 0,
        unit: "MB",
        lastUpdated: new Date().toISOString()
      }));
    }
    
    return [];
  };

  return (
    <>
      <DashboardHeader
        title="Workspaces & Resources"
        subtitle="Manage workspaces, resource allocation, and isolation settings"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="resources" disabled={!selectedWorkspaceId}>Resources</TabsTrigger>
            <TabsTrigger value="policies" disabled={!selectedWorkspaceId}>Policies</TabsTrigger>
            <TabsTrigger value="metrics" disabled={!selectedWorkspaceId}>Metrics</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2">
          {activeTab === "workspaces" && (
            <Button
              onClick={() => setIsAddWorkspaceOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Workspace
            </Button>
          )}
          
          {activeTab !== "workspaces" && (
            <Select
              value={selectedWorkspaceId?.toString() || ""}
              onValueChange={(value) => handleWorkspaceSelection(parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces?.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id.toString()}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="workspaces">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Workspaces</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
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
                          Loading workspaces...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : workspaces?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Building className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No workspaces found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddWorkspaceOpen(true)}
                          className="mt-2"
                        >
                          Add your first workspace
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  workspaces?.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white">
                            <Building className="h-4 w-4" />
                          </div>
                          <span className="ml-3 font-medium">
                            {workspace.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {workspace.description || "N/A"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            workspace.status
                          )}`}
                        >
                          {workspace.status.charAt(0).toUpperCase() +
                            workspace.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {workspace.createdAt 
                          ? new Date(workspace.createdAt).toLocaleDateString() 
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {workspace.updatedAt 
                          ? new Date(workspace.updatedAt).toLocaleDateString() 
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Set as Default Workspace"
                            onClick={() => {
                              setCurrentWorkspace(workspace);
                              setIsDefaultDialogOpen(true);
                            }}
                          >
                            <Flag className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Workspace"
                            onClick={() => {
                              setCurrentWorkspace(workspace);
                              setIsEditWorkspaceOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Manage Members"
                            onClick={() => {
                              // We'll implement this in the member management page
                            }}
                          >
                            <UserPlus className="h-4 w-4 text-muted-foreground hover:text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Archive Workspace"
                            disabled={workspace.name === "Enterprise"}
                            onClick={() => {
                              setCurrentWorkspace(workspace);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
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
            {workspaces?.length ? (
              <>
                Total: <span className="font-medium">{workspaces.length}</span>{" "}
                workspaces
              </>
            ) : null}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <Loader2
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardFooter>
      </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-medium">
                    {workspaces?.find(w => w.id === selectedWorkspaceId)?.name} Resources
                  </CardTitle>
                  <CardDescription>
                    Monitor and manage workspace resources
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center mr-4">
                    <Select 
                      defaultValue="all" 
                      onValueChange={(value) => setResourceTypeFilter(value)}
                      value={resourceTypeFilter}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue placeholder="Resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="server">Servers</SelectItem>
                        <SelectItem value="database">Databases</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                        <SelectItem value="compute">Compute</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Refresh resources</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add resource</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingResources ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading resources...
                  </span>
                </div>
              ) : resources && resources.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getResourceData().map((resource) => (
                    <Card key={resource.id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getResourceTypeIcon(resource.type)}
                            <CardTitle className="text-base font-medium">
                              {resource.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full ${getResourceStatusColor(resource.status)}`} />
                            <span className="ml-2 text-xs capitalize">{resource.status}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Utilization</span>
                              <span className={`font-medium ${resource.utilizationPercent > 80 ? 'text-destructive' : resource.utilizationPercent > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {resource.utilizationPercent}%
                              </span>
                            </div>
                            <Progress 
                              value={resource.utilizationPercent} 
                              className={getUtilizationColor(resource.utilizationPercent)}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-muted/30 p-2 rounded-md">
                              <span className="text-xs text-muted-foreground block mb-1">Allocated</span>
                              <p className="font-medium">
                                {resource.unit === 'bytes' 
                                  ? formatBytes(resource.allocatedAmount)
                                  : `${resource.allocatedAmount} ${resource.unit}`}
                              </p>
                            </div>
                            <div className="bg-muted/30 p-2 rounded-md">
                              <span className="text-xs text-muted-foreground block mb-1">Used</span>
                              <p className="font-medium">
                                {resource.unit === 'bytes'
                                  ? formatBytes(resource.usedAmount)
                                  : `${resource.usedAmount} ${resource.unit}`}
                              </p>
                            </div>
                          </div>
                          
                          {resource.details && (
                            <div className="bg-muted/20 p-2 rounded-md text-sm">
                              <h4 className="text-xs font-medium mb-1">Details</h4>
                              <div className="space-y-1">
                                {Object.entries(resource.details).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                    <span className="text-xs">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Updated {resource.lastUpdated ? new Date(resource.lastUpdated).toLocaleString() : "N/A"}
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Refresh resource data</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ServerCrash className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">No resources found</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    This workspace doesn't have any resources configured yet or you may not have permission to view them.
                  </p>
                  <Button>Add Resource</Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-between">
              <div className="text-xs text-muted-foreground">
                Resources are automatically updated every few minutes
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchResources()}>
                Refresh Resources
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">
                {workspaces?.find(w => w.id === selectedWorkspaceId)?.name} Policies
              </CardTitle>
              <CardDescription>
                Manage workspace policy and compliance settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPolicies ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading policies...
                  </span>
                </div>
              ) : policies && policies.length > 0 ? (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <Card key={policy.id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <CardTitle className="text-base font-medium">
                              {policy.name}
                            </CardTitle>
                          </div>
                          <Badge className={
                            policy.status === "active" ? "bg-success/10 text-success" :
                            policy.status === "pending" ? "bg-amber-500/10 text-amber-500" :
                            "bg-muted text-muted-foreground"
                          }>
                            {policy.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-sm mb-3">{policy.description}</p>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <Badge variant="outline" className="mr-2">
                              {policy.type}
                            </Badge>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Updated {policy.lastUpdated ? new Date(policy.lastUpdated).toLocaleString() : "N/A"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">No policies found</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    This workspace doesn't have any policies configured yet or you may not have permission to view them.
                  </p>
                  <Button>Create Policy</Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t p-4 flex justify-between">
              <div className="text-xs text-muted-foreground">
                Policies help ensure compliance with security and governance standards
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchPolicies()}>
                Refresh Policies
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader className="bg-muted/50 py-4 flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-medium">
                  {workspaces?.find(w => w.id === selectedWorkspaceId)?.name} Metrics
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchMetrics()}
                  disabled={isLoadingMetrics}
                  className="h-8"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMetrics ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                View real-time workspace performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : workspaceMetrics ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Active Users
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.activeUsers || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Active Sessions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.activeSessions || 0}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Requests per Min
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.requestsPerMinute || 0}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Avg Response Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.avgResponseTime || 0} <span className="text-sm text-muted-foreground">ms</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Error Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.errorRate || 0}%
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Active Sessions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.activeSessions || 0}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Requests / Minute
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">
                          {workspaceMetrics.summary?.requestsPerMinute || 0}
                        </div>
                      </CardContent>
                    </Card>
                    
                  </div>
                  
                  <h3 className="text-lg font-medium mb-4 mt-8">Resource Utilization</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          CPU
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {workspaceMetrics.resources?.cpu.utilization || 0}% utilized
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Trend: {workspaceMetrics.resources?.cpu.trend || 'stable'}
                            </span>
                          </div>
                          <Progress 
                            value={workspaceMetrics.resources?.cpu.utilization || 0} 
                            className={`h-2 ${
                              (workspaceMetrics.resources?.cpu.utilization || 0) > 90 
                                ? 'bg-destructive' 
                                : (workspaceMetrics.resources?.cpu.utilization || 0) > 75
                                  ? 'bg-amber-500'
                                  : ''
                            }`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Memory
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {workspaceMetrics.resources?.memory.utilization || 0}% utilized
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Trend: {workspaceMetrics.resources?.memory.trend || 'stable'}
                            </span>
                          </div>
                          <Progress 
                            value={workspaceMetrics.resources?.memory.utilization || 0} 
                            className={`h-2 ${
                              (workspaceMetrics.resources?.memory.utilization || 0) > 90 
                                ? 'bg-destructive' 
                                : (workspaceMetrics.resources?.memory.utilization || 0) > 75
                                  ? 'bg-amber-500'
                                  : ''
                            }`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Storage
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {workspaceMetrics.resources?.storage.utilization || 0}% utilized
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Trend: {workspaceMetrics.resources?.storage.trend || 'stable'}
                            </span>
                          </div>
                          <Progress 
                            value={workspaceMetrics.resources?.storage.utilization || 0} 
                            className={`h-2 ${
                              (workspaceMetrics.resources?.storage.utilization || 0) > 90 
                                ? 'bg-destructive' 
                                : (workspaceMetrics.resources?.storage.utilization || 0) > 75
                                  ? 'bg-amber-500'
                                  : ''
                            }`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Network
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {workspaceMetrics.resources?.network.utilization || 0}% utilized
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Trend: {workspaceMetrics.resources?.network.trend || 'stable'}
                            </span>
                          </div>
                          <Progress 
                            value={workspaceMetrics.resources?.network.utilization || 0} 
                            className={`h-2 ${
                              (workspaceMetrics.resources?.network.utilization || 0) > 90 
                                ? 'bg-destructive' 
                                : (workspaceMetrics.resources?.network.utilization || 0) > 75
                                  ? 'bg-amber-500'
                                  : ''
                            }`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="p-4">
                      <CardTitle className="text-base font-medium">
                        Resource Utilization
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>CPU</span>
                            <span>{workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.cpu || 0}%</span>
                          </div>
                          <Progress 
                            value={workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.cpu || 0} 
                            className={getUtilizationColor(workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.cpu || 0)}
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>Memory</span>
                            <span>{workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.memory || 0}%</span>
                          </div>
                          <Progress 
                            value={workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.memory || 0} 
                            className={getUtilizationColor(workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.memory || 0)}
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>Storage</span>
                            <span>{workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.storage || 0}%</span>
                          </div>
                          <Progress 
                            value={workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.storage || 0} 
                            className={getUtilizationColor(workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.storage || 0)}
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1 text-sm">
                            <span>Network</span>
                            <span>{workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.network || 0}%</span>
                          </div>
                          <Progress 
                            value={workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.network || 0} 
                            className={getUtilizationColor(workspaces.find(w => w.id === selectedWorkspaceId)?.resourceUtilization?.network || 0)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BarChart4 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-1">No metrics available</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Metrics data is not available for this workspace or you may not have permission to view it.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Workspace Dialog */}
      <Dialog open={isAddWorkspaceOpen} onOpenChange={setIsAddWorkspaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to isolate MCP servers and tools.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Production" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a description for this workspace"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isolationLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Isolation Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select isolation level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="maximum">Maximum</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Controls the level of isolation for this workspace
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Domain (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. workspace.example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Custom domain for this workspace
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddWorkspaceOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createWorkspaceMutation.isPending}
                >
                  {createWorkspaceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Workspace"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={isEditWorkspaceOpen} onOpenChange={setIsEditWorkspaceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>
              Update workspace information and settings.
            </DialogDescription>
          </DialogHeader>
          {currentWorkspace && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => {
                  updateWorkspaceMutation.mutate({
                    id: currentWorkspace.id,
                    data: data
                  });
                })}
                className="space-y-4 py-2"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace Name</FormLabel>
                      <FormControl>
                        <Input defaultValue={currentWorkspace.name} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          defaultValue={currentWorkspace.description || ""}
                          placeholder="Enter a description for this workspace"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        defaultValue={currentWorkspace.status}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isolationLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Isolation Level</FormLabel>
                      <Select
                        defaultValue={currentWorkspace.isolationLevel || "standard"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select isolation level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="maximum">Maximum</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Controls the level of isolation for this workspace
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="customDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Domain (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. workspace.example.com" 
                          defaultValue={currentWorkspace.customDomain || ""}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Custom domain for this workspace
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditWorkspaceOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateWorkspaceMutation.isPending}
                  >
                    {updateWorkspaceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Workspace"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Workspace Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this workspace? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {currentWorkspace && (
            <div className="py-4">
              <div className="p-4 mb-4 bg-muted/50 rounded-md">
                <h4 className="font-medium mb-1">{currentWorkspace.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {currentWorkspace.description || "No description provided."}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">What happens when you archive a workspace?</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>The workspace will be removed from active workspaces</li>
                  <li>All members will lose access to this workspace</li>
                  <li>MCP servers and tools in this workspace will be inaccessible</li>
                  <li>Data will be retained according to your data retention policy</li>
                </ul>
              </div>
              <DialogFooter className="pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={archiveWorkspaceMutation.isPending}
                  onClick={() => archiveWorkspaceMutation.mutate(currentWorkspace.id)}
                >
                  {archiveWorkspaceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    "Archive Workspace"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Set Default Workspace Dialog */}
      <Dialog open={isDefaultDialogOpen} onOpenChange={setIsDefaultDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Default Workspace</DialogTitle>
            <DialogDescription>
              Set this workspace as your default when logging in to NexusMCP.
            </DialogDescription>
          </DialogHeader>
          {currentWorkspace && (
            <div className="py-4">
              <div className="p-4 mb-4 bg-primary/5 border border-primary/20 rounded-md flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white">
                  <Flag className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">{currentWorkspace.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentWorkspace.description || "No description provided."}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Benefits of setting a default workspace:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Automatically use this workspace when logging in</li>
                  <li>Quicker access to your most important environment</li>
                  <li>Streamlined workflow for recurring tasks</li>
                </ul>
              </div>
              <DialogFooter className="pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDefaultDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={setDefaultWorkspaceMutation.isPending}
                  onClick={() => setDefaultWorkspaceMutation.mutate(currentWorkspace.id)}
                >
                  {setDefaultWorkspaceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting...
                    </>
                  ) : (
                    "Set as Default"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
