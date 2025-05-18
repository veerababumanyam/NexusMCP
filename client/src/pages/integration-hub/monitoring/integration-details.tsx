import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { 
  ChevronLeft, 
  Activity, 
  Waves,
  AlertCircle,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Form schema for updating an integration
const integrationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Please enter a valid URL"),
  apiKey: z.string().optional(),
  authToken: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  refreshInterval: z.coerce.number().min(10, "Minimum refresh interval is 10 seconds"),
  advancedConfig: z.string().optional(),
});

type IntegrationFormValues = z.infer<typeof integrationFormSchema>;

export default function IntegrationDetailsPage() {
  const [location, navigate] = useLocation();
  const { id } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("settings");
  
  // Fetch integration details
  const { 
    data: integration, 
    isLoading: isLoadingIntegration,
    isError: isErrorIntegration
  } = useQuery({
    queryKey: [`/api/monitoring/integrations/${id}`],
    onSuccess: (data) => {
      // Reset form with fetched data
      if (data) {
        form.reset({
          name: data.name,
          url: data.url,
          apiKey: data.apiKey ? "••••••••••••••••" : "",
          authToken: data.authToken ? "••••••••••••••••" : "",
          username: data.username || "",
          password: data.password ? "••••••••••••••••" : "",
          description: data.description || "",
          isEnabled: data.isEnabled,
          refreshInterval: data.refreshInterval,
          advancedConfig: data.advancedConfig ? JSON.stringify(data.advancedConfig, null, 2) : "",
        });
      }
    },
    onError: () => {
      toast({
        title: "Failed to load integration",
        description: "Could not load the integration details. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Fetch integration endpoints/configs
  const { data: endpoints, isLoading: isLoadingEndpoints } = useQuery({
    queryKey: [`/api/monitoring/integrations/${id}/endpoints`],
    enabled: !!id && activeTab === "endpoints",
  });
  
  // Fetch integration alerts
  const { data: alerts, isLoading: isLoadingAlerts } = useQuery({
    queryKey: [`/api/monitoring/integrations/${id}/alerts`],
    enabled: !!id && activeTab === "alerts",
  });
  
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      url: "",
      apiKey: "",
      authToken: "",
      username: "",
      password: "",
      description: "",
      isEnabled: true,
      refreshInterval: 60,
      advancedConfig: "",
    },
  });
  
  const updateIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormValues) => {
      // Remove password fields if they contain the masked value
      const updateData = { ...data };
      if (updateData.apiKey === "••••••••••••••••") delete updateData.apiKey;
      if (updateData.authToken === "••••••••••••••••") delete updateData.authToken;
      if (updateData.password === "••••••••••••••••") delete updateData.password;
      
      const res = await apiRequest("PUT", `/api/monitoring/integrations/${id}`, updateData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update integration");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration updated",
        description: "Your monitoring integration has been updated successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/monitoring/integrations/${id}`],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/monitoring/integrations'],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const testIntegrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/monitoring/integrations/${id}/test`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to test integration connection");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection successful",
        description: `Successfully connected to ${integration?.system}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const refreshIntegrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/monitoring/integrations/${id}/refresh`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to refresh integration data");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Data refreshed",
        description: "Integration data has been refreshed successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/monitoring/integrations/${id}`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/monitoring/integrations/${id}/endpoints`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/monitoring/integrations/${id}/alerts`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to refresh data",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const deleteIntegrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/monitoring/integrations/${id}`, {});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete integration");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration deleted",
        description: "The monitoring integration has been deleted successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/monitoring/integrations'],
      });
      navigate("/integration-hub/monitoring");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  function onSubmit(data: IntegrationFormValues) {
    updateIntegrationMutation.mutate(data);
  }
  
  if (isErrorIntegration) {
    return (
      <div className="flex-1 space-y-4 pt-6 px-8">
        <DashboardHeader 
          heading="Integration Not Found" 
          text="The monitoring integration you requested could not be found."
          className="px-0"
        >
          <Button variant="outline" onClick={() => navigate("/integration-hub/monitoring")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Integrations
          </Button>
        </DashboardHeader>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            The integration you're looking for doesn't exist or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <DashboardHeader 
        heading={isLoadingIntegration ? "Loading Integration..." : `${integration?.name} Integration`} 
        text={isLoadingIntegration ? "Please wait..." : `${integration?.type === 'apm' ? 'Application Performance Monitoring' : 'Log Aggregation'} integration details`}
        className="px-0"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refreshIntegrationMutation.mutate()}
            disabled={refreshIntegrationMutation.isPending}
          >
            {refreshIntegrationMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden md:inline">Refresh Data</span>
          </Button>
          
          <Button variant="outline" onClick={() => navigate("/integration-hub/monitoring")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Back</span>
          </Button>
        </div>
      </DashboardHeader>
      
      {!isLoadingIntegration && (
        <div className="flex items-center space-x-2 mb-2">
          <Badge variant={integration?.status === "active" ? "success" : "destructive"}>
            {integration?.status === "active" ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {integration?.status === "active" ? "Connected" : "Disconnected"}
          </Badge>
          
          <Badge variant="outline" className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Updated {integration?.updatedAt ? format(new Date(integration.updatedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
          </Badge>
          
          <Badge variant="secondary">
            {integration?.type === 'apm' ? (
              <Activity className="h-3 w-3 mr-1" />
            ) : (
              <Waves className="h-3 w-3 mr-1" />
            )}
            {integration?.system}
          </Badge>
        </div>
      )}
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>
                Manage connection details for this integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegration ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading integration details...
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Integration Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Endpoint URL</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="refreshInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Refresh Interval (seconds)</FormLabel>
                            <FormControl>
                              <Input type="number" min="10" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Display appropriate auth fields based on integration type */}
                      {integration?.apiKey !== undefined && (
                        <FormField
                          control={form.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Enter to change or leave masked to keep existing" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Leave masked to keep current key
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {integration?.authToken !== undefined && (
                        <FormField
                          control={form.control}
                          name="authToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Auth Token</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Enter to change or leave masked to keep existing"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Leave masked to keep current token
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {integration?.username !== undefined && (
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {integration?.password !== undefined && (
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Enter to change or leave masked to keep existing"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Leave masked to keep current password
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Integration</FormLabel>
                            <FormDescription>
                              {field.value 
                                ? "Integration is active and data collection is enabled" 
                                : "Integration is disabled and no data will be collected"}
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
                      name="advancedConfig"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Advanced Configuration (JSON)</FormLabel>
                          <FormControl>
                            <Textarea 
                              className="min-h-[120px] font-mono text-sm"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Optional JSON configuration specific to this integration system
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-between">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => testIntegrationMutation.mutate()}
                          disabled={testIntegrationMutation.isPending}
                        >
                          {testIntegrationMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Test Connection
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Integration
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this integration and all associated data.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteIntegrationMutation.mutate()}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleteIntegrationMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      <Button 
                        type="submit"
                        disabled={updateIntegrationMutation.isPending}
                      >
                        {updateIntegrationMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Endpoints</CardTitle>
              <CardDescription>
                Configured endpoints for this monitoring integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEndpoints ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading endpoints...
                </div>
              ) : !endpoints || endpoints.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No endpoints configured</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                    This integration doesn't have any endpoints configured yet
                  </p>
                  <Button onClick={() => navigate(`/integration-hub/monitoring/${id}/endpoints/new`)}>
                    Add Endpoint
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {endpoints.map((endpoint) => (
                    <div 
                      key={endpoint.id} 
                      className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/integration-hub/monitoring/${id}/endpoints/${endpoint.id}`)}
                    >
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {endpoint.type} • {endpoint.path}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={endpoint.isActive ? "success" : "outline"}
                      >
                        {endpoint.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {endpoints && endpoints.length > 0 && (
              <CardFooter>
                <Button 
                  onClick={() => navigate(`/integration-hub/monitoring/${id}/endpoints/new`)}
                  variant="outline"
                  className="w-full"
                >
                  Add Endpoint
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Alerts</CardTitle>
              <CardDescription>
                Alert rules configured for this monitoring integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading alerts...
                </div>
              ) : !alerts || alerts.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No alerts configured</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                    This integration doesn't have any alert rules configured yet
                  </p>
                  <Button onClick={() => navigate(`/integration-hub/monitoring/${id}/alerts/new`)}>
                    Add Alert Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => navigate(`/integration-hub/monitoring/${id}/alerts/${alert.id}`)}
                    >
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="font-medium">{alert.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {alert.metric} {alert.condition} {alert.threshold}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={alert.severity === "critical" ? "destructive" : (alert.severity === "warning" ? "warning" : "outline")}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {alerts && alerts.length > 0 && (
              <CardFooter>
                <Button 
                  onClick={() => navigate(`/integration-hub/monitoring/${id}/alerts/new`)}
                  variant="outline"
                  className="w-full"
                >
                  Add Alert Rule
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Metrics</CardTitle>
              <CardDescription>
                Performance metrics for this integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-6 text-center border rounded-lg">
                <h3 className="text-lg font-medium">Metrics Visualization</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Metrics visualization will be available in a future update
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}