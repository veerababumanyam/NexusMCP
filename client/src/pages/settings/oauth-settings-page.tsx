import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Define schemas for OAuth configuration
const globalOAuthConfigSchema = z.object({
  enabled: z.boolean(),
  defaultAuthServer: z.object({
    discoveryUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    tokenUrl: z.string().url("Please enter a valid URL"),
    clientId: z.string().min(1, "Client ID is required"),
    clientSecret: z.string().min(1, "Client Secret is required"),
    jwksUri: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  }).optional(),
  defaultScopes: z.array(z.string()).optional(),
  tokenValidation: z.object({
    enabled: z.boolean(),
    requiredScopes: z.array(z.string()).optional(),
    audience: z.string().optional().or(z.literal("")),
  }).optional()
});

const serverOAuthConfigSchema = z.object({
  serverId: z.number(),
  enabled: z.boolean(),
  authServer: z.object({
    discoveryUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    tokenUrl: z.string().url("Please enter a valid URL"),
    clientId: z.string().min(1, "Client ID is required"),
    clientSecret: z.string().min(1, "Client Secret is required"),
    jwksUri: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  }).optional(),
  scopes: z.array(z.string()).optional()
});

const discoverySchema = z.object({
  discoveryUrl: z.string().url("Please enter a valid URL"),
});

const testTokenSchema = z.object({
  serverId: z.number().optional(),
  forceRefresh: z.boolean().optional(),
});

type GlobalOAuthConfig = z.infer<typeof globalOAuthConfigSchema>;
type ServerOAuthConfig = z.infer<typeof serverOAuthConfigSchema>;
type DiscoveryRequest = z.infer<typeof discoverySchema>;
type TestTokenRequest = z.infer<typeof testTokenSchema>;

