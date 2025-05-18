import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import {
  SlidersHorizontal,
  Database,
  Layers,
  Server,
  Cpu,
  BarChart3,
  Plus,
  Settings,
  RefreshCcw,
  AlertTriangle,
  FileText,
  Download,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  Play,
  Pause,
  Zap,
  ShieldCheck,
  Globe,
  Lock,
  PlugZap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { mcpServersApi, type MCPServer } from "@/api/mcp-servers";

// Define resource types and statuses
type ResourceStatus = "active" | "provisioning" | "degraded" | "error" | "paused" | "inactive" | "maintenance";

interface ResourceType {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  capabilities?: string[];
  policySupport?: boolean;
  authTypes?: string[];
  enterpriseFeatures?: string[];
}

// Tool definition from MCP servers
interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  capabilities: string[];
  server_id: number;
  parameters?: ToolParameter[];
  metadata?: Record<string, any>;
  status: string;
  created_at: string;
}

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

// Updated to focus on resource types that follow the MCP Gateway flow
const ResourceTypes = () => {
  const { t } = useTranslation();
  
  const resourceTypes: ResourceType[] = [
    {
      id: "mcp_server",
      name: t("integration_types.mcp_server.name", "MCP Server"),
      icon: Server,
      description: t("integration_types.mcp_server.description", "Connect to Model Context Protocol servers for tool execution"),
      capabilities: ["tool_discovery", "tool_execution", "policy_enforcement"],
      policySupport: true,
      authTypes: ["oauth", "api_key", "jwt", "certificate"],
      enterpriseFeatures: ["rate_limiting", "audit_logging", "sandboxing"],
    },
    {
      id: "oauth_provider",
      name: t("integration_types.oauth_provider.name", "OAuth Provider"),
      icon: Lock,
      description: t("integration_types.oauth_provider.description", "Identity and authentication provider integration"),
      capabilities: ["authentication", "identity_management", "sso", "mfa"],
      policySupport: true,
      authTypes: ["saml", "oidc", "oauth2"],
      enterpriseFeatures: ["token_validation", "attribute_mapping", "federation"],
    },
    {
      id: "data_storage",
      name: t("integration_types.data_storage.name", "Data Storage"),
      icon: Database,
      description: t("integration_types.data_storage.description", "Enterprise data storage and warehouse integrations"),
      capabilities: ["data_access", "data_query", "schema_discovery"],
      policySupport: true,
      authTypes: ["oauth", "api_key", "service_account"],
      enterpriseFeatures: ["data_masking", "column_filtering", "row_filtering"],
    },
    {
      id: "api_gateway",
      name: t("integration_types.api_gateway.name", "API Gateway"),
      icon: Globe,
      description: t("integration_types.api_gateway.description", "API management and routing services"),
      capabilities: ["api_routing", "traffic_management", "api_transformation"],
      policySupport: true,
      authTypes: ["api_key", "jwt", "certificate"],
      enterpriseFeatures: ["circuit_breaking", "fault_injection", "canary_deployment"],
    },
    {
      id: "policy_engine",
      name: t("integration_types.policy_engine.name", "Policy Engine"),
      icon: ShieldCheck,
      description: t("integration_types.policy_engine.description", "Policy definition and enforcement services"),
      capabilities: ["policy_evaluation", "policy_management", "policy_discovery"],
      policySupport: true,
      authTypes: ["oauth", "jwt", "api_key"],
      enterpriseFeatures: ["decision_logging", "policy_simulation", "impact_analysis"],
    },
    {
      id: "monitoring",
      name: t("integration_types.monitoring.name", "Monitoring & Telemetry"),
      icon: BarChart3,
      description: t("integration_types.monitoring.description", "Monitoring and observability services"),
      capabilities: ["metrics", "logs", "traces", "alerts"],
      policySupport: false,
      authTypes: ["api_key", "oauth", "basic"],
      enterpriseFeatures: ["anomaly_detection", "correlation_analysis", "predictive_alerting"],
    },
  ];
  
  return resourceTypes;
};

