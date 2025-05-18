import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  Save, 
  Check, 
  X, 
  Plug, 
  RefreshCw, 
  AlertCircle,
  PlusCircle,
  Trash2,
  Github,
  Slack,
  PlusSquare,
  BarChart,
  Webhook,
  Gitlab,
  Database
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// Integration form schema
const integrationFormSchema = z.object({
  name: z.string().min(1, "Integration name is required"),
  type: z.string().min(1, "Integration type is required"),
  url: z.string().url("Must be a valid URL"),
  apiKey: z.string().optional(),
  status: z.enum(["active", "inactive", "error"]).default("inactive"),
  version: z.string().optional(),
  config: z.any().optional(),
  isEnabled: z.boolean().default(false),
});

type IntegrationFormValues = z.infer<typeof integrationFormSchema>;

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all-integrations");
  const [editingIntegration, setEditingIntegration] = useState<IntegrationFormValues | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Fetch integrations from API
  const { data: integrations, isLoading, refetch } = useQuery({
    queryKey: ['/api/system/integrations'],
  });
  
  // Create form
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationFormSchema),
    defaultValues: editingIntegration || {
      name: "",
      type: "",
      url: "",
      status: "inactive",
      isEnabled: false,
    },
  });
  
  // Save integration mutation
  const saveIntegrationMutation = useMutation({
    mutationFn: async (data: IntegrationFormValues) => {
      const res = await apiRequest(
        editingIntegration ? "PUT" : "POST", 
        `/api/system/integrations${editingIntegration ? `/${editingIntegration.name}` : ''}`, 
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: `Integration ${editingIntegration ? "updated" : "created"}`,
        description: `The integration has been ${editingIntegration ? "updated" : "created"} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/integrations'] });
      setEditingIntegration(null);
      setShowAddForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: `Error ${editingIntegration ? "updating" : "creating"} integration`,
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("DELETE", `/api/system/integrations/${name}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration deleted",
        description: "The integration has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/integrations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Test integration mutation
  const testIntegrationMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/system/integrations/${name}/test`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Integration test completed",
        description: data.success 
          ? "The integration test was successful." 
          : `Test failed: ${data.message}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error testing integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: IntegrationFormValues) => {
    saveIntegrationMutation.mutate(data);
  };
  
  // Edit integration
  const handleEdit = (integration: IntegrationFormValues) => {
    setEditingIntegration(integration);
    form.reset(integration);
    setShowAddForm(true);
  };
  
  // Delete integration
  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete the integration "${name}"?`)) {
      deleteIntegrationMutation.mutate(name);
    }
  };
  
  // Test integration
  const handleTest = (name: string) => {
    testIntegrationMutation.mutate(name);
  };
  
  // Add new integration
  const handleAddNew = () => {
    setEditingIntegration(null);
    form.reset({
      name: "",
      type: "",
      url: "",
      status: "inactive",
      isEnabled: false,
    });
    setShowAddForm(true);
  };
  
  // Get icon for integration type
  const getIntegrationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'github':
        return <Github className="h-5 w-5" />;
      case 'gitlab':
        return <Gitlab className="h-5 w-5" />;
      case 'slack':
        return <Slack className="h-5 w-5" />;
      case 'webhook':
        return <Webhook className="h-5 w-5" />;
      case 'datadog':
      case 'prometheus':
        return <BarChart className="h-5 w-5" />;
      case 'database':
        return <Database className="h-5 w-5" />;
      default:
        return <Plug className="h-5 w-5" />;
    }
  };
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader 
        heading="Integrations" 
        text="Manage external system integrations and connections."
      >
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </DashboardHeader>
      
      <Tabs defaultValue="all-integrations" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all-integrations">All Integrations</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          {showAddForm && <TabsTrigger value="add-integration">
            {editingIntegration ? 'Edit Integration' : 'Add Integration'}
          </TabsTrigger>}
        </TabsList>
        
        <TabsContent value="all-integrations" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !integrations || integrations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Integrations Found</CardTitle>
                <CardDescription>
                  No external system integrations have been configured yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleAddNew}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Your First Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration: IntegrationFormValues) => (
                <Card key={integration.name} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                      {getIntegrationIcon(integration.type)}
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-1">
                      {integration.status === "active" ? (
                        <span className="flex items-center text-xs font-medium text-green-600 dark:text-green-500">
                          <span className="flex h-2 w-2 rounded-full bg-green-600 dark:bg-green-500 mr-1"></span>
                          Active
                        </span>
                      ) : integration.status === "error" ? (
                        <span className="flex items-center text-xs font-medium text-red-600 dark:text-red-500">
                          <span className="flex h-2 w-2 rounded-full bg-red-600 dark:bg-red-500 mr-1"></span>
                          Error
                        </span>
                      ) : (
                        <span className="flex items-center text-xs font-medium text-gray-500">
                          <span className="flex h-2 w-2 rounded-full bg-gray-500 mr-1"></span>
                          Inactive
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Type:</span> {integration.type}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mb-2">
                      <span className="font-medium">URL:</span> {integration.url}
                    </div>
                    {integration.version && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">Version:</span> {integration.version}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-muted/50 pt-2 pb-2 px-6 flex justify-between">
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(integration)}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleTest(integration.name)}
                        disabled={testIntegrationMutation.isPending}
                      >
                        {testIntegrationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(integration.name)}
                      disabled={deleteIntegrationMutation.isPending}
                    >
                      {deleteIntegrationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations && integrations
              .filter((i: IntegrationFormValues) => i.status === "active")
              .map((integration: IntegrationFormValues) => (
                <Card key={integration.name} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                      {getIntegrationIcon(integration.type)}
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                    <span className="flex items-center text-xs font-medium text-green-600 dark:text-green-500">
                      <span className="flex h-2 w-2 rounded-full bg-green-600 dark:bg-green-500 mr-1"></span>
                      Active
                    </span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Type:</span> {integration.type}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mb-2">
                      <span className="font-medium">URL:</span> {integration.url}
                    </div>
                    {integration.version && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">Version:</span> {integration.version}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-muted/50 pt-2 pb-2 px-6 flex justify-between">
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(integration)}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleTest(integration.name)}
                        disabled={testIntegrationMutation.isPending}
                      >
                        {testIntegrationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(integration.name)}
                      disabled={deleteIntegrationMutation.isPending}
                    >
                      {deleteIntegrationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </CardFooter>
                </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="inactive" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations && integrations
              .filter((i: IntegrationFormValues) => i.status !== "active")
              .map((integration: IntegrationFormValues) => (
                <Card key={integration.name} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                      {getIntegrationIcon(integration.type)}
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                    {integration.status === "error" ? (
                      <span className="flex items-center text-xs font-medium text-red-600 dark:text-red-500">
                        <span className="flex h-2 w-2 rounded-full bg-red-600 dark:bg-red-500 mr-1"></span>
                        Error
                      </span>
                    ) : (
                      <span className="flex items-center text-xs font-medium text-gray-500">
                        <span className="flex h-2 w-2 rounded-full bg-gray-500 mr-1"></span>
                        Inactive
                      </span>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Type:</span> {integration.type}
                    </div>
                    <div className="text-sm text-muted-foreground truncate mb-2">
                      <span className="font-medium">URL:</span> {integration.url}
                    </div>
                    {integration.version && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium">Version:</span> {integration.version}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-muted/50 pt-2 pb-2 px-6 flex justify-between">
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEdit(integration)}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleTest(integration.name)}
                        disabled={testIntegrationMutation.isPending}
                      >
                        {testIntegrationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(integration.name)}
                      disabled={deleteIntegrationMutation.isPending}
                    >
                      {deleteIntegrationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </CardFooter>
                </Card>
            ))}
          </div>
        </TabsContent>
        
        {showAddForm && (
          <TabsContent value="add-integration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingIntegration ? 'Edit Integration' : 'Add New Integration'}</CardTitle>
                <CardDescription>
                  {editingIntegration 
                    ? 'Update the integration details below' 
                    : 'Configure a new external system integration'}
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
                              <Input 
                                placeholder="Enter integration name" 
                                {...field} 
                                disabled={!!editingIntegration}
                              />
                            </FormControl>
                            <FormDescription>
                              A unique name to identify this integration
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
                            <FormLabel>Integration Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select integration type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="github">GitHub</SelectItem>
                                <SelectItem value="gitlab">GitLab</SelectItem>
                                <SelectItem value="slack">Slack</SelectItem>
                                <SelectItem value="jira">Jira</SelectItem>
                                <SelectItem value="confluence">Confluence</SelectItem>
                                <SelectItem value="webhook">Webhook</SelectItem>
                                <SelectItem value="prometheus">Prometheus</SelectItem>
                                <SelectItem value="datadog">Datadog</SelectItem>
                                <SelectItem value="database">Database</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The type of external system to integrate with
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Integration URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://api.example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            The base URL for the integration API
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
                          <FormLabel>API Key / Token</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter API key or token" {...field} type="password" />
                          </FormControl>
                          <FormDescription>
                            Authentication token for the integration (securely stored)
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
                              Enable Integration
                            </FormLabel>
                            <FormDescription>
                              Toggle to enable or disable this integration
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
                    
                    <div className="flex justify-end space-x-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowAddForm(false);
                          setActiveTab("all-integrations");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={saveIntegrationMutation.isPending}
                      >
                        {saveIntegrationMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            {editingIntegration ? 'Update' : 'Save'}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}