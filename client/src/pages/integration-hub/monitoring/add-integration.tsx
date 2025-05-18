import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { 
  ChevronLeft, 
  Activity, 
  Waves,
  AlertCircle,
  X,
  Save,
  Loader2
} from "lucide-react";

// Form schema for creating a new integration
const integrationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.enum(["apm", "logging"]),
  system: z.string(),
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

export default function AddIntegrationPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<"apm" | "logging">("apm");
  
  // Parse URL parameters for pre-selection
  const params = new URLSearchParams(location.split("?")[1]);
  const typeParam = params.get("type") as "apm" | "logging" | null;
  const systemParam = params.get("system");
  
  // Set active tab based on URL parameter
  useEffect(() => {
    if (typeParam && (typeParam === "apm" || typeParam === "logging")) {
      setActiveType(typeParam);
    }
  }, [typeParam]);
  
  // Fetch available monitoring systems
  const { data: monitoringSystems, isLoading: isLoadingMonitoringSystems } = useQuery({
    queryKey: ['/api/public/monitoring/systems'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: {
      name: "",
      type: activeType,
      system: systemParam || "",
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
  
  // Update form when active type changes
  useEffect(() => {
    form.setValue("type", activeType);
  }, [activeType, form]);
  
  const createIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormValues) => {
      const res = await apiRequest("POST", "/api/monitoring/integrations", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create integration");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration created",
        description: "Your monitoring integration has been created successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/monitoring/integrations'],
      });
      navigate("/integration-hub/monitoring");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  function onSubmit(data: IntegrationFormValues) {
    createIntegrationMutation.mutate(data);
  }
  
  // Helper to determine if additional auth fields should be shown based on system
  const showsApiKey = (system: string): boolean => {
    const apmWithApiKey = ["datadog", "newrelic", "appdynamics"];
    const loggingWithApiKey = ["datadog_logs", "splunk", "azure_monitor_logs", "gcp_logging"];
    
    if (activeType === "apm") {
      return apmWithApiKey.includes(system);
    } else {
      return loggingWithApiKey.includes(system);
    }
  };
  
  const showsAuthToken = (system: string): boolean => {
    const systemsWithToken = ["elastic_apm", "elastic_stack", "datadog", "datadog_logs"];
    return systemsWithToken.includes(system);
  };
  
  const showsUsernamePassword = (system: string): boolean => {
    const systemsWithCredentials = ["graylog", "splunk", "elastic_stack"];
    return systemsWithCredentials.includes(system);
  };

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <DashboardHeader 
        heading="Add Monitoring Integration" 
        text="Connect your MCP platform with monitoring and observability systems."
        className="px-0"
      >
        <Button variant="outline" onClick={() => navigate("/integration-hub/monitoring")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Button>
      </DashboardHeader>
      
      <Tabs 
        defaultValue={activeType} 
        onValueChange={(v) => setActiveType(v as "apm" | "logging")}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="apm" className="flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            APM Integration
          </TabsTrigger>
          <TabsTrigger value="logging" className="flex items-center">
            <Waves className="h-4 w-4 mr-2" />
            Logging Integration
          </TabsTrigger>
        </TabsList>
        
        <Card>
          <CardHeader>
            <CardTitle>
              {activeType === "apm" ? "APM System Integration" : "Logging System Integration"}
            </CardTitle>
            <CardDescription>
              Configure your {activeType === "apm" ? "Application Performance Monitoring" : "Log Aggregation"} system connection
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                          <Input placeholder="Production Datadog" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this integration
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="system"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select system" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingMonitoringSystems ? (
                              <SelectItem value="loading">Loading...</SelectItem>
                            ) : (
                              (activeType === "apm" ? monitoringSystems?.apm : monitoringSystems?.logging)?.map((system) => (
                                <SelectItem key={system.id} value={system.id}>
                                  {system.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the monitoring system to integrate with
                        </FormDescription>
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
                          <Input placeholder="https://api.example.com/v1" {...field} />
                        </FormControl>
                        <FormDescription>
                          The API endpoint URL for the selected system
                        </FormDescription>
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
                        <FormDescription>
                          How often to fetch data from this integration
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Conditional fields based on system type */}
                  {form.watch("system") && showsApiKey(form.watch("system")) && (
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormDescription>
                            API key for authentication
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {form.watch("system") && showsAuthToken(form.watch("system")) && (
                    <FormField
                      control={form.control}
                      name="authToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auth Token</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormDescription>
                            Authentication token or secret
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {form.watch("system") && showsUsernamePassword(form.watch("system")) && (
                    <>
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormDescription>
                              Username for authentication
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormDescription>
                              Password for authentication
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
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
                          placeholder="Details about this integration and its purpose"
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
                          Activate this integration immediately after creation
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
                          placeholder='{"optional": "configuration", "specific": "to system"}'
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
                
                <Alert variant="default" className="bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Security Note</AlertTitle>
                  <AlertDescription>
                    All sensitive credentials are encrypted before storage and never exposed in plain text.
                  </AlertDescription>
                </Alert>
                
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/integration-hub/monitoring")}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createIntegrationMutation.isPending}
                  >
                    {createIntegrationMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Create Integration
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}