// Enhanced WorkspaceResource to better align with the MCP Gateway sequence flow
interface WorkspaceResource {
  id: string;
  name: string;
  resourceType: string;
  status: ResourceStatus;
  connectorType?: string; // OAuth, API Key, JWT, etc.
  authMethod?: string; // Specific auth implementation (SAML, OIDC, etc.)
  externalService?: string; // Service name (e.g., "OpenAI", "Azure", "AWS")
  connectionUrl?: string; // URL of the connected service
  scopes?: string[]; // Granted permission scopes
  capabilities?: string[]; // Supported capabilities
  tools?: Tool[]; // Associated tools (for MCP servers)
  policyIds?: string[]; // IDs of associated policies
  rbacRules?: string[]; // Role-based access control rules
  lastSyncTime?: string; // When the tools/capabilities were last synced
  lastUpdated: string;
  workspaceId: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

// Metrics interface for monitoring resource utilization
interface ResourceMetric {
  id: string;
  name: string; 
  value: number;
  change: number;
  unit: string;
  timestamp: string;
  resourceId?: string;
}

// Sample MCP servers converted to workspace resources format
const getMcpServersAsResources = (servers: MCPServer[]): WorkspaceResource[] => {
  return servers.map(server => ({
    id: `mcp-${server.id}`,
    name: server.name,
    resourceType: "mcp_server",
    status: server.status,
    connectorType: server.authType,
    externalService: server.metadata?.provider || "MCP Provider",
    connectionUrl: server.endpoint,
    capabilities: server.capabilities || [],
    lastSyncTime: server.updatedAt,
    lastUpdated: server.updatedAt,
    workspaceId: 1, // Would be dynamically determined in a real implementation
    createdAt: server.createdAt,
    metadata: server.metadata
  }));
};

// Live metrics for resources
const getResourceMetrics = (resourceId: string): ResourceMetric[] => {
  // This would make an API call to fetch real metrics in a production environment
  return [
    {
      id: `${resourceId}-requests`,
      name: "Requests/Min",
      value: Math.floor(Math.random() * 200) + 20,
      change: Math.random() * 10 - 5,
      unit: "req/min",
      timestamp: new Date().toISOString()
    },
    {
      id: `${resourceId}-latency`,
      name: "Avg. Latency",
      value: Math.floor(Math.random() * 300) + 50,
      change: Math.random() * 15 - 7.5,
      unit: "ms",
      timestamp: new Date().toISOString()
    },
    {
      id: `${resourceId}-errors`,
      name: "Error Rate",
      value: Math.random() * 5,
      change: Math.random() * 2 - 1,
      unit: "%",
      timestamp: new Date().toISOString()
    },
    {
      id: `${resourceId}-tokens`,
      name: "Token Usage",
      value: Math.floor(Math.random() * 500000) + 10000,
      change: Math.random() * 20 - 10,
      unit: "tokens",
      timestamp: new Date().toISOString(),
      resourceId
    }
  ];
};

// Workspace metrics summary data
const demoMetrics: ResourceMetric[] = [
  {
    id: 'workspace-cpu',
    name: 'CPU Usage',
    value: 42,
    change: 5.4,
    unit: '%',
    timestamp: new Date().toISOString()
  },
  {
    id: 'workspace-memory',
    name: 'Memory Usage',
    value: 64,
    change: -2.1,
    unit: '%',
    timestamp: new Date().toISOString()
  },
  {
    id: 'workspace-storage',
    name: 'Storage',
    value: 53.2,
    change: 7.5,
    unit: 'GB',
    timestamp: new Date().toISOString()
  },
  {
    id: 'workspace-network',
    name: 'Network I/O',
    value: 748,
    change: 12.3,
    unit: 'MB/s',
    timestamp: new Date().toISOString()
  }
];

const ResourceAllocationCard: React.FC<{
  title: string;
  allocated: number;
  used: number;
  icon: React.ReactNode;
}> = ({ title, allocated, used, icon }) => {
  const { t } = useTranslation();
  const percentUsed = (used / allocated) * 100;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used} / {allocated}
        </div>
        <Progress className="mt-2" value={percentUsed} />
        <p className="text-xs text-muted-foreground mt-2">
          {t("workspace_integrations.resources.percent_utilized", { percent: percentUsed.toFixed(1) })}
        </p>
      </CardContent>
    </Card>
  );
};

