import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Activity,
  AlertTriangle,
  ArrowDownAZ,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Define activity log interface
interface ActivityLog {
  id: number;
  eventType: string;
  eventTime: string;
  userId: number | null;
  username?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error';
  resourceType?: string;
  resourceId?: string;
}

// Filter form schema
const filterSchema = z.object({
  eventType: z.string().optional(),
  userId: z.string().optional(),
  severity: z.string().optional(),
  resourceType: z.string().optional(),
  timeRange: z.string().optional(),
});

type FilterValues = z.infer<typeof filterSchema>;

export default function ActivityLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');
  
  // Filter form
  const filterForm = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      eventType: '',
      userId: '',
      severity: '',
      resourceType: '',
      timeRange: 'last-24-hours',
    }
  });
  
  const onSubmitFilters = (values: FilterValues) => {
    console.log('Filter values:', values);
    // This would normally update the query parameters
    toast({
      title: "Filters applied",
      description: "The activity logs have been filtered based on your criteria.",
    });
  };
  
  // Get activity logs
  const { 
    data: activityLogs, 
    isLoading: logsLoading, 
    error: logsError,
    refetch: refetchLogs,
    isRefetching,
  } = useQuery<{ logs: ActivityLog[], totalCount: number }>({
    queryKey: ['/api/activity-logs', page, limit, searchQuery],
    enabled: false, // Disabled until API is fully implemented
  });
  
  // Get log details
  const {
    data: logDetails,
    isLoading: isLoadingDetails,
  } = useQuery<ActivityLog>({
    queryKey: ['/api/activity-logs', selectedLogId],
    enabled: selectedLogId !== null && detailsDialogOpen,
  });
  
  // Sample data for demonstration
  const sampleLogs: ActivityLog[] = [
    {
      id: 1,
      eventType: 'user.login',
      eventTime: new Date().toISOString(),
      userId: 1,
      username: 'admin@example.com',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      details: { method: 'password', success: true },
      severity: 'info',
    },
    {
      id: 2,
      eventType: 'mcp.server.registered',
      eventTime: new Date(Date.now() - 15 * 60000).toISOString(),
      userId: 1,
      username: 'admin@example.com',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      details: { serverId: 'srv-123', serverName: 'Production-MCP-01' },
      severity: 'info',
      resourceType: 'server',
      resourceId: 'srv-123',
    },
    {
      id: 3,
      eventType: 'policy.violation',
      eventTime: new Date(Date.now() - 55 * 60000).toISOString(),
      userId: 2,
      username: 'developer@example.com',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      details: { 
        policyId: 'pol-456', 
        policyName: 'Data Access Control', 
        violationType: 'Unauthorized access attempt' 
      },
      severity: 'warning',
      resourceType: 'policy',
      resourceId: 'pol-456',
    },
    {
      id: 4,
      eventType: 'security.breach',
      eventTime: new Date(Date.now() - 4 * 3600000).toISOString(),
      userId: null,
      ipAddress: '203.0.113.42',
      userAgent: 'Python-urllib/3.8',
      details: { 
        attempt: 'Brute force login', 
        targetUsername: 'admin', 
        attemptCount: 25 
      },
      severity: 'error',
    },
    {
      id: 5,
      eventType: 'workflow.instance.completed',
      eventTime: new Date(Date.now() - 12 * 3600000).toISOString(),
      userId: 3,
      username: 'analyst@example.com',
      ipAddress: '192.168.1.110',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/98.0.4758.102',
      details: { 
        workflowId: 'wf-789', 
        workflowName: 'Data Processing Pipeline', 
        duration: '45.2s',
        status: 'success' 
      },
      severity: 'info',
      resourceType: 'workflow',
      resourceId: 'wf-789',
    },
  ];
  
  const handleRefresh = () => {
    refetchLogs();
    toast({
      title: "Refreshed",
      description: "Activity logs have been refreshed.",
    });
  };
  
  const searchLogs = () => {
    toast({
      title: "Search executed",
      description: `Searching for logs matching "${searchQuery}"`,
    });
    // Would normally trigger a refetch with the search parameters
  };
  
  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast({
        title: "Export complete",
        description: `Activity logs exported as ${exportFormat.toUpperCase()}`,
      });
    }, 1000);
  };
  
  const viewLogDetails = (logId: number) => {
    setSelectedLogId(logId);
    setDetailsDialogOpen(true);
  };
  
  const getSeverityBadge = (severity: 'info' | 'warning' | 'error') => {
    switch (severity) {
      case 'info':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Info</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Warning</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">
          View and analyze all activity across the platform
        </p>
      </div>
      
      <Tabs defaultValue="all-logs" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="all-logs">All Logs</TabsTrigger>
            <TabsTrigger value="user-activity">User Activity</TabsTrigger>
            <TabsTrigger value="system-events">System Events</TabsTrigger>
            <TabsTrigger value="security-alerts">Security Alerts</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Select
              value={exportFormat}
              onValueChange={(value: 'json' | 'csv') => setExportFormat(value)}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <TabsContent value="all-logs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Comprehensive logs of all activities and events in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-between mb-6 gap-4">
                <div className="flex flex-wrap gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search logs..."
                      className="pl-8 w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchLogs()}
                    />
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80">
                      <DropdownMenuLabel>Filter Logs</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <form 
                        className="p-4 space-y-4"
                        onSubmit={filterForm.handleSubmit(onSubmitFilters)}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="eventType">Event Type</Label>
                          <Select 
                            defaultValue={filterForm.getValues().eventType}
                            onValueChange={(value) => filterForm.setValue('eventType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Events</SelectItem>
                              <SelectItem value="user">User Events</SelectItem>
                              <SelectItem value="system">System Events</SelectItem>
                              <SelectItem value="security">Security Events</SelectItem>
                              <SelectItem value="policy">Policy Events</SelectItem>
                              <SelectItem value="workflow">Workflow Events</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="severity">Severity</Label>
                          <Select 
                            defaultValue={filterForm.getValues().severity}
                            onValueChange={(value) => filterForm.setValue('severity', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Severities</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="error">Error</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="timeRange">Time Range</Label>
                          <Select 
                            defaultValue={filterForm.getValues().timeRange}
                            onValueChange={(value) => filterForm.setValue('timeRange', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select time range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="last-hour">Last Hour</SelectItem>
                              <SelectItem value="last-24-hours">Last 24 Hours</SelectItem>
                              <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button type="submit" className="w-full">Apply Filters</Button>
                      </form>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date Range
                  </Button>
                  
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <ArrowDownAZ className="h-4 w-4" />
                    Sort
                  </Button>
                </div>
              </div>
              
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : logsError ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Failed to load logs</h3>
                  <p className="text-muted-foreground">There was an error loading the activity logs.</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetchLogs()}>
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="h-12 px-4 text-left align-middle font-medium">Event Type</th>
                          <th className="h-12 px-4 text-left align-middle font-medium">Time</th>
                          <th className="h-12 px-4 text-left align-middle font-medium">User</th>
                          <th className="h-12 px-4 text-left align-middle font-medium">IP Address</th>
                          <th className="h-12 px-4 text-left align-middle font-medium">Severity</th>
                          <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleLogs.map((log) => (
                          <tr key={log.id} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 align-middle">{log.eventType}</td>
                            <td className="p-4 align-middle">
                              {new Date(log.eventTime).toLocaleString()}
                            </td>
                            <td className="p-4 align-middle">
                              {log.userId ? (
                                log.username || `User ${log.userId}`
                              ) : (
                                <span className="text-muted-foreground italic">System</span>
                              )}
                            </td>
                            <td className="p-4 align-middle">{log.ipAddress}</td>
                            <td className="p-4 align-middle">
                              {getSeverityBadge(log.severity)}
                            </td>
                            <td className="p-4 align-middle">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewLogDetails(log.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {sampleLogs.length} of {sampleLogs.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={true} // Would normally check if there are more pages
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="user-activity">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>
                Track user authentication, permission changes, and resource access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="h-12 w-12 text-primary opacity-50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a tab to view logs</h3>
                <p className="text-muted-foreground max-w-md">
                  This view will show user-specific actions including logins, permission changes, and resource access.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system-events">
          <Card>
            <CardHeader>
              <CardTitle>System Events</CardTitle>
              <CardDescription>
                Monitor system-level activities, server status changes, and system tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-12 w-12 text-primary opacity-50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a tab to view logs</h3>
                <p className="text-muted-foreground max-w-md">
                  This view will show system events including server registrations, configuration changes, and scheduled tasks.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security-alerts">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                View security incidents, policy violations, and suspicious activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-12 w-12 text-primary opacity-50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a tab to view logs</h3>
                <p className="text-muted-foreground max-w-md">
                  This view will show security-related events including breaches, policy violations, and access control issues.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Log Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this activity log entry
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !logDetails ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p>No details available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Using the sample logs for demonstration */}
              {(() => {
                const log = sampleLogs.find(l => l.id === selectedLogId);
                if (!log) return null;
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Event Type</h4>
                        <p className="text-sm">{log.eventType}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Event Time</h4>
                        <p className="text-sm">{new Date(log.eventTime).toLocaleString()}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Severity</h4>
                        <div>{getSeverityBadge(log.severity)}</div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">IP Address</h4>
                        <p className="text-sm">{log.ipAddress}</p>
                      </div>
                      {log.userId && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">User</h4>
                          <p className="text-sm">{log.username || `User ${log.userId}`}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-medium mb-1">User Agent</h4>
                        <p className="text-sm truncate">{log.userAgent}</p>
                      </div>
                      {log.resourceType && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Resource Type</h4>
                          <p className="text-sm">{log.resourceType}</p>
                        </div>
                      )}
                      {log.resourceId && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Resource ID</h4>
                          <p className="text-sm">{log.resourceId}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Event Details</h4>
                      <div className="rounded-md bg-muted p-4">
                        <pre className="text-xs overflow-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end gap-2">
                      {log.severity === 'error' && (
                        <Button variant="destructive">Flag for Review</Button>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Log exported",
                            description: "Event details exported as JSON",
                          });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Details
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}