import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Plus, Bot, Activity, Play, History, 
  Search, Settings, Cpu, Network, RotateCcw, 
  CheckCircle2, XCircle, AlertCircle, Clock, Hourglass 
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Define Agent type (matching server-side schema)
interface Agent {
  id: number;
  name: string;
  type: string;
  description: string | null;
  capabilities: string[];
  status: string;
  workspaceId: number | null;
  createdAt: string;
  updatedAt: string;
}

// Define Flow type (matching server-side schema)
interface Flow {
  id: number;
  name: string;
  description: string | null;
  definition: any;
  status: string;
  workspaceId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// Define Execution type (matching server-side schema)
interface Execution {
  id: number;
  flowId: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  result: any;
  error: string | null;
  initiatedBy: number | null;
  workspaceId: number | null;
}

// API functions
async function getAgents() {
  try {
    const response = await apiRequest("GET", "/api/a2a/agents");
    return await response.json() as Agent[];
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw new Error("Failed to fetch agents");
  }
}

async function getFlows() {
  try {
    const response = await apiRequest("GET", "/api/a2a/flows");
    return await response.json() as Flow[];
  } catch (error) {
    console.error("Error fetching flows:", error);
    throw new Error("Failed to fetch flows");
  }
}

async function executeFlow(flowId: number) {
  try {
    const response = await apiRequest("POST", `/api/a2a/flows/${flowId}/execute`);
    return await response.json() as Execution;
  } catch (error) {
    console.error(`Error executing flow ${flowId}:`, error);
    throw new Error("Failed to execute flow");
  }
}

// Get executions for a specific flow
async function getExecutions(flowId: number) {
  try {
    const response = await apiRequest("GET", `/api/a2a/flows/${flowId}/executions`);
    return await response.json() as Execution[];
  } catch (error) {
    console.error(`Error fetching executions for flow ${flowId}:`, error);
    throw new Error("Failed to fetch executions");
  }
}

export default function A2AOrchestrationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("agents");
  const [agentFilter, setAgentFilter] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  
  // Fetch agents
  const {
    data: agents,
    isLoading: agentsLoading,
    refetch: refetchAgents
  } = useQuery({
    queryKey: ["/api/a2a/agents"],
    queryFn: getAgents
  });
  
  // Fetch flows
  const {
    data: flows,
    isLoading: flowsLoading,
    refetch: refetchFlows
  } = useQuery({
    queryKey: ["/api/a2a/flows"],
    queryFn: getFlows
  });
  
  // Fetch executions for a specific flow
  const {
    data: executions,
    isLoading: executionsLoading,
    refetch: refetchExecutions
  } = useQuery({
    queryKey: ["/api/a2a/flows", selectedFlowId, "executions"],
    queryFn: () => selectedFlowId ? getExecutions(selectedFlowId) : Promise.resolve([]),
    enabled: !!selectedFlowId && showExecutionHistory
  });
  
