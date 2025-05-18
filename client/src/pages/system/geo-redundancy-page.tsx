import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardHeader from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DialogHeader, Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Activity, AlertTriangle, BarChart, CheckCircle, CloudOff, Database, 
  Globe, Loader2, MapPin, Plus, RefreshCw, Save, Server, Settings, Shield,
  Trash2, XCircle, Zap 
} from "lucide-react";

// Schema for the multi-region configuration form
const multiRegionConfigSchema = z.object({
  isEnabled: z.boolean(),
  primaryRegionId: z.string().min(1, "Primary region is required"),
  routingStrategy: z.string().min(1, "Routing strategy is required"),
  autoFailover: z.boolean(),
  edgeCaching: z.boolean(),
  asyncReplication: z.boolean(),
  maxLatencyThreshold: z.coerce.number().min(0).optional(),
  healthCheckInterval: z.coerce.number().min(10).optional()
});

// Schema for the region form
const regionFormSchema = z.object({
  id: z.string().min(2, "Region ID is required"),
  name: z.string().min(2, "Region name is required"),
  isPrimary: z.boolean().optional(),
  isEdgeEnabled: z.boolean().optional(),
  failoverRegion: z.string().optional(),
  maxNodes: z.coerce.number().min(1).optional(),
  minNodes: z.coerce.number().min(1).optional(),
  priority: z.coerce.number().min(1).max(100).optional(),
});

type RegionStatus = "healthy" | "degraded" | "unavailable";

interface Region {
  id: string;
  name: string;
  status: RegionStatus;
  isPrimary: boolean;
  isEdgeEnabled: boolean;
  failoverRegion?: string;
  maxNodes?: number;
  minNodes?: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  zones: Zone[];
  metrics: RegionMetric[];
}

interface Zone {
  id: string;
  regionId: string;
  name: string;
  status: string;
  isPrimary: boolean;
  priority: number;
}

interface RegionMetric {
  id: number;
  regionId: string;
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  requestCount: number;
  errorCount: number;
  nodeCount: number;
  activeNodeCount: number;
}

interface MultiRegionConfig {
  id: number;
  isEnabled: boolean;
  primaryRegionId: string;
  routingStrategy: string;
  autoFailover: boolean;
  edgeCaching: boolean;
  asyncReplication: boolean;
  maxLatencyThreshold?: number;
  healthCheckInterval?: number;
  updatedAt: string;
  updatedBy: number;
  primaryRegion?: Region;
}

interface RegionLatency {
  id: number;
  sourceRegionId: string;
  destinationRegionId: string;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  lastCheck: string;
  sourceRegion: Region;
  destinationRegion: Region;
}

const GeoRedundancyPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("regions");
  const [isAddRegionDialogOpen, setIsAddRegionDialogOpen] = useState(false);
  const [isEditRegionDialogOpen, setIsEditRegionDialogOpen] = useState(false);
  const [editRegionId, setEditRegionId] = useState<string | null>(null);
  const [isConfirmFailoverDialogOpen, setIsConfirmFailoverDialogOpen] = useState(false);
  const [failoverDetails, setFailoverDetails] = useState<{fromRegion: string, toRegion: string}>({fromRegion: "", toRegion: ""});

  // Query for fetching regions
  const { data: regions, isLoading: isLoadingRegions, isError: isRegionsError, error: regionsError, refetch: refetchRegions } = 
    useQuery<Region[]>({
      queryKey: ["/api/geo-redundancy/regions"],
      retry: 1,
    });

  // Query for multi-region configuration
  const { data: config, isLoading: isLoadingConfig, isError: isConfigError, error: configError, refetch: refetchConfig } = 
    useQuery<MultiRegionConfig>({
      queryKey: ["/api/geo-redundancy/config"],
      retry: 1,
    });
  
  // Query for latency data
  const { data: latencyData, isLoading: isLoadingLatency, isError: isLatencyError, error: latencyError, refetch: refetchLatency } = 
    useQuery<RegionLatency[]>({
      queryKey: ["/api/geo-redundancy/latency"],
      retry: 1,
    });

  // Form for multi-region configuration
  const configForm = useForm<z.infer<typeof multiRegionConfigSchema>>({
    resolver: zodResolver(multiRegionConfigSchema),
    defaultValues: {
      isEnabled: config?.isEnabled || false,
      primaryRegionId: config?.primaryRegionId || "",
      routingStrategy: config?.routingStrategy || "nearest",
      autoFailover: config?.autoFailover || true,
      edgeCaching: config?.edgeCaching || false,
      asyncReplication: config?.asyncReplication || true,
      maxLatencyThreshold: config?.maxLatencyThreshold || 100,
      healthCheckInterval: config?.healthCheckInterval || 60,
    },
  });

  // Update form values when config is loaded
  React.useEffect(() => {
    if (config) {
      configForm.reset({
        isEnabled: config.isEnabled,
        primaryRegionId: config.primaryRegionId,
        routingStrategy: config.routingStrategy,
        autoFailover: config.autoFailover,
        edgeCaching: config.edgeCaching,
        asyncReplication: config.asyncReplication,
        maxLatencyThreshold: config.maxLatencyThreshold,
        healthCheckInterval: config.healthCheckInterval,
      });
    }
  }, [config, configForm]);

  // Form for adding/editing regions
  const regionForm = useForm<z.infer<typeof regionFormSchema>>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: {
      id: "",
      name: "",
      isPrimary: false,
      isEdgeEnabled: false,
      failoverRegion: "",
      maxNodes: 10,
      minNodes: 1,
      priority: 50,
    },
  });

  // Reset region form when opening the add dialog
  React.useEffect(() => {
    if (isAddRegionDialogOpen) {
      regionForm.reset({
        id: "",
        name: "",
        isPrimary: false,
        isEdgeEnabled: false,
        failoverRegion: "",
        maxNodes: 10,
        minNodes: 1,
        priority: 50,
      });
    }
  }, [isAddRegionDialogOpen, regionForm]);

  // Update region form when editing a region
  React.useEffect(() => {
    if (isEditRegionDialogOpen && editRegionId && regions) {
      const region = regions.find(r => r.id === editRegionId);
      if (region) {
        regionForm.reset({
          id: region.id,
          name: region.name,
          isPrimary: region.isPrimary,
          isEdgeEnabled: region.isEdgeEnabled,
          failoverRegion: region.failoverRegion,
          maxNodes: region.maxNodes,
          minNodes: region.minNodes,
          priority: region.priority,
        });
      }
    }
  }, [isEditRegionDialogOpen, editRegionId, regions, regionForm]);

  // Mutation for updating multi-region configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (data: z.infer<typeof multiRegionConfigSchema>) => {
      const res = await apiRequest("PATCH", "/api/geo-redundancy/config", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Multi-region configuration has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/config"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update multi-region configuration",
        variant: "destructive",
      });
    },
  });

  // Mutation for adding a new region
  const addRegionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof regionFormSchema>) => {
      const res = await apiRequest("POST", "/api/geo-redundancy/regions", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Region Added",
        description: "New region has been added successfully",
      });
      setIsAddRegionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/regions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Add Failed",
        description: error.message || "Failed to add new region",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating a region
  const updateRegionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof regionFormSchema>) => {
      const res = await apiRequest("PATCH", `/api/geo-redundancy/regions/${data.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Region Updated",
        description: "Region has been updated successfully",
      });
      setIsEditRegionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/regions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update region",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a region
  const deleteRegionMutation = useMutation({
    mutationFn: async (regionId: string) => {
      const res = await apiRequest("DELETE", `/api/geo-redundancy/regions/${regionId}`);
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Region Deleted",
        description: "Region has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/regions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete region",
        variant: "destructive",
      });
    },
  });

  // Mutation for triggering failover
  const triggerFailoverMutation = useMutation({
    mutationFn: async (data: { fromRegion: string, toRegion: string, reason: string }) => {
      const res = await apiRequest("POST", "/api/geo-redundancy/failover", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Failover Triggered",
        description: "Region failover has been triggered successfully",
      });
      setIsConfirmFailoverDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/regions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/geo-redundancy/config"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failover Failed",
        description: error.message || "Failed to trigger region failover",
        variant: "destructive",
      });
    },
  });

  const handleConfigSubmit = (data: z.infer<typeof multiRegionConfigSchema>) => {
    updateConfigMutation.mutate(data);
  };

  const handleAddRegion = (data: z.infer<typeof regionFormSchema>) => {
    addRegionMutation.mutate(data);
  };

  const handleUpdateRegion = (data: z.infer<typeof regionFormSchema>) => {
    updateRegionMutation.mutate(data);
  };

  const handleDeleteRegion = (regionId: string) => {
    deleteRegionMutation.mutate(regionId);
  };

  const handleFailover = () => {
    triggerFailoverMutation.mutate({
      fromRegion: failoverDetails.fromRegion,
      toRegion: failoverDetails.toRegion,
      reason: "Manual failover triggered by administrator"
    });
  };

  const openFailoverDialog = (fromRegion: string, toRegion: string) => {
    setFailoverDetails({ fromRegion, toRegion });
    setIsConfirmFailoverDialogOpen(true);
  };

  const refreshData = () => {
    refetchRegions();
    refetchConfig();
    refetchLatency();
  };

  const getStatusBadge = (status: RegionStatus) => {
    switch (status) {
      case "healthy":
        return (
          <Badge className="bg-success/10 text-success">
            <CheckCircle className="h-3 w-3 mr-1" /> Healthy
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-warning/10 text-warning">
            <AlertTriangle className="h-3 w-3 mr-1" /> Degraded
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="bg-destructive/10 text-destructive">
            <XCircle className="h-3 w-3 mr-1" /> Unavailable
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <CloudOff className="h-3 w-3 mr-1" /> Unknown
          </Badge>
        );
    }
  };

  const getActiveNodePercentage = (region: Region) => {
    if (!region.metrics || region.metrics.length === 0) return 0;
    
    const latestMetric = region.metrics[0];
    if (latestMetric.nodeCount === 0) return 0;
    
    return Math.round((latestMetric.activeNodeCount / latestMetric.nodeCount) * 100);
  };

  const isLoading = isLoadingRegions || isLoadingConfig || isLoadingLatency;
  const isError = isRegionsError || isConfigError || isLatencyError;
  const error = regionsError || configError || latencyError;

  return (
    <>
      <DashboardHeader
        title="Geo-Redundancy"
        subtitle="Manage multi-region deployment and geo-routing capabilities"
        onRefresh={refreshData}
        isRefreshing={isLoading}
      >
        <div className="flex items-center gap-2">
          {activeTab === "regions" && (
            <Button onClick={() => setIsAddRegionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Region
            </Button>
          )}
          <Button 
            onClick={configForm.handleSubmit(handleConfigSubmit)} 
            disabled={updateConfigMutation.isPending}
            variant={activeTab === "settings" ? "default" : "outline"}
          >
            {updateConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Config
              </>
            )}
          </Button>
        </div>
      </DashboardHeader>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading geo-redundancy configuration...</span>
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertTitle>Error loading configuration</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || "An error occurred while loading geo-redundancy configuration. Please try refreshing."}
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="regions" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="regions" className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              Regions
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Routing
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Regions Tab */}
          <TabsContent value="regions">
            <Card>
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Deployment Regions</CardTitle>
                <CardDescription>
                  Manage regions for multi-region deployment and failover configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {regions && regions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Nodes</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead>Edge Enabled</TableHead>
                        <TableHead>Failover To</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regions.map((region) => (
                        <TableRow key={region.id}>
                          <TableCell className="font-mono">{region.id}</TableCell>
                          <TableCell className="font-medium">{region.name}</TableCell>
                          <TableCell>{getStatusBadge(region.status)}</TableCell>
                          <TableCell>
                            {region.metrics && region.metrics.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <div className="text-xs">
                                  {region.metrics[0].activeNodeCount}/{region.metrics[0].nodeCount} active
                                </div>
                                <Progress value={getActiveNodePercentage(region)} className="h-2" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No data</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {region.isPrimary ? (
                              <Badge className="bg-primary/10 text-primary">Primary</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Secondary</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {region.isEdgeEnabled ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            {region.failoverRegion ? (
                              <span className="text-xs font-mono">{region.failoverRegion}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditRegionId(region.id);
                                  setIsEditRegionDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              {!region.isPrimary && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Find primary region
                                      const primaryRegion = regions.find(r => r.isPrimary);
                                      if (primaryRegion) {
                                        openFailoverDialog(primaryRegion.id, region.id);
                                      }
                                    }}
                                  >
                                    Failover to
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => handleDeleteRegion(region.id)}
                                    disabled={deleteRegionMutation.isPending}
                                  >
                                    {deleteRegionMutation.isPending && deleteRegionMutation.variables === region.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <Server className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Regions Configured</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first deployment region to enable geo-redundancy features
                    </p>
                    <Button onClick={() => setIsAddRegionDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Region
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics">
            <Card>
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Region Performance Metrics</CardTitle>
                <CardDescription>
                  Monitor performance and health metrics across deployment regions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {regions && regions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {regions.map((region) => {
                      const latestMetric = region.metrics && region.metrics.length > 0 
                        ? region.metrics[0] 
                        : null;
                      
                      return (
                        <Card key={region.id} className={region.status === "unavailable" ? "border-destructive/50" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-sm font-medium">{region.name}</CardTitle>
                              {getStatusBadge(region.status)}
                            </div>
                            <CardDescription className="text-xs font-mono">{region.id}</CardDescription>
                          </CardHeader>
                          <CardContent className="pb-2">
                            {latestMetric ? (
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>CPU Usage</span>
                                    <span>{latestMetric.cpuUsage.toFixed(1)}%</span>
                                  </div>
                                  <Progress value={latestMetric.cpuUsage} className="h-1" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>Memory Usage</span>
                                    <span>{latestMetric.memoryUsage.toFixed(1)}%</span>
                                  </div>
                                  <Progress value={latestMetric.memoryUsage} className="h-1" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>Latency</span>
                                    <span>{latestMetric.latency.toFixed(1)} ms</span>
                                  </div>
                                  <Progress value={Math.min(latestMetric.latency / 2, 100)} className="h-1" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                  <div className="rounded-md bg-muted p-2">
                                    <div className="text-xs text-muted-foreground">Requests</div>
                                    <div className="text-sm font-medium">{latestMetric.requestCount}</div>
                                  </div>
                                  <div className="rounded-md bg-muted p-2">
                                    <div className="text-xs text-muted-foreground">Errors</div>
                                    <div className="text-sm font-medium">{latestMetric.errorCount}</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-md bg-muted p-2">
                                    <div className="text-xs text-muted-foreground">Active Nodes</div>
                                    <div className="text-sm font-medium">{latestMetric.activeNodeCount}/{latestMetric.nodeCount}</div>
                                  </div>
                                  <div className="rounded-md bg-muted p-2">
                                    <div className="text-xs text-muted-foreground">Last Update</div>
                                    <div className="text-xs">{new Date(latestMetric.timestamp).toLocaleTimeString()}</div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-4">
                                <BarChart className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">No metrics available</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Metrics Available</h3>
                    <p className="text-muted-foreground">
                      Configure regions to start collecting performance metrics
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {latencyData && latencyData.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="bg-muted/50 py-4">
                  <CardTitle className="text-base font-medium">Region-to-Region Latency</CardTitle>
                  <CardDescription>
                    Cross-region latency measurements for optimal routing
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Avg Latency</TableHead>
                        <TableHead>Min Latency</TableHead>
                        <TableHead>Max Latency</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Last Check</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latencyData.map((latency) => (
                        <TableRow key={latency.id}>
                          <TableCell className="font-mono text-xs">{latency.sourceRegion.name}</TableCell>
                          <TableCell className="font-mono text-xs">{latency.destinationRegion.name}</TableCell>
                          <TableCell>{latency.averageLatency.toFixed(1)} ms</TableCell>
                          <TableCell>{latency.minLatency.toFixed(1)} ms</TableCell>
                          <TableCell>{latency.maxLatency.toFixed(1)} ms</TableCell>
                          <TableCell>{latency.successRate.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs">
                            {new Date(latency.lastCheck).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Routing Tab */}
          <TabsContent value="routing">
            <Card>
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Geo-Routing Configuration</CardTitle>
                <CardDescription>
                  Configure routing strategies and edge caching for optimal client routing
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Current Routing Strategy</h3>
                    <div className="bg-muted rounded-lg p-4 mb-4">
                      <div className="flex items-center mb-2">
                        <MapPin className="h-5 w-5 mr-2 text-primary" />
                        <span className="font-medium">
                          {config?.routingStrategy === "nearest" && "Nearest Region"}
                          {config?.routingStrategy === "sticky" && "Sticky Region"}
                          {config?.routingStrategy === "performance" && "Performance-Based"}
                          {config?.routingStrategy === "load-balanced" && "Load Balanced"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {config?.routingStrategy === "nearest" && "Routes clients to their geographically nearest region for minimal latency."}
                        {config?.routingStrategy === "sticky" && "Keeps clients in the same region across sessions for consistency."}
                        {config?.routingStrategy === "performance" && "Routes clients based on region performance metrics."}
                        {config?.routingStrategy === "load-balanced" && "Distributes clients across regions based on load."}
                      </p>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-4">Primary Region</h3>
                    {config?.primaryRegion ? (
                      <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                        <div className="flex items-start">
                          <Server className="h-8 w-8 mr-3 text-primary flex-shrink-0 mt-1" />
                          <div>
                            <div className="font-medium">{config.primaryRegion.name}</div>
                            <div className="text-xs font-mono text-muted-foreground">{config.primaryRegion.id}</div>
                            <div className="mt-2 flex items-center">
                              {getStatusBadge(config.primaryRegion.status)}
                              {config.primaryRegion.status !== "healthy" && config.autoFailover && (
                                <Badge className="ml-2 bg-warning/10 text-warning">
                                  Auto-failover enabled
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <Server className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">No primary region configured</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Region Routing Map</h3>
                    {regions && regions.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-3 gap-0">
                          <div className="bg-muted p-2 text-center text-xs font-medium border-r border-b">Region</div>
                          <div className="bg-muted p-2 text-center text-xs font-medium border-r border-b">Priority</div>
                          <div className="bg-muted p-2 text-center text-xs font-medium border-b">Failover To</div>
                          
                          {regions.map((region) => (
                            <React.Fragment key={region.id}>
                              <div className="p-2 text-sm border-r border-b">
                                <div className="font-medium">{region.name}</div>
                                <div className="text-xs font-mono text-muted-foreground">{region.id}</div>
                              </div>
                              <div className="p-2 text-center text-sm border-r border-b">
                                {region.priority || 50}
                              </div>
                              <div className="p-2 text-center text-sm border-b">
                                {region.failoverRegion ? (
                                  <span className="text-xs font-mono">{region.failoverRegion}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">No regions configured for routing</p>
                      </div>
                    )}
                    
                    <h3 className="text-lg font-semibold mt-6 mb-4">Edge Caching</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Zap className="h-5 w-5 mr-2 text-muted-foreground" />
                          <span className="font-medium">Edge Caching</span>
                        </div>
                        <Badge className={config?.edgeCaching ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                          {config?.edgeCaching ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {config?.edgeCaching 
                          ? "Content is cached at edge regions for faster delivery to clients." 
                          : "Edge caching is disabled. Enable it in settings for better performance."}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Multi-Region Configuration</CardTitle>
                <CardDescription>
                  Configure global settings for geo-redundancy and multi-region deployment
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <Form {...configForm}>
                  <form onSubmit={configForm.handleSubmit(handleConfigSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <FormField
                          control={configForm.control}
                          name="isEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Enable Multi-Region</FormLabel>
                                <FormDescription>
                                  Activate multi-region deployment capabilities
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
                          control={configForm.control}
                          name="primaryRegionId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Region</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select primary region" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {regions?.map((region) => (
                                    <SelectItem key={region.id} value={region.id}>
                                      {region.name} ({region.id})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                The main region for handling requests when no specific routing is applied
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={configForm.control}
                          name="routingStrategy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Routing Strategy</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select routing strategy" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="nearest">Nearest Region</SelectItem>
                                  <SelectItem value="sticky">Sticky Region</SelectItem>
                                  <SelectItem value="performance">Performance-Based</SelectItem>
                                  <SelectItem value="load-balanced">Load Balanced</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Strategy used to route client requests to appropriate regions
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={configForm.control}
                          name="maxLatencyThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Latency Threshold (ms)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} min={0} />
                              </FormControl>
                              <FormDescription>
                                Maximum acceptable latency before failover is triggered
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <FormField
                          control={configForm.control}
                          name="autoFailover"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Automatic Failover</FormLabel>
                                <FormDescription>
                                  Automatically failover to secondary regions when primary is unavailable
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
                          control={configForm.control}
                          name="edgeCaching"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Edge Caching</FormLabel>
                                <FormDescription>
                                  Enable content caching at edge regions for faster delivery
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
                          control={configForm.control}
                          name="asyncReplication"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Async Replication</FormLabel>
                                <FormDescription>
                                  Use asynchronous replication between regions (faster but may have slight data delay)
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
                          control={configForm.control}
                          name="healthCheckInterval"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Health Check Interval (seconds)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} min={10} />
                              </FormControl>
                              <FormDescription>
                                Frequency of health checks between regions
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={updateConfigMutation.isPending}
                      className="w-full"
                    >
                      {updateConfigMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving Configuration...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Configuration
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Add Region Dialog */}
      <Dialog
        open={isAddRegionDialogOpen}
        onOpenChange={setIsAddRegionDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Region</DialogTitle>
            <DialogDescription>
              Create a new deployment region for multi-region capabilities
            </DialogDescription>
          </DialogHeader>
          
          <Form {...regionForm}>
            <form onSubmit={regionForm.handleSubmit(handleAddRegion)} className="space-y-4">
              <FormField
                control={regionForm.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region ID</FormLabel>
                    <FormControl>
                      <Input placeholder="us-east-1" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for the region (e.g., us-east-1)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={regionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region Name</FormLabel>
                    <FormControl>
                      <Input placeholder="US East (N. Virginia)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Human-readable name for the region
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={regionForm.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Primary Region</FormLabel>
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
                  control={regionForm.control}
                  name="isEdgeEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Edge Enabled</FormLabel>
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
              </div>
              
              <FormField
                control={regionForm.control}
                name="failoverRegion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Failover Region</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select failover region" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {regions?.filter(r => r.id !== regionForm.getValues("id")).map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name} ({region.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Region to failover to if this region becomes unavailable
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={regionForm.control}
                  name="minNodes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Nodes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={regionForm.control}
                  name="maxNodes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Nodes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={regionForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Priority (1-100)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormDescription>
                        Region priority for routing decisions (higher = higher priority)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddRegionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addRegionMutation.isPending}
                >
                  {addRegionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Region"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Region Dialog */}
      <Dialog
        open={isEditRegionDialogOpen}
        onOpenChange={setIsEditRegionDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Region</DialogTitle>
            <DialogDescription>
              Update configuration for this deployment region
            </DialogDescription>
          </DialogHeader>
          
          <Form {...regionForm}>
            <form onSubmit={regionForm.handleSubmit(handleUpdateRegion)} className="space-y-4">
              <FormField
                control={regionForm.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region ID</FormLabel>
                    <FormControl>
                      <Input disabled {...field} />
                    </FormControl>
                    <FormDescription>
                      Region ID cannot be changed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={regionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Human-readable name for the region
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={regionForm.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Primary Region</FormLabel>
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
                  control={regionForm.control}
                  name="isEdgeEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Edge Enabled</FormLabel>
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
              </div>
              
              <FormField
                control={regionForm.control}
                name="failoverRegion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Failover Region</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select failover region" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {regions?.filter(r => r.id !== regionForm.getValues("id")).map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name} ({region.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Region to failover to if this region becomes unavailable
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={regionForm.control}
                  name="minNodes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Nodes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={regionForm.control}
                  name="maxNodes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Nodes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={regionForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Priority (1-100)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormDescription>
                        Region priority for routing decisions (higher = higher priority)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditRegionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateRegionMutation.isPending}
                >
                  {updateRegionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Region"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirm Failover Dialog */}
      <Dialog
        open={isConfirmFailoverDialogOpen}
        onOpenChange={setIsConfirmFailoverDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Region Failover</DialogTitle>
            <DialogDescription>
              This will initiate a failover from the primary region to the selected region.
              This operation can affect system availability during the transition.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-lg border p-4 mb-4">
              <div className="flex items-center mb-3">
                <Shield className="h-5 w-5 mr-2 text-destructive" />
                <span className="font-semibold text-destructive">High-Impact Operation</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Region failover will redirect all traffic from the current primary region to the selected region.
                This may cause temporary service disruption and potential data synchronization issues.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">From Region</div>
                <div className="font-medium">
                  {regions?.find(r => r.id === failoverDetails.fromRegion)?.name || failoverDetails.fromRegion}
                </div>
              </div>
              <div className="rounded-md bg-primary/10 p-3">
                <div className="text-xs text-muted-foreground">To Region</div>
                <div className="font-medium">
                  {regions?.find(r => r.id === failoverDetails.toRegion)?.name || failoverDetails.toRegion}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmFailoverDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleFailover}
              disabled={triggerFailoverMutation.isPending}
            >
              {triggerFailoverMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Failing over...
                </>
              ) : (
                "Confirm Failover"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GeoRedundancyPage;