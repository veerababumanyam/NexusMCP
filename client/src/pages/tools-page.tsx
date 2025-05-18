import { useState, useEffect } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Plus, 
  Wrench, 
  Edit, 
  Trash2, 
  Play, 
  Code,
  Check,
  CircleAlert,
  Settings2,
  PenLine,
  Terminal,
  AlertCircle,
  RefreshCw,
  Server
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { ToolExecutionDialog } from "@/components/tools/tool-execution-dialog";
import { WebSocketTestPanel } from "@/components/tools/websocket-test-panel";
import { mcpClient as mcpWebSocketClient } from "@/lib/mcpWebsocketClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Form validation schema
const toolFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  schema: z.string(),
  serverId: z.coerce.number().min(1, "Server is required"),
  type: z.string().default("custom"),
  status: z.string().default("active"),
});

type ToolFormValues = z.infer<typeof toolFormSchema>;

// Mock API functions (replace with actual API calls)
async function getTools() {
  const res = await apiRequest("GET", "/api/tools");
  return await res.json();
}

async function getServers() {
  const res = await apiRequest("GET", "/api/mcp-servers");
  return await res.json();
}

async function createTool(data: ToolFormValues) {
  const res = await apiRequest("POST", "/api/tools", data);
  return await res.json();
}

