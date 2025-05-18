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
  FileText
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

export default function EnhancedAuditPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [complianceStandard, setComplianceStandard] = useState<'gdpr' | 'hipaa' | 'sox' | 'pci-dss' | 'iso27001'>('gdpr');
  
  const workspaceId = user?.workspaceId || 1; // Default to workspace 1 if not available

  // Fetch enhanced audit logs
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
  
  // Fetch audit archives
  const {
    data: archivesData,
    isLoading: isLoadingArchives,
    refetch: refetchArchives,
  } = useQuery({
    queryKey: ['/api/audit/archives', workspaceId],
    queryFn: () => getAuditArchives(workspaceId),
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
  
  // Archive logs mutation
  const archiveLogsMutation = useMutation({
    mutationFn: (options: { workspaceId?: number, olderThan?: Date }) => 
      archiveAuditLogs(options),
    onSuccess: (data) => {
      refetchLogs();
      refetchArchives();
      toast({
        title: "Logs Archived",
        description: `Successfully archived ${data.recordCount} logs`,
      });
    },
    onError: (error) => {
      toast({
        title: "Archive Failed",
        description: error instanceof Error ? error.message : "Failed to archive logs",
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
  
  // Search logs function
  const searchLogs = async () => {
    if (!searchQuery.trim()) {
      refetchLogs();
      return;
    }
    
    setIsRefreshing(true);
    try {
      const result = await searchAuditLogs(searchQuery, { page, limit, workspaceId });
      // Update UI with search results
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

  return (
    <>
      <DashboardHeader
        title="Enhanced Audit System"
        subtitle="Enterprise-grade audit logs for compliance and security"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
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
          <TabsTrigger value="archives" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archives
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
                            value={filterAction || ""}
                            onValueChange={(value) => setFilterAction(value || null)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Actions</SelectItem>
                              {uniqueActions.map((action) => (
                                <SelectItem key={action} value={action}>{action}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="p-2">
                          <p className="text-xs font-medium mb-1">Resource Type</p>
                          <Select
                            value={filterResourceType || ""}
                            onValueChange={(value) => setFilterResourceType(value || null)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Resource Types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Resource Types</SelectItem>
                              {uniqueResourceTypes.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="p-2">
                          <p className="text-xs font-medium mb-1">Severity</p>
                          <Select
                            value={filterSeverity || ""}
                            onValueChange={(value) => setFilterSeverity(value || null)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="All Severities" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Severities</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <DropdownMenuSeparator />
                        
                        <div className="p-2 flex justify-between">
                          <Button variant="outline" size="sm"
                            onClick={() => {
                              setFilterAction(null);
                              setFilterResourceType(null);
                              setFilterSeverity(null);
                            }}
                          >
                            Clear Filters
                          </Button>
                          <Button size="sm"
                            onClick={() => {
                              refetchLogs();
                            }}
                          >
                            Apply Filters
                          </Button>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <FileDown className="h-4 w-4" />
                          Export
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Export Logs</DropdownMenuLabel>
                        <DropdownMenuSeparator />
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
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingLogs || isRefreshing ? (
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
                            <TableCell className="text-sm">
                              {log.userId ? `ID: ${log.userId}` : "System"}
                            </TableCell>
                            <TableCell>
                              <Badge className={getActionBadgeColor(log.action)}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.resourceType}</TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(log.status)}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getSeverityBadgeColor(log.severity)}>
                                {log.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => viewLogDetails(log.id)}
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View details</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              
              <CardFooter className="bg-muted/50 py-3 px-6 flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {auditLogsData && (
                    <>
                      Showing <span className="font-medium">{auditLogsData.logs.length}</span> of{" "}
                      <span className="font-medium">{auditLogsData.total}</span> logs
                      {(filterAction || filterResourceType || filterSeverity) && (
                        <Button 
                          variant="link" 
                          className="text-xs p-0 h-auto ml-2"
                          onClick={() => {
                            setFilterAction(null);
                            setFilterResourceType(null);
                            setFilterSeverity(null);
                            refetchLogs();
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm mx-2">
                      Page {page} of {auditLogsData?.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={auditLogsData?.totalPages === undefined || page >= auditLogsData.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                  
                  <Select
                    value={limit.toString()}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1); // Reset to first page when changing limit
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardFooter>
            </Card>
            
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Audit Verification</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={() => verifyIntegrityMutation.mutate({ workspaceId })}
                      disabled={verifyIntegrityMutation.isPending}
                    >
                      {verifyIntegrityMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Verify Integrity
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Archive logs older than 90 days
                        const olderThan = new Date();
                        olderThan.setDate(olderThan.getDate() - 90);
                        archiveLogsMutation.mutate({ workspaceId, olderThan });
                      }}
                      disabled={archiveLogsMutation.isPending}
                    >
                      {archiveLogsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Archiving...
                        </>
                      ) : (
                        <>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive Old Logs
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select
                      value={complianceStandard}
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
                    
                    <Button 
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={generateReport}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Report
                    </Button>
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
              <CardTitle>Audit Alerts</CardTitle>
              <CardDescription>Security and compliance alerts that need attention</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !alertsData || alertsData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No alerts found</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertsData.map((alert) => (
                    <Card key={alert.id} className={alert.status === 'new' ? 'border-destructive' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge className={`${getSeverityBadgeColor(alert.severity)} mb-2`}>
                              {alert.severity}
                            </Badge>
                            <CardTitle className="text-base">{alert.title}</CardTitle>
                          </div>
                          <Badge variant={alert.status === 'new' ? 'default' : alert.status === 'acknowledged' ? 'outline' : 'secondary'}>
                            {alert.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-sm">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created at: {formatDate(alert.createdAt.toString())}
                        </p>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2">
                        {alert.status === 'new' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAlertMutation.mutate({ id: alert.id, status: 'acknowledged' })}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {alert.status !== 'resolved' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => updateAlertMutation.mutate({ id: alert.id, status: 'resolved', notes: 'Resolved by admin' })}
                          >
                            Resolve
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Compliance Tab */}
        <TabsContent value="compliance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Standards</CardTitle>
                <CardDescription>Audit logs are configured for these compliance standards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <Shield className="h-8 w-8 text-green-500 mt-1" />
                    <div>
                      <h4 className="text-base font-medium">GDPR Compliance</h4>
                      <p className="text-sm text-muted-foreground">
                        Logs maintain compliance with Article 30 recordkeeping requirements
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-start space-x-4">
                    <Shield className="h-8 w-8 text-blue-500 mt-1" />
                    <div>
                      <h4 className="text-base font-medium">HIPAA Audit Controls</h4>
                      <p className="text-sm text-muted-foreground">
                        Records and examines access and activity as required by §164.312(b)
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-start space-x-4">
                    <Shield className="h-8 w-8 text-amber-500 mt-1" />
                    <div>
                      <h4 className="text-base font-medium">SOX Compliance</h4>
                      <p className="text-sm text-muted-foreground">
                        Maintains audit trail for financial systems access and changes
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-start space-x-4">
                    <Shield className="h-8 w-8 text-purple-500 mt-1" />
                    <div>
                      <h4 className="text-base font-medium">PCI-DSS Requirements</h4>
                      <p className="text-sm text-muted-foreground">
                        Tracks and monitors access to network resources and cardholder data
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reporting</CardTitle>
                <CardDescription>Generate compliance reports for audits and reviews</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Compliance Standard</label>
                        <Select
                          value={complianceStandard}
                          onValueChange={(value: any) => setComplianceStandard(value)}
                        >
                          <SelectTrigger className="w-full mt-1">
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
                      
                      <div>
                        <label className="text-sm font-medium">Date Range</label>
                        <Select defaultValue="30days">
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7days">Last 7 days</SelectItem>
                            <SelectItem value="30days">Last 30 days</SelectItem>
                            <SelectItem value="90days">Last 90 days</SelectItem>
                            <SelectItem value="year">Last year</SelectItem>
                            <SelectItem value="custom">Custom range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button className="w-full" onClick={generateReport}>
                      Generate Compliance Report
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-3">Recent Reports</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div>
                          <div className="text-sm font-medium">GDPR Compliance Report</div>
                          <div className="text-xs text-muted-foreground">Generated on May 1, 2025</div>
                        </div>
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 border rounded-md">
                        <div>
                          <div className="text-sm font-medium">HIPAA Audit Report</div>
                          <div className="text-xs text-muted-foreground">Generated on April 15, 2025</div>
                        </div>
                        <Button variant="outline" size="sm">View</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Archives Tab */}
        <TabsContent value="archives">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Archives</CardTitle>
              <CardDescription>Long-term storage of audit logs based on retention policy</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingArchives ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !archivesData || archivesData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Archive className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No archives found</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archive ID</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Record Count</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivesData.map((archive) => (
                      <TableRow key={archive.id}>
                        <TableCell className="font-mono text-xs">{archive.batchId}</TableCell>
                        <TableCell>
                          {formatDate(archive.fromTimestamp.toString()).split(',')[0]} to {formatDate(archive.toTimestamp.toString()).split(',')[0]}
                        </TableCell>
                        <TableCell>{archive.recordCount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={archive.status === 'active' ? 'default' : 'secondary'}>
                            {archive.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(archive.createdAt.toString())}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Archive logs older than 90 days
                    const olderThan = new Date();
                    olderThan.setDate(olderThan.getDate() - 90);
                    archiveLogsMutation.mutate({ workspaceId, olderThan });
                  }}
                  disabled={archiveLogsMutation.isPending}
                >
                  {archiveLogsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  Archive Old Logs
                </Button>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Archives are stored according to your retention policy
                </p>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Audit Log Settings</CardTitle>
              <CardDescription>Configure audit log behavior for your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSettings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !settingsData ? (
                <div className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Settings className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No settings found</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-medium mb-1">Retention Policy</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Configure how long audit logs are stored in the system
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Retention Period (days)</label>
                          <Input
                            type="number"
                            value={settingsData.retentionPeriodDays}
                            onChange={() => {}}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Archive After (days)</label>
                          <Input
                            type="number"
                            value={settingsData.archiveAfterDays}
                            onChange={() => {}}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-base font-medium mb-1">Security Settings</h3>
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">PII Masking</div>
                          <div className="text-sm text-muted-foreground">
                            Automatically mask personal data in logs
                          </div>
                        </div>
                        <Badge variant={settingsData.maskPiiEnabled ? 'default' : 'outline'}>
                          {settingsData.maskPiiEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">Encryption</div>
                          <div className="text-sm text-muted-foreground">
                            Encrypt sensitive audit log data
                          </div>
                        </div>
                        <Badge variant={settingsData.encryptionEnabled ? 'default' : 'outline'}>
                          {settingsData.encryptionEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">Integrity Checks</div>
                          <div className="text-sm text-muted-foreground">
                            Regularly verify log integrity
                          </div>
                        </div>
                        <Badge variant={settingsData.integrityCheckEnabled ? 'default' : 'outline'}>
                          {settingsData.integrityCheckEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-medium mb-1">Integration Settings</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Configure external system integrations for audit logs
                      </p>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">SIEM Integration</div>
                          <div className="text-sm text-muted-foreground">
                            Forward logs to external SIEM system
                          </div>
                        </div>
                        <Badge variant={settingsData.siemIntegrationEnabled ? 'default' : 'outline'}>
                          {settingsData.siemIntegrationEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">Log Forwarding</div>
                          <div className="text-sm text-muted-foreground">
                            Forward logs to external systems
                          </div>
                        </div>
                        <Badge variant={settingsData.logForwardingEnabled ? 'default' : 'outline'}>
                          {settingsData.logForwardingEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium">Alerting</div>
                          <div className="text-sm text-muted-foreground">
                            Generate alerts for suspicious activities
                          </div>
                        </div>
                        <Badge variant={settingsData.alertingEnabled ? 'default' : 'outline'}>
                          {settingsData.alertingEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-base font-medium mb-1">Compliance Settings</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Configure compliance-specific audit requirements
                      </p>
                      
                      <div className="space-y-2">
                        <div className="bg-muted/40 p-3 rounded-md">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 mr-2 text-blue-500" />
                            <span className="font-medium">GDPR Compliance</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Data subject access audit trails enabled
                          </p>
                        </div>
                        
                        <div className="bg-muted/40 p-3 rounded-md">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 mr-2 text-green-500" />
                            <span className="font-medium">HIPAA Compliance</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            PHI access logging and monitoring enabled
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Log Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !logDetails ? (
            <div className="text-center py-8">
              <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Log details not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Event Information</h4>
                  <div className="bg-muted/40 p-3 rounded-md space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">ID:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.id}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Timestamp:</div>
                      <div className="text-xs font-medium col-span-2">{formatDate(logDetails.createdAt.toString())}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">User ID:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.userId || "System"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Action:</div>
                      <div className="col-span-2">
                        <Badge className={getActionBadgeColor(logDetails.action)}>
                          {logDetails.action}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Resource:</div>
                      <div className="text-xs font-medium col-span-2">
                        {logDetails.resourceType}{logDetails.resourceId ? ` (${logDetails.resourceId})` : ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Status:</div>
                      <div className="col-span-2">
                        <Badge className={getStatusBadgeColor(logDetails.status)}>
                          {logDetails.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Severity:</div>
                      <div className="col-span-2">
                        <Badge className={getSeverityBadgeColor(logDetails.severity)}>
                          {logDetails.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-1">Request Information</h4>
                  <div className="bg-muted/40 p-3 rounded-md space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">IP Address:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.ipAddress || "N/A"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">User Agent:</div>
                      <div className="text-xs font-medium col-span-2 break-all">{logDetails.userAgent || "N/A"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Session ID:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.sessionId || "N/A"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Location:</div>
                      <div className="text-xs font-medium col-span-2">
                        {logDetails.geoLocation ? 
                          `${logDetails.geoLocation.city || ''}, ${logDetails.geoLocation.region || ''}, ${logDetails.geoLocation.country || ''}`.replace(/(^,\s*)|(,\s*$)/g, '') : 
                          "N/A"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Workspace:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.workspaceId || "N/A"}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="text-xs text-muted-foreground">Compliance:</div>
                      <div className="text-xs font-medium col-span-2">{logDetails.complianceCategory || "N/A"}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium mb-2">Event Details</h4>
                <div className="bg-muted/40 p-3 rounded-md overflow-auto max-h-[200px]">
                  <pre className="text-xs">{formatJSON(logDetails.details)}</pre>
                </div>
              </div>
              
              {(logDetails.requestPayload || logDetails.responsePayload) && (
                <>
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    {logDetails.requestPayload && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Request Payload</h4>
                        <div className="bg-muted/40 p-3 rounded-md overflow-auto max-h-[200px]">
                          <pre className="text-xs">{formatJSON(logDetails.requestPayload)}</pre>
                        </div>
                      </div>
                    )}
                    
                    {logDetails.responsePayload && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Response Payload</h4>
                        <div className="bg-muted/40 p-3 rounded-md overflow-auto max-h-[200px]">
                          <pre className="text-xs">{formatJSON(logDetails.responsePayload)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {logDetails.isEncrypted && (
                <p className="text-xs text-muted-foreground">
                  <Info className="h-3 w-3 inline-block mr-1" />
                  Some data in this log is encrypted for security.
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