// Status badge component with appropriate colors
const StatusBadge: React.FC<{ status: ResourceStatus }> = ({ status }) => {
  const { t } = useTranslation();
  
  const getStatusColor = (status: ResourceStatus) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "provisioning":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "paused":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Badge className={`${getStatusColor(status)}`}>
      {t(`workspace_integrations.status.${status}`)}
    </Badge>
  );
};

const WorkspaceResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("1");
  const [newResourceDialogOpen, setNewResourceDialogOpen] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState<string | null>(null);
  const [resourceNameInput, setResourceNameInput] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [viewToolsDialogOpen, setViewToolsDialogOpen] = useState(false);
  const [resourceDetailsOpen, setResourceDetailsOpen] = useState(false);
  
  // Integration form fields
  const [externalServiceInput, setExternalServiceInput] = useState<string>("");
  const [connectorTypeInput, setConnectorTypeInput] = useState<string>("");
  const [connectionUrlInput, setConnectionUrlInput] = useState<string>("");
  const [apiVersionInput, setApiVersionInput] = useState<string>("1.0");
  const [descriptionInput, setDescriptionInput] = useState<string>("");
  const [rateLimitInput, setRateLimitInput] = useState<string>("100");

  // Get the resource types for the UI
  const resourceTypes = ResourceTypes();

  // Fetch MCP servers from the API
  const { 
    data: mcpServers = [], 
    isLoading: isLoadingServers,
    refetch: refetchServers
  } = useQuery({
    queryKey: ["mcpServers"],
    queryFn: async () => {
      return mcpServersApi.getServers();
    },
  });

  // Fetch workspace resources (in a real implementation, this would fetch from a dedicated API)
  const { 
    data: otherResources = [], 
    isLoading: isLoadingResources 
  } = useQuery({
    queryKey: ["workspaceResources", selectedWorkspace],
    queryFn: async () => {
      // This is a placeholder for other resource types beyond MCP servers
      // In a real implementation, this would fetch from an API
      return [] as WorkspaceResource[];
    },
  });

  // Create a combined resource list from MCP servers and other workspace resources
  const resources = React.useMemo(() => {
    const mcpResources = getMcpServersAsResources(mcpServers);
    return [...mcpResources, ...otherResources];
  }, [mcpServers, otherResources]);

  // Query for tools when a specific server is selected
  const { 
    data: serverTools = [], 
    isLoading: isLoadingTools,
    refetch: refetchTools
  } = useQuery({
    queryKey: ["serverTools", selectedResourceId],
    queryFn: async () => {
      if (!selectedResourceId) return [];
      
      // Extract the actual server ID from the resource ID format "mcp-{serverId}"
      const serverId = selectedResourceId.startsWith("mcp-") 
        ? selectedResourceId.replace("mcp-", "") 
        : selectedResourceId;
        
      return mcpServersApi.getServerTools(serverId);
    },
    enabled: !!selectedResourceId && selectedResourceId.startsWith("mcp-")
  });

  // Mutations for server management
  const connectServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return mcpServersApi.connectServer(serverId.replace("mcp-", ""));
    },
    onSuccess: () => {
      toast({
        title: t("workspace_integrations.notifications.connect_success", "Connected to server"),
        description: t("workspace_integrations.notifications.connect_success_desc", "Successfully established connection to the MCP server"),
        variant: "default",
      });
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: t("workspace_integrations.notifications.connect_error", "Connection failed"),
        description: error.message || t("workspace_integrations.notifications.connect_error_desc", "Failed to connect to the MCP server"),
        variant: "destructive",
      });
    }
  });

  const disconnectServerMutation = useMutation({
    mutationFn: async (serverId: string) => {
      return mcpServersApi.disconnectServer(serverId.replace("mcp-", ""));
    },
    onSuccess: () => {
      toast({
        title: t("workspace_integrations.notifications.disconnect_success", "Disconnected from server"),
        description: t("workspace_integrations.notifications.disconnect_success_desc", "Successfully disconnected from the MCP server"),
        variant: "default",
      });
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: t("workspace_integrations.notifications.disconnect_error", "Disconnection failed"),
        description: error.message || t("workspace_integrations.notifications.disconnect_error_desc", "Failed to disconnect from the MCP server"),
        variant: "destructive",
      });
    }
  });

  const addServerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedResourceType || !resourceNameInput || !connectionUrlInput || !connectorTypeInput) {
        throw new Error("Missing required fields");
      }
      
      const serverData = {
        name: resourceNameInput,
        endpoint: connectionUrlInput,
        apiVersion: apiVersionInput,
        authType: connectorTypeInput,
        rateLimit: parseInt(rateLimitInput),
        description: descriptionInput,
        status: 'inactive' as const,
        tags: [],
        metadata: externalServiceInput ? { provider: externalServiceInput } : undefined
      };
      
      return mcpServersApi.addServer(serverData);
    },
    onSuccess: () => {
      toast({
        title: t("workspace_integrations.notifications.server_added", "Server added"),
        description: t("workspace_integrations.notifications.server_added_desc", "MCP server was successfully added"),
        variant: "default",
      });
      setNewResourceDialogOpen(false);
      resetForm();
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: t("workspace_integrations.notifications.server_add_error", "Failed to add server"),
        description: error.message || t("workspace_integrations.notifications.server_add_error_desc", "There was an error adding the MCP server"),
        variant: "destructive",
      });
    }
  });

  // Function to reset the form fields
  const resetForm = () => {
    setResourceNameInput("");
    setSelectedResourceType(null);
    setExternalServiceInput("");
    setConnectorTypeInput("");
    setConnectionUrlInput("");
    setApiVersionInput("1.0");
    setDescriptionInput("");
    setRateLimitInput("100");
  };

  // Filter resources based on user selections
  const filteredResources = resources.filter((resource) => {
    const matchesType = resourceTypeFilter === "all" || resource.resourceType === resourceTypeFilter;
    const matchesStatus = statusFilter === "all" || resource.status === statusFilter;
    return matchesType && matchesStatus;
  });

  // Get icon component for a resource type
  const getResourceIcon = (resourceType: string) => {
    const type = resourceTypes.find((t: ResourceType) => t.id === resourceType);
    const Icon = type?.icon || Layers;
    return <Icon className="h-4 w-4" />;
  };
  
  // Handle connecting/disconnecting servers
  const handleToggleConnection = (resource: WorkspaceResource) => {
    if (!resource.id.startsWith("mcp-")) return;
    
    const serverId = resource.id;
    if (resource.status === "active") {
      disconnectServerMutation.mutate(serverId);
    } else {
      connectServerMutation.mutate(serverId);
    }
  };
  
  // Handle viewing tools for a server
  const handleViewTools = (resource: WorkspaceResource) => {
    setSelectedResourceId(resource.id);
    setViewToolsDialogOpen(true);
    if (resource.id.startsWith("mcp-")) {
      refetchTools();
    }
  };
  
  // Flag for overall loading state
  const isLoading = isLoadingServers || isLoadingResources;

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title={t("workspace_integrations.title")}
        description={t("workspace_integrations.description")}
        actions={
          <Button onClick={() => setNewResourceDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("workspace_integrations.new_integration")}
          </Button>
        }
      />

      <div className="my-6">
        <Tabs defaultValue="resources" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resources">{t("workspace_integrations.tabs.resources", "Resources")}</TabsTrigger>
            <TabsTrigger value="metrics">{t("workspace_integrations.tabs.metrics", "Metrics")}</TabsTrigger>
            <TabsTrigger value="quotas">{t("workspace_integrations.tabs.quotas", "Quotas")}</TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="p-4 pt-6">
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <Select
                  value={resourceTypeFilter}
                  onValueChange={setResourceTypeFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t("workspace_integrations.filters.resource_type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("workspace_integrations.filters.all_types")}</SelectItem>
                    {resourceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t("workspace_integrations.filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("workspace_integrations.filters.all_statuses")}</SelectItem>
                    <SelectItem value="active">{t("workspace_integrations.status.active")}</SelectItem>
                    <SelectItem value="provisioning">{t("workspace_integrations.status.provisioning")}</SelectItem>
                    <SelectItem value="degraded">{t("workspace_integrations.status.degraded")}</SelectItem>
                    <SelectItem value="error">{t("workspace_integrations.status.error")}</SelectItem>
                    <SelectItem value="paused">{t("workspace_integrations.status.paused")}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  title={t("workspace_integrations.actions.refresh")}
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center">
                <Input 
                  className="max-w-xs" 
                  placeholder={t("workspace_integrations.search.placeholder")}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : filteredResources.length === 0 ? (
              <EmptyState 
                title={t("workspace_integrations.empty_state.title")}
                description={t("workspace_integrations.empty_state.description")}
                actions={
                  <Button onClick={() => setNewResourceDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> {t("workspace_integrations.empty_state.add_integration")}
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <Card key={resource.id} className={`overflow-hidden transition-all hover:shadow-md ${resource.status === 'active' ? 'border-green-200 dark:border-green-900' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-md ${resource.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            {getResourceIcon(resource.resourceType)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{resource.name}</CardTitle>
                            <CardDescription>
                              {resourceTypes.find(t => t.id === resource.resourceType)?.name || resource.resourceType}
                              {resource.externalService && ` • ${resource.externalService}`}
                            </CardDescription>
                          </div>
                        </div>
                        <StatusBadge status={resource.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-2 text-sm">
                      <div className="flex flex-col gap-2">
                        {resource.capabilities && resource.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {resource.capabilities.slice(0, 3).map((cap) => (
                              <Badge key={cap} variant="outline" className="text-xs">
                                {cap}
                              </Badge>
                            ))}
                            {resource.capabilities.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{resource.capabilities.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-1">
                          {resource.connectionUrl && (
                            <div className="truncate">
                              <span className="font-semibold">{t("workspace_integrations.endpoint")}:</span> {resource.connectionUrl}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold">{t("workspace_integrations.auth_type")}:</span> {resource.connectorType || "Basic"}
                          </div>
                          {resource.lastSyncTime && (
                            <div>
                              <span className="font-semibold">{t("workspace_integrations.last_sync.label")}:</span> {new Date(resource.lastSyncTime).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between pt-2 pb-3 px-6">
                      {resource.resourceType === 'mcp_server' ? (
                        <>
                          <Button 
                            size="sm" 
                            variant={resource.status === 'active' ? 'destructive' : 'default'}
                            onClick={() => handleToggleConnection(resource)}
                            disabled={connectServerMutation.isPending || disconnectServerMutation.isPending}
                          >
                            {resource.status === 'active' ? (
                              <>
                                <Pause className="mr-1 h-3 w-3" /> {t("workspace_integrations.actions.disconnect")}
                              </>
                            ) : (
                              <>
                                <Play className="mr-1 h-3 w-3" /> {t("workspace_integrations.actions.connect")}
                              </>
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewTools(resource)}
                            disabled={resource.status !== 'active'}
                          >
                            <Zap className="mr-1 h-3 w-3" /> {t("workspace_integrations.actions.view_tools")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => console.log('Configure resource')}
                          >
                            <Settings className="mr-1 h-3 w-3" /> {t("workspace_integrations.actions.configure")}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => console.log('View details')}
                          >
                            <FileText className="mr-1 h-3 w-3" /> {t("workspace_integrations.actions.view_details")}
                          </Button>
                        </>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="p-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {demoMetrics.map((metric) => (
                <Card key={metric.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metric.value} {metric.unit}
                    </div>
                    <p className={`text-xs ${metric.change > 0 ? 'text-green-500' : 'text-red-500'} flex items-center mt-1`}>
                      {metric.change > 0 ? '↑' : '↓'} {Math.abs(metric.change)}% from last period
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Chart visualization would be displayed here
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quotas" className="p-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ResourceAllocationCard
                title="CPU Allocation"
                allocated={500}
                used={320}
                icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
              />
              <ResourceAllocationCard
                title="Memory Allocation"
                allocated={1024}
                used={768}
                icon={<Layers className="h-4 w-4 text-muted-foreground" />}
              />
              <ResourceAllocationCard
                title="Storage Allocation"
                allocated={2000}
                used={1250}
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Quota Adjustment History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Previous</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Changed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>CPU Allocation</TableCell>
                      <TableCell>400 units</TableCell>
                      <TableCell>500 units</TableCell>
                      <TableCell>Administrator</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>Storage Allocation</TableCell>
                      <TableCell>1500 GB</TableCell>
                      <TableCell>2000 GB</TableCell>
                      <TableCell>System</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>Memory Allocation</TableCell>
                      <TableCell>512 GB</TableCell>
                      <TableCell>1024 GB</TableCell>
                      <TableCell>Administrator</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Resource Dialog */}
      <Dialog open={newResourceDialogOpen} onOpenChange={setNewResourceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("integration_dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("integration_dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resourceType" className="text-right">
                {t("integration_dialog.integration_type")}
              </Label>
              <Select
                value={selectedResourceType || ""}
                onValueChange={setSelectedResourceType}
              >
                <SelectTrigger id="resourceType" className="col-span-3">
                  <SelectValue placeholder="Select integration type" />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resourceName" className="text-right">
                Name
              </Label>
              <Input
                id="resourceName"
                className="col-span-3"
                value={resourceNameInput}
                onChange={(e) => setResourceNameInput(e.target.value)}
                placeholder="My Integration Name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="externalService" className="text-right">
                Service
              </Label>
              <Input
                id="externalService"
                className="col-span-3"
                placeholder="e.g., Snowflake, OpenAI, Okta"
                value={externalServiceInput || ""}
                onChange={(e) => setExternalServiceInput?.(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="connectorType" className="text-right">
                Connector Type
              </Label>
              <Select
                value={connectorTypeInput || ""}
                onValueChange={setConnectorTypeInput}
              >
                <SelectTrigger id="connectorType" className="col-span-3">
                  <SelectValue placeholder="Select connector type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="API Key">API Key</SelectItem>
                  <SelectItem value="OAuth">OAuth</SelectItem>
                  <SelectItem value="SAML">SAML</SelectItem>
                  <SelectItem value="Certificate">Certificate</SelectItem>
                  <SelectItem value="Basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="connectionUrl" className="text-right">
                Connection URL
              </Label>
              <Input
                id="connectionUrl"
                className="col-span-3"
                placeholder="https://service-endpoint.example.com"
                value={connectionUrlInput || ""}
                onChange={(e) => setConnectionUrlInput?.(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewResourceDialogOpen(false)}>
              {t("integration_dialog.cancel")}
            </Button>
            <Button type="submit" onClick={() => {
              // Create the new integration resource
              if (selectedResourceType && resourceNameInput) {
                const newResource: WorkspaceResource = {
                  id: `res-${Date.now()}`,
                  name: resourceNameInput,
                  resourceType: selectedResourceType,
                  status: "provisioning",
                  lastUpdated: new Date().toISOString(),
                  workspaceId: parseInt(selectedWorkspace),
                  createdAt: new Date().toISOString(),
                  // Add new integration-specific fields
                  connectorType: connectorTypeInput,
                  externalService: externalServiceInput,
                  connectionUrl: connectionUrlInput,
                  scopes: [],
                };
                
                // In a real implementation, we would make an API call here
                // but for now we'll simulate adding the resource to the demo data
                console.log("Creating new integration resource:", newResource);
                
                // Reset form fields
                setResourceNameInput("");
                setSelectedResourceType(null);
                setConnectorTypeInput("");
                setExternalServiceInput("");
                setConnectionUrlInput("");
                
                // Close the dialog
                setNewResourceDialogOpen(false);
                
                // This would trigger a refetch in a real implementation
                // queryClient.invalidateQueries(["workspaceResources", selectedWorkspace]);
              }
            }}>
              {t("integration_dialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new resource dialog - modernized to follow MCP Gateway flow */}
      <Dialog open={newResourceDialogOpen} onOpenChange={(open) => {
        setNewResourceDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{t("workspace_integrations.new_resource.title", "Create New Integration")}</DialogTitle>
            <DialogDescription>
              {t("workspace_integrations.new_resource.description", "Add a new integration to your workspace.")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="resource-name">{t("workspace_integrations.new_resource.name_label", "Name")}</Label>
              <Input
                id="resource-name"
                placeholder={t("workspace_integrations.new_resource.name_placeholder", "My Integration Name")}
                value={resourceNameInput}
                onChange={(e) => setResourceNameInput(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>{t("workspace_integrations.new_resource.type_label", "Integration Type")}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resourceTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`flex items-start p-3 border rounded-md cursor-pointer
                      ${selectedResourceType === type.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'}`}
                    onClick={() => setSelectedResourceType(type.id)}
                  >
                    <div className={`p-2 rounded-md mr-3 ${
                      selectedResourceType === type.id 
                        ? 'text-white bg-primary' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{type.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {selectedResourceType && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="connector-type">{t("workspace_integrations.new_resource.connector_type_label", "Authentication Type")}</Label>
                  <Select value={connectorTypeInput} onValueChange={setConnectorTypeInput}>
                    <SelectTrigger id="connector-type">
                      <SelectValue placeholder={t("workspace_integrations.new_resource.connector_type_placeholder", "Select authentication type")} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedResourceType === "mcp_server" ? (
                        <>
                          <SelectItem value="oauth">OAuth 2.0</SelectItem>
                          <SelectItem value="api_key">API Key</SelectItem>
                          <SelectItem value="jwt">JWT</SelectItem>
                          <SelectItem value="certificate">Certificate</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="OAuth">OAuth 2.0</SelectItem>
                          <SelectItem value="API Key">API Key</SelectItem>
                          <SelectItem value="JWT">JWT</SelectItem>
                          <SelectItem value="Certificate">Certificate</SelectItem>
                          <SelectItem value="Basic">Basic Auth</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="external-service">{t("workspace_integrations.new_resource.service_label", "Provider/Service")}</Label>
                  <Input
                    id="external-service"
                    placeholder={t("workspace_integrations.new_resource.service_placeholder", "e.g., OpenAI, Azure, AWS")}
                    value={externalServiceInput}
                    onChange={(e) => setExternalServiceInput(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="connection-url">{t("workspace_integrations.new_resource.url_label", "Endpoint URL")}</Label>
                  <Input
                    id="connection-url"
                    placeholder={t("workspace_integrations.new_resource.url_placeholder", "https://api.example.com")}
                    value={connectionUrlInput}
                    onChange={(e) => setConnectionUrlInput(e.target.value)}
                  />
                </div>
                
                {selectedResourceType === "mcp_server" && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="api-version">{t("workspace_integrations.new_resource.api_version", "API Version")}</Label>
                      <Input
                        id="api-version"
                        placeholder="1.0"
                        value={apiVersionInput}
                        onChange={(e) => setApiVersionInput(e.target.value)}
                      />
                    </div>
                
                    <div className="grid gap-2">
                      <Label htmlFor="rate-limit">{t("workspace_integrations.new_resource.rate_limit", "Rate Limit (req/min)")}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="rate-limit"
                          type="range"
                          min="10"
                          max="1000"
                          step="10"
                          value={rateLimitInput}
                          onChange={(e) => setRateLimitInput(e.target.value)}
                          className="w-full"
                        />
                        <span>{rateLimitInput} {t("workspace_integrations.new_resource.requests_per_minute", "req/min")}</span>
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="description">{t("workspace_integrations.new_resource.description_label", "Description")}</Label>
                      <Input
                        id="description"
                        placeholder={t("workspace_integrations.new_resource.description_placeholder", "Enter a description...")}
                        value={descriptionInput}
                        onChange={(e) => setDescriptionInput(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewResourceDialogOpen(false)}>
              {t("workspace_integrations.new_resource.cancel", "Cancel")}
            </Button>
            <Button 
              type="submit"
              disabled={!resourceNameInput || !selectedResourceType || !connectionUrlInput || !connectorTypeInput || addServerMutation.isPending}
              onClick={() => {
                if (selectedResourceType === "mcp_server") {
                  addServerMutation.mutate();
                } else {
                  // Implementation for other resource types
                  toast({
                    title: t("workspace_integrations.notifications.not_implemented", "Not implemented"),
                    description: t("workspace_integrations.notifications.resource_type_not_implemented", "This resource type is not yet implemented"),
                    variant: "destructive",
                  });
                }
              }}
            >
              {addServerMutation.isPending ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  {t("workspace_integrations.new_resource.creating", "Creating...")}
                </>
              ) : (
                t("workspace_integrations.new_resource.create", "Create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View tools dialog for MCP server resources */}
      <Dialog open={viewToolsDialogOpen} onOpenChange={setViewToolsDialogOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("workspace_integrations.view_tools.title", "Available Tools")}
            </DialogTitle>
            <DialogDescription>
              {t("workspace_integrations.view_tools.description", "These tools are available from the connected MCP server")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {isLoadingTools ? (
              <div className="flex justify-center py-8">
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : serverTools.length === 0 ? (
              <EmptyState
                icon={Zap}
                title={t("workspace_integrations.view_tools.no_tools_title", "No tools available")}
                description={t("workspace_integrations.view_tools.no_tools_description", "This server doesn't have any tools available or hasn't synchronized tools yet.")}
                actionLabel={t("workspace_integrations.view_tools.refresh", "Refresh")}
                onAction={() => refetchTools()}
              />
            ) : (
              <div className="space-y-6">
                {serverTools.map((tool) => (
                  <Card key={tool.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            {tool.name}
                            <Badge variant="outline" className="ml-2">
                              v{tool.version}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{tool.description}</CardDescription>
                        </div>
                        <Badge variant={tool.status === "active" ? "default" : "secondary"}>
                          {tool.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tool.tags && tool.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {tool.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {tool.parameters && tool.parameters.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium mb-2">
                            {t("workspace_integrations.view_tools.parameters", "Parameters")}
                          </h4>
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("workspace_integrations.view_tools.parameter_name", "Name")}</TableHead>
                                  <TableHead>{t("workspace_integrations.view_tools.parameter_type", "Type")}</TableHead>
                                  <TableHead>{t("workspace_integrations.view_tools.parameter_required", "Required")}</TableHead>
                                  <TableHead>{t("workspace_integrations.view_tools.parameter_description", "Description")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tool.parameters.map((param) => (
                                  <TableRow key={param.name}>
                                    <TableCell className="font-medium">{param.name}</TableCell>
                                    <TableCell><code className="bg-muted px-1 py-0.5 rounded text-xs">{param.type}</code></TableCell>
                                    <TableCell>
                                      {param.required ? (
                                        <Badge variant="destructive" className="text-xs">
                                          {t("workspace_integrations.view_tools.required", "Required")}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs">
                                          {t("workspace_integrations.view_tools.optional", "Optional")}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm">{param.description}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewToolsDialogOpen(false)}>
              {t("workspace_integrations.view_tools.close", "Close")}
            </Button>
            <Button 
              onClick={() => refetchTools()}
              disabled={isLoadingTools}
            >
              {isLoadingTools ? (
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              {t("workspace_integrations.view_tools.refresh", "Refresh")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkspaceResourcesPage;