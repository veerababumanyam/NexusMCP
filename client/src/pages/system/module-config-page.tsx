import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, CheckCircle2, CreditCard, Activity, Brain } from "lucide-react";
import { z } from "zod";
import { SystemModule, AiProvider } from "@shared/schema_system";

// Helper to set icon component
const getIconComponent = (iconName: string | null) => {
  switch(iconName) {
    case 'CreditCard': return <CreditCard className="h-5 w-5 mr-2" />;
    case 'Activity': return <Activity className="h-5 w-5 mr-2" />;
    case 'Brain': return <Brain className="h-5 w-5 mr-2" />;
    default: return null;
  }
};

// OpenAI config schema
const openAiConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  defaultModel: z.string().min(1, "Default model is required"),
  timeout: z.coerce.number().int().positive().optional(),
});

// Azure OpenAI config schema
const azureOpenAiConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  endpoint: z.string().url("Must be a valid URL").min(1, "Endpoint is required"),
  apiVersion: z.string().min(1, "API version is required"),
  defaultModel: z.string().min(1, "Default model is required"),
  timeout: z.coerce.number().int().positive().optional(),
});

export default function ModuleConfigPage() {
  const { toast } = useToast();
  
  // Query modules
  const { 
    data: modules, 
    isLoading: modulesLoading,
    error: modulesError
  } = useQuery<SystemModule[]>({
    queryKey: ['/api/system/modules'],
  });

  // Query AI providers
  const { 
    data: providers, 
    isLoading: providersLoading, 
    error: providersError 
  } = useQuery<AiProvider[]>({
    queryKey: ['/api/system/ai-providers'],
  });

  // Toggle module status mutation
  const toggleModuleMutation = useMutation({
    mutationFn: async (moduleId: number) => {
      const response = await fetch(`/api/system/modules/${moduleId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to toggle module status');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/modules'] });
      toast({
        title: "Module updated",
        description: "Module status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update module",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Toggle AI provider status mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async ({ providerId, enabled }: { providerId: number, enabled: boolean }) => {
      const response = await fetch(`/api/system/ai-providers/${providerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update provider status');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/ai-providers'] });
      toast({
        title: "Provider updated",
        description: "Provider status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update provider",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Set default AI provider mutation
  const setDefaultProviderMutation = useMutation({
    mutationFn: async (providerId: number) => {
      const response = await fetch(`/api/system/ai-providers/${providerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isDefault: true }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to set default provider');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/ai-providers'] });
      toast({
        title: "Default provider updated",
        description: "Default AI provider has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set default provider",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update API key mutation
  const updateApiKeyMutation = useMutation({
    mutationFn: async ({ providerId, apiKey }: { providerId: number, apiKey: string }) => {
      const response = await fetch(`/api/system/ai-providers/${providerId}/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update API key');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/ai-providers'] });
      toast({
        title: "API key updated",
        description: "API key has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update API key",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle toggle module change
  const handleToggleModule = (moduleId: number) => {
    toggleModuleMutation.mutate(moduleId);
  };

  // Handle toggle provider change
  const handleToggleProvider = (providerId: number, enabled: boolean) => {
    toggleProviderMutation.mutate({ providerId, enabled });
  };

  // Handle set default provider change
  const handleSetDefaultProvider = (providerId: number) => {
    setDefaultProviderMutation.mutate(providerId);
  };

  // OpenAI config form
  const openAiForm = useForm<z.infer<typeof openAiConfigSchema>>({
    resolver: zodResolver(openAiConfigSchema),
    defaultValues: {
      apiKey: "",
      defaultModel: "gpt-4o",
      timeout: 30000,
    },
  });

  // Azure OpenAI config form
  const azureOpenAiForm = useForm<z.infer<typeof azureOpenAiConfigSchema>>({
    resolver: zodResolver(azureOpenAiConfigSchema),
    defaultValues: {
      apiKey: "",
      endpoint: "https://your-resource-name.openai.azure.com/",
      apiVersion: "2023-05-15",
      defaultModel: "gpt-4",
      timeout: 30000,
    },
  });

  // Handle OpenAI config submit
  const handleOpenAiSubmit = (values: z.infer<typeof openAiConfigSchema>) => {
    if (!providers) return;
    
    const openAiProvider = providers.find(p => p.name === 'openai');
    if (!openAiProvider) {
      toast({
        title: "Provider not found",
        description: "OpenAI provider configuration not found",
        variant: "destructive",
      });
      return;
    }
    
    updateApiKeyMutation.mutate({ 
      providerId: openAiProvider.id, 
      apiKey: values.apiKey 
    });
  };

  // Handle Azure OpenAI config submit
  const handleAzureOpenAiSubmit = (values: z.infer<typeof azureOpenAiConfigSchema>) => {
    if (!providers) return;
    
    const azureProvider = providers.find(p => p.name === 'azure_openai');
    if (!azureProvider) {
      toast({
        title: "Provider not found",
        description: "Azure OpenAI provider configuration not found",
        variant: "destructive",
      });
      return;
    }
    
    updateApiKeyMutation.mutate({ 
      providerId: azureProvider.id, 
      apiKey: values.apiKey 
    });
  };

  // If loading, show a loading spinner
  if (modulesLoading || providersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If there's an error, show an error message
  if (modulesError || providersError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Error loading configuration</h2>
        <p className="text-muted-foreground">
          {modulesError instanceof Error ? modulesError.message : 'Unknown error'}
          {providersError instanceof Error ? providersError.message : ''}
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">System Configuration</h1>
      
      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="modules">Enterprise Modules</TabsTrigger>
          <TabsTrigger value="ai-providers">AI Providers</TabsTrigger>
        </TabsList>
        
        {/* Modules Tab */}
        <TabsContent value="modules">
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Enterprise Module Management</h2>
                <p className="text-muted-foreground mt-1">Enable or disable enterprise modules in the system</p>
              </div>
            </div>
            
            <div className="grid gap-4">
              {modules && modules.map((module) => (
                <Card key={module.id} className={module.enabled ? "border-l-4 border-l-primary" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getIconComponent(module.iconName)}
                        <CardTitle className="text-xl">{module.displayName}</CardTitle>
                      </div>
                      <Switch 
                        checked={module.enabled} 
                        onCheckedChange={() => handleToggleModule(module.id)}
                        disabled={toggleModuleMutation.isPending}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm mb-2">{module.description}</CardDescription>
                    {module.enabled ? (
                      <div className="flex items-center text-sm text-primary-foreground bg-primary px-2 py-1 rounded-full w-fit">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        <span>Enabled</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full w-fit">
                        <span>Disabled</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
        
        {/* AI Providers Tab */}
        <TabsContent value="ai-providers">
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">AI Provider Configuration</h2>
                <p className="text-muted-foreground mt-1">Configure AI providers used by the system</p>
              </div>
            </div>
            
            <div className="grid gap-8">
              {providers && providers.map((provider) => (
                <Card key={provider.id} className={provider.isDefault ? "border-l-4 border-l-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{provider.displayName}</CardTitle>
                      <div className="flex items-center gap-4">
                        {!provider.isDefault && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSetDefaultProvider(provider.id)}
                            disabled={setDefaultProviderMutation.isPending}
                          >
                            Set as Default
                          </Button>
                        )}
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id={`provider-${provider.id}`} 
                            checked={provider.enabled}
                            onCheckedChange={(checked) => handleToggleProvider(provider.id, checked)}
                            disabled={toggleProviderMutation.isPending}
                          />
                          <Label htmlFor={`provider-${provider.id}`}>
                            {provider.enabled ? 'Enabled' : 'Disabled'}
                          </Label>
                        </div>
                      </div>
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                    {provider.isDefault && (
                      <div className="flex items-center text-sm text-primary-foreground bg-primary px-2 py-1 rounded-full w-fit mt-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        <span>Default Provider</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Separator className="mb-4" />
                    
                    {provider.name === 'openai' && (
                      <Form {...openAiForm}>
                        <form onSubmit={openAiForm.handleSubmit(handleOpenAiSubmit)} className="space-y-4">
                          <h3 className="text-lg font-semibold">OpenAI Configuration</h3>
                          
                          <FormField
                            control={openAiForm.control}
                            name="apiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" placeholder="sk-..." />
                                </FormControl>
                                <FormDescription>
                                  Your OpenAI API key. This will be stored securely.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={openAiForm.control}
                            name="defaultModel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Default Model</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="gpt-4o" />
                                </FormControl>
                                <FormDescription>
                                  {/* the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user */}
                                  The default model to use for OpenAI requests. Current recommendation is gpt-4o.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button type="submit" className="mt-2" disabled={updateApiKeyMutation.isPending}>
                            {updateApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </form>
                      </Form>
                    )}
                    
                    {provider.name === 'azure_openai' && (
                      <Form {...azureOpenAiForm}>
                        <form onSubmit={azureOpenAiForm.handleSubmit(handleAzureOpenAiSubmit)} className="space-y-4">
                          <h3 className="text-lg font-semibold">Azure OpenAI Configuration</h3>
                          
                          <FormField
                            control={azureOpenAiForm.control}
                            name="apiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" placeholder="Your Azure OpenAI API key" />
                                </FormControl>
                                <FormDescription>
                                  Your Azure OpenAI API key. This will be stored securely.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={azureOpenAiForm.control}
                            name="endpoint"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Endpoint</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="https://your-resource-name.openai.azure.com/" />
                                </FormControl>
                                <FormDescription>
                                  Your Azure OpenAI endpoint URL.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={azureOpenAiForm.control}
                              name="apiVersion"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>API Version</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="2023-05-15" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={azureOpenAiForm.control}
                              name="defaultModel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Default Model</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="gpt-4" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <Button type="submit" className="mt-2" disabled={updateApiKeyMutation.isPending}>
                            {updateApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                          </Button>
                        </form>
                      </Form>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}