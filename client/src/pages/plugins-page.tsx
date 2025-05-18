import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  Package, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Settings,
  Check,
  X,
  AlertTriangle,
  FileCode,
  Upload,
  Download,
  Code,
  RefreshCcw,
  Info,
  Play
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Plugin Form Schema
const pluginFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in the format X.Y.Z"),
  packageUrl: z.string().url("Please enter a valid package URL"),
  configuration: z.string().optional(),
  isEnabled: z.boolean().default(true),
  autoUpdate: z.boolean().default(false),
});

type PluginFormValues = z.infer<typeof pluginFormSchema>;

// API functions
async function getPlugins() {
  const res = await apiRequest("GET", "/api/plugins");
  return await res.json();
}

async function getPluginById(id: number) {
  const res = await apiRequest("GET", `/api/plugins/${id}`);
  return await res.json();
}

async function installPlugin(data: PluginFormValues) {
  const res = await apiRequest("POST", "/api/plugins", data);
  return await res.json();
}

async function updatePlugin(id: number, data: Partial<PluginFormValues>) {
  const res = await apiRequest("PUT", `/api/plugins/${id}`, data);
  return await res.json();
}

async function togglePlugin(id: number, isEnabled: boolean) {
  const res = await apiRequest("PATCH", `/api/plugins/${id}/toggle`, { isEnabled });
  return await res.json();
}

async function deletePlugin(id: number) {
  const res = await apiRequest("DELETE", `/api/plugins/${id}`);
  return await res.json();
}

export default function PluginsPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isAddPluginOpen, setIsAddPluginOpen] = useState(false);
  const [isViewPluginOpen, setIsViewPluginOpen] = useState(false);
  const [selectedPluginId, setSelectedPluginId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("");

  // Fetch plugins
  const {
    data: plugins,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/plugins"],
    queryFn: getPlugins,
  });

  // Fetch selected plugin details
  const {
    data: selectedPlugin,
    isLoading: isLoadingSelectedPlugin,
  } = useQuery({
    queryKey: ["/api/plugins", selectedPluginId],
    queryFn: () => getPluginById(selectedPluginId as number),
    enabled: !!selectedPluginId,
  });

  // Install plugin mutation
  const installPluginMutation = useMutation({
    mutationFn: installPlugin,
    onSuccess: () => {
      toast({
        title: "Plugin installed",
        description: "The plugin has been installed successfully",
      });
      setIsAddPluginOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to install plugin",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Toggle plugin mutation
  const togglePluginMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) => 
      togglePlugin(id, isEnabled),
    onSuccess: () => {
      toast({
        title: "Plugin updated",
        description: "The plugin status has been updated successfully",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to update plugin",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete plugin mutation
  const deletePluginMutation = useMutation({
    mutationFn: (id: number) => deletePlugin(id),
    onSuccess: () => {
      toast({
        title: "Plugin deleted",
        description: "The plugin has been deleted successfully",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete plugin",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Form setup
  const form = useForm<PluginFormValues>({
    resolver: zodResolver(pluginFormSchema),
    defaultValues: {
      name: "",
      description: "",
      version: "1.0.0",
      packageUrl: "",
      configuration: "{}",
      isEnabled: true,
      autoUpdate: false,
    },
  });

  // Form submission handler
  const onSubmit = (data: PluginFormValues) => {
    // Ensure JSON is valid
    try {
      if (data.configuration) {
        JSON.parse(data.configuration);
      }
      installPluginMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please provide valid JSON for the configuration",
        variant: "destructive",
      });
    }
  };

  // Handle plugin toggle
  const handleTogglePlugin = (id: number, isEnabled: boolean) => {
    togglePluginMutation.mutate({ id, isEnabled: !isEnabled });
  };

  // Handle plugin delete
  const handleDeletePlugin = (id: number) => {
    if (confirm("Are you sure you want to delete this plugin? This action cannot be undone.")) {
      deletePluginMutation.mutate(id);
    }
  };

  // Handle view plugin details
  const handleViewPlugin = (id: number) => {
    setSelectedPluginId(id);
    setIsViewPluginOpen(true);
  };

  // Refresh plugin data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Plugin data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh plugin data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter plugins by name or description
  const filteredPlugins = plugins?.filter(plugin => {
    if (!filter) return true;
    
    const searchTerm = filter.toLowerCase();
    return (
      plugin.name.toLowerCase().includes(searchTerm) ||
      (plugin.description && plugin.description.toLowerCase().includes(searchTerm))
    );
  });

  const getPluginStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success">Active</Badge>;
      case "disabled":
        return <Badge className="bg-muted text-muted-foreground">Disabled</Badge>;
      case "error":
        return <Badge className="bg-destructive/10 text-destructive">Error</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <DashboardHeader
        title="Plugins"
        subtitle="Extend functionality with third-party plugins and integrations"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search plugins..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
          <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        
        {hasPermission('plugins:create') && (
          <Button
            onClick={() => setIsAddPluginOpen(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Install Plugin
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Installed Plugins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto Update</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">
                          Loading plugins...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPlugins?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No plugins found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddPluginOpen(true)}
                          className="mt-2"
                        >
                          Install your first plugin
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlugins?.map((plugin) => (
                    <TableRow key={plugin.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="ml-3">
                            <div className="font-medium">{plugin.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {plugin.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        v{plugin.version}
                      </TableCell>
                      <TableCell>
                        {getPluginStatusBadge(plugin.isEnabled ? "active" : "disabled")}
                      </TableCell>
                      <TableCell>
                        {plugin.autoUpdate ? (
                          <Badge className="bg-primary/10 text-primary">Enabled</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {hasPermission('plugins:view') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Details"
                              onClick={() => handleViewPlugin(plugin.id)}
                            >
                              <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          {hasPermission('plugins:toggle') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={plugin.isEnabled ? "Disable Plugin" : "Enable Plugin"}
                              onClick={() => handleTogglePlugin(plugin.id, plugin.isEnabled)}
                              disabled={togglePluginMutation.isPending}
                            >
                              {plugin.isEnabled ? (
                                <PowerOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              ) : (
                                <Power className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </Button>
                          )}
                          {hasPermission('plugins:delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Plugin"
                              onClick={() => handleDeletePlugin(plugin.id)}
                              disabled={deletePluginMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {filteredPlugins?.length ? (
              <>
                {filter ? (
                  <>
                    Showing <span className="font-medium">{filteredPlugins.length}</span> of{" "}
                    <span className="font-medium">{plugins?.length}</span> plugins
                  </>
                ) : (
                  <>
                    Total: <span className="font-medium">{plugins?.length}</span> plugins
                  </>
                )}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {/* Install Plugin Dialog */}
      <Dialog open={isAddPluginOpen} onOpenChange={setIsAddPluginOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Install Plugin</DialogTitle>
            <DialogDescription>
              Install a new plugin to extend functionality
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plugin Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Analytics Connector" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1.0.0" {...field} />
                      </FormControl>
                      <FormDescription>
                        Semantic version in X.Y.Z format
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter a description for this plugin"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="packageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/plugins/my-plugin.zip" 
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      URL to the plugin package (ZIP file)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Plugin</FormLabel>
                        <FormDescription>
                          Activate plugin after installation
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
                  name="autoUpdate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Auto Update</FormLabel>
                        <FormDescription>
                          Automatically update to new versions
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
              </div>
              
              <FormField
                control={form.control}
                name="configuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Configuration (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm"
                        rows={8}
                        placeholder="Enter plugin configuration as JSON"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional JSON configuration for the plugin
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPluginOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={installPluginMutation.isPending}
                >
                  {installPluginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Install Plugin
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Plugin Dialog */}
      <Dialog open={isViewPluginOpen} onOpenChange={setIsViewPluginOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Plugin Details</DialogTitle>
            <DialogDescription>
              View detailed information about this plugin
            </DialogDescription>
          </DialogHeader>
          {isLoadingSelectedPlugin ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedPlugin ? (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
                    <p className="text-sm font-medium">{selectedPlugin.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Version</h3>
                    <p className="text-sm font-mono">{selectedPlugin.version}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                    <div className="mt-1">
                      {getPluginStatusBadge(selectedPlugin.isEnabled ? "active" : "disabled")}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Auto Update</h3>
                    <div className="mt-1">
                      {selectedPlugin.autoUpdate ? (
                        <Badge className="bg-primary/10 text-primary">Enabled</Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">Disabled</Badge>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                    <p className="text-sm mt-1">{selectedPlugin.description || "No description provided"}</p>
                  </div>
                  <div className="col-span-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Package URL</h3>
                    <p className="text-sm mt-1 break-all">{selectedPlugin.packageUrl}</p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Plugin Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground">Author</h4>
                      <p className="text-sm">{selectedPlugin.author || "Unknown"}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground">License</h4>
                      <p className="text-sm">{selectedPlugin.license || "Unknown"}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground">Size</h4>
                      <p className="text-sm">{formatBytes(selectedPlugin.size || 0)}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground">Installed On</h4>
                      <p className="text-sm">{new Date(selectedPlugin.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground">Last Updated</h4>
                      <p className="text-sm">{new Date(selectedPlugin.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsViewPluginOpen(false)}
                  >
                    Close
                  </Button>
                  {hasPermission('plugins:toggle') && (
                    <Button
                      variant={selectedPlugin.isEnabled ? "outline" : "default"}
                      className="flex items-center gap-2"
                      onClick={() => {
                        handleTogglePlugin(selectedPlugin.id, selectedPlugin.isEnabled);
                        setIsViewPluginOpen(false);
                      }}
                    >
                      {selectedPlugin.isEnabled ? (
                        <>
                          <PowerOff className="h-4 w-4" />
                          Disable Plugin
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4" />
                          Enable Plugin
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="configuration" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Plugin Configuration</CardTitle>
                    <CardDescription>
                      JSON configuration for this plugin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs font-mono">
                      {JSON.stringify(selectedPlugin.configuration || {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsViewPluginOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Plugin Logs</CardTitle>
                    <CardDescription>
                      Recent activity and error logs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedPlugin.logs && selectedPlugin.logs.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {selectedPlugin.logs.map((log, index) => (
                          <div 
                            key={index} 
                            className={`p-2 rounded-md text-xs font-mono ${
                              log.level === 'error' ? 'bg-destructive/10 text-destructive' :
                              log.level === 'warn' ? 'bg-warning/10 text-warning' :
                              'bg-muted'
                            }`}
                          >
                            <div className="flex justify-between">
                              <span className="font-semibold">[{log.level.toUpperCase()}]</span>
                              <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="mt-1">{log.message}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Info className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No logs available for this plugin</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsViewPluginOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-warning mb-2" />
              <p>Plugin details not available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}