import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  BarChart3,
  Download,
  Box,
  Zap,
  Activity,
  Clock,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AgentMetricsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedAgent, setSelectedAgent] = useState("all");
  
  // Fetch agent metrics data
  const {
    data: metricsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/agent-metrics", timeRange, selectedAgent],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/agent-metrics?timeRange=${timeRange}&agentId=${selectedAgent}`);
        if (!res.ok) throw new Error("Failed to fetch agent metrics");
        return res.json();
      } catch (error) {
        console.error("Error fetching agent metrics:", error);
        return {
          agents: [],
          summaryStats: {},
          executionTimeData: [],
          requestVolumeData: [],
          errorRateData: []
        };
      }
    },
  });
  
  // Fetch available agents for the dropdown
  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) throw new Error("Failed to fetch agents");
        return res.json();
      } catch (error) {
        console.error("Error fetching agents for dropdown:", error);
        return [];
      }
    },
  });

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error("Error refreshing metrics data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <DashboardHeader
        title="Agent Metrics"
        subtitle="Analyze and monitor agent performance metrics"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            // Export metrics functionality would go here
            alert("Export functionality will be available in a future update");
          }}
        >
          <Download className="h-4 w-4" />
          Export Metrics
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Execution Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {isLoading || isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  metricsData?.summaryStats?.avgExecutionTime || "N/A"
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ms average execution time
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {isLoading || isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  metricsData?.summaryStats?.totalExecutions?.toLocaleString() || "N/A"
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              total agent executions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Zap className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {isLoading || isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  metricsData?.summaryStats?.errorRate || "N/A"
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              % error rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Box className="h-5 w-5 text-muted-foreground mr-2" />
              <div className="text-2xl font-bold">
                {isLoading || isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  metricsData?.summaryStats?.activeAgents || "N/A"
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              active agents
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="execution-time" className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="execution-time">Execution Time</TabsTrigger>
          <TabsTrigger value="request-volume">Request Volume</TabsTrigger>
          <TabsTrigger value="error-rate">Error Rate</TabsTrigger>
        </TabsList>
        
        <TabsContent value="execution-time">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Execution Time (ms)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading execution time metrics...
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <BarChart3 className="h-16 w-16 text-muted-foreground" />
                    <div className="ml-4 text-muted-foreground">
                      Execution time chart will be available in a future update
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="request-volume">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Request Volume</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading request volume metrics...
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <BarChart3 className="h-16 w-16 text-muted-foreground" />
                    <div className="ml-4 text-muted-foreground">
                      Request volume chart will be available in a future update
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="error-rate">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Error Rate (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading error rate metrics...
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <BarChart3 className="h-16 w-16 text-muted-foreground" />
                    <div className="ml-4 text-muted-foreground">
                      Error rate chart will be available in a future update
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Agent-Specific Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading agent metrics...
              </span>
            </div>
          ) : metricsData?.agents?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Box className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                No agent metrics available
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {metricsData?.agents?.map((agent: any) => (
                <div key={agent.id} className="p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Box className="h-5 w-5 text-primary" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-base font-medium">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground">{agent.type || "Unknown type"}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Last execution</div>
                        <div className="text-sm font-medium flex items-center">
                          <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          {new Date(agent.lastExecution).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                      <div>
                        <div className="text-sm">Avg. Execution Time</div>
                        <div className="text-base font-medium">{agent.avgExecutionTime} ms</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Activity className="h-4 w-4 text-muted-foreground mr-2" />
                      <div>
                        <div className="text-sm">Executions</div>
                        <div className="text-base font-medium">{agent.executions.toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Zap className="h-4 w-4 text-muted-foreground mr-2" />
                      <div>
                        <div className="text-sm">Error Rate</div>
                        <div className="text-base font-medium">{agent.errorRate}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}