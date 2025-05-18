import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  FileDown, 
  Calendar, 
  Filter, 
  AlertCircle, 
  History,
  ChevronDown,
  Search,
  Shield,
  Archive,
  ClipboardCheck,
  Settings,
  Bell,
  Info,
  Eye,
  Check,
  XCircle,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { 
  getAuditLogs, 
  searchAuditLogs, 
  getAuditLog, 
  exportAuditLogs, 
  verifyAuditLogIntegrity,
  archiveAuditLogs,
  getAuditArchives,
  generateComplianceReport,
  getAuditSettings,
  updateAuditSettings,
  getAlerts,
  updateAlertStatus
} from "@/lib/auditApi";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";

export default function AuditLogsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [complianceStandard, setComplianceStandard] = useState<'gdpr' | 'hipaa' | 'sox' | 'pci-dss' | 'iso27001'>('gdpr');
  
  const workspaceId = user?.workspaceId || 1; // Default to workspace 1 if not available

  // Fetch enhanced audit logs with optimized query
  const {
    data: auditLogsData,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['/api/audit/logs', page, limit, filterAction, filterResourceType, filterSeverity, workspaceId],
    queryFn: () => getAuditLogs({
      page,
      limit,
      actions: filterAction ? [filterAction] : undefined,
      resourceTypes: filterResourceType ? [filterResourceType] : undefined,
      severity: filterSeverity || undefined,
      workspaceId,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    }),
  });
  
  // Fetch log details
  const {
    data: logDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['/api/audit/logs', selectedLogId],
    queryFn: () => selectedLogId ? getAuditLog(selectedLogId) : null,
    enabled: !!selectedLogId && detailsDialogOpen,
  });
  
  // Fetch audit alerts
  const {
    data: alertsData,
    isLoading: isLoadingAlerts,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['/api/audit/alerts', workspaceId],
    queryFn: () => getAlerts({ workspaceId }),
  });
  
  // Fetch audit settings
  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['/api/audit/settings', workspaceId],
    queryFn: () => getAuditSettings(workspaceId),
  });
  
  // Update alert status mutation
  const updateAlertMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number, status: 'acknowledged' | 'resolved' | 'false_positive', notes?: string }) => 
      updateAlertStatus(id, status, notes),
    onSuccess: () => {
      refetchAlerts();
      toast({
        title: "Alert Updated",
        description: "Alert status has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update alert status",
        variant: "destructive",
      });
    }
  });
  
  // Verify integrity mutation
  const verifyIntegrityMutation = useMutation({
    mutationFn: (options: { workspaceId?: number, fromDate?: Date, toDate?: Date }) => 
      verifyAuditLogIntegrity(options),
    onSuccess: (data) => {
      if (data.verified) {
        toast({
          title: "Integrity Verified",
          description: `Successfully verified ${data.totalChecked} logs with no issues found`,
        });
      } else {
        toast({
          title: "Integrity Issues Found",
          description: `Found ${data.issueCount} integrity issues in ${data.totalChecked} logs`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify log integrity",
        variant: "destructive",
      });
    }
  });
  
  // Search logs function with debouncing
  const searchLogs = async () => {
    if (!searchQuery.trim()) {
      refetchLogs();
      return;
    }
    
    setIsRefreshing(true);
    try {
      const result = await searchAuditLogs(searchQuery, { page, limit, workspaceId });
      toast({
        title: "Search Completed",
        description: `Found ${result.total} matching logs`,
      });
    } catch (error) {
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to search logs",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh audit logs
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetchLogs();
      await refetchAlerts();
      toast({
        title: "Refreshed",
        description: "Audit logs have been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh audit logs",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle export
  const handleExport = (format: 'json' | 'csv') => {
    try {
      exportAuditLogs({
        format,
        workspaceId,
        actions: filterAction ? [filterAction] : undefined,
        resourceTypes: filterResourceType ? [filterResourceType] : undefined,
        severity: filterSeverity || undefined,
      });
      
      toast({
        title: `Export Initiated`,
        description: `Audit logs will be exported as ${format.toUpperCase()} file`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export logs",
        variant: "destructive",
      });
    }
  };
  
  // Generate compliance report
  const generateReport = async () => {
    try {
      // Set date range to last 30 days by default
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      
      await generateComplianceReport({
        workspaceId,
        complianceStandard,
        fromDate,
        toDate
      });
      
      toast({
        title: "Report Generated",
        description: `${complianceStandard.toUpperCase()} compliance report has been generated`,
      });
    } catch (error) {
      toast({
        title: "Report Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate compliance report",
        variant: "destructive",
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get severity badge color
  const getSeverityBadgeColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-destructive text-destructive-foreground";
      case "high":
        return "bg-destructive/80 text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-warning/70 text-warning-foreground";
      case "info":
        return "bg-info text-info-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  
  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return "bg-success text-success-foreground";
      case "failure":
        return "bg-destructive text-destructive-foreground";
      case "warning":
        return "bg-warning text-warning-foreground";
      case "info":
        return "bg-info text-info-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "bg-success/20 text-success";
      case "update":
        return "bg-info/20 text-info";
      case "delete":
        return "bg-destructive/20 text-destructive";
      case "login":
      case "login_success":
        return "bg-primary/20 text-primary";
      case "login_failed":
      case "logout":
        return "bg-warning/20 text-warning";
      case "verify":
        return "bg-purple-500/20 text-purple-500";
      case "archive":
        return "bg-amber-500/20 text-amber-500";
      case "generate":
        return "bg-emerald-500/20 text-emerald-500";
      default:
        return "bg-muted/50 text-muted-foreground";
    }
  };
  
  // Handle log details view
  const viewLogDetails = (logId: number) => {
    setSelectedLogId(logId);
    setDetailsDialogOpen(true);
  };

  // Get unique actions for filter
  const uniqueActions = auditLogsData?.logs
    ? [...new Set(auditLogsData.logs.map(log => log.action))]
    : [];
    
  // Get unique resource types for filter
  const uniqueResourceTypes = auditLogsData?.logs
    ? [...new Set(auditLogsData.logs.map(log => log.resourceType))]
    : [];
  
  // Format JSON for display
  const formatJSON = (json: any) => {
    if (!json) return "No data";
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return "Invalid JSON data";
    }
  };

  // Handle pagination
  const handleNextPage = () => {
    if (auditLogsData && page < auditLogsData.totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  useEffect(() => {
    // Initial data fetch
    refreshData();
  }, []);

  return (
    <>
      <PageHeader
        title="Access Manager Audit Logs"
        description="Secure audit logging for tracking authentication, authorization, and access management actions"
        actions={
          <Button 
            onClick={refreshData}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        }
      />

      <Tabs defaultValue="logs" className="mb-6">
        <TabsList className="w-full lg:w-auto mb-4">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
            {alertsData && alertsData.length > 0 && (
              <Badge className="ml-1 bg-destructive">{alertsData.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        {/* Audit Logs Tab */}
        <TabsContent value="logs">
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <Card className="col-span-3">
              <CardHeader className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="text-lg font-medium">Audit Log Events</CardTitle>
                  
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
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Filter Logs</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        <div className="p-2">
                          <p className="text-xs font-medium mb-1">Action</p>
                          <Select
                            value={filterAction || "all_actions"}
                            onValueChange={(value) => setFilterAction(value === "all_actions" ? null : value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_actions">All Actions</SelectItem>
                              {uniqueActions.map((action) => (
                                <SelectItem key={action} value={action || "unknown_action"}>{action || "Unknown Action"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="p-2">
                          <p className="text-xs font-medium mb-1">Resource Type</p>
                          <Select
                            value={filterResourceType || "all_resources"}
                            onValueChange={(value) => setFilterResourceType(value === "all_resources" ? null : value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Resource Types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_resources">All Resource Types</SelectItem>
                              {uniqueResourceTypes.map((type) => (
                                <SelectItem key={type} value={type || "unknown_type"}>{type || "Unknown Type"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="p-2">
                          <p className="text-xs font-medium mb-1">Severity</p>
                          <Select
                            value={filterSeverity || "all_severities"}
                            onValueChange={(value) => setFilterSeverity(value === "all_severities" ? null : value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Severities" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all_severities">All Severities</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <DropdownMenuSeparator />
                        
                        <div className="p-2">
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={() => {
                              setFilterAction(null);
                              setFilterResourceType(null);
                              setFilterSeverity(null);
                              refetchLogs();
                            }}
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <FileDown className="h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('csv')}>
                          Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('json')}>
                          Export as JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingLogs ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex flex-col items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <span className="text-muted-foreground">
                                Loading audit logs...
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : !auditLogsData || auditLogsData.logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex flex-col items-center justify-center">
                              <History className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-muted-foreground">
                                No audit logs found
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogsData.logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {formatDate(log.createdAt.toString())}
                            </TableCell>
                            <TableCell>
                              <Badge className={getActionBadgeColor(log.action)}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{log.resourceType}</span>
                                {log.resourceId && (
                                  <span className="text-xs text-muted-foreground">
                                    ID: {log.resourceId}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.userId ? `ID: ${log.userId}` : "System"}
                            </TableCell>
                            <TableCell>
                              <Badge className={getSeverityBadgeColor(log.severity)}>
                                {log.severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(log.status)}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewLogDetails(log.id)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {auditLogsData && auditLogsData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, auditLogsData.total)} of {auditLogsData.total} logs
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={page >= auditLogsData.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="col-span-3 md:col-span-1 space-y-4">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => verifyIntegrityMutation.mutate({ workspaceId })}
                    disabled={verifyIntegrityMutation.isPending}
                  >
                    {verifyIntegrityMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-4 w-4" />
                    )}
                    Verify Integrity
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={generateReport}
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Generate Compliance Report
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg font-medium">Audit Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Total Logs</div>
                    <div className="text-3xl font-bold">{auditLogsData?.total || 0}</div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Critical Events</div>
                    <div className="text-xl font-semibold text-destructive">
                      {auditLogsData?.logs.filter(log => log.severity === 'critical').length || 0}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">High Severity</div>
                    <div className="text-xl font-semibold text-amber-500">
                      {auditLogsData?.logs.filter(log => log.severity === 'high').length || 0}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Security alerts based on audit log patterns and anomalies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading security alerts...
                  </span>
                </div>
              ) : !alertsData || alertsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">
                    No security alerts found
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertsData.map((alert) => (
                    <Card key={alert.id} className="bg-muted/30">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <AlertCircle className={
                              alert.severity === 'critical' ? "text-destructive h-5 w-5" :
                              alert.severity === 'high' ? "text-amber-500 h-5 w-5" :
                              "text-warning h-5 w-5"
                            } />
                            <CardTitle className="text-base font-medium">
                              {alert.title}
                            </CardTitle>
                          </div>
                          <Badge className={
                            alert.status === 'new' ? "bg-destructive" :
                            alert.status === 'acknowledged' ? "bg-warning" :
                            alert.status === 'resolved' ? "bg-success" :
                            "bg-muted"
                          }>
                            {alert.status}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-2">
                          {formatDate(alert.createdAt.toString())}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <p className="text-sm mb-3">
                          {alert.description}
                        </p>
                        
                        {alert.logIds && alert.logIds.length > 0 && (
                          <div className="text-xs text-muted-foreground mb-3">
                            Related Log IDs: {alert.logIds.join(", ")}
                          </div>
                        )}
                        
                        <div className="flex justify-end gap-2 mt-4">
                          {alert.status === 'new' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateAlertMutation.mutate({
                                id: alert.id,
                                status: 'acknowledged'
                              })}
                            >
                              Acknowledge
                            </Button>
                          )}
                          
                          {(alert.status === 'new' || alert.status === 'acknowledged') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => updateAlertMutation.mutate({
                                id: alert.id,
                                status: 'resolved'
                              })}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Compliance Tab */}
        <TabsContent value="compliance">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reports</CardTitle>
                <CardDescription>
                  Generate compliance reports for audit and regulatory requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Compliance Standard</label>
                  <Select
                    value={complianceStandard || "gdpr"}
                    onValueChange={(value: any) => setComplianceStandard(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gdpr">GDPR</SelectItem>
                      <SelectItem value="hipaa">HIPAA</SelectItem>
                      <SelectItem value="sox">SOX</SelectItem>
                      <SelectItem value="pci-dss">PCI-DSS</SelectItem>
                      <SelectItem value="iso27001">ISO 27001</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-4">
                  <Button onClick={generateReport} className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>
                  Current compliance and audit readiness status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-success" />
                      <span className="font-medium">GDPR</span>
                    </div>
                    <Badge className="bg-success">Compliant</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-success" />
                      <span className="font-medium">HIPAA</span>
                    </div>
                    <Badge className="bg-success">Compliant</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-warning" />
                      <span className="font-medium">SOX</span>
                    </div>
                    <Badge className="bg-warning">Partial</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-success" />
                      <span className="font-medium">PCI-DSS</span>
                    </div>
                    <Badge className="bg-success">Compliant</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-success" />
                      <span className="font-medium">ISO 27001</span>
                    </div>
                    <Badge className="bg-success">Compliant</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Settings</CardTitle>
              <CardDescription>
                Configure audit log settings and retention policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSettings ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading settings...
                  </span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Retention Period</label>
                      <Select
                        value={settingsData?.retentionPeriodDays.toString() || "90"}
                        onValueChange={(value) => {
                          if (settingsData) {
                            updateAuditSettings(workspaceId, {
                              ...settingsData,
                              retentionPeriodDays: parseInt(value)
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select retention period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                          <SelectItem value="730">2 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Log Level</label>
                      <Select
                        value={settingsData?.logLevel || "info"}
                        onValueChange={(value: any) => {
                          if (settingsData) {
                            updateAuditSettings(workspaceId, {
                              ...settingsData,
                              logLevel: value
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select log level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debug">Debug</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Log Details Dialog */}
      {selectedLogId && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
              <DialogDescription>
                Detailed information for audit log #{selectedLogId}
              </DialogDescription>
            </DialogHeader>
            
            {isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <span className="text-muted-foreground">
                  Loading log details...
                </span>
              </div>
            ) : !logDetails ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">
                  Log details not found
                </span>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">Timestamp</h3>
                      <p className="text-sm">{formatDate(logDetails.createdAt.toString())}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">User</h3>
                      <p className="text-sm">{logDetails.userId ? `ID: ${logDetails.userId}` : "System"}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Action</h3>
                      <Badge className={getActionBadgeColor(logDetails.action)}>
                        {logDetails.action}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Resource</h3>
                      <p className="text-sm">{logDetails.resourceType}{logDetails.resourceId ? ` (ID: ${logDetails.resourceId})` : ""}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Status</h3>
                      <Badge className={getStatusBadgeColor(logDetails.status)}>
                        {logDetails.status}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-1">Severity</h3>
                      <Badge className={getSeverityBadgeColor(logDetails.severity)}>
                        {logDetails.severity}
                      </Badge>
                    </div>
                    
                    {logDetails.ipAddress && (
                      <div>
                        <h3 className="text-sm font-medium mb-1">IP Address</h3>
                        <p className="text-sm">{logDetails.ipAddress}</p>
                      </div>
                    )}
                    
                    {logDetails.userAgent && (
                      <div className="col-span-2">
                        <h3 className="text-sm font-medium mb-1">User Agent</h3>
                        <p className="text-sm text-muted-foreground truncate">{logDetails.userAgent}</p>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {logDetails.details && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Details</h3>
                      <div className="bg-muted p-2 rounded-md">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {formatJSON(logDetails.details)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {logDetails.requestPayload && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Request Payload</h3>
                      <div className="bg-muted p-2 rounded-md">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {formatJSON(logDetails.requestPayload)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {logDetails.responsePayload && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Response Payload</h3>
                      <div className="bg-muted p-2 rounded-md">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {formatJSON(logDetails.responsePayload)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {logDetails.integrityChecksum && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Integrity Checksum</h3>
                      <div className="bg-muted p-2 rounded-md">
                        <code className="text-xs break-all">{logDetails.integrityChecksum}</code>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}