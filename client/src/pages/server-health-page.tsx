import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  MonitorCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  BarChart3,
  RefreshCw,
  Clock,
  Zap,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function ServerHealthPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Fetch server health data
  const {
    data: healthData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/server-health"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/server-health");
        if (!res.ok) throw new Error("Failed to fetch server health data");
        return res.json();
      } catch (error) {
        console.error("Error fetching server health:", error);
        return {
          servers: [],
          globalHealth: {
            status: "unknown",
            uptime: "N/A",
            lastChecked: new Date().toISOString(),
          }
        };
      }
    },
  });

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Health data refreshed",
        description: "Server health data has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing health data:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh server health data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Format health status to display element
  const getHealthStatusDisplay = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <div className="flex items-center text-success">
            <CheckCircle2 className="h-5 w-5 mr-2" />
            <span>Healthy</span>
          </div>
        );
      case "degraded":
        return (
          <div className="flex items-center text-warning">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>Degraded</span>
          </div>
        );
      case "critical":
        return (
          <div className="flex items-center text-destructive">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Critical</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>Unknown</span>
          </div>
        );
    }
  };
  
  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      // Convert to seconds
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 60) {
        return `${diffSec} seconds ago`;
      } else if (diffSec < 3600) {
        return `${Math.floor(diffSec / 60)} minutes ago`;
      } else if (diffSec < 86400) {
        return `${Math.floor(diffSec / 3600)} hours ago`;
      } else {
        return `${Math.floor(diffSec / 86400)} days ago`;
      }
    } catch (e) {
      return "Unknown";
    }
  };

  return (
    <>
      <DashboardHeader
        title="Server Health"
        subtitle="Monitor the health and status of your MCP servers"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <Card className="mb-6">
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">System Health Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading health data...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
                <div className="text-lg font-medium mb-2">Overall Status</div>
                <div className="text-xl">
                  {getHealthStatusDisplay(healthData?.globalHealth?.status || "unknown")}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
                <div className="text-lg font-medium mb-2">System Uptime</div>
                <div className="flex items-center text-xl">
                  <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span>{healthData?.globalHealth?.uptime || "N/A"}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
                <div className="text-lg font-medium mb-2">Last Health Check</div>
                <div className="flex items-center text-xl">
                  <RefreshCw className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span>
                    {healthData?.globalHealth?.lastChecked 
                      ? formatRelativeTime(healthData.globalHealth.lastChecked)
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Tabs defaultValue="status" className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="status">Server Status</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="status">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Server Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading server status...
                  </span>
                </div>
              ) : healthData?.servers?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <MonitorCheck className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">
                    No servers found
                  </span>
                </div>
              ) : (
                <div className="divide-y">
                  {healthData?.servers?.map((server: any) => (
                    <div key={server.id} className="p-4 hover:bg-muted/50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            server.status === 'healthy' ? 'bg-success/20' :
                            server.status === 'degraded' ? 'bg-warning/20' :
                            'bg-destructive/20'
                          }`}>
                            <MonitorCheck className={`h-5 w-5 ${
                              server.status === 'healthy' ? 'text-success' :
                              server.status === 'degraded' ? 'text-warning' :
                              'text-destructive'
                            }`} />
                          </div>
                          <div className="ml-4">
                            <h3 className="text-base font-medium">{server.name}</h3>
                            <p className="text-sm text-muted-foreground">{server.url}</p>
                          </div>
                        </div>
                        
                        <div>
                          {getHealthStatusDisplay(server.status)}
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-muted-foreground">CPU</span>
                            <span className="text-sm font-medium">{server.cpu}%</span>
                          </div>
                          <Progress
                            value={server.cpu}
                            className={
                              server.cpu > 80 ? "bg-destructive/20" : 
                              server.cpu > 60 ? "bg-warning/20" : 
                              "bg-success/20"
                            }
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Memory</span>
                            <span className="text-sm font-medium">{server.memory}%</span>
                          </div>
                          <Progress
                            value={server.memory}
                            className={
                              server.memory > 80 ? "bg-destructive/20" : 
                              server.memory > 60 ? "bg-warning/20" : 
                              "bg-success/20"
                            }
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Disk</span>
                            <span className="text-sm font-medium">{server.disk}%</span>
                          </div>
                          <Progress
                            value={server.disk}
                            className={
                              server.disk > 80 ? "bg-destructive/20" : 
                              server.disk > 60 ? "bg-warning/20" : 
                              "bg-success/20"
                            }
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Last check: {formatRelativeTime(server.lastChecked)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 py-3 px-6">
              <div className="text-sm text-muted-foreground">
                {healthData?.servers?.length ? (
                  <>
                    Total: <span className="font-medium">{healthData.servers.length}</span> servers
                  </>
                ) : null}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Response Times</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-6">
                      <Zap className="h-20 w-20 text-muted-foreground" />
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      Select specific servers to view response time metrics
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Request Throughput</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-6">
                      <BarChart3 className="h-20 w-20 text-muted-foreground" />
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      Select specific servers to view request throughput metrics
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Security Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-center py-6">
                <Shield className="h-20 w-20 text-muted-foreground" />
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Security metrics monitoring will be available in a future update
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}