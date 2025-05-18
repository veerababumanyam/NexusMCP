import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Loader2,
  Database,
  Server,
  BarChart3,
  FileBox,
  Calendar,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Eye,
  EyeOff,
  Settings,
  Edit,
  Clock,
  Table,
  Shield,
  HardDrive,
  Code
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PageTitle } from "@/components/ui/page-title";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
import { DataIntegration, DataSchema, DataSyncJob } from "@shared/schema_data_storage_bi";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function IntegrationDetailsPage() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const integrationId = parseInt(params.id, 10);
  const [activeTab, setActiveTab] = useState("overview");

  // Query to fetch integration details
  const { data: integration, isLoading, error } = useQuery<DataIntegration>({
    queryKey: ["/api/data-storage", integrationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/data-storage/${integrationId}`);
      return await res.json();
    },
    retry: 1,
  });

  // Mutation to test connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/data-storage/${integrationId}/test`);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection test successful",
          description: data.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Connection test failed",
          description: data.message,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage", integrationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to toggle enabled status
  const toggleEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", `/api/data-storage/${integrationId}`, { enabled });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration updated",
        description: "The integration status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage", integrationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/data-storage/${integrationId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete integration");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration deleted",
        description: "The integration has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage"] });
      navigate("/integration-hub/data-storage");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to discover schemas
  const discoverSchemasMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/data-storage/${integrationId}/discover-schemas`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Schemas discovered",
        description: "Database schemas have been discovered successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage", integrationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Schema discovery failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to create a sync job
  const createSyncJobMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/data-storage/${integrationId}/sync-jobs`, {
        status: "pending"
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync job created",
        description: "A new synchronization job has been started.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage", integrationId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start sync job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle test connection button click
  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  // Handle enable/disable toggle
  const handleToggleEnabled = (enabled: boolean) => {
    toggleEnabledMutation.mutate(enabled);
  };

  // Handle delete integration button click
  const handleDeleteIntegration = () => {
    deleteIntegrationMutation.mutate();
  };

  // Get integration type icon
  const getIntegrationTypeIcon = () => {
    if (!integration) return <Database className="h-6 w-6" />;
    
    switch (integration.type) {
      case 'database':
        return <Database className="h-6 w-6" />;
      case 'data_warehouse':
        return <Server className="h-6 w-6" />;
      case 'bi_tool':
        return <BarChart3 className="h-6 w-6" />;
      case 'file_storage':
        return <FileBox className="h-6 w-6" />;
      default:
        return <Database className="h-6 w-6" />;
    }
  };

  // Get connection status badge
  const getStatusBadge = () => {
    if (!integration) return null;
    
    switch (integration.status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'disconnected':
        return <Badge variant="outline">Disconnected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'configured':
        return <Badge variant="outline">Configured</Badge>;
      default:
        return <Badge variant="outline">{integration.status}</Badge>;
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render error state
  if (error || !integration) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <PageTitle title="Integration Details" description="Error loading integration details" />
          <Button variant="outline" asChild className="gap-1">
            <Link href="/integration-hub/data-storage">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader className="bg-destructive/10">
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle />
              Error Loading Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p>There was an error loading the integration details. The integration may have been deleted or you may not have permission to view it.</p>
            <p className="text-muted-foreground mt-2">{error instanceof Error ? error.message : "Unknown error"}</p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/data-storage", integrationId] })}
              variant="outline"
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIntegrationTypeIcon()}
          <PageTitle title={integration.name} description={`${integration.system} ${integration.type.replace('_', ' ')}`} />
          {getStatusBadge()}
        </div>
        <Button variant="outline" asChild className="gap-1">
          <Link href="/integration-hub/data-storage">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={handleTestConnection} 
          variant="outline" 
          size="sm" 
          className="gap-1"
          disabled={testConnectionMutation.isPending}
        >
          {testConnectionMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Test Connection
        </Button>

        {integration.type === "database" && (
          <Button
            onClick={() => discoverSchemasMutation.mutate()}
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={discoverSchemasMutation.isPending}
          >
            {discoverSchemasMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Table className="h-4 w-4" />
            )}
            Discover Schemas
          </Button>
        )}

        {integration.syncEnabled && (
          <Button
            onClick={() => createSyncJobMutation.mutate()}
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={createSyncJobMutation.isPending}
          >
            {createSyncJobMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start Sync Job
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <Link href={`/integration-hub/data-storage/edit/${integrationId}`}>
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Integration</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this integration? This action cannot be undone.
                All connected data, schemas, and synchronization jobs will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteIntegration}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteIntegrationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={integration.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={toggleEnabledMutation.isPending}
          />
          <span className="text-sm">
            {integration.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        {toggleEnabledMutation.isPending && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1">
            <HardDrive className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="schemas" className="gap-1">
            <Table className="h-4 w-4" />
            Schemas
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Sync Jobs
          </TabsTrigger>
          <TabsTrigger value="queries" className="gap-1">
            <Code className="h-4 w-4" />
            Query Templates
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Description</div>
                  <div className="text-sm text-muted-foreground">
                    {integration.description || "No description provided"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Type</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {integration.type.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">System</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.system}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Created</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(integration.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Last Updated</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(integration.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {integration.host && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Host</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.host}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Port</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.port || "Default"}
                      </div>
                    </div>
                  </div>
                )}
                {integration.authType && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Authentication</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {integration.authType.replace('_', ' ')}
                    </div>
                  </div>
                )}
                {integration.username && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Username</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.username}
                    </div>
                  </div>
                )}
                {integration.connectionString && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Connection String</div>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded text-xs overflow-x-auto">
                      {/* Mask the password in connection string */}
                      {integration.connectionString.replace(/:([^:@]+)@/, ':********@')}
                    </div>
                  </div>
                )}
                {integration.databaseName && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Database</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.databaseName}
                    </div>
                  </div>
                )}
                {integration.bucket && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Bucket/Container</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.bucket}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Health Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Connection Status</div>
                  <div className="flex items-center gap-2">
                    {integration.status === 'connected' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {integration.status === 'error' && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    {(integration.status === 'disconnected' || integration.status === 'pending' || integration.status === 'configured') && (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm capitalize">{integration.status}</span>
                  </div>
                </div>
                {integration.lastHealthCheck && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Last Health Check</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(integration.lastHealthCheck).toLocaleString()}
                    </div>
                  </div>
                )}
                {integration.lastSyncedAt && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Last Synced</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(integration.lastSyncedAt).toLocaleString()}
                    </div>
                  </div>
                )}
                {integration.syncEnabled && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Sync Schedule</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.syncSchedule || integration.syncInterval || "Not configured"}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  disabled={testConnectionMutation.isPending}
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh Status
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="schemas" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Table className="h-5 w-5" />
              Database Schemas
            </h3>
            <Button
              onClick={() => discoverSchemasMutation.mutate()}
              variant="outline" 
              size="sm" 
              className="gap-1"
              disabled={discoverSchemasMutation.isPending || integration.type !== "database"}
            >
              {discoverSchemasMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Discover Schemas
            </Button>
          </div>
          <RenderSchemas schemas={integration.schemas || []} integrationId={integration.id} integrationType={integration.type} />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Synchronization Jobs
            </h3>
            <Button
              onClick={() => createSyncJobMutation.mutate()}
              variant="outline" 
              size="sm" 
              className="gap-1"
              disabled={createSyncJobMutation.isPending || !integration.syncEnabled}
            >
              {createSyncJobMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start New Sync
            </Button>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.syncEnabled}
                      onCheckedChange={(enabled) => toggleEnabledMutation.mutate({ 
                        ...integration, 
                        syncEnabled: enabled 
                      })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                    <span className="text-sm">
                      {integration.syncEnabled ? "Sync Enabled" : "Sync Disabled"}
                    </span>
                  </div>
                  {toggleEnabledMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>

                {integration.syncEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Sync Interval</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.syncInterval || "Not configured"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Sync Schedule</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.syncSchedule || "Not configured"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Last Synced</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString() : "Never"}
                      </div>
                    </div>
                    {integration.lastSyncStatus && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Last Sync Status</div>
                        <div className="text-sm">
                          {integration.lastSyncStatus === "success" ? (
                            <span className="text-green-500 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Success
                            </span>
                          ) : integration.lastSyncStatus === "error" ? (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Error: {integration.lastSyncError || "Unknown error"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{integration.lastSyncStatus}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            <RenderSyncJobs syncJobs={integration.syncJobs || []} integrationId={integration.id} />
          </div>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Code className="h-5 w-5" />
              Query Templates
            </h3>
            <Button
              variant="outline" 
              size="sm" 
              className="gap-1"
              asChild
            >
              <Link href={`/integration-hub/data-storage/${integrationId}/queries/new`}>
                <RefreshCw className="h-4 w-4" />
                Add Query Template
              </Link>
            </Button>
          </div>
          <RenderQueryTemplates 
            queryTemplates={integration.queryTemplates || []} 
            integrationId={integration.id} 
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Access Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.accessRestricted}
                      onCheckedChange={(enabled) => toggleEnabledMutation.mutate({ 
                        ...integration, 
                        accessRestricted: enabled 
                      })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                    <span className="text-sm">
                      {integration.accessRestricted ? "Access Restricted" : "Access Unrestricted"}
                    </span>
                  </div>
                  {toggleEnabledMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Data Classification</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {integration.dataClassification || "Unclassified"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Protection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.sslEnabled}
                      onCheckedChange={(enabled) => toggleEnabledMutation.mutate({ 
                        ...integration, 
                        sslEnabled: enabled 
                      })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                    <span className="text-sm">
                      {integration.sslEnabled ? "SSL/TLS Enabled" : "SSL/TLS Disabled"}
                    </span>
                  </div>
                  {toggleEnabledMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.encryptionEnabled}
                      onCheckedChange={(enabled) => toggleEnabledMutation.mutate({ 
                        ...integration, 
                        encryptionEnabled: enabled 
                      })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                    <span className="text-sm">
                      {integration.encryptionEnabled ? "Credential Encryption Enabled" : "Credential Encryption Disabled"}
                    </span>
                  </div>
                  {toggleEnabledMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Credential Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {integration.username && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Username</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.username}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Password</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <EyeOff className="h-4 w-4" />
                        ••••••••
                      </div>
                    </div>
                  </div>
                )}
                {integration.apiKey && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">API Key</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-4 w-4" />
                      ••••••••••••••••
                    </div>
                  </div>
                )}
                {integration.accessToken && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Access Token</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-4 w-4" />
                      ••••••••••••••••
                    </div>
                  </div>
                )}
                {integration.oauthClientId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">OAuth Client ID</div>
                      <div className="text-sm text-muted-foreground">
                        {integration.oauthClientId}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">OAuth Client Secret</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <EyeOff className="h-4 w-4" />
                        ••••••••
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline" 
                size="sm" 
                className="gap-1"
                asChild
              >
                <Link href={`/integration-hub/data-storage/edit/${integrationId}`}>
                  <Edit className="h-4 w-4" />
                  Update Credentials
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Integration Settings
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={handleToggleEnabled}
                        disabled={toggleEnabledMutation.isPending}
                      />
                      <span className="text-sm">
                        {integration.enabled ? "Integration Enabled" : "Integration Disabled"}
                      </span>
                    </div>
                    {toggleEnabledMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Integration
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Integration</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the <strong>{integration.name}</strong> integration? This action cannot be undone.
                        All connected data, schemas, and synchronization jobs will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteIntegration}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteIntegrationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component to render schemas
function RenderSchemas({ 
  schemas, 
  integrationId, 
  integrationType 
}: { 
  schemas: DataSchema[],
  integrationId: number,
  integrationType: string
}) {
  if (schemas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Schemas Found</CardTitle>
        </CardHeader>
        <CardContent>
          {integrationType === 'database' || integrationType === 'data_warehouse' ? (
            <p className="text-muted-foreground">
              No schemas have been discovered yet. Click "Discover Schemas" to scan the database for available tables and relationships.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Schema discovery is not available for this integration type.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {schemas.map((schema) => (
        <Card key={schema.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{schema.name}</span>
              <Badge>{schema.type}</Badge>
            </CardTitle>
            <CardDescription>
              Last updated: {new Date(schema.updatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schema.tables && schema.tables.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tables</h4>
                <div className="bg-muted rounded-md p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {schema.tables.map((table: any, index: number) => (
                      <div key={index} className="text-sm">
                        {table.name} {table.rows && <span className="text-xs text-muted-foreground">({table.rows.toLocaleString()} rows)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {schema.relationships && schema.relationships.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Relationships</h4>
                <div className="bg-muted rounded-md p-4">
                  <div className="grid grid-cols-1 gap-2">
                    {schema.relationships.map((rel: any, index: number) => (
                      <div key={index} className="text-sm">
                        {rel.name}: {rel.source} → {rel.target}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/integration-hub/data-storage/${integrationId}/schemas/${schema.id}`}>
                <Eye className="h-4 w-4" />
                View Details
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// Component to render sync jobs
function RenderSyncJobs({ 
  syncJobs,
  integrationId 
}: { 
  syncJobs: DataSyncJob[],
  integrationId: number 
}) {
  if (syncJobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Sync Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No synchronization jobs have been created yet. Click "Start New Sync" to create a sync job.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {syncJobs.slice(0, 5).map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Sync Job #{job.id}</span>
              <SyncJobStatusBadge status={job.status} />
            </CardTitle>
            <CardDescription>
              Created: {new Date(job.createdAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {job.startedAt && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Started</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(job.startedAt).toLocaleString()}
                  </div>
                </div>
              )}
              {job.completedAt && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Completed</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(job.completedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            {job.recordsProcessed && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Records Processed</div>
                <div className="text-sm text-muted-foreground">
                  {job.recordsProcessed.toLocaleString()}
                </div>
              </div>
            )}
            {job.error && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-destructive">Error</div>
                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                  {job.error}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/integration-hub/data-storage/${integrationId}/sync-jobs/${job.id}`}>
                <Eye className="h-4 w-4" />
                View Details
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
      
      {syncJobs.length > 5 && (
        <Button variant="outline" className="w-full gap-1" asChild>
          <Link href={`/integration-hub/data-storage/${integrationId}/sync-jobs`}>
            <Calendar className="h-4 w-4" />
            View All Sync Jobs
          </Link>
        </Button>
      )}
    </div>
  );
}

// Component to render query templates
function RenderQueryTemplates({ 
  queryTemplates,
  integrationId 
}: { 
  queryTemplates: any[],
  integrationId: number 
}) {
  if (queryTemplates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Query Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No query templates have been created yet. Click "Add Query Template" to create a new template.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {queryTemplates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
            <CardDescription>
              {template.description || "No description provided"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Query</h4>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                {template.query}
              </pre>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <Link href={`/integration-hub/data-storage/${integrationId}/queries/${template.id}`}>
                <Play className="h-4 w-4" />
                Run Query
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// Helper component for sync job status badge
function SyncJobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;
    case 'running':
      return <Badge variant="secondary">Running</Badge>;
    case 'completed':
      return <Badge className="bg-green-500">Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'cancelled':
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}