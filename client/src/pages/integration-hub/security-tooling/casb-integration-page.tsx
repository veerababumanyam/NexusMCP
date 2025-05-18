import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Server, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DashboardHeader from "@/components/dashboard-header";
import { PageContainer } from "@/components/page-container";

// Schema and types
import { 
  CasbFormValues, 
  CASB_SYSTEMS, 
  SECURITY_AUTH_TYPES, 
  securityToolingFormSchema
} from "@shared/schema_security_tooling";

// Create a subset of the schema just for the CASB form
const casbFormSchema = securityToolingFormSchema.refine(
  (data) => data.type === "casb",
  {
    message: "Invalid form data for CASB integration",
    path: ["type"],
  }
) as z.ZodType<CasbFormValues>;

export default function CasbIntegrationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  // Query to fetch existing CASB integrations
  const { 
    data: integrations = [], 
    isLoading: isLoadingIntegrations,
    isError: isErrorIntegrations 
  } = useQuery({
    queryKey: ["/api/security-tooling/casb"],
    queryFn: async () => {
      const response = await fetch("/api/security-tooling/casb");
      if (!response.ok) {
        throw new Error("Failed to fetch CASB integrations");
      }
      return response.json();
    }
  });

  // Mutation to add a new CASB integration
  const addIntegrationMutation = useMutation({
    mutationFn: async (values: CasbFormValues) => {
      const response = await fetch("/api/security-tooling/casb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add CASB integration");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "CASB Integration Added",
        description: "The CASB integration has been successfully added.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/security-tooling/casb"] });
      form.reset();
      setActiveTab("overview");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to test a CASB integration
  const testIntegrationMutation = useMutation({
    mutationFn: async (values: CasbFormValues) => {
      const response = await fetch("/api/security-tooling/casb/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to test CASB integration");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setTestStatus("success");
      setTestMessage(data.message || "Connection successful");
      toast({
        title: "Connection Test Successful",
        description: "Successfully connected to the CASB provider.",
      });
    },
    onError: (error: Error) => {
      setTestStatus("error");
      setTestMessage(error.message);
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a CASB integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/security-tooling/casb/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete CASB integration");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "CASB Integration Deleted",
        description: "The CASB integration has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/security-tooling/casb"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize form with default values
  const form = useForm<CasbFormValues>({
    resolver: zodResolver(casbFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "casb",
      system: "netskope",
      authType: "api_key",
      host: "",
      port: undefined,
      apiKey: "",
      username: "",
      password: "",
      tenantId: "",
      instanceId: "",
      config: {
        monitoredApplications: [],
        maxSessions: 100,
        scanFrequency: "daily",
        incidentNotifications: true,
        sensitiveDataTypes: [],
        allowedRegions: [],
        dlpEnabled: true,
        malwareScanning: true,
      },
    },
  });

  // Form submission handler
  const onSubmit = (values: CasbFormValues) => {
    addIntegrationMutation.mutate(values);
  };

  // Test connection handler
  const handleTestConnection = () => {
    const values = form.getValues();
    setTestStatus("testing");
    setTestMessage("");
    testIntegrationMutation.mutate(values);
  };

  // Delete integration handler
  const handleDeleteIntegration = (id: number) => {
    if (window.confirm("Are you sure you want to delete this integration?")) {
      deleteIntegrationMutation.mutate(id);
    }
  };

  // Get auth fields based on selected auth type
  const renderAuthFields = () => {
    const authType = form.watch("authType");
    
    switch (authType) {
      case "api_key":
        return (
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <Input {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "username_password":
        return (
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
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      case "oauth2":
        return (
          <>
            <FormField
              control={form.control}
              name="oauthClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OAuth Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="oauthClientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OAuth Client Secret</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="oauthTokenUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      default:
        return null;
    }
  };

  // For specific provider fields
  const renderProviderSpecificFields = () => {
    const system = form.watch("system");
    
    switch (system) {
      case "netskope":
        return (
          <FormField
            control={form.control}
            name="tenantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Netskope Tenant ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Your Netskope tenant identifier
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "microsoft_defender_cloud":
        return (
          <FormField
            control={form.control}
            name="tenantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Azure Tenant ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Your Microsoft Azure AD tenant ID
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "palo_alto_prisma":
        return (
          <FormField
            control={form.control}
            name="instanceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prisma Instance ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Your Palo Alto Prisma SaaS instance identifier
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      default:
        return null;
    }
  };

  // Get status badge color based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500">Connected</Badge>;
      case "configured":
        return <Badge variant="outline">Configured</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "disconnected":
        return <Badge variant="secondary">Disconnected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PageContainer>
      <DashboardHeader
        heading="Cloud Access Security Broker (CASB) Integration"
        text="Connect your enterprise CASB systems to monitor and secure your cloud applications."
        icon={<Shield className="h-6 w-6" />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="add">Add Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          {isLoadingIntegrations ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isErrorIntegrations ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load CASB integrations. Please try again later.
              </AlertDescription>
            </Alert>
          ) : integrations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Integrations Found</CardTitle>
                <CardDescription>
                  You haven't set up any CASB integrations yet. Get started by adding a new integration.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setActiveTab("add")}>
                  Add Integration
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {integrations.map((integration: any) => (
                <Card key={integration.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle>{integration.name}</CardTitle>
                      {getStatusBadge(integration.status)}
                    </div>
                    <CardDescription className="mt-1">
                      {integration.description || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Provider:</span>
                        <span className="font-medium">{integration.system.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Authentication:</span>
                        <span className="font-medium">{integration.authType.replace(/_/g, " ")}</span>
                      </div>
                      {integration.config && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">DLP Enabled:</span>
                            <span className="font-medium">{integration.config.dlpEnabled ? "Yes" : "No"}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Malware Scanning:</span>
                            <span className="font-medium">{integration.config.malwareScanning ? "Yes" : "No"}</span>
                          </div>
                        </>
                      )}
                      {integration.lastSuccessfulConnection && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Last Connected:</span>
                          <span className="font-medium">
                            {new Date(integration.lastSuccessfulConnection).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <Separator />
                  <CardFooter className="pt-3 flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteIntegration(integration.id)}
                      disabled={deleteIntegrationMutation.isPending}
                    >
                      {deleteIntegrationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Remove
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Handle edit integration
                      }}
                    >
                      <Server className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add CASB Integration</CardTitle>
              <CardDescription>
                Connect to your CASB provider to monitor and secure your cloud applications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                    {/* Basic Information */}
                    <div className="md:col-span-2">
                      <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Integration Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Production Netskope" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="system"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CASB Provider</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a CASB provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CASB_SYSTEMS.map((system) => (
                                <SelectItem key={system} value={system}>
                                  {system.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Describe the purpose of this integration" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Connection Details */}
                    <div className="md:col-span-2 mt-4">
                      <h3 className="text-lg font-medium mb-4">Connection Details</h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.cloudcasb.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              placeholder="443"
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Authentication */}
                    <div className="md:col-span-2 mt-4">
                      <h3 className="text-lg font-medium mb-4">Authentication</h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="authType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select authentication type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SECURITY_AUTH_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderAuthFields()}
                    </div>

                    {/* Provider Specific Fields */}
                    {renderProviderSpecificFields()}

                    {/* Advanced Configuration */}
                    <div className="md:col-span-2 mt-4">
                      <h3 className="text-lg font-medium mb-4">Advanced Configuration</h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="config.dlpEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Data Loss Prevention (DLP)</FormLabel>
                            <FormDescription>
                              Enable DLP scanning for sensitive data
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
                      name="config.malwareScanning"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Malware Scanning</FormLabel>
                            <FormDescription>
                              Enable malware scanning for cloud content
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
                      name="config.incidentNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Incident Notifications</FormLabel>
                            <FormDescription>
                              Receive alerts for security incidents
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
                      name="config.scanFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scan Frequency</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select scan frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="realtime">Real-time</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Test connection results */}
                  {testStatus !== "idle" && (
                    <Alert
                      variant={testStatus === "success" ? "default" : testStatus === "error" ? "destructive" : "default"}
                      className="mt-4"
                    >
                      {testStatus === "testing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : testStatus === "success" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {testStatus === "testing"
                          ? "Testing Connection..."
                          : testStatus === "success"
                          ? "Connection Successful"
                          : "Connection Failed"}
                      </AlertTitle>
                      {testMessage && <AlertDescription>{testMessage}</AlertDescription>}
                    </Alert>
                  )}

                  <div className="flex flex-col md:flex-row gap-3 md:justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testStatus === "testing" || addIntegrationMutation.isPending}
                    >
                      {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                    <Button
                      type="submit"
                      disabled={addIntegrationMutation.isPending || testStatus === "testing"}
                    >
                      {addIntegrationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Integration
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}