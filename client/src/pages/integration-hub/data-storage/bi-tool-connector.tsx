/**
 * BI Tool Connector Component
 * 
 * Specialized component for connecting and configuring BI tools like
 * Tableau, Power BI, Looker, and Qlik with the NexusMCP platform.
 * 
 * Features:
 * - Tool-specific configuration forms
 * - Direct platform connectors
 * - Standardized API endpoints
 * - Data export compatibility
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  ChevronLeft, 
  BarChart3, 
  Lock,
  KeyRound,
  RefreshCw,
  Globe,
  FileDown,
  Database,
  ArrowUpDown,
  Layers,
  FileJson,
  Table,
  ShieldCheck,
  Puzzle,
  Zap
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  InsertDataIntegration, 
  BI_TOOL_SYSTEMS,
  AUTH_TYPES
} from "@shared/schema_data_storage_bi";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Create a specialized schema for BI tool connections
const biToolFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  system: z.string().refine(val => BI_TOOL_SYSTEMS.includes(val as any), {
    message: `System must be one of: ${BI_TOOL_SYSTEMS.join(', ')}`
  }),
  authType: z.string().refine(val => AUTH_TYPES.includes(val as any), {
    message: `Auth type must be one of: ${AUTH_TYPES.join(', ')}`
  }),
  host: z.string().optional(),
  port: z.coerce.number().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  oauthRedirectUri: z.string().optional(),
  oauthScope: z.string().optional(),
  endpoint: z.string().optional(),
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  sslEnabled: z.boolean().default(true),
  dataClassification: z.string().optional(),
  accessRestricted: z.boolean().default(true),
  config: z.object({
    queryTimeout: z.coerce.number().default(300),
    maxRowLimit: z.coerce.number().default(10000),
    allowDirectQueries: z.boolean().default(false),
    automaticExtraction: z.boolean().default(false),
    customFields: z.array(z.object({
      name: z.string(),
      value: z.string()
    })).default([]),
    enableRealTimeSync: z.boolean().default(false),
    enableExport: z.boolean().default(true),
    exportFormats: z.array(z.string()).default(["csv", "json", "parquet"]),
    apiVersion: z.string().optional(),
    defaultWorkspace: z.string().optional(),
    defaultDataSource: z.string().optional(),
  }).default({})
});

type BiToolFormValues = z.infer<typeof biToolFormSchema>;

// Tool-specific default configurations
const toolDefaults = {
  tableau: {
    host: "https://your-tableau-server",
    port: 443,
    authType: "oauth2",
    config: {
      apiVersion: "3.15",
      allowDirectQueries: true,
      exportFormats: ["csv", "json", "parquet", "excel"],
    }
  },
  powerbi: {
    host: "https://api.powerbi.com",
    port: 443,
    authType: "oauth2",
    oauthScope: "https://analysis.windows.net/powerbi/api/.default",
    config: {
      apiVersion: "v1.0",
      enableRealTimeSync: true,
      exportFormats: ["csv", "excel"],
    }
  },
  looker: {
    host: "https://your-looker-instance.cloud.looker.com",
    port: 443,
    authType: "api_key",
    config: {
      apiVersion: "4.0",
      allowDirectQueries: true,
      defaultWorkspace: "dev",
    }
  },
  qlik: {
    host: "https://your-qlik-instance.qlikcloud.com",
    port: 443,
    authType: "oauth2",
    config: {
      apiVersion: "v1",
      enableExport: true,
      exportFormats: ["csv", "qvd", "json"]
    }
  },
  metabase: {
    host: "https://your-metabase-server",
    port: 3000,
    authType: "username_password",
    config: {
      allowDirectQueries: true,
    }
  },
  mode: {
    host: "https://app.mode.com",
    port: 443,
    authType: "api_key",
    config: {
      enableExport: true,
      exportFormats: ["csv", "excel"],
    }
  },
  thoughtspot: {
    host: "https://your-thoughtspot-server",
    port: 443,
    authType: "username_password",
    config: {
      allowDirectQueries: false,
    }
  }
};

export default function BIToolConnectorPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("connection");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // Form setup with default values
  const form = useForm<BiToolFormValues>({
    resolver: zodResolver(biToolFormSchema),
    defaultValues: {
      name: "",
      description: "",
      system: "",
      authType: "oauth2",
      host: "",
      port: 443,
      sslEnabled: true,
      accessRestricted: true,
      config: {
        queryTimeout: 300,
        maxRowLimit: 10000,
        allowDirectQueries: false,
        automaticExtraction: false,
        enableRealTimeSync: false,
        enableExport: true,
        exportFormats: ["csv", "json"],
        customFields: []
      }
    }
  });

  // Get systems query
  const { data: systemsData } = useQuery({
    queryKey: ["/api/data-storage/systems"],
    queryFn: async () => {
      const res = await fetch("/api/data-storage/systems");
      if (!res.ok) throw new Error("Failed to load systems");
      return res.json();
    }
  });

  // Creation mutation
  const createMutation = useMutation({
    mutationFn: async (formData: BiToolFormValues) => {
      // Transform form data to match API expectations
      const integrationData: InsertDataIntegration = {
        ...formData,
        type: "bi_tool",
        enabled: true,
        status: "configured",
        config: formData.config
      };

      const res = await apiRequest("POST", "/api/data-storage", integrationData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create integration");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "BI Tool connected successfully",
        description: "Your BI tool has been connected to the platform.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-storage"] });
      navigate("/integration-hub/data-storage");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to connect BI tool",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  function onSubmit(values: BiToolFormValues) {
    createMutation.mutate(values);
  }

  // Update form values when a tool is selected
  function handleToolSelect(tool: string) {
    setSelectedTool(tool);
    
    if (tool in toolDefaults) {
      const defaults = toolDefaults[tool as keyof typeof toolDefaults];
      
      form.setValue("system", tool);
      form.setValue("name", `${tool.charAt(0).toUpperCase() + tool.slice(1)} Connection`);
      form.setValue("authType", defaults.authType);
      form.setValue("host", defaults.host);
      form.setValue("port", defaults.port);
      
      if (defaults.oauthScope) {
        form.setValue("oauthScope", defaults.oauthScope);
      }
      
      if (defaults.config) {
        const configDefaults = defaults.config;
        
        Object.keys(configDefaults).forEach(key => {
          form.setValue(`config.${key}`, configDefaults[key as keyof typeof configDefaults]);
        });
      }
    }
  }

  // Get auth field component based on selected auth type
  const authFieldsComponent = () => {
    const authType = form.watch("authType");
    
    switch (authType) {
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
                    <Input placeholder="Enter username" {...field} />
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
                    <Input type="password" placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case "api_key":
        return (
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <Input placeholder="Enter API key" {...field} />
                </FormControl>
                <FormDescription>
                  The API key for authenticating with the BI tool.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    <Input placeholder="Enter client ID" {...field} />
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
                    <Input type="password" placeholder="Enter client secret" {...field} />
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
                  <FormLabel>Redirect URI</FormLabel>
                  <FormControl>
                    <Input placeholder="https://your-redirect-uri.com/callback" {...field} />
                  </FormControl>
                  <FormDescription>
                    The URI where the OAuth provider will redirect after authentication.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="oauthScope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OAuth Scope</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., read:reports write:reports" {...field} />
                  </FormControl>
                  <FormDescription>
                    Space-separated list of permissions to request.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case "connection_string":
        return (
          <FormField
            control={form.control}
            name="connectionString"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Connection String</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter connection string" {...field} rows={3} />
                </FormControl>
                <FormDescription>
                  The connection string containing all parameters needed to connect.
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

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/integration-hub/data-storage" className="flex items-center text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Data Integrations
        </Link>
      </div>
      
      <PageTitle 
        title="Connect BI Tool" 
        description="Connect your business intelligence tools to the NexusMCP platform." 
        icon={<BarChart3 className="h-10 w-10 text-primary" />}
      />
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Select BI Tool Type</CardTitle>
          <CardDescription>Choose the type of Business Intelligence tool you want to connect.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BI_TOOL_SYSTEMS.map((tool) => (
              <Card 
                key={tool}
                className={`cursor-pointer transition-all ${selectedTool === tool ? 'ring-2 ring-primary' : 'hover:bg-accent'}`}
                onClick={() => handleToolSelect(tool)}
              >
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium">{tool.charAt(0).toUpperCase() + tool.slice(1)}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {selectedTool && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>BI Tool Configuration</CardTitle>
                <CardDescription>Configure connection details for your {selectedTool.charAt(0).toUpperCase() + selectedTool.slice(1)} integration.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-3 mb-8">
                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                    <TabsTrigger value="connection">Connection Details</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter a name for this connection" {...field} />
                          </FormControl>
                          <FormDescription>
                            A descriptive name to identify this BI tool connection.
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
                            <Textarea placeholder="Enter a description" {...field} />
                          </FormControl>
                          <FormDescription>
                            Optional details about this BI tool connection.
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
                          <FormLabel>System</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select BI tool" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {systemsData?.systems?.bi_tool?.map((system: string) => (
                                <SelectItem key={system} value={system}>
                                  {system.charAt(0).toUpperCase() + system.slice(1).replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The BI tool system type.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  <TabsContent value="connection" className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., tableau-server.company.com" {...field} />
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
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="authType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication Type</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Reset auth-related fields when changing auth type
                              form.resetField("apiKey");
                              form.resetField("username");
                              form.resetField("password");
                              form.resetField("oauthClientId");
                              form.resetField("oauthClientSecret");
                              form.resetField("oauthRedirectUri");
                              form.resetField("connectionString");
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select authentication type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {AUTH_TYPES.map((authType) => (
                                <SelectItem key={authType} value={authType}>
                                  {authType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The authentication method for connecting to the BI tool.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {authFieldsComponent()}
                    
                    <FormField
                      control={form.control}
                      name="sslEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              SSL/TLS Encryption
                            </FormLabel>
                            <FormDescription>
                              Enable secure transport layer encryption.
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
                  </TabsContent>
                  
                  <TabsContent value="advanced" className="space-y-6">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="performance">
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <Zap className="h-5 w-5 mr-2" />
                            <span>Performance Settings</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <FormField
                            control={form.control}
                            name="config.queryTimeout"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Query Timeout (seconds)</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Maximum time in seconds to wait for query results.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="config.maxRowLimit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maximum Row Limit</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Maximum number of rows to return in a single query.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="data-access">
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <Database className="h-5 w-5 mr-2" />
                            <span>Data Access Controls</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <FormField
                            control={form.control}
                            name="config.allowDirectQueries"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Allow Direct Queries
                                  </FormLabel>
                                  <FormDescription>
                                    Enable users to run direct SQL queries against this data source.
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
                            name="dataClassification"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data Classification</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select classification" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="public">Public</SelectItem>
                                    <SelectItem value="internal">Internal</SelectItem>
                                    <SelectItem value="confidential">Confidential</SelectItem>
                                    <SelectItem value="restricted">Restricted</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Classification level for the data in this BI tool.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="accessRestricted"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Access Restriction
                                  </FormLabel>
                                  <FormDescription>
                                    Limit access to authorized users only.
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
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="data-sync">
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <RefreshCw className="h-5 w-5 mr-2" />
                            <span>Data Synchronization</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <FormField
                            control={form.control}
                            name="config.enableRealTimeSync"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Real-time Synchronization
                                  </FormLabel>
                                  <FormDescription>
                                    Enable real-time data synchronization where supported.
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
                            name="config.automaticExtraction"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Automatic Extraction
                                  </FormLabel>
                                  <FormDescription>
                                    Automatically extract and cache data from reports.
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
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="export">
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <FileDown className="h-5 w-5 mr-2" />
                            <span>Data Export Options</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <FormField
                            control={form.control}
                            name="config.enableExport"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">
                                    Enable Data Export
                                  </FormLabel>
                                  <FormDescription>
                                    Allow data to be exported from this BI tool.
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
                          
                          {form.watch("config.enableExport") && (
                            <div className="p-4 border rounded-lg space-y-4">
                              <h4 className="font-medium">Export Formats</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="checkbox" 
                                    id="csv"
                                    checked={form.watch("config.exportFormats").includes("csv")}
                                    onChange={(e) => {
                                      const currentFormats = form.watch("config.exportFormats");
                                      if (e.target.checked) {
                                        form.setValue("config.exportFormats", [...currentFormats, "csv"]);
                                      } else {
                                        form.setValue("config.exportFormats", currentFormats.filter(f => f !== "csv"));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor="csv">CSV</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="checkbox" 
                                    id="json"
                                    checked={form.watch("config.exportFormats").includes("json")}
                                    onChange={(e) => {
                                      const currentFormats = form.watch("config.exportFormats");
                                      if (e.target.checked) {
                                        form.setValue("config.exportFormats", [...currentFormats, "json"]);
                                      } else {
                                        form.setValue("config.exportFormats", currentFormats.filter(f => f !== "json"));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor="json">JSON</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="checkbox" 
                                    id="parquet"
                                    checked={form.watch("config.exportFormats").includes("parquet")}
                                    onChange={(e) => {
                                      const currentFormats = form.watch("config.exportFormats");
                                      if (e.target.checked) {
                                        form.setValue("config.exportFormats", [...currentFormats, "parquet"]);
                                      } else {
                                        form.setValue("config.exportFormats", currentFormats.filter(f => f !== "parquet"));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor="parquet">Parquet</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input 
                                    type="checkbox" 
                                    id="excel"
                                    checked={form.watch("config.exportFormats").includes("excel")}
                                    onChange={(e) => {
                                      const currentFormats = form.watch("config.exportFormats");
                                      if (e.target.checked) {
                                        form.setValue("config.exportFormats", [...currentFormats, "excel"]);
                                      } else {
                                        form.setValue("config.exportFormats", currentFormats.filter(f => f !== "excel"));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor="excel">Excel</label>
                                </div>
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="tool-specific">
                        <AccordionTrigger>
                          <div className="flex items-center">
                            <Puzzle className="h-5 w-5 mr-2" />
                            <span>Tool-Specific Settings</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <FormField
                            control={form.control}
                            name="config.apiVersion"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Version</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., v1.0, 3.15" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Version of the BI tool API to use.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="config.defaultWorkspace"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Default Workspace/Site</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Default, Production" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Default workspace, site, or project to connect to.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="config.defaultDataSource"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Default Data Source</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter default data source name" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Default data source to connect to in the BI tool.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate("/integration-hub/data-storage")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="min-w-[120px]"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>Connect BI Tool</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}