export default function OAuthSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("global");
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [tokenResult, setTokenResult] = useState<any>(null);

  // Query to fetch the global OAuth configuration
  const { 
    data: globalConfig, 
    isLoading: isLoadingGlobal,
    error: globalError
  } = useQuery({
    queryKey: ["/api/oauth/config"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/oauth/config");
      if (!response.ok) {
        throw new Error("Failed to fetch OAuth configuration");
      }
      return await response.json();
    }
  });

  // Query to fetch MCP servers for the server-specific configuration
  const { 
    data: mcpServers, 
    isLoading: isLoadingServers 
  } = useQuery({
    queryKey: ["/api/mcp/servers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/mcp/servers");
      if (!response.ok) {
        throw new Error("Failed to fetch MCP servers");
      }
      return await response.json();
    }
  });

  // Query to fetch server-specific OAuth configuration if a server is selected
  const { 
    data: serverConfig, 
    isLoading: isLoadingServerConfig,
    error: serverConfigError
  } = useQuery({
    queryKey: ["/api/oauth/server", selectedServer],
    queryFn: async () => {
      if (!selectedServer) return null;
      const response = await apiRequest("GET", `/api/oauth/server/${selectedServer}`);
      if (!response.ok) {
        throw new Error("Failed to fetch server OAuth configuration");
      }
      return await response.json();
    },
    enabled: !!selectedServer
  });

  // Form for global OAuth configuration
  const globalForm = useForm<GlobalOAuthConfig>({
    resolver: zodResolver(globalOAuthConfigSchema),
    defaultValues: {
      enabled: false,
      defaultAuthServer: {
        discoveryUrl: "",
        tokenUrl: "",
        clientId: "",
        clientSecret: "",
        jwksUri: ""
      },
      defaultScopes: [],
      tokenValidation: {
        enabled: false,
        requiredScopes: [],
        audience: ""
      }
    }
  });

  // Update form when data is loaded
  React.useEffect(() => {
    if (globalConfig) {
      globalForm.reset(globalConfig);
    }
  }, [globalConfig]);

  // Form for server-specific OAuth configuration
  const serverForm = useForm<ServerOAuthConfig>({
    resolver: zodResolver(serverOAuthConfigSchema),
    defaultValues: {
      serverId: selectedServer || 0,
      enabled: false,
      authServer: {
        discoveryUrl: "",
        tokenUrl: "",
        clientId: "",
        clientSecret: "",
        jwksUri: ""
      },
      scopes: []
    }
  });

  // Update server form when server is selected or data is loaded
  React.useEffect(() => {
    if (selectedServer && serverConfig) {
      serverForm.reset({
        ...serverConfig,
        serverId: selectedServer
      });
    } else if (selectedServer) {
      serverForm.reset({
        serverId: selectedServer,
        enabled: false,
        authServer: {
          discoveryUrl: "",
          tokenUrl: "",
          clientId: "",
          clientSecret: "",
          jwksUri: ""
        },
        scopes: []
      });
    }
  }, [selectedServer, serverConfig]);

  // Form for discovery URL
  const discoveryForm = useForm<DiscoveryRequest>({
    resolver: zodResolver(discoverySchema),
    defaultValues: {
      discoveryUrl: ""
    }
  });

  // Form for testing token
  const testTokenForm = useForm<TestTokenRequest>({
    resolver: zodResolver(testTokenSchema),
    defaultValues: {
      serverId: undefined,
      forceRefresh: false
    }
  });

  // Mutation to update global OAuth configuration
  const updateGlobalConfigMutation = useMutation({
    mutationFn: async (data: GlobalOAuthConfig) => {
      const response = await apiRequest("PUT", "/api/oauth/config", data);
      if (!response.ok) {
        throw new Error("Failed to update OAuth configuration");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "OAuth Configuration Updated",
        description: "Global OAuth configuration has been successfully updated.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/config"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to update server-specific OAuth configuration
  const updateServerConfigMutation = useMutation({
    mutationFn: async (data: ServerOAuthConfig) => {
      const response = await apiRequest("PUT", `/api/oauth/server/${data.serverId}`, data);
      if (!response.ok) {
        throw new Error("Failed to update server OAuth configuration");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Server OAuth Configuration Updated",
        description: "Server-specific OAuth configuration has been successfully updated.",
        variant: "default"
      });
      if (selectedServer) {
        queryClient.invalidateQueries({ queryKey: ["/api/oauth/server", selectedServer] });
      }
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to discover OAuth provider
  const discoverOAuthProviderMutation = useMutation({
    mutationFn: async (data: DiscoveryRequest) => {
      const response = await apiRequest("POST", "/api/oauth/discover", data);
      if (!response.ok) {
        throw new Error("Failed to discover OAuth provider");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setDiscoveryResult(data);
      toast({
        title: "Discovery Successful",
        description: "OAuth provider configuration discovered successfully.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to test OAuth token
  const testTokenMutation = useMutation({
    mutationFn: async (data: TestTokenRequest) => {
      const response = await apiRequest("POST", "/api/oauth/test-token", data);
      if (!response.ok) {
        throw new Error("Failed to get token");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setTokenResult(data);
      toast({
        title: "Token Retrieved",
        description: "OAuth token retrieved successfully.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Token Retrieval Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to clear token caches
  const clearCachesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/oauth/clear-caches");
      if (!response.ok) {
        throw new Error("Failed to clear token caches");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Caches Cleared",
        description: "OAuth token caches have been cleared successfully.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Cache Clear Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Global config form submission handler
  const onSubmitGlobalConfig = (data: GlobalOAuthConfig) => {
    updateGlobalConfigMutation.mutate(data);
  };

  // Server config form submission handler
  const onSubmitServerConfig = (data: ServerOAuthConfig) => {
    updateServerConfigMutation.mutate(data);
  };

  // Discovery form submission handler
  const onSubmitDiscovery = (data: DiscoveryRequest) => {
    discoverOAuthProviderMutation.mutate(data);
  };

  // Test token form submission handler
  const onSubmitTestToken = (data: TestTokenRequest) => {
    testTokenMutation.mutate(data);
  };

  // Handler for clearing token caches
  const handleClearCaches = () => {
    clearCachesMutation.mutate();
  };

  // Handle server selection change
  const handleServerChange = (serverId: string) => {
    setSelectedServer(parseInt(serverId));
  };

  // Display loading state if data is still loading
  if (isLoadingGlobal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Format scopes array for display
  const formatScopes = (scopes: string[] | undefined) => {
    if (!scopes || scopes.length === 0) return "";
    return scopes.join(" ");
  };

  // Parse scopes string into array
  const parseScopes = (scopesString: string): string[] => {
    if (!scopesString) return [];
    return scopesString.split(/\s+/).filter(s => s);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">OAuth 2.1 Client Credentials Configuration</h1>
      <p className="text-muted-foreground mb-8">
        Configure OAuth 2.1 Client Credentials flow for secure service-to-service communication between 
        MCP Gateway and MCP Servers.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="global">Global Configuration</TabsTrigger>
          <TabsTrigger value="server">Server-Specific</TabsTrigger>
          <TabsTrigger value="tools">Tools & Utilities</TabsTrigger>
        </TabsList>

        {/* Global OAuth Configuration Tab */}
        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>Global OAuth Configuration</CardTitle>
              <CardDescription>
                Configure default OAuth settings that apply to all MCP server connections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...globalForm}>
                <form onSubmit={globalForm.handleSubmit(onSubmitGlobalConfig)}>
                  <div className="space-y-6">
                    <FormField
                      control={globalForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable OAuth</FormLabel>
                            <FormDescription>
                              Enable OAuth 2.1 Client Credentials flow for MCP server communication
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

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-medium mb-4">Default Auth Server</h3>
                      
                      <FormField
                        control={globalForm.control}
                        name="defaultAuthServer.discoveryUrl"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Discovery URL (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://auth-server/.well-known/openid-configuration"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription>
                              OpenID Connect discovery URL for auto-configuration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={globalForm.control}
                        name="defaultAuthServer.tokenUrl"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Token URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://auth-server/oauth/token"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              URL to request access tokens from the authorization server
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={globalForm.control}
                        name="defaultAuthServer.clientId"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Client ID</FormLabel>
                            <FormControl>
                              <Input placeholder="client_id" {...field} />
                            </FormControl>
                            <FormDescription>
                              OAuth client identifier registered with the authorization server
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={globalForm.control}
                        name="defaultAuthServer.clientSecret"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Client Secret</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="client_secret"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Secret associated with the client ID
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={globalForm.control}
                        name="defaultAuthServer.jwksUri"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>JWKS URI (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://auth-server/.well-known/jwks.json"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription>
                              JSON Web Key Set URI for validating token signatures
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={globalForm.control}
                      name="defaultScopes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Scopes</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="scope1 scope2 scope3"
                              value={formatScopes(field.value)}
                              onChange={(e) => field.onChange(parseScopes(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Space-separated list of default OAuth scopes to request
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-medium mb-4">Token Validation</h3>
                      
                      <FormField
                        control={globalForm.control}
                        name="tokenValidation.enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mb-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Token Validation</FormLabel>
                              <FormDescription>
                                Validate incoming tokens from MCP clients and services
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
                        control={globalForm.control}
                        name="tokenValidation.requiredScopes"
                        render={({ field }) => (
                          <FormItem className="mb-4">
                            <FormLabel>Required Scopes</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="required_scope1 required_scope2"
                                value={formatScopes(field.value)}
                                onChange={(e) => field.onChange(parseScopes(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Space-separated list of scopes required in incoming tokens
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={globalForm.control}
                        name="tokenValidation.audience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected Audience</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://api.example.com"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormDescription>
                              Expected audience claim in incoming tokens
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      type="submit"
                      className="mr-2"
                      disabled={updateGlobalConfigMutation.isPending}
                    >
                      {updateGlobalConfigMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Server-Specific Configuration Tab */}
        <TabsContent value="server">
          <Card>
            <CardHeader>
              <CardTitle>Server-Specific OAuth Configuration</CardTitle>
              <CardDescription>
                Configure OAuth settings for specific MCP servers, overriding the global defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingServers ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <label htmlFor="serverSelect" className="block text-sm font-medium mb-2">
                      Select MCP Server
                    </label>
                    <select
                      id="serverSelect"
                      className="w-full px-3 py-2 border rounded-md"
                      onChange={(e) => handleServerChange(e.target.value)}
                      value={selectedServer || ""}
                    >
                      <option value="">Select a server...</option>
                      {mcpServers && mcpServers.map((server: any) => (
                        <option key={server.id} value={server.id}>
                          {server.name} ({server.host})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedServer ? (
                    isLoadingServerConfig ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <Form {...serverForm}>
                        <form onSubmit={serverForm.handleSubmit(onSubmitServerConfig)}>
                          <div className="space-y-6">
                            <FormField
                              control={serverForm.control}
                              name="enabled"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">Enable Server-Specific OAuth</FormLabel>
                                    <FormDescription>
                                      Override global OAuth settings for this MCP server
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

                            <div className="p-4 border rounded-lg">
                              <h3 className="text-lg font-medium mb-4">Server Auth Configuration</h3>
                              
                              <FormField
                                control={serverForm.control}
                                name="authServer.discoveryUrl"
                                render={({ field }) => (
                                  <FormItem className="mb-4">
                                    <FormLabel>Discovery URL (Optional)</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="https://auth-server/.well-known/openid-configuration"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      OpenID Connect discovery URL for auto-configuration
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={serverForm.control}
                                name="authServer.tokenUrl"
                                render={({ field }) => (
                                  <FormItem className="mb-4">
                                    <FormLabel>Token URL</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="https://auth-server/oauth/token"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      URL to request access tokens from the authorization server
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={serverForm.control}
                                name="authServer.clientId"
                                render={({ field }) => (
                                  <FormItem className="mb-4">
                                    <FormLabel>Client ID</FormLabel>
                                    <FormControl>
                                      <Input placeholder="client_id" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                      OAuth client identifier registered with the authorization server
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={serverForm.control}
                                name="authServer.clientSecret"
                                render={({ field }) => (
                                  <FormItem className="mb-4">
                                    <FormLabel>Client Secret</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="password"
                                        placeholder="client_secret"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Secret associated with the client ID
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={serverForm.control}
                                name="authServer.jwksUri"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>JWKS URI (Optional)</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="https://auth-server/.well-known/jwks.json"
                                        {...field}
                                        value={field.value || ""}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      JSON Web Key Set URI for validating token signatures
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={serverForm.control}
                              name="scopes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Scopes</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="scope1 scope2 scope3"
                                      value={formatScopes(field.value)}
                                      onChange={(e) => field.onChange(parseScopes(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Space-separated list of OAuth scopes to request for this server
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="mt-6">
                            <Button
                              type="submit"
                              className="mr-2"
                              disabled={updateServerConfigMutation.isPending}
                            >
                              {updateServerConfigMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Save Server Configuration
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )
                  ) : (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                      Please select a server to configure
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools & Utilities Tab */}
        <TabsContent value="tools">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Discovery Tool */}
            <Card>
              <CardHeader>
                <CardTitle>OAuth Provider Discovery</CardTitle>
                <CardDescription>
                  Auto-discover OAuth provider configuration from a discovery URL
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...discoveryForm}>
                  <form onSubmit={discoveryForm.handleSubmit(onSubmitDiscovery)}>
                    <FormField
                      control={discoveryForm.control}
                      name="discoveryUrl"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Discovery URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://auth-server/.well-known/openid-configuration"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            OpenID Connect discovery URL for auto-configuration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full mt-2"
                      disabled={discoverOAuthProviderMutation.isPending}
                    >
                      {discoverOAuthProviderMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Discover Provider
                    </Button>
                  </form>
                </Form>

                {discoveryResult && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Discovery Result</h4>
                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                      <pre className="text-xs">
                        {JSON.stringify(discoveryResult, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Token Tool */}
            <Card>
              <CardHeader>
                <CardTitle>Test OAuth Token</CardTitle>
                <CardDescription>
                  Test getting an OAuth token from the configured provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...testTokenForm}>
                  <form onSubmit={testTokenForm.handleSubmit(onSubmitTestToken)}>
                    <div className="mb-4">
                      <label htmlFor="testServerSelect" className="block text-sm font-medium mb-2">
                        Server (Optional)
                      </label>
                      <select
                        id="testServerSelect"
                        className="w-full px-3 py-2 border rounded-md"
                        onChange={(e) => 
                          testTokenForm.setValue(
                            "serverId", 
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        value={testTokenForm.watch("serverId") || ""}
                      >
                        <option value="">Use global configuration</option>
                        {mcpServers && mcpServers.map((server: any) => (
                          <option key={server.id} value={server.id}>
                            {server.name} ({server.host})
                          </option>
                        ))}
                      </select>
                    </div>

                    <FormField
                      control={testTokenForm.control}
                      name="forceRefresh"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 mb-4">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Force Token Refresh</FormLabel>
                            <FormDescription>
                              Force a new token to be requested even if a cached one exists
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full mt-2"
                      disabled={testTokenMutation.isPending}
                    >
                      {testTokenMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Get Token
                    </Button>
                  </form>
                </Form>

                {tokenResult && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Token Result</h4>
                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                      <pre className="text-xs">
                        {JSON.stringify(tokenResult, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cache Management */}
            <Card>
              <CardHeader>
                <CardTitle>Token Cache Management</CardTitle>
                <CardDescription>
                  Manage the OAuth token cache
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Clear all cached OAuth tokens. This will force new tokens to be requested on the next API call.
                </p>
                
                <Button
                  onClick={handleClearCaches}
                  variant="destructive"
                  className="w-full"
                  disabled={clearCachesMutation.isPending}
                >
                  {clearCachesMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Clear All Token Caches
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}