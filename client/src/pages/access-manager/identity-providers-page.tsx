import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";
import { Loader2, PlusCircle, Trash, Edit, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Define types based on the backend schema
interface AuthProvider {
  id: number;
  name: string;
  type: string;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scope?: string;
  callbackUrl?: string;
  issuer?: string;
  jwksUri?: string;
  logoUrl?: string;
  config?: Record<string, any>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details: any;
}

// Create form validation schema
const providerFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  type: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  authorizationUrl: z.string().url().optional().or(z.literal("")),
  tokenUrl: z.string().url().optional().or(z.literal("")),
  userInfoUrl: z.string().url().optional().or(z.literal("")),
  scope: z.string().optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
  issuer: z.string().optional(),
  jwksUri: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  isEnabled: z.boolean().default(true),
  config: z.record(z.any()).optional(),
});

type ProviderFormValues = z.infer<typeof providerFormSchema>;

function IdentityProvidersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [currentProviderId, setCurrentProviderId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Fetch providers
  const { data: providers, isLoading, error, refetch } = useQuery<AuthProvider[]>({
    queryKey: ["/api/auth-providers"],
    retry: 1,
  });

  // Create provider mutation
  const createProviderMutation = useMutation({
    mutationFn: async (data: ProviderFormValues) => {
      const res = await apiRequest("POST", "/api/auth-providers", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider created successfully",
      });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth-providers"] });
      form.reset({
        name: "",
        type: "oauth2",
        clientId: "",
        clientSecret: "",
        authorizationUrl: "",
        tokenUrl: "",
        userInfoUrl: "",
        scope: "",
        callbackUrl: "",
        issuer: "",
        jwksUri: "",
        logoUrl: "",
        isEnabled: true,
        config: {},
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create provider: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    },
  });

  // Update provider mutation
  const updateProviderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProviderFormValues> }) => {
      const res = await apiRequest("PUT", `/api/auth-providers/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider updated successfully",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth-providers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update provider: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    },
  });

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/auth-providers/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth-providers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete provider: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    },
  });

  // Toggle provider status mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/auth-providers/${id}/toggle`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Provider status toggled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth-providers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to toggle provider status: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    },
  });

  // Test provider connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      setIsTestingProvider(true);
      const res = await apiRequest("POST", `/api/auth-providers/${id}/test`);
      return await res.json();
    },
    onSuccess: (data: ConnectionTestResult) => {
      setTestResult(data);
      setIsTestingProvider(false);
      // Show toast based on test result
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: data.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsTestingProvider(false);
      setTestResult(null);
      toast({
        title: "Test Failed",
        description: "Failed to test provider connection: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    },
  });

  // Setup form for adding a new provider
  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      type: "oauth2",
      clientId: "",
      clientSecret: "",
      authorizationUrl: "",
      tokenUrl: "",
      userInfoUrl: "",
      scope: "",
      callbackUrl: "",
      issuer: "",
      jwksUri: "",
      logoUrl: "",
      isEnabled: true,
      config: {},
    },
  });

  // Setup form for editing a provider
  const editForm = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      type: "oauth2",
      clientId: "",
      clientSecret: "",
      authorizationUrl: "",
      tokenUrl: "",
      userInfoUrl: "",
      scope: "",
      callbackUrl: "",
      issuer: "",
      jwksUri: "",
      logoUrl: "",
      isEnabled: true,
      config: {},
    },
  });

  // Handle form submission
  const onSubmit = (values: ProviderFormValues) => {
    createProviderMutation.mutate(values);
  };

  // Handle edit form submission
  const onEditSubmit = (values: ProviderFormValues) => {
    if (currentProviderId) {
      updateProviderMutation.mutate({ id: currentProviderId, data: values });
    }
  };

  // Open edit dialog and populate form
  const handleEditProvider = (provider: AuthProvider) => {
    setCurrentProviderId(provider.id);
    
    // Map provider data to form values
    editForm.reset({
      name: provider.name,
      type: provider.type,
      clientId: provider.clientId || "",
      clientSecret: "",  // Don't populate for security
      authorizationUrl: provider.authorizationUrl || "",
      tokenUrl: provider.tokenUrl || "",
      userInfoUrl: provider.userInfoUrl || "",
      scope: provider.scope || "",
      callbackUrl: provider.callbackUrl || "",
      issuer: provider.issuer || "",
      jwksUri: provider.jwksUri || "",
      logoUrl: provider.logoUrl || "",
      isEnabled: provider.isEnabled,
      config: provider.config || {},
    });
    
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const handleDeleteProvider = (id: number) => {
    setCurrentProviderId(id);
    setIsDeleteDialogOpen(true);
  };

  // Handle provider status toggle
  const handleToggleProvider = (id: number) => {
    toggleProviderMutation.mutate(id);
  };

  // Handle test connection
  const handleTestConnection = (id: number) => {
    setCurrentProviderId(id);
    testConnectionMutation.mutate(id);
  };

  // Determine fields to show based on provider type
  const renderProviderTypeFields = (type: string, formContext: any) => {
    if (type === "oauth2" || type === "oidc") {
      return (
        <>
          <FormField
            control={formContext.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter client ID" {...field} />
                </FormControl>
                <FormDescription>
                  The client identifier issued by the authorization server
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="clientSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Secret</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="Enter client secret" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  The client secret issued by the authorization server
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="tokenUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Token URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/token" {...field} />
                </FormControl>
                <FormDescription>
                  The endpoint for obtaining an access token
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="authorizationUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authorization URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/authorize" {...field} />
                </FormControl>
                <FormDescription>
                  The endpoint for authorization requests
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scope</FormLabel>
                <FormControl>
                  <Input placeholder="openid profile email" {...field} />
                </FormControl>
                <FormDescription>
                  Space-separated list of scopes
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {type === "oidc" && (
            <>
              <FormField
                control={formContext.control}
                name="issuer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      The issuer identifier for the OIDC provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formContext.control}
                name="jwksUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>JWKS URI</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/.well-known/jwks.json" {...field} />
                    </FormControl>
                    <FormDescription>
                      The URL for the JSON Web Key Set
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </>
      );
    } else if (type === "saml") {
      return (
        <>
          <FormField
            control={formContext.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entity ID</FormLabel>
                <FormControl>
                  <Input placeholder="https://your-app.com/saml/metadata" {...field} />
                </FormControl>
                <FormDescription>
                  Your service provider entity ID
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="authorizationUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SSO URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://idp.example.com/saml2/sso" {...field} />
                </FormControl>
                <FormDescription>
                  The identity provider's SSO endpoint
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="callbackUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ACS URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://your-app.com/saml/callback" {...field} />
                </FormControl>
                <FormDescription>
                  Your Assertion Consumer Service URL
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    } else if (type === "ldap") {
      return (
        <>
          <FormField
            control={formContext.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LDAP URL</FormLabel>
                <FormControl>
                  <Input placeholder="ldap://ldap.example.com:389" {...field} />
                </FormControl>
                <FormDescription>
                  The LDAP server URL including protocol and port
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="authorizationUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base DN</FormLabel>
                <FormControl>
                  <Input placeholder="dc=example,dc=com" {...field} />
                </FormControl>
                <FormDescription>
                  The base Distinguished Name for LDAP searches
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formContext.control}
            name="clientSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bind Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="Enter bind password" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Password for the bind DN
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load identity providers"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Identity Providers | NexusMCP</title>
      </Helmet>
      
      <div className="container mx-auto py-6">
        <PageHeader
          title={t("Identity Providers")}
          description={t("Manage authentication providers for SSO and OAuth 2.1 Client Credentials flow.")}
          children={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("Add Provider")}
            </Button>
          }
        />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("Identity Providers")}</CardTitle>
            <CardDescription>
              {t("Configure authentication providers for single sign-on and OAuth 2.1 Client Credentials flow.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {providers && providers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Type")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">
                          {provider.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {provider.isEnabled ? (
                          <Badge className="bg-green-500 hover:bg-green-600">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleProvider(provider.id)}
                          >
                            {provider.isEnabled ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(provider.id)}
                            disabled={isTestingProvider}
                          >
                            {isTestingProvider && currentProviderId === provider.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProvider(provider)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteProvider(provider.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  {t("No identity providers configured yet.")}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t("Add your first provider")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("Add Identity Provider")}</DialogTitle>
            <DialogDescription>
              {t("Configure a new authentication provider for your application.")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Provider name" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for the provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.trigger("type");
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                        <SelectItem value="oidc">OpenID Connect</SelectItem>
                        <SelectItem value="saml">SAML 2.0</SelectItem>
                        <SelectItem value="ldap">LDAP / Active Directory</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The type of authentication protocol used by this provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dynamic fields based on provider type */}
              {renderProviderTypeFields(form.watch("type"), form)}

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/logo.png" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL to the provider's logo (optional)
                    </FormDescription>
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
                      <FormLabel className="text-base">
                        Enabled
                      </FormLabel>
                      <FormDescription>
                        Enable this provider for authentication
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProviderMutation.isPending}>
                  {createProviderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("Creating...")}
                    </>
                  ) : (
                    t("Create Provider")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("Edit Identity Provider")}</DialogTitle>
            <DialogDescription>
              {t("Update the configuration for this authentication provider.")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Provider name" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for the provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Type</FormLabel>
                    <FormControl>
                      <Input disabled {...field} />
                    </FormControl>
                    <FormDescription>
                      The provider type cannot be changed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dynamic fields based on provider type */}
              {renderProviderTypeFields(editForm.watch("type"), editForm)}

              <FormField
                control={editForm.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/logo.png" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL to the provider's logo (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enabled
                      </FormLabel>
                      <FormDescription>
                        Enable this provider for authentication
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProviderMutation.isPending}>
                  {updateProviderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("Updating...")}
                    </>
                  ) : (
                    t("Update Provider")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("Delete Provider")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this identity provider?")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-destructive">
            {t("This action cannot be undone and may affect users who authenticate with this provider.")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={() => currentProviderId && deleteProviderMutation.mutate(currentProviderId)}
              disabled={deleteProviderMutation.isPending}
            >
              {deleteProviderMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete Provider")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection Test Result Dialog */}
      {testResult && (
        <Dialog open={!!testResult} onOpenChange={() => setTestResult(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {testResult.success ? (
                  <span className="text-green-600">Connection Successful</span>
                ) : (
                  <span className="text-red-600">Connection Failed</span>
                )}
              </DialogTitle>
              <DialogDescription>
                Test results for the provider connection
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <p className="font-medium">{testResult.message}</p>
              </div>
              
              {testResult.details && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Details:</h4>
                  <pre className="rounded-md bg-slate-950 p-4 text-xs text-slate-50 overflow-auto">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button onClick={() => setTestResult(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default IdentityProvidersPage;