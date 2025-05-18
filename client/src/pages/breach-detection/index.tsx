import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  AlertCircle, 
  Info, 
  ArrowRight, 
  BarChart4 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { formatDistanceToNow } from 'date-fns';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

// Security Score Card Component
const SecurityScoreCard = ({ score, recommended }: { score?: number, recommended?: any[] }) => {
  // Ensure we have default values to prevent errors
  const safeScore = typeof score === 'number' ? score : 0;
  const safeRecommended = Array.isArray(recommended) ? recommended : [];
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Security Score
          <BarChart4 className="w-5 h-5 text-primary" />
        </CardTitle>
        <CardDescription>
          Overall security posture assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className={`
                  text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full 
                  ${safeScore >= 70 ? 'bg-green-200 text-green-800' : 
                   safeScore >= 40 ? 'bg-yellow-200 text-yellow-800' : 
                   'bg-red-200 text-red-800'}
                `}>
                  {safeScore >= 70 ? 'Good' : safeScore >= 40 ? 'Needs Attention' : 'Critical'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-primary">
                  {safeScore}/100
                </span>
              </div>
            </div>
            <Progress value={safeScore} className="w-full" />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Recommended Actions</h3>
            {safeRecommended.length > 0 ? (
              <ul className="space-y-2">
                {safeRecommended.slice(0, 3).map((action, index) => (
                  <li key={index} className="flex items-start">
                    <span className={`
                      flex-shrink-0 inline-flex rounded-full p-1 mr-2 mt-0.5
                      ${action?.priority === 'critical' ? 'bg-red-100 text-red-600' : 
                       action?.priority === 'high' ? 'bg-orange-100 text-orange-600' : 
                       action?.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 
                       'bg-blue-100 text-blue-600'}
                    `}>
                      {action?.priority === 'critical' ? <AlertCircle className="h-3 w-3" /> : 
                       action?.priority === 'high' ? <AlertTriangle className="h-3 w-3" /> : 
                       action?.priority === 'medium' ? <Info className="h-3 w-3" /> : 
                       <Shield className="h-3 w-3" />}
                    </span>
                    <span className="text-sm">{action?.action || 'Unspecified action'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recommended actions at this time.</p>
            )}
            {safeRecommended.length > 3 && (
              <Button variant="link" size="sm" className="mt-2 text-xs" asChild>
                <Link to="/breach-detection/actions">
                  View all {safeRecommended.length} recommended actions <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Breach Stats Card Component
const BreachStatsCard = ({ stats }: { stats: any }) => {
  // Ensure stats has a default value to prevent errors
  const safeStats = stats || {
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    false_positive: 0
  };
  
  // Use optional chaining with default values
  const severityCritical = safeStats.bySeverity?.critical || 0;
  const severityHigh = safeStats.bySeverity?.high || 0;
  const severityMedium = safeStats.bySeverity?.medium || 0;
  const severityLow = safeStats.bySeverity?.low || 0;
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Breach Detection</CardTitle>
        <CardDescription>Current security breach status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <span className="text-2xl font-bold text-red-600">{severityCritical}</span>
            <span className="text-xs text-red-600 font-medium">Critical</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-orange-500 mb-2" />
            <span className="text-2xl font-bold text-orange-600">{severityHigh}</span>
            <span className="text-xs text-orange-600 font-medium">High</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
            <span className="text-2xl font-bold text-yellow-600">{severityMedium}</span>
            <span className="text-xs text-yellow-600 font-medium">Medium</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
            <Info className="h-8 w-8 text-blue-500 mb-2" />
            <span className="text-2xl font-bold text-blue-600">{severityLow}</span>
            <span className="text-xs text-blue-600 font-medium">Low</span>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Status Breakdown</span>
            <span className="text-xs text-muted-foreground">Total: {safeStats.total || 0}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
                <span className="text-sm">Open</span>
              </div>
              <span className="text-sm font-medium">{safeStats.open || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
                <span className="text-sm">In Progress</span>
              </div>
              <span className="text-sm font-medium">{safeStats.in_progress || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                <span className="text-sm">Resolved</span>
              </div>
              <span className="text-sm font-medium">{safeStats.resolved || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-gray-500 mr-2"></span>
                <span className="text-sm">False Positive</span>
              </div>
              <span className="text-sm font-medium">{safeStats.false_positive || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/breach-detection/breaches">
            View All Breaches
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// IP Access Card Component
const IPAccessCard = ({ stats }: { stats: any }) => {
  // Ensure stats has a default value to prevent errors
  const safeStats = stats || {
    violationsLast24h: 0,
    suspiciousActivity: 0,
    allowedTotal: 0,
    blockedTotal: 0
  };
  
  // Safe access to values
  const violationsLast24h = safeStats.violationsLast24h || 0;
  const suspiciousActivity = safeStats.suspiciousActivity || 0;
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>IP Access Control</CardTitle>
        <CardDescription>Access control violations monitoring</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Access Violations (24h)</span>
              <span className={`text-sm font-medium ${violationsLast24h > 10 ? 'text-red-600' : 'text-gray-700'}`}>
                {violationsLast24h}
              </span>
            </div>
            <Progress value={Math.min(violationsLast24h / 20 * 100, 100)} className="w-full" />
          </div>
          
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Suspicious Activities</span>
              <span className={`text-sm font-medium ${suspiciousActivity > 5 ? 'text-red-600' : 'text-gray-700'}`}>
                {suspiciousActivity}
              </span>
            </div>
            <Progress value={Math.min(suspiciousActivity / 10 * 100, 100)} className="w-full" />
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 mt-6">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Allowed</span>
              <span className="text-lg font-semibold">{safeStats.allowedTotal || 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Blocked</span>
              <span className="text-lg font-semibold">{safeStats.blockedTotal || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/ip-access-control">
            Manage IP Access Control
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// Token Usage Card Component
const TokenUsageCard = ({ stats }: { stats: any }) => {
  // Ensure stats has a default value to prevent errors
  const safeStats = stats || {
    activeTokens: 0,
    revokedLast7Days: 0,
    expiredLast7Days: 0,
    rateLimitExceeded: 0,
    scopeViolations: 0,
    timeViolations: 0,
    geoViolations: 0
  };
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Token Monitoring</CardTitle>
        <CardDescription>OAuth token usage analytics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted-foreground">Active Tokens</div>
              <div className="text-2xl font-bold">{safeStats.activeTokens || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Revoked (7d)</div>
              <div className="text-2xl font-bold">{safeStats.revokedLast7Days || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Expired (7d)</div>
              <div className="text-2xl font-bold">{safeStats.expiredLast7Days || 0}</div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-2">Suspicious Usage (24h)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Rate Exceeded</span>
                  <span className="text-sm font-semibold">{safeStats.rateLimitExceeded || 0}</span>
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Scope Violations</span>
                  <span className="text-sm font-semibold">{safeStats.scopeViolations || 0}</span>
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Time Violations</span>
                  <span className="text-sm font-semibold">{safeStats.timeViolations || 0}</span>
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs">Geo Violations</span>
                  <span className="text-sm font-semibold">{safeStats.geoViolations || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/token-management">
            Manage Token Policies
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// Breach Detection Overview Page
const BreachDetectionOverview = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Fetch security overview data
  const { data: overviewData, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['/api/breach-detection/overview'],
    staleTime: 60000, // 1 minute
  });
  
  // Fetch breaches with applied filters
  const { data: breachesData, isLoading: breachesLoading, error: breachesError } = useQuery({
    queryKey: [
      '/api/breach-detection/breaches', 
      {
        workspaceId: workspaceFilter !== "all" ? workspaceFilter : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
      }
    ],
    staleTime: 60000, // 1 minute
  });
  
  // Show errors if any
  React.useEffect(() => {
    if (overviewError) {
      toast({
        variant: "destructive",
        title: "Failed to load security overview",
        description: "Please try again or contact support.",
      });
    }
    
    if (breachesError) {
      toast({
        variant: "destructive",
        title: "Failed to load breach detections",
        description: "Please try again or contact support.",
      });
    }
  }, [overviewError, breachesError, toast]);
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown';
    }
  };
  
  // Get severity badge
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="border-red-500 text-red-500">Open</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">In Progress</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="border-green-500 text-green-500">Resolved</Badge>;
      case 'false_positive':
        return <Badge variant="outline" className="border-gray-500 text-gray-500">False Positive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Enhanced Breach Detection</h1>
        <p className="text-muted-foreground">
          Monitor and respond to security breaches across your infrastructure
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breaches">Active Breaches</TabsTrigger>
          <TabsTrigger value="rules">Detection Rules</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="h-full">
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : overviewData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SecurityScoreCard 
                  score={overviewData.securityScore} 
                  recommended={overviewData.recommendedActions} 
                />
                <BreachStatsCard stats={overviewData.breachDetection} />
                <IPAccessCard stats={overviewData.ipAccess} />
                <TokenUsageCard stats={overviewData.tokenUsage} />
              </div>
              
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Recent Security Events</CardTitle>
                  <CardDescription>Latest breach detections and security incidents</CardDescription>
                </CardHeader>
                <CardContent>
                  {breachesData && breachesData.data && breachesData.data.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Detected</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {breachesData.data.slice(0, 5).map((breach: any) => (
                          <TableRow key={breach.id}>
                            <TableCell className="font-medium">{breach.title}</TableCell>
                            <TableCell>{getSeverityBadge(breach.severity)}</TableCell>
                            <TableCell>{getStatusBadge(breach.status)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{breach.source}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(breach.detectedAt)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/breach-detection/breaches/${breach.id}`}>
                                  <span>View</span>
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <ShieldCheck className="w-12 h-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium text-center">No security events detected</h3>
                      <p className="text-sm text-center text-muted-foreground mt-1">
                        Your system is currently clear of detected breaches
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="ml-auto" asChild>
                    <Link to="/breach-detection/breaches">
                      View All Breaches
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-medium">Failed to load security overview</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please try refreshing the page or contact support
              </p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Breaches Tab */}
        <TabsContent value="breaches">
          <Card>
            <CardHeader>
              <CardTitle>Active Breach Detections</CardTitle>
              <CardDescription>
                Monitor and manage security breaches detected in your system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search breaches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Workspaces</SelectItem>
                      <SelectItem value="1">Production</SelectItem>
                      <SelectItem value="2">Development</SelectItem>
                      <SelectItem value="3">Testing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {breachesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : breachesData && breachesData.data && breachesData.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breachesData.data.map((breach: any) => (
                      <TableRow key={breach.id}>
                        <TableCell className="font-medium">{breach.title}</TableCell>
                        <TableCell>{getSeverityBadge(breach.severity)}</TableCell>
                        <TableCell>{getStatusBadge(breach.status)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{breach.source}</Badge>
                        </TableCell>
                        <TableCell>{breach.workspaceName || 'Global'}</TableCell>
                        <TableCell>{formatDate(breach.detectedAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/breach-detection/breaches/${breach.id}`}>
                              <span>View</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShieldCheck className="w-12 h-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">No breaches found</h3>
                  {(searchQuery || severityFilter !== "all" || statusFilter !== "all" || workspaceFilter !== "all") ? (
                    <p className="text-sm text-center text-muted-foreground mt-1 max-w-md">
                      No breaches match your current filters. Try adjusting your search criteria.
                    </p>
                  ) : (
                    <p className="text-sm text-center text-muted-foreground mt-1 max-w-md">
                      Your system is currently clear of detected breaches
                    </p>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => {
                setSearchQuery("");
                setSeverityFilter("all");
                setStatusFilter("all");
                setWorkspaceFilter("all");
              }}>
                Reset Filters
              </Button>
              <Button asChild>
                <Link to="/breach-detection/breaches/new">
                  Create Manual Report
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Breach Detection Rules</CardTitle>
              <CardDescription>
                Configure and manage rules used to detect security breaches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 text-center">
                <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-medium">Detection Rules Configuration</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Create and manage behavior, signature, anomaly, and correlation rules to detect security breaches in your system.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/breach-detection/rules">
                    Manage Detection Rules
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BreachDetectionOverview;