export default function ToolsPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string>("{}");
  const [isExecuteToolOpen, setIsExecuteToolOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [serverStatuses, setServerStatuses] = useState<any[]>([]);
  const [isViewSchemaOpen, setIsViewSchemaOpen] = useState(false);
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Set up server status listener using the subscribe method
    const unsubscribe = mcpWebSocketClient.subscribe((event) => {
      if (event.type === 'status_update') {
        console.log('[Tools Page] Received server status update:', event.servers);
        setServerStatuses(event.servers);
      } else if (event.type === 'connected') {
        console.log('[Tools Page] MCP WebSocket connected successfully');
        // Request an immediate status update upon connection
        mcpWebSocketClient.send({ type: 'status_request' });
      } else if (event.type === 'disconnected') {
        console.log(`[Tools Page] MCP WebSocket disconnected: code=${event.code}, reason=${event.reason}`);
      } else if (event.type === 'error') {
        console.error('[Tools Page] MCP WebSocket error:', event.error);
      }
    });
    
    // Connect to WebSocket if not already connected
    if (!mcpWebSocketClient.isConnected()) {
      console.log('[Tools Page] Initiating MCP WebSocket connection');
      mcpWebSocketClient.connect();
    } else {
      console.log('[Tools Page] MCP WebSocket already connected');
      // Request a status update even if already connected
      mcpWebSocketClient.send({ type: 'status_request' });
    }
    
    return () => {
      // Clean up subscription when component unmounts
      if (unsubscribe) {
        console.log('[Tools Page] Unsubscribing from MCP WebSocket events');
        unsubscribe();
      }
    };
  }, []);

  // Fetch tools
  const {
    data: tools,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/tools"],
    queryFn: getTools,
  });

  // Fetch servers for dropdown
  const {
    data: servers,
    isLoading: isLoadingServers,
  } = useQuery({
    queryKey: ["/api/mcp-servers"],
    queryFn: getServers,
  });

  // Create new tool mutation
  const createToolMutation = useMutation({
    mutationFn: createTool,
    onSuccess: () => {
      toast({
        title: "Tool created",
        description: "The tool has been created successfully",
      });
      setIsAddToolOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to create tool",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Tool form definition
  const form = useForm<ToolFormValues>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      name: "",
      description: "",
      schema: "{}",
      serverId: undefined,
      type: "custom",
      status: "active",
    },
  });

  // Form submission handler
  const onSubmit = (data: ToolFormValues) => {
    try {
      // Ensure the schema is valid JSON
      JSON.parse(data.schema);
      createToolMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON Schema",
        description: "Please provide a valid JSON schema",
        variant: "destructive",
      });
    }
  };

  // Refresh tool data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Tool data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh tool data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    if (!status) return "bg-muted text-muted-foreground";
    
    switch (status) {
      case "active":
        return "bg-success/10 text-success";
      case "inactive":
        return "bg-muted text-muted-foreground";
      case "error":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeBadgeClass = (type?: string) => {
    if (!type) return "bg-muted text-muted-foreground";
    
    switch (type) {
      case "core":
        return "bg-primary/10 text-primary";
      case "custom":
        return "bg-secondary/10 text-secondary";
      case "plugin":
        return "bg-violet-600/10 text-violet-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Format server name from ID
  const getServerName = (serverId?: number) => {
    if (!serverId) return "Unknown Server";
    const server = servers?.find(s => s.id === serverId);
    return server ? server.name : `Server #${serverId}`;
  };

  // JSON schema templates
  const schemaTemplates = {
    basic: JSON.stringify({
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Input text to process"
        }
      },
      required: ["input"]
    }, null, 2),
    advanced: JSON.stringify({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query to execute"
        },
        options: {
          type: "object",
          properties: {
            maxResults: {
              type: "integer",
              description: "Maximum number of results to return",
              default: 10
            },
            filters: {
              type: "array",
              items: {
                type: "string"
              },
              description: "List of filters to apply"
            }
          }
        }
      },
      required: ["query"]
    }, null, 2)
  };

  return (
    <>
      <DashboardHeader
        title="AI Tools"
        subtitle="Manage your Model Context Protocol tools and integrations"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex justify-end mb-6">
        {hasPermission('tools:create') && (
          <Button
            onClick={() => setIsAddToolOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Tool
          </Button>
        )}
      </div>

      <Tabs defaultValue="tools" className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tools">Available Tools</TabsTrigger>
          <TabsTrigger value="diagnostics">WebSocket Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tools">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Available Tools</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">
                          Loading tools...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tools?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Wrench className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No tools found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddToolOpen(true)}
                          className="mt-2"
                        >
                          Add your first tool
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tools?.map((tool) => (
                    <TableRow key={tool.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white">
                            <Wrench className="h-4 w-4" />
                          </div>
                          <span className="ml-3 font-medium">
                            {tool.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {tool.description || "N/A"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeClass(
                            tool.type
                          )}`}
                        >
                          {tool.type && typeof tool.type === 'string' 
                            ? tool.type.charAt(0).toUpperCase() + tool.type.slice(1)
                            : 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getServerName(tool.serverId)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            tool.status
                          )}`}
                        >
                          {tool.status && typeof tool.status === 'string'
                            ? tool.status.charAt(0).toUpperCase() + tool.status.slice(1)
                            : 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {hasPermission('tools:execute') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedTool(tool);
                                      setIsExecuteToolOpen(true);
                                    }}
                                  >
                                    <Play className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Execute Tool</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {hasPermission('tools:edit') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                  >
                                    <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Tool</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {hasPermission('tools:view') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedTool(tool);
                                      setSelectedSchema(JSON.stringify(tool.metadata, null, 2));
                                      setIsViewSchemaOpen(true);
                                    }}
                                  >
                                    <Code className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Schema</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {hasPermission('tools:delete') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={tool.type === "core"}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete Tool</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
            {tools?.length ? (
              <>
                Total: <span className="font-medium">{tools.length}</span>{" "}
                tools
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>
        </TabsContent>
        
        <TabsContent value="diagnostics">
          {hasPermission('admin') ? (
            <WebSocketTestPanel />
          ) : (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Admin Access Required</h3>
                <p className="text-muted-foreground max-w-md">
                  The WebSocket diagnostics panel requires administrator permissions.
                  Please contact your system administrator for access.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Tool Dialog */}
      <Dialog open={isAddToolOpen} onOpenChange={setIsAddToolOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Tool</DialogTitle>
            <DialogDescription>
              Create a new Model Context Protocol tool for integration.
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
                      <FormLabel>Tool Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Document Search" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="plugin">Plugin</SelectItem>
                        </SelectContent>
                      </Select>
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
                        placeholder="Enter a description for this tool"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MCP Server</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select server" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingServers ? (
                            <div className="flex justify-center items-center py-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            servers?.map((server) => (
                              <SelectItem
                                key={server.id}
                                value={server.id.toString()}
                              >
                                {server.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="schema"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>JSON Schema</FormLabel>
                    <div className="mb-2 flex space-x-2">
                      <Select
                        onValueChange={(value) => {
                          const template = schemaTemplates[value as keyof typeof schemaTemplates];
                          setSelectedSchema(template);
                          field.onChange(template);
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Schema templates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic Template</SelectItem>
                          <SelectItem value="advanced">Advanced Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm"
                        rows={10}
                        placeholder="Enter JSON schema for the tool"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddToolOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createToolMutation.isPending}
                >
                  {createToolMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Tool"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Tool Execution Dialog */}
      {selectedTool && (
        <ToolExecutionDialog
          open={isExecuteToolOpen}
          onOpenChange={setIsExecuteToolOpen}
          tool={selectedTool}
          serverId={selectedTool.serverId}
        />
      )}
      
      {/* View Schema Dialog */}
      <Dialog open={isViewSchemaOpen} onOpenChange={setIsViewSchemaOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tool Schema: {selectedTool?.name}</DialogTitle>
            <DialogDescription>
              JSON Schema definition for tool inputs and parameters
            </DialogDescription>
          </DialogHeader>
          
          <Card>
            <CardContent className="p-4">
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[60vh] text-sm font-mono">
                {selectedSchema}
              </pre>
            </CardContent>
          </Card>
          
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setIsViewSchemaOpen(false)}
            >
              Close
            </Button>
            {selectedTool && (
              <Button 
                onClick={() => {
                  setIsViewSchemaOpen(false);
                  setIsExecuteToolOpen(true);
                }}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Execute Tool
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}