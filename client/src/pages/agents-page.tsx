import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  Box, 
  Plus, 
  Settings,
  Search,
  MoreHorizontal,
  RefreshCw,
  Play,
  Trash2,
  ArrowDownToLine,
  ShieldAlert,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function AgentsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  
  // Fetch agents
  const {
    data: agents,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error("Failed to fetch agents");
        return res.json();
      } catch (error) {
        console.error("Error fetching agents:", error);
        return [];
      }
    },
  });

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Agents refreshed",
        description: "Agent registry has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing agents:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh agent registry.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter agents based on search query
  const filteredAgents = agents?.filter((agent: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.agentType.toLowerCase().includes(query)
    );
  });
  
  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
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
  
  // Get type badge class
  const getTypeBadgeClass = (type: string) => {
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

  return (
    <>
      <DashboardHeader
        title="Agent Registry"
        subtitle="Manage and monitor MCP agent registrations"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {hasPermission('agents:create') && (
          <Button
            onClick={() => setIsAddAgentOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Register Agent
          </Button>
        )}
      </div>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Agent Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading agents...
              </span>
            </div>
          ) : filteredAgents?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Box className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                {searchQuery ? "No agents match your search" : "No agents found"}
              </span>
              {!searchQuery && (
                <Button
                  variant="link"
                  onClick={() => setIsAddAgentOpen(true)}
                  className="mt-2"
                >
                  Register your first agent
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredAgents?.map((agent: any) => (
                <div key={agent.id} className="p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Box className="h-5 w-5 text-primary" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-base font-medium flex items-center">
                          {agent.name}
                          {agent.implementsA2A && (
                            <Badge variant="outline" className="ml-2 text-xs py-0">
                              A2A
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">{agent.description || "No description"}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeClass(
                          agent.agentType
                        )}`}
                      >
                        {agent.agentType}
                      </span>
                      
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          agent.status
                        )}`}
                      >
                        {agent.status}
                      </span>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              toast({
                                title: "Viewing agent details",
                                description: `Viewing details for ${agent.name}`
                              });
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {hasPermission('agents:execute') && (
                            <DropdownMenuItem
                              onClick={() => {
                                toast({
                                  title: "Executing agent",
                                  description: `Executing ${agent.name}`
                                });
                              }}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Execute
                            </DropdownMenuItem>
                          )}
                          {hasPermission('agents:manage') && (
                            <DropdownMenuItem
                              onClick={() => {
                                toast({
                                  title: "Regenerating API key",
                                  description: `Regenerating API key for ${agent.name}`
                                });
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate API Key
                            </DropdownMenuItem>
                          )}
                          {hasPermission('agents:delete') && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                toast({
                                  title: "Deleting agent",
                                  description: `Deleting ${agent.name}`
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Version:</span>{" "}
                      <span className="font-medium">{agent.version}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registration:</span>{" "}
                      <span className="font-medium">{new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">A2A Support:</span>{" "}
                      <span className="font-medium flex items-center">
                        {agent.implementsA2A ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 text-success mr-1" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                            Disabled
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {agent.metadata?.capabilities && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {agent.metadata.capabilities.map((capability: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6">
          <div className="text-sm text-muted-foreground">
            {filteredAgents?.length ? (
              <>
                Total: <span className="font-medium">{filteredAgents.length}</span> agents
                {searchQuery && agents?.length !== filteredAgents.length && (
                  <> (filtered from {agents.length})</>
                )}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>
      
      {/* Register Agent Dialog */}
      <Dialog open={isAddAgentOpen} onOpenChange={setIsAddAgentOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register Agent</DialogTitle>
            <DialogDescription>
              Register a new agent for MCP integration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center justify-center py-6 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <ArrowDownToLine className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium mb-1">Upload Agent Definition</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop, or click to select
                </p>
                <Button variant="outline" size="sm">
                  Select File
                </Button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center space-x-2">
              <div className="h-px flex-1 bg-border"></div>
              <span className="text-sm text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border"></div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button variant="outline" className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                Import from Registry
              </Button>
              
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Manual Setup
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddAgentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsAddAgentOpen(false);
              toast({
                title: "Agent registered",
                description: "New agent has been registered successfully."
              });
              // In a real implementation, we would add the agent to the database
              refreshData();
            }}>
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}