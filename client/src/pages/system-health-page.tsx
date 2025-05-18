import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Cpu,
  Activity,
  Shield,
  Globe,
  Layers,
  BarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// Types for System Health API response
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  system: {
    cluster: {
      status: string;
      nodeId: string;
      role: string;
      region: string;
      zone: string;
      nodes: number;
      isMaster: boolean;
      startTime: string;
      uptime: number;
      version: string;
      resources: {
        cpu: number;
        memory: number;
      };
    };
    circuitBreakers: {
      healthy: boolean;
      circuits: Record<string, string>;
    };
    rateLimits: {
      status: string;
    };
  };
  services: {
    mcp: {
      status: string;
      servers: Array<{
        id: number;
        name: string;
        status: string;
        lastConnected?: string;
        lastError?: string | null;
      }>;
      metrics: Array<{
        serverId: number;
        serverName: string;
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageLatency: number;
        successRate: number;
        toolMetrics: Record<string, any>;
      }>;
    };
  };
}

// Types for Connection Pool API response
interface ConnectionPool {
  stats: {
    totalServers: number;
    activeServers: number;
    healthyServers: number;
    totalConnections: number;
    averageResponseTime: number;
    strategyUsed: string;
  };
  servers: Array<{
    id: number;
    name: string;
    url: string;
    weight: number;
    isActive: boolean;
    maxConnections: number;
    currentConnections: number;
    healthCheckStatus: 'healthy' | 'degraded' | 'unhealthy';
    failureCount: number;
    successCount: number;
    totalRequests: number;
    averageResponseTimeMs: number;
    lastError: string | null;
  }>;
  config: {
    loadBalancingStrategy: string;
    healthCheckIntervalMs: number;
    healthCheckTimeoutMs: number;
    failureThreshold: number;
    recoveryThreshold: number;
    maxConnectionsPerServer: number;
  };
}

// Circuit breaker types
interface CircuitBreaker {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  stats: {
    failures: number;
    successes: number;
    lastFailure: string | null;
    lastSuccess: string | null;
    lastStateChange: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rejectedRequests: number;
    averageResponseTime: number;
  };
}

// Helper function to format timestamps
const formatTime = (timestamp: string): string => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

// Helper function to format uptime
const formatUptime = (seconds: number): string => {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
};

// Helper to get status color
const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'operational':
    case 'connected':
    case 'closed':
      return 'bg-green-500';
    case 'degraded':
    case 'half-open':
      return 'bg-amber-500';
    case 'unhealthy':
    case 'open':
    case 'disconnected':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

// Helper to get status icon
const StatusIcon = ({ status }: { status: string }) => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'operational':
    case 'connected':
    case 'closed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'degraded':
    case 'half-open':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'unhealthy':
    case 'open':
    case 'disconnected':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-500" />;
  }
};

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Component to show health status badge
const HealthBadge = ({ status }: { status: string }) => {
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge className={`${getStatusColor(status)} text-white`}>
      <StatusIcon status={status} />
      <span className="ml-1">{statusText}</span>
    </Badge>
  );
};