  // Auto-refresh executions when a flow is running
  useEffect(() => {
    if (!executions || !selectedFlowId) return;
    
    const hasRunningExecutions = executions.some(
      exec => exec.status === 'running' || exec.status === 'queued'
    );
    
    if (hasRunningExecutions) {
      const intervalId = setInterval(() => {
        refetchExecutions();
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [executions, selectedFlowId, refetchExecutions]);
  
  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === "agents") {
        await refetchAgents();
      } else if (activeTab === "flows") {
        await refetchFlows();
        if (selectedFlowId && showExecutionHistory) {
          await refetchExecutions();
        }
      }
      
      toast({
        title: "Refreshed",
        description: `${activeTab === "agents" ? "Agent" : "Flow"} data has been refreshed`,
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: `Failed to refresh ${activeTab === "agents" ? "agent" : "flow"} data`,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Execute a flow
  const handleExecuteFlow = async (flowId: number) => {
    try {
      const execution = await executeFlow(flowId);
      toast({
        title: "Flow Execution Started",
        description: `Execution ID: ${execution.id}, Status: ${execution.status}`,
      });
      
      // Refresh flows after a short delay to show updated status
      setTimeout(() => refetchFlows(), 1000);
    } catch (error) {
      toast({
        title: "Execution Failed",
        description: "Failed to execute flow. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Filter agents
  const filteredAgents = agents?.filter((agent) => {
    if (!agentFilter) return true;
    
    const searchTerm = agentFilter.toLowerCase();
    return (
      agent.name.toLowerCase().includes(searchTerm) ||
      agent.type.toLowerCase().includes(searchTerm) ||
      agent.description?.toLowerCase().includes(searchTerm) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm))
    );
  });
  
  // Filter flows
  const filteredFlows = flows?.filter((flow) => {
    if (!flowFilter) return true;
    
    const searchTerm = flowFilter.toLowerCase();
    return (
      flow.name.toLowerCase().includes(searchTerm) ||
      flow.description?.toLowerCase().includes(searchTerm) ||
      flow.status.toLowerCase().includes(searchTerm)
    );
  });
  
  // Get CSS class for status badge
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': 
        return "bg-green-500/10 text-green-500";
      case 'inactive':
      case 'draft':
        return "bg-gray-500/10 text-gray-500";
      case 'error':
      case 'failed':
        return "bg-red-500/10 text-red-500";
      case 'running':
        return "bg-blue-500/10 text-blue-500";
      case 'completed':
        return "bg-emerald-500/10 text-emerald-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  
  // Get CSS class for agent type badge
  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'llm':
        return "bg-violet-500/10 text-violet-500";
      case 'tool':
        return "bg-blue-500/10 text-blue-500";
      case 'retrieval':
        return "bg-amber-500/10 text-amber-500";
      case 'connector':
        return "bg-cyan-500/10 text-cyan-500";
      case 'orchestrator':
        return "bg-rose-500/10 text-rose-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  
  return (
    <>
      <DashboardHeader
        title="Agent Orchestration"
        subtitle="Manage agents, flows, and execution of Agent-to-Agent (A2A) interactions"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>Agents</span>
          </TabsTrigger>
          <TabsTrigger value="flows" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Flows</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Input
                placeholder="Search agents..."
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <Button
              onClick={() => {
                toast({
                  title: "Not implemented",
                  description: "Agent creation functionality is coming soon!",
                });
              }}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Agent
            </Button>
          </div>
          
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Registered Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capabilities</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentsLoading || isRefreshing ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            <span className="text-muted-foreground">
                              Loading agents...
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredAgents?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center">
                            <Bot className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-muted-foreground">
                              No agents found
                            </span>
                            <Button
                              variant="link"
                              onClick={() => {
                                toast({
                                  title: "Not implemented",
                                  description: "Agent creation functionality is coming soon!",
                                });
                              }}
                              className="mt-2"
                            >
                              Register your first agent
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAgents?.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-9 w-9 bg-primary rounded-full flex items-center justify-center text-white">
                                <Cpu className="h-4 w-4" />
                              </div>
                              <div className="ml-3">
                                <div className="font-medium">{agent.name}</div>
                                <div className="text-xs text-muted-foreground">{agent.description || "No description"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={getTypeBadgeClass(agent.type)}
                            >
                              {agent.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {agent.capabilities && agent.capabilities.length > 0 ? (
                                agent.capabilities.slice(0, 3).map((capability, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="outline"
                                    className="bg-muted/40 text-muted-foreground text-xs"
                                  >
                                    {capability}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">No capabilities</span>
                              )}
                              {agent.capabilities && agent.capabilities.length > 3 && (
                                <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                                  +{agent.capabilities.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={getStatusBadgeClass(agent.status)}
                            >
                              {agent.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(agent.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                toast({
                                  title: "Not implemented",
                                  description: "Agent settings functionality is coming soon!",
                                });
                              }}
                            >
                              <Settings className="h-4 w-4" />
                              <span className="sr-only">Settings</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="flows" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Input
                placeholder="Search flows..."
                value={flowFilter}
                onChange={(e) => setFlowFilter(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <Button
              onClick={() => {
                toast({
                  title: "Not implemented",
                  description: "Flow creation functionality is coming soon!",
                });
              }}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Create Flow
            </Button>
          </div>
          
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">A2A Flows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Agents</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flowsLoading || isRefreshing ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                            <span className="text-muted-foreground">
                              Loading flows...
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredFlows?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center">
                            <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-muted-foreground">
                              No flows found
                            </span>
                            <Button
                              variant="link"
                              onClick={() => {
                                toast({
                                  title: "Not implemented",
                                  description: "Flow creation functionality is coming soon!",
                                });
                              }}
                              className="mt-2"
                            >
                              Create your first flow
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFlows?.map((flow) => (
                        <TableRow key={flow.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-9 w-9 bg-primary rounded-full flex items-center justify-center text-white">
                                <Network className="h-4 w-4" />
                              </div>
                              <div className="ml-3">
                                <div className="font-medium">{flow.name}</div>
                                <div className="text-xs text-muted-foreground">{flow.description || "No description"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={getStatusBadgeClass(flow.status)}
                            >
                              {flow.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {flow.definition && flow.definition.steps && flow.definition.steps.length > 0 ? (
                              <span className="text-sm">{flow.definition.steps.length} agent{flow.definition.steps.length > 1 ? 's' : ''}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No agents defined</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(flow.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExecuteFlow(flow.id)}
                                disabled={flow.status !== 'active'}
                                className="flex items-center gap-1"
                              >
                                <Play className="h-3 w-3" />
                                Execute
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedFlowId(flow.id);
                                  setShowExecutionHistory(true);
                                }}
                                className="flex items-center gap-1"
                              >
                                <History className="h-3 w-3" />
                                History
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  toast({
                                    title: "Not implemented",
                                    description: "Flow editing functionality is coming soon!",
                                  });
                                }}
                              >
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
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
          </Card>

          {/* Execution History Section */}
          {showExecutionHistory && selectedFlowId && (
            <Card className="mt-6">
              <CardHeader className="bg-muted/50 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <History className="h-4 w-4" /> 
                    Execution History
                  </CardTitle>
                  <CardDescription>
                    {flows?.find(f => f.id === selectedFlowId)?.name || 'Selected Flow'}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowExecutionHistory(false);
                    setSelectedFlowId(null);
                  }}
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started At</TableHead>
                        <TableHead>Completed At</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionsLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <span className="text-muted-foreground">
                                Loading execution history...
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : !executions || executions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center justify-center">
                              <History className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-muted-foreground">
                                No execution records found
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        executions.map(execution => {
                          // Calculate duration
                          const startTime = new Date(execution.startedAt).getTime();
                          const endTime = execution.completedAt 
                            ? new Date(execution.completedAt).getTime()
                            : Date.now();
                          const durationMs = endTime - startTime;
                          const durationSec = Math.floor(durationMs / 1000);
                          
                          // Format duration
                          let durationText = '';
                          if (durationSec < 60) {
                            durationText = `${durationSec}s`;
                          } else {
                            const minutes = Math.floor(durationSec / 60);
                            const seconds = durationSec % 60;
                            durationText = `${minutes}m ${seconds}s`;
                          }
                          
                          // Get status icon
                          let StatusIcon = Hourglass;
                          if (execution.status === 'completed') {
                            StatusIcon = CheckCircle2;
                          } else if (execution.status === 'failed') {
                            StatusIcon = XCircle;
                          } else if (execution.status === 'running') {
                            StatusIcon = Loader2;
                          } else if (execution.status === 'queued') {
                            StatusIcon = Clock;
                          }
                          
                          return (
                            <TableRow key={execution.id}>
                              <TableCell>#{execution.id}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline"
                                  className={getStatusBadgeClass(execution.status)}
                                >
                                  <StatusIcon className={`h-3 w-3 mr-1 ${execution.status === 'running' ? 'animate-spin' : ''}`} />
                                  {execution.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(execution.startedAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {execution.completedAt 
                                  ? new Date(execution.completedAt).toLocaleString()
                                  : <span className="text-muted-foreground italic">In progress</span>}
                              </TableCell>
                              <TableCell className="text-sm">
                                {execution.status === 'completed' || execution.status === 'failed' 
                                  ? durationText
                                  : <span className="text-blue-500">{durationText} (running)</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    toast({
                                      title: "Not implemented",
                                      description: "Execution details functionality is coming soon!",
                                    });
                                  }}
                                >
                                  <Settings className="h-4 w-4" />
                                  <span className="sr-only">Execution details</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}