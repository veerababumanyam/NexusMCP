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
import { ServerDetailsModal } from "@/components/server/server-details-modal";
import { Loader2, Server, Edit, RefreshCw, Plus, Trash2 } from "lucide-react";
import {
  getServerStatuses,
  getWorkspaces,
  createServer,
  connectServer,
  disconnectServer,
} from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

// Form validation schema
const serverFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  url: z.string().url("Must be a valid URL"),
  apiKey: z.string().min(1, "API key is required"),
  type: z.string().min(1, "Type is required"),
  workspaceId: z.coerce.number().min(1, "Workspace is required"),
  status: z.string().default("inactive"),
  version: z.string().optional(),
  config: z.any().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

export default function ServersPage() {
  const { toast } = useToast();
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedServer, setSelectedServer] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [processingServerId, setProcessingServerId] = useState<number | null>(
    null
  );

  // Fetch server statuses
  const {
    data: servers,
    isLoading: isLoadingServers,
    refetch: refetchServers,
  } = useQuery({
    queryKey: ["/api/mcp-servers/status"],
    queryFn: getServerStatuses,
  });

  // Fetch workspaces for the form
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: getWorkspaces,
  });

  // Create new server mutation
  const createServerMutation = useMutation({
    mutationFn: createServer,
    onSuccess: () => {
      toast({
        title: "Server created",
        description: "The MCP server has been created successfully",
      });
      setIsAddServerOpen(false);
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: "Failed to create server",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Connect server mutation
  const connectServerMutation = useMutation({
    mutationFn: connectServer,
    onSuccess: () => {
      toast({
        title: "Server connected",
        description: "The MCP server has been connected successfully",
      });
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: "Failed to connect server",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProcessingServerId(null);
    },
  });

  // Disconnect server mutation
  const disconnectServerMutation = useMutation({
    mutationFn: disconnectServer,
    onSuccess: () => {
      toast({
        title: "Server disconnected",
        description: "The MCP server has been disconnected successfully",
      });
      refetchServers();
    },
    onError: (error) => {
      toast({
        title: "Failed to disconnect server",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProcessingServerId(null);
    },
  });

  // Server form definition
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      url: "",
      apiKey: "",
      type: "primary",
      status: "inactive",
      version: "",
    },
  });

  // Form submission handler
  const onSubmit = (data: ServerFormValues) => {
    createServerMutation.mutate(data);
  };

  // Refresh server data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetchServers();
    } catch (error) {
      console.error("Error refreshing server data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle view server details
  const handleViewServer = (server: any) => {
    setSelectedServer(server);
    setIsDetailsModalOpen(true);
  };

  // Handle server connection toggle
  const handleToggleConnection = async (server: any) => {
    setProcessingServerId(server.id);
    
    if (server.status === "connected") {
      disconnectServerMutation.mutate(server.id);
    } else {
      connectServerMutation.mutate(server.id);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "connected":
      case "healthy":
        return "bg-success/10 text-success";
      case "warning":
      case "issues":
        return "bg-warning/10 text-warning";
      case "error":
      case "disconnected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <>
      <DashboardHeader
        title="MCP Servers"
        subtitle="Manage and monitor your MCP servers"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      <div className="flex justify-end mb-6">
        <Button
          onClick={() => setIsAddServerOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add MCP Server
        </Button>
      </div>

      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">MCP Servers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingServers || isRefreshing ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">
                          Loading servers...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : servers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <Server className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">
                          No servers found
                        </span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddServerOpen(true)}
                          className="mt-2"
                        >
                          Add your first MCP server
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers?.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white">
                            <Server className="h-4 w-4" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium">
                              {server.name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{server.url}</TableCell>
                      <TableCell className="text-sm">{server.type}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            server.status
                          )}`}
                        >
                          {getStatusLabel(server.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {workspaces?.find((w) => w.id === server.workspaceId)
                          ?.name || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewServer(server)}
                            title="View Details"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4 text-primary hover:text-primary/80"
                            >
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Server"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant={
                              server.status === "connected"
                                ? "ghost-destructive"
                                : "ghost-success"
                            }
                            size="icon"
                            onClick={() => handleToggleConnection(server)}
                            disabled={processingServerId === server.id}
                            title={
                              server.status === "connected"
                                ? "Disconnect"
                                : "Connect"
                            }
                          >
                            {processingServerId === server.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : server.status === "connected" ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 text-destructive"
                              >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 text-success"
                              >
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                              </svg>
                            )}
                          </Button>
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
            {servers?.length ? (
              <>
                Total: <span className="font-medium">{servers.length}</span> MCP
                servers
              </>
            ) : null}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </CardFooter>
      </Card>

      {/* Add Server Dialog */}
      <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
            <DialogDescription>
              Add a new MCP server to your NexusMCP platform.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Production-MCP-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://mcp-server.example.com"
                        {...field}
                      />
                    </FormControl>
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
                      <Input placeholder="Enter API Key" {...field} />
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
                    <FormLabel>Server Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select server type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="testing">Testing</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workspaceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingWorkspaces ? (
                          <div className="flex justify-center items-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          workspaces?.map((workspace) => (
                            <SelectItem
                              key={workspace.id}
                              value={workspace.id.toString()}
                            >
                              {workspace.name}
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
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2.4.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddServerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createServerMutation.isPending}
                >
                  {createServerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Server"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Server Details Modal */}
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </>
  );
}
