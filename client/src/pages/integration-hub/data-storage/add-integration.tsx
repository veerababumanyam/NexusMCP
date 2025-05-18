import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  ChevronLeft, 
  Database, 
  Server, 
  BarChart3, 
  FileBox,
  Lock,
  KeyRound,
  RefreshCw
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PageTitle } from "@/components/ui/page-title";
import { 
  InsertDataIntegration, 
  DATA_INTEGRATION_TYPES,
  DATABASE_SYSTEMS,
  DATA_WAREHOUSE_SYSTEMS,
  BI_TOOL_SYSTEMS,
  FILE_STORAGE_SYSTEMS,
  AUTH_TYPES
} from "@shared/schema_data_storage_bi";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Create a form schema based on the InsertDataIntegration type
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(DATA_INTEGRATION_TYPES),
  system: z.string().min(1, "System is required"),
  enabled: z.boolean().default(true),
  
  // Connection details
  host: z.string().optional(),
  port: z.coerce.number().optional(),
  authType: z.enum(AUTH_TYPES).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  connectionString: z.string().optional(),
  region: z.string().optional(),
  
  // Integration-specific settings
  databaseName: z.string().optional(),
  schema: z.string().optional(),
  bucket: z.string().optional(),
  folderPath: z.string().optional(),
  endpoint: z.string().optional(),
  
  // OAuth configuration
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  oauthRedirectUri: z.string().optional(),
  oauthScope: z.string().optional(),
  
  // Advanced configuration
  sslEnabled: z.boolean().default(true),
  
  // Synchronization and scheduling
  syncEnabled: z.boolean().default(false),
  syncInterval: z.string().optional(),
  syncSchedule: z.string().optional(),
  
  // Security and compliance
  dataClassification: z.string().optional(),
  encryptionEnabled: z.boolean().default(true),
  accessRestricted: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddIntegrationPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState<typeof DATA_INTEGRATION_TYPES[number]>("database");

  // Define the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "database",
      system: "",
      enabled: true,
      host: "",
      port: undefined,
      authType: "username_password",
      username: "",
      password: "",
      apiKey: "",
      accessToken: "",
      connectionString: "",
      region: "",
      databaseName: "",
      schema: "",
      bucket: "",
      folderPath: "",
      endpoint: "",
      oauthClientId: "",
      oauthClientSecret: "",
      oauthRedirectUri: "",
      oauthScope: "",
      sslEnabled: true,
      syncEnabled: false,
      syncInterval: "",
      syncSchedule: "",
      dataClassification: "",
      encryptionEnabled: true,
      accessRestricted: true,
    },
  });

  // Watch the type field to conditionally render fields
  const integrationType = form.watch("type");

  // Handle type selection
  const handleTypeChange = (value: typeof DATA_INTEGRATION_TYPES[number]) => {
    setSelectedType(value);
    form.setValue("type", value);
    
    // Reset system field when type changes
    form.setValue("system", "");
  };

  // Create mutation to add new integration
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Transform form values to match the API schema
      const apiData: Partial<InsertDataIntegration> = {
        name: data.name,
        description: data.description || "",
        type: data.type,
        system: data.system,
        enabled: data.enabled,
        host: data.host || null,
        port: data.port || null,
        authType: data.authType || null,
        username: data.username || null,
        password: data.password || null,
        apiKey: data.apiKey || null,
        accessToken: data.accessToken || null,
        connectionString: data.connectionString || null,
        region: data.region || null,
        databaseName: data.databaseName || null,
        schema: data.schema || null,
        bucket: data.bucket || null,
        folderPath: data.folderPath || null,
        endpoint: data.endpoint || null,
        oauthClientId: data.oauthClientId || null,
        oauthClientSecret: data.oauthClientSecret || null,
        oauthRedirectUri: data.oauthRedirectUri || null,
        oauthScope: data.oauthScope || null,
        sslEnabled: data.sslEnabled,
        syncEnabled: data.syncEnabled,
        syncInterval: data.syncInterval || null,
        syncSchedule: data.syncSchedule || null,
        dataClassification: data.dataClassification || null,
        encryptionEnabled: data.encryptionEnabled,
        accessRestricted: data.accessRestricted,
        status: "configured", // Default status for new integrations
      };

      const res = await apiRequest("POST", "/api/data-storage", apiData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration added",
        description: "Your integration has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage"] });
      navigate("/integration-hub/data-storage");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  function onSubmit(values: FormValues) {
    createMutation.mutate(values);
  }

  // Get available systems based on the selected integration type
  const getAvailableSystems = () => {
    switch (selectedType) {
      case "database":
        return DATABASE_SYSTEMS;
      case "data_warehouse":
        return DATA_WAREHOUSE_SYSTEMS;
      case "bi_tool":
        return BI_TOOL_SYSTEMS;
      case "file_storage":
        return FILE_STORAGE_SYSTEMS;
      default:
        return [];
    }
  };

  // Render the form fields based on the integration type
  const renderTypeSpecificFields = () => {
    switch (selectedType) {
      case "database":
        return (
          <>
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="localhost or db.example.com" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The hostname or IP address of your database server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="5432" 
                      {...field} 
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                        field.onChange(value);
                      }}
                      value={field.value === undefined ? '' : field.value} 
                    />
                  </FormControl>
                  <FormDescription>
                    The port number for your database connection
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="databaseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my_database" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The name of the database to connect to
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="schema"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schema</FormLabel>
                  <FormControl>
                    <Input placeholder="public" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The database schema (if applicable)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      case "data_warehouse":
        return (
          <>
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="us-east-1" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The cloud region where your data warehouse is hosted
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="connectionString"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection String</FormLabel>
                  <FormControl>
                    <Input placeholder="jdbc:snowflake://..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The connection string for your data warehouse
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="warehouse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse</FormLabel>
                  <FormControl>
                    <Input placeholder="compute_wh" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The warehouse name (for Snowflake) or equivalent
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      case "bi_tool":
        return (
          <>
            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Endpoint</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The API endpoint for your BI tool
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Enter your API key" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormDescription>
                    The API key for authentication
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      case "file_storage":
        return (
          <>
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="us-east-1" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The cloud region where your storage is hosted
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bucket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bucket / Container</FormLabel>
                  <FormControl>
                    <Input placeholder="my-bucket" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The storage bucket or container name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="folderPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder Path</FormLabel>
                  <FormControl>
                    <Input placeholder="/data" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormDescription>
                    The folder path within the bucket/container
                  </FormDescription>
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <PageTitle 
          title="Add Data Storage Integration" 
          description="Connect to databases, data warehouses, BI tools, and file storage systems" 
        />
        <Button variant="outline" asChild className="gap-1">
          <Link href="/integration-hub/data-storage">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Provide basic details about your integration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Production PostgreSQL" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for your integration
                        </FormDescription>
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
                            placeholder="Main production database for customer data" 
                            className="resize-none" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          A brief description of what this integration is used for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enabled</FormLabel>
                          <FormDescription>
                            Whether this integration is active
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integration Type</CardTitle>
                  <CardDescription>
                    Select the type of data storage integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs 
                    defaultValue="database" 
                    value={selectedType} 
                    onValueChange={(value) => handleTypeChange(value as typeof DATA_INTEGRATION_TYPES[number])}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="database" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span className="hidden sm:inline">Database</span>
                      </TabsTrigger>
                      <TabsTrigger value="data_warehouse" className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span className="hidden sm:inline">Data Warehouse</span>
                      </TabsTrigger>
                      <TabsTrigger value="bi_tool" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">BI Tool</span>
                      </TabsTrigger>
                      <TabsTrigger value="file_storage" className="flex items-center gap-2">
                        <FileBox className="h-4 w-4" />
                        <span className="hidden sm:inline">File Storage</span>
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* System selection is common to all tabs */}
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="system"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>System</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select system" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {getAvailableSystems().map((system) => (
                                  <SelectItem key={system} value={system}>
                                    {system}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The specific system or platform
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Connection Details</CardTitle>
                  <CardDescription>
                    Configure how to connect to your {selectedType.replace('_', ' ')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="authType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Authentication Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value || "username_password"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select authentication type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="username_password">Username & Password</SelectItem>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="token">Access Token</SelectItem>
                            <SelectItem value="oauth">OAuth</SelectItem>
                            <SelectItem value="connection_string">Connection String</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How to authenticate with the service
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Render auth fields based on selected auth type */}
                  {form.watch("authType") === "username_password" && (
                    <>
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="db_user" {...field} value={field.value || ''} />
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
                              <Input 
                                type="password" 
                                placeholder="Enter password" 
                                {...field} 
                                value={field.value || ''} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {form.watch("authType") === "api_key" && (
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter API key" 
                              {...field} 
                              value={field.value || ''} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("authType") === "token" && (
                    <FormField
                      control={form.control}
                      name="accessToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Token</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter access token" 
                              {...field} 
                              value={field.value || ''} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("authType") === "connection_string" && (
                    <FormField
                      control={form.control}
                      name="connectionString"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection String</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="postgresql://user:password@localhost:5432/dbname" 
                              className="resize-none" 
                              {...field} 
                              value={field.value || ''} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("authType") === "oauth" && (
                    <>
                      <FormField
                        control={form.control}
                        name="oauthClientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>OAuth Client ID</FormLabel>
                            <FormControl>
                              <Input placeholder="client_id" {...field} value={field.value || ''} />
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
                              <Input 
                                type="password" 
                                placeholder="client_secret" 
                                {...field} 
                                value={field.value || ''} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="oauthRedirectUri"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>OAuth Redirect URI</FormLabel>
                            <FormControl>
                              <Input placeholder="https://app.example.com/callback" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* Render type-specific fields */}
                  {renderTypeSpecificFields()}

                  {/* SSL field common for most connections */}
                  {form.watch("authType") !== "none" && (
                    <FormField
                      control={form.control}
                      name="sslEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Lock className="mr-2 h-4 w-4" />
                              <FormLabel>SSL/TLS Encryption</FormLabel>
                            </div>
                            <FormDescription>
                              Enable secure connection with SSL/TLS
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
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Synchronization Settings</CardTitle>
                  <CardDescription>
                    Configure automated data synchronization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="syncEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            <FormLabel>Enable Synchronization</FormLabel>
                          </div>
                          <FormDescription>
                            Automatically sync data from this integration
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

                  {form.watch("syncEnabled") && (
                    <>
                      <FormField
                        control={form.control}
                        name="syncInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sync Interval</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select sync interval" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="5m">5 minutes</SelectItem>
                                <SelectItem value="15m">15 minutes</SelectItem>
                                <SelectItem value="30m">30 minutes</SelectItem>
                                <SelectItem value="1h">1 hour</SelectItem>
                                <SelectItem value="6h">6 hours</SelectItem>
                                <SelectItem value="12h">12 hours</SelectItem>
                                <SelectItem value="1d">1 day</SelectItem>
                                <SelectItem value="7d">7 days</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              How frequently to synchronize data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="syncSchedule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sync Schedule (CRON)</FormLabel>
                            <FormControl>
                              <Input placeholder="0 0 * * *" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormDescription>
                              Optional CRON expression for advanced scheduling
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security and access control
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="dataClassification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Classification</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select data classification" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="internal">Internal</SelectItem>
                            <SelectItem value="confidential">Confidential</SelectItem>
                            <SelectItem value="restricted">Restricted</SelectItem>
                            <SelectItem value="sensitive">Sensitive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Classification level of data stored in this system
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="encryptionEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Encryption</FormLabel>
                          <FormDescription>
                            Encrypt credentials and sensitive data
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
                    name="accessRestricted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Restrict Access</FormLabel>
                          <FormDescription>
                            Limit access to authorized users only
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
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button 
              variant="outline" 
              type="button" 
              onClick={() => navigate("/integration-hub/data-storage")}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Integration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}