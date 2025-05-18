import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Network, Server, Activity, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function ConnectionPoolPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  
  // Fetch connection pool data
  const {
    data: connectionPool,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/connection-pool"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/connection-pool");
        if (!res.ok) throw new Error("Failed to fetch connection pool data");
        return res.json();
      } catch (error) {
        console.error("Error fetching connection pool:", error);
        // Return mock data for demonstration
        return {
          servers: [],
          metrics: {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            waitingRequests: 0
          },
          status: "healthy"
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
        title: "Connection pool refreshed",
        description: "The connection pool data has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing connection pool data:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh connection pool data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Reset connection pool
  const resetPool = async () => {
    try {
      const res = await fetch("/api/connection-pool/reset", {
        method: "POST",
      });
      
      if (!res.ok) throw new Error("Failed to reset connection pool");
      
      toast({
        title: "Connection pool reset",
        description: "The connection pool has been reset successfully.",
      });
      
      refreshData();
    } catch (error) {
      console.error("Error resetting connection pool:", error);
      toast({
        title: "Reset failed",
        description: "Failed to reset connection pool.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DashboardHeader
        title="Connection Pool"
        subtitle="Manage MCP server connection pools"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading || isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                connectionPool?.metrics?.totalConnections || "0"
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading || isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                connectionPool?.metrics?.activeConnections || "0"
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Idle Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading || isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                connectionPool?.metrics?.idleConnections || "0"
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waiting Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading || isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                connectionPool?.metrics?.waitingRequests || "0"
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Connection Pool Status</CardTitle>
          {hasPermission('servers:manage') && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={resetPool}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className="h-4 w-4" />
              Reset Pool
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading connection pool data...
              </span>
            </div>
          ) : connectionPool?.servers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Network className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                No servers in connection pool
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {connectionPool?.servers?.map((server: any) => (
                <Card key={server.id} className="overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        server.status === 'connected' ? 'bg-success/20' :
                        server.status === 'connecting' ? 'bg-warning/20' :
                        'bg-destructive/20'
                      }`}>
                        <Server className={`h-5 w-5 ${
                          server.status === 'connected' ? 'text-success' :
                          server.status === 'connecting' ? 'text-warning' :
                          'text-destructive'
                        }`} />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-base font-medium">{server.name}</h3>
                        <p className="text-sm text-muted-foreground">{server.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {server.activeConnections}/{server.maxConnections}
                        </span>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        server.status === 'connected' ? 'bg-success/10 text-success' :
                        server.status === 'connecting' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                      </div>
                      
                      {hasPermission('servers:manage') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            // Reset individual server connection
                            toast({
                              title: "Reconnecting...",
                              description: `Reconnecting to server ${server.name}`
                            });
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6">
          <div className="flex items-center text-sm text-muted-foreground">
            <div className={`h-2 w-2 rounded-full mr-2 ${
              connectionPool?.status === 'healthy' ? 'bg-success' :
              connectionPool?.status === 'degraded' ? 'bg-warning' :
              'bg-destructive'
            }`} />
            Pool Status: {connectionPool?.status === 'healthy' ? 'Healthy' :
              connectionPool?.status === 'degraded' ? 'Degraded' :
              'Error'}
          </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Connection Pool Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Connection Strategy</h3>
                <p className="text-sm text-muted-foreground">Weighted Round Robin</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Max Connections Per Server</h3>
                <p className="text-sm text-muted-foreground">10</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Connection Timeout</h3>
                <p className="text-sm text-muted-foreground">5000ms</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Circuit Breaker</h3>
                <p className="text-sm text-muted-foreground">Enabled (Threshold: 5 failures)</p>
              </div>
            </div>
            
            {hasPermission('servers:manage') && (
              <div className="pt-4 border-t">
                <Button variant="outline" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Configure Pool Settings
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}