export default function SystemHealthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch system health data
  const { 
    data: healthData, 
    isLoading: isHealthLoading, 
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth
  } = useQuery<SystemHealth>({
    queryKey: ['/health'],
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Fetch circuit breaker data
  const { 
    data: circuitBreakerData, 
    isLoading: isCircuitLoading,
    isError: isCircuitError,
    error: circuitError,
    refetch: refetchCircuitBreakers
  } = useQuery<CircuitBreaker[]>({
    queryKey: ['/api/circuit-breakers'],
    enabled: !!user, // Only fetch if user is authenticated
  });
  
  // Fetch connection pool data
  const { 
    data: connectionPoolData, 
    isLoading: isPoolLoading,
    isError: isPoolError,
    error: poolError,
    refetch: refetchConnectionPool
  } = useQuery<ConnectionPool>({
    queryKey: ['/api/connection-pool'],
    enabled: !!user, // Only fetch if user is authenticated
  });
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchHealth(),
        refetchCircuitBreakers(),
        refetchConnectionPool()
      ]);
      toast({
        title: "Refreshed",
        description: "System health data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh system health data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Manual circuit breaker control for admins
  const toggleCircuitBreaker = async (name: string, action: string) => {
    try {
      await apiRequest("POST", `/api/circuit-breakers/${name}/${action}`);
      toast({
        title: "Circuit Breaker Updated",
        description: `Circuit breaker ${name} ${action}ed successfully`,
      });
      refetchCircuitBreakers();
    } catch (error) {
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Server control for admins
  const toggleServer = async (id: number, isActive: boolean) => {
    try {
      await apiRequest("POST", `/api/connection-pool/servers/${id}/toggle`, { isActive });
      toast({
        title: "Server Updated",
        description: `Server has been ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
      refetchConnectionPool();
    } catch (error) {
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Calculate overall system health
  const overallHealth = healthData?.status || 'unknown';
  const mcpServersHealth = healthData?.services.mcp.status || 'unknown';
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system health, performance metrics, and server status
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {isHealthLoading ? (
                <Skeleton className="h-12 w-24" />
              ) : (
                <div className="flex items-center">
                  <HealthBadge status={overallHealth} />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">
                  Last updated:
                </p>
                <p className="text-xs font-medium">
                  {isHealthLoading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    healthData ? formatTime(healthData.timestamp) : 'N/A'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MCP Server Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {isHealthLoading ? (
                <Skeleton className="h-12 w-24" />
              ) : (
                <div className="flex items-center">
                  <HealthBadge status={mcpServersHealth} />
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Connected Servers:</p>
                <p className="text-lg font-medium">
                  {isHealthLoading ? (
                    <Skeleton className="h-5 w-16 inline-block" />
                  ) : (
                    healthData ? `${healthData.services.mcp.servers.filter(s => s.status === 'connected').length}/${healthData.services.mcp.servers.length}` : 'N/A'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cluster Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isHealthLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : healthData ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node ID:</span>
                  <span className="font-medium truncate ml-2" title={healthData.system.cluster.nodeId}>
                    {healthData.system.cluster.nodeId.substring(0, 8)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-medium capitalize">
                    {healthData.system.cluster.role}
                    {healthData.system.cluster.isMaster && 
                      <Badge className="ml-2 bg-blue-500 text-white" variant="outline">Master</Badge>
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="font-medium">{formatUptime(healthData.system.cluster.uptime)}</span>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground italic">No cluster data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center">
            <Layers className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="servers" className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            MCP Servers
          </TabsTrigger>
          <TabsTrigger value="circuit-breakers" className="flex items-center">
            <Shield className="h-4 w-4 mr-2" />
            Circuit Breakers
          </TabsTrigger>
          <TabsTrigger value="connection-pool" className="flex items-center">
            <Cpu className="h-4 w-4 mr-2" />
            Connection Pool
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center">
            <BarChart className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  System Services
                </CardTitle>
                <CardDescription>
                  Current status of system services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isHealthLoading ? (
                  <>
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </>
                ) : healthData ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>MCP Servers</span>
                      </div>
                      <HealthBadge status={healthData.services.mcp.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Circuit Breakers</span>
                      </div>
                      <HealthBadge 
                        status={healthData.system.circuitBreakers.healthy ? 'healthy' : 'degraded'} 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Rate Limiting</span>
                      </div>
                      <HealthBadge status={healthData.system.rateLimits.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Cluster</span>
                      </div>
                      <HealthBadge status={healthData.system.cluster.status} />
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">No service data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Resource Utilization
                </CardTitle>
                <CardDescription>
                  Current system resource usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isHealthLoading ? (
                  <>
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </>
                ) : healthData ? (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">CPU</span>
                        <span className="text-sm font-medium">{healthData.system.cluster.resources.cpu} Cores</span>
                      </div>
                      <Progress value={65} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">Memory</span>
                        <span className="text-sm font-medium">{formatBytes(healthData.system.cluster.resources.memory)}</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">No resource data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  System Version Info
                </CardTitle>
                <CardDescription>
                  Version and environment information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isHealthLoading ? (
                  <>
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </>
                ) : healthData ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Version</span>
                      <span className="text-sm font-medium">{healthData.system.cluster.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Region</span>
                      <span className="text-sm font-medium">{healthData.system.cluster.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Zone</span>
                      <span className="text-sm font-medium">{healthData.system.cluster.zone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Started At</span>
                      <span className="text-sm font-medium">{formatTime(healthData.system.cluster.startTime)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">No version data available</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MCP Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MCP Server Status</CardTitle>
              <CardDescription>
                Status and performance of all registered MCP servers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isHealthLoading ? (
                <>
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                </>
              ) : healthData?.services.mcp.servers ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Connected</TableHead>
                      <TableHead>Last Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthData.services.mcp.servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell>{server.id}</TableCell>
                        <TableCell className="font-medium">{server.name}</TableCell>
                        <TableCell>
                          <HealthBadge status={server.status} />
                        </TableCell>
                        <TableCell>
                          {server.lastConnected ? formatTime(server.lastConnected) : 'Never'}
                        </TableCell>
                        <TableCell className="text-xs text-red-500 max-w-[250px] truncate" title={server.lastError || ''}>
                          {server.lastError || 'None'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No MCP servers data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Server Metrics</CardTitle>
                <CardDescription>
                  Performance metrics for MCP servers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isHealthLoading ? (
                  <>
                    <Skeleton className="h-8 w-full mb-2" />
                    <Skeleton className="h-8 w-full mb-2" />
                  </>
                ) : healthData?.services.mcp.metrics ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Server</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Avg Latency</TableHead>
                        <TableHead>Total Requests</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthData.services.mcp.metrics.map((metric) => (
                        <TableRow key={metric.serverId}>
                          <TableCell className="font-medium">{metric.serverName}</TableCell>
                          <TableCell>
                            {metric.totalRequests > 0 
                              ? `${(metric.successRate * 100).toFixed(1)}%` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {metric.totalRequests > 0 
                              ? `${metric.averageLatency.toFixed(2)}ms` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{metric.totalRequests}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No metrics data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Distribution</CardTitle>
                <CardDescription>
                  Request success and failure distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isHealthLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : healthData?.services.mcp.metrics ? (
                  healthData.services.mcp.metrics.some(m => m.totalRequests > 0) ? (
                    <div className="space-y-4">
                      {healthData.services.mcp.metrics.map((metric) => (
                        metric.totalRequests > 0 && (
                          <div key={metric.serverId} className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span>{metric.serverName}</span>
                              <span className="text-xs text-muted-foreground">
                                {metric.successfulRequests} / {metric.totalRequests} requests successful
                              </span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${(metric.successfulRequests / metric.totalRequests) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No request data available yet
                    </div>
                  )
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No metrics data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Circuit Breakers Tab */}
        <TabsContent value="circuit-breakers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breakers</CardTitle>
              <CardDescription>
                Status and statistics for all circuit breakers in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCircuitLoading ? (
                <>
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                </>
              ) : isCircuitError ? (
                <div className="text-center py-4 text-red-500">
                  {user ? "Error loading circuit breaker data" : "Please log in to view circuit breaker details"}
                </div>
              ) : circuitBreakerData && circuitBreakerData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Success/Total</TableHead>
                      <TableHead>Last Failure</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {circuitBreakerData.map((breaker) => (
                      <TableRow key={breaker.name}>
                        <TableCell className="font-medium">{breaker.name}</TableCell>
                        <TableCell>
                          <HealthBadge status={breaker.state} />
                        </TableCell>
                        <TableCell>
                          {breaker.stats.successfulRequests} / {breaker.stats.totalRequests}
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div 
                              className="bg-green-500 h-1 rounded-full" 
                              style={{ 
                                width: breaker.stats.totalRequests ? 
                                  `${(breaker.stats.successfulRequests / breaker.stats.totalRequests) * 100}%` : 
                                  '0%' 
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {breaker.stats.lastFailure ? formatTime(breaker.stats.lastFailure) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => toggleCircuitBreaker(breaker.name, 'reset')}
                                  >
                                    Reset
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reset circuit breaker state</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className={breaker.state === 'open' ? 'bg-green-100' : ''}
                                    onClick={() => toggleCircuitBreaker(breaker.name, 'close')}
                                    disabled={breaker.state === 'closed'}
                                  >
                                    Close
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Force circuit closed (allow traffic)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className={breaker.state === 'closed' ? 'bg-red-100' : ''}
                                    onClick={() => toggleCircuitBreaker(breaker.name, 'open')}
                                    disabled={breaker.state === 'open'}
                                  >
                                    Open
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Force circuit open (block traffic)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No circuit breaker data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Statistics</CardTitle>
              <CardDescription>
                Detailed performance metrics for each circuit breaker
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCircuitLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : isCircuitError ? (
                <div className="text-center py-4 text-red-500">
                  {user ? "Error loading circuit breaker statistics" : "Please log in to view circuit breaker statistics"}
                </div>
              ) : circuitBreakerData && circuitBreakerData.length > 0 ? (
                <div className="space-y-6">
                  {circuitBreakerData.map((breaker) => (
                    <div key={breaker.name} className="space-y-2">
                      <h3 className="text-lg font-medium">{breaker.name}</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Requests</div>
                          <div className="text-2xl font-bold">{breaker.stats.totalRequests}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Success Rate</div>
                          <div className="text-2xl font-bold">
                            {breaker.stats.totalRequests > 0
                              ? `${((breaker.stats.successfulRequests / breaker.stats.totalRequests) * 100).toFixed(1)}%`
                              : "N/A"}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Avg Response Time</div>
                          <div className="text-2xl font-bold">
                            {breaker.stats.averageResponseTime > 0
                              ? `${breaker.stats.averageResponseTime.toFixed(2)}ms`
                              : "N/A"}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Rejected Requests</div>
                          <div className="text-2xl font-bold">{breaker.stats.rejectedRequests}</div>
                        </div>
                      </div>
                      <div className="pt-2">
                        <div className="text-sm font-medium mb-1">Request History</div>
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-green-500"
                            style={{ width: `${(breaker.stats.successfulRequests / Math.max(1, breaker.stats.totalRequests)) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-red-500"
                            style={{ width: `${(breaker.stats.failedRequests / Math.max(1, breaker.stats.totalRequests)) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-amber-500"
                            style={{ width: `${(breaker.stats.rejectedRequests / Math.max(1, breaker.stats.totalRequests)) * 100}%` }}
                          ></div>
                        </div>
                        <div className="flex text-xs pt-1 text-muted-foreground justify-between">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                            <span>Success: {breaker.stats.successfulRequests}</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                            <span>Failed: {breaker.stats.failedRequests}</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>
                            <span>Rejected: {breaker.stats.rejectedRequests}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No circuit breaker statistics available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connection Pool Tab */}
        <TabsContent value="connection-pool" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
            {isPoolLoading ? (
              <>
                <Skeleton className="h-[100px]" />
                <Skeleton className="h-[100px]" />
                <Skeleton className="h-[100px]" />
                <Skeleton className="h-[100px]" />
              </>
            ) : isPoolError ? (
              <div className="col-span-4 text-center py-4 text-red-500">
                {user ? "Error loading connection pool data" : "Please log in to view connection pool data"}
              </div>
            ) : connectionPoolData ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Servers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {connectionPoolData.stats.activeServers} / {connectionPoolData.stats.totalServers}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connectionPoolData.stats.healthyServers} healthy servers
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {connectionPoolData.stats.totalConnections}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across all servers
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {connectionPoolData.stats.averageResponseTime.toFixed(2)} ms
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Overall average
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Load Balancing</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-medium">
                      {connectionPoolData.stats.strategyUsed.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current strategy
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="col-span-4 text-center py-4 text-muted-foreground">
                No connection pool data available
              </div>
            )}
          </div>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Server Pool</CardTitle>
                <CardDescription>
                  Manage and monitor connection pool servers
                </CardDescription>
              </div>
              {connectionPoolData && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Add Server
                  </Button>
                  <Button variant="outline" size="sm">
                    Edit Configuration
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isPoolLoading ? (
                <>
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full mb-2" />
                </>
              ) : isPoolError ? (
                <div className="text-center py-4 text-red-500">
                  {user ? "Error loading server pool data" : "Please log in to view server pool data"}
                </div>
              ) : connectionPoolData?.servers && connectionPoolData.servers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Server</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Connections</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectionPoolData.servers.map((server) => (
                      <TableRow key={server.id}>
                        <TableCell>{server.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{server.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={server.url}>
                            {server.url}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <HealthBadge status={server.healthCheckStatus} />
                            {!server.isActive && (
                              <Badge variant="outline" className="bg-gray-100">Disabled</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{server.currentConnections} / {server.maxConnections}</span>
                            <Progress 
                              value={(server.currentConnections / server.maxConnections) * 100} 
                              className="h-2 w-12" 
                            />
                          </div>
                        </TableCell>
                        <TableCell>{server.weight}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant={server.isActive ? "ghost" : "outline"} 
                              size="sm"
                              onClick={() => toggleServer(server.id, !server.isActive)}
                            >
                              {server.isActive ? "Disable" : "Enable"}
                            </Button>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    Settings
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit server settings</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No servers in connection pool
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Connection Pool Configuration</CardTitle>
              <CardDescription>
                Current configuration settings for the connection pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPoolLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : isPoolError ? (
                <div className="text-center py-4 text-red-500">
                  {user ? "Error loading connection pool configuration" : "Please log in to view configuration"}
                </div>
              ) : connectionPoolData?.config ? (
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Load Balancing Strategy</TableCell>
                      <TableCell>
                        {connectionPoolData.config.loadBalancingStrategy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Health Check Interval</TableCell>
                      <TableCell>{connectionPoolData.config.healthCheckIntervalMs / 1000}s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Health Check Timeout</TableCell>
                      <TableCell>{connectionPoolData.config.healthCheckTimeoutMs / 1000}s</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Failure Threshold</TableCell>
                      <TableCell>{connectionPoolData.config.failureThreshold} failures</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Recovery Threshold</TableCell>
                      <TableCell>{connectionPoolData.config.recoveryThreshold} successes</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Max Connections Per Server</TableCell>
                      <TableCell>{connectionPoolData.config.maxConnectionsPerServer} connections</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No configuration data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>
                Performance and operational metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Detailed metrics visualization coming soon</p>
                <p className="text-sm">Integration with monitoring systems like Prometheus and Grafana</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}