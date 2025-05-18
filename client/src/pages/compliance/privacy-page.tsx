import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Lock, ShieldCheck, Search, Eye, EyeOff, Users, Filter, Database, File, FileText, 
  Settings, MoreHorizontal, Download, RefreshCw, Clock, Trash2, Circle, CheckCircle, 
  XCircle, AlertCircle, Plus, UserRoundX, ShieldAlert
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PrivacyControlsPage() {
  const [activeTab, setActiveTab] = useState("data-map");
  const [filterRegulation, setFilterRegulation] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Mock query for privacy controls data
  const { data: privacyData, isLoading } = useQuery({
    queryKey: ["/api/compliance/privacy"],
    queryFn: async () => {
      // This would fetch from the actual endpoint in a real implementation
      return {
        dataInventory: [
          {
            id: "db-users",
            name: "User Profiles",
            category: "Personal Data",
            location: "Main Database",
            dataSubjects: "Users",
            dataFields: ["Full Name", "Email", "Phone Number", "Address"],
            retention: "3 years after account deletion",
            processingPurpose: "Account Management",
            legalBasis: "Contractual Necessity",
            regulations: ["GDPR", "CCPA", "LGPD"],
            riskLevel: "high",
            lastReview: "2023-04-12T10:00:00Z"
          },
          {
            id: "db-transactions",
            name: "Transaction History",
            category: "Financial Data",
            location: "Finance Database",
            dataSubjects: "Customers",
            dataFields: ["Transaction ID", "Amount", "Date", "Payment Method"],
            retention: "7 years",
            processingPurpose: "Financial Record Keeping",
            legalBasis: "Legal Obligation",
            regulations: ["GDPR", "SOX"],
            riskLevel: "high",
            lastReview: "2023-03-15T14:30:00Z"
          },
          {
            id: "analytics-usage",
            name: "Usage Analytics",
            category: "Behavioral Data",
            location: "Analytics Platform",
            dataSubjects: "Users",
            dataFields: ["User ID", "Page Views", "Features Used", "Session Duration"],
            retention: "2 years",
            processingPurpose: "Product Improvement",
            legalBasis: "Legitimate Interest",
            regulations: ["GDPR", "CCPA"],
            riskLevel: "medium",
            lastReview: "2023-04-25T09:15:00Z"
          },
          {
            id: "mcp-messages",
            name: "MCP Interaction Logs",
            category: "Communication Data",
            location: "Secure Log Storage",
            dataSubjects: "MCP Users",
            dataFields: ["User ID", "Message Content", "Timestamp"],
            retention: "1 year",
            processingPurpose: "Service Delivery",
            legalBasis: "Contractual Necessity",
            regulations: ["GDPR", "CCPA", "HIPAA"],
            riskLevel: "high",
            lastReview: "2023-04-30T16:45:00Z"
          },
          {
            id: "marketing-list",
            name: "Marketing Contacts",
            category: "Contact Data",
            location: "Marketing CRM",
            dataSubjects: "Prospects",
            dataFields: ["Email", "Name", "Company", "Industry"],
            retention: "Until opt-out",
            processingPurpose: "Marketing Communications",
            legalBasis: "Consent",
            regulations: ["GDPR", "CAN-SPAM", "CCPA"],
            riskLevel: "medium",
            lastReview: "2023-03-20T11:30:00Z"
          }
        ],
        privacyRequests: [
          {
            id: "dsrq-001",
            requestType: "access",
            status: "completed",
            submittedAt: "2023-04-15T09:30:00Z",
            completedAt: "2023-04-18T14:15:00Z",
            dataSubject: "john.doe@example.com",
            regulation: "GDPR",
            datasets: ["User Profiles", "Transaction History", "Usage Analytics"],
            requestDetails: "Subject requested copy of all personal data",
            completionTime: 74 // hours
          },
          {
            id: "dsrq-002",
            requestType: "deletion",
            status: "in-progress",
            submittedAt: "2023-05-01T13:20:00Z",
            completedAt: null,
            dataSubject: "sarah.smith@example.com",
            regulation: "CCPA",
            datasets: ["User Profiles", "Marketing Contacts"],
            requestDetails: "Request for complete account deletion",
            completionTime: null
          },
          {
            id: "dsrq-003",
            requestType: "correction",
            status: "completed",
            submittedAt: "2023-04-10T10:45:00Z",
            completedAt: "2023-04-11T16:30:00Z",
            dataSubject: "robert.jones@example.com",
            regulation: "GDPR",
            datasets: ["User Profiles"],
            requestDetails: "Correction of name and address information",
            completionTime: 30 // hours
          },
          {
            id: "dsrq-004",
            requestType: "access",
            status: "rejected",
            submittedAt: "2023-04-28T15:10:00Z",
            completedAt: "2023-04-29T11:45:00Z",
            dataSubject: "unknown@example.com",
            regulation: "GDPR",
            datasets: [],
            requestDetails: "Unable to verify identity of requestor after multiple attempts",
            completionTime: 21 // hours
          }
        ],
        consentRecords: [
          {
            id: "cons-001",
            userId: "user-12345",
            email: "john.doe@example.com",
            marketingConsent: true,
            dataAnalyticsConsent: true,
            thirdPartyConsent: false,
            cookiesConsent: true,
            consentVersion: "1.2",
            consentDate: "2023-03-10T14:30:00Z",
            consentMethod: "Web Form",
            ipAddress: "192.168.1.101",
            lastUpdated: "2023-04-15T09:45:00Z"
          },
          {
            id: "cons-002",
            userId: "user-54321",
            email: "sarah.smith@example.com",
            marketingConsent: false,
            dataAnalyticsConsent: true,
            thirdPartyConsent: false,
            cookiesConsent: true,
            consentVersion: "1.2",
            consentDate: "2023-02-20T10:15:00Z",
            consentMethod: "Mobile App",
            ipAddress: "192.168.1.102",
            lastUpdated: "2023-02-20T10:15:00Z"
          },
          {
            id: "cons-003",
            userId: "user-67890",
            email: "robert.jones@example.com",
            marketingConsent: true,
            dataAnalyticsConsent: true,
            thirdPartyConsent: true,
            cookiesConsent: true,
            consentVersion: "1.1",
            consentDate: "2022-11-05T16:45:00Z",
            consentMethod: "Web Form",
            ipAddress: "192.168.1.103",
            lastUpdated: "2023-01-10T11:20:00Z"
          }
        ]
      };
    }
  });
  
  // Filter data based on search query and regulation filter
  const getFilteredItems = (list: any[], regulationField = 'regulations') => {
    if (!list) return [];
    
    let filtered = list;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        (item.name?.toLowerCase().includes(query)) || 
        (item.dataSubject?.toLowerCase().includes(query)) ||
        (item.email?.toLowerCase().includes(query)) ||
        (item.userId?.toLowerCase().includes(query))
      );
    }
    
    // Apply regulation filter
    if (filterRegulation !== 'all' && regulationField) {
      filtered = filtered.filter(item => 
        item[regulationField]?.includes(filterRegulation)
      );
    }
    
    return filtered;
  };
  
  const filteredInventory = privacyData?.dataInventory ? 
    getFilteredItems(privacyData.dataInventory) : [];
  
  const filteredRequests = privacyData?.privacyRequests ? 
    getFilteredItems(privacyData.privacyRequests, 'regulation') : [];
  
  const filteredConsent = privacyData?.consentRecords ? 
    getFilteredItems(privacyData.consentRecords) : [];
  
  const getRiskBadge = (riskLevel: string) => {
    switch(riskLevel.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-500 hover:bg-red-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>;
      default:
        return <Badge>{riskLevel}</Badge>;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>
          </div>
        );
      case 'in-progress':
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-500" />
            <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <Badge className="bg-red-500 hover:bg-red-600">Rejected</Badge>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>
          </div>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const formatDateRelative = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Controls</h1>
          <p className="text-muted-foreground mt-1">
            Manage data privacy compliance, subject requests, and consent records
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Select value={filterRegulation} onValueChange={setFilterRegulation}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by regulation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regulations</SelectItem>
                <SelectItem value="GDPR">GDPR</SelectItem>
                <SelectItem value="CCPA">CCPA</SelectItem>
                <SelectItem value="HIPAA">HIPAA</SelectItem>
                <SelectItem value="SOX">SOX</SelectItem>
                <SelectItem value="LGPD">LGPD</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="relative w-64">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Alert className="mb-6">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Compliance Status</AlertTitle>
        <AlertDescription>
          Your organization is currently compliant with GDPR, CCPA, and HIPAA regulations. 
          Privacy impact assessments are up to date for high-risk data processing activities.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="data-map">
            <Database className="h-4 w-4 mr-2" />
            Data Inventory
          </TabsTrigger>
          <TabsTrigger value="dsr">
            <Users className="h-4 w-4 mr-2" />
            Privacy Requests
          </TabsTrigger>
          <TabsTrigger value="consent">
            <FileText className="h-4 w-4 mr-2" />
            Consent Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="data-map" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Data Processing Inventory</CardTitle>
                  <CardDescription>
                    Map of personal data processing activities within the organization
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data Asset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Data Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Data Subjects</TableHead>
                    <TableHead>Storage Location</TableHead>
                    <TableHead>Legal Basis</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Regulations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        Loading data inventory...
                      </TableCell>
                    </TableRow>
                  ) : filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.dataSubjects}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Lock className="h-3.5 w-3.5 text-primary" />
                            {item.location}
                          </span>
                        </TableCell>
                        <TableCell>{item.legalBasis}</TableCell>
                        <TableCell>{item.retention}</TableCell>
                        <TableCell>{getRiskBadge(item.riskLevel)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.regulations.map((reg: string, index: number) => (
                              <Badge 
                                key={index} 
                                variant="secondary" 
                                className="text-xs py-0"
                              >
                                {reg}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Settings className="h-4 w-4 mr-2" />
                                Edit Record
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <File className="h-4 w-4 mr-2" />
                                Privacy Impact Assessment
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                        No data assets found matching your search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="dsr" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Data Subject Requests</CardTitle>
                  <CardDescription>
                    Track and process privacy requests from data subjects
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Open Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-1 text-primary">
                      {privacyData?.privacyRequests?.filter(r => r.status === 'in-progress' || r.status === 'pending').length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {privacyData?.privacyRequests?.some(r => r.status === 'in-progress') ?
                        "Requests awaiting processing" :
                        "No pending requests"}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Avg. Response Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-1 text-primary">
                      {(() => {
                        const completedRequests = privacyData?.privacyRequests?.filter(r => r.completionTime);
                        if (!completedRequests || completedRequests.length === 0) return "N/A";
                        
                        const avgTime = completedRequests.reduce((sum, r) => sum + (r.completionTime || 0), 0) / completedRequests.length;
                        return `${Math.round(avgTime)} hrs`;
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      For completed requests
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Compliance Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-1 text-primary">
                      {(() => {
                        const total = privacyData?.privacyRequests?.length || 0;
                        if (total === 0) return "N/A";
                        
                        const completed = privacyData?.privacyRequests?.filter(r => r.status === 'completed').length || 0;
                        return `${Math.round((completed / total) * 100)}%`;
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Successfully completed requests
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Data Subject</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Regulation</TableHead>
                    <TableHead>Completion Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        Loading privacy requests...
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {request.requestType === 'access' ? (
                              <Eye className="h-4 w-4 text-blue-500" />
                            ) : request.requestType === 'deletion' ? (
                              <UserRoundX className="h-4 w-4 text-red-500" />
                            ) : (
                              <File className="h-4 w-4 text-green-500" />
                            )}
                            {request.id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {request.requestType}
                          </Badge>
                        </TableCell>
                        <TableCell>{request.dataSubject}</TableCell>
                        <TableCell>{formatDateRelative(request.submittedAt)}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {request.regulation}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.completionTime ? 
                            `${request.completionTime} hours` : 
                            'In progress'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {request.status === 'in-progress' && (
                                <DropdownMenuItem>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Mark as Completed
                                </DropdownMenuItem>
                              )}
                              {request.requestType === 'access' && request.status === 'completed' && (
                                <DropdownMenuItem>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download Data Package
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <FileText className="h-4 w-4 mr-2" />
                                Generate Report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                        No privacy requests found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="consent" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Consent Management</CardTitle>
                  <CardDescription>
                    Track and manage user consent preferences and records
                  </CardDescription>
                </div>
                <Button>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Consent Forms
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 border rounded-lg bg-card/50">
                <h3 className="text-lg font-medium mb-3">Consent Preference Center</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="marketing" className="flex flex-col items-start gap-1">
                        <span>Marketing Communications</span>
                        <span className="text-xs text-muted-foreground">
                          Emails, newsletters, and special offers
                        </span>
                      </Label>
                      <Switch id="marketing" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="analytics" className="flex flex-col items-start gap-1">
                        <span>Usage Analytics</span>
                        <span className="text-xs text-muted-foreground">
                          Product usage and feature analytics
                        </span>
                      </Label>
                      <Switch id="analytics" defaultChecked />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="third-party" className="flex flex-col items-start gap-1">
                        <span>Third-Party Data Sharing</span>
                        <span className="text-xs text-muted-foreground">
                          Sharing data with integration partners
                        </span>
                      </Label>
                      <Switch id="third-party" />
                    </div>
                    
                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="cookies" className="flex flex-col items-start gap-1">
                        <span>Cookies & Tracking</span>
                        <span className="text-xs text-muted-foreground">
                          Session and persistent cookies
                        </span>
                      </Label>
                      <Switch id="cookies" defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Consent Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Loading consent records...
                      </TableCell>
                    </TableRow>
                  ) : filteredConsent.length > 0 ? (
                    filteredConsent.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.userId}
                        </TableCell>
                        <TableCell>{record.email}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span>Marketing</span>
                              {record.marketingConsent ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span>Analytics</span>
                              {record.dataAnalyticsConsent ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span>Third Party</span>
                              {record.thirdPartyConsent ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDateRelative(record.lastUpdated)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            v{record.consentVersion}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.consentMethod}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Request Refresh
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <FileText className="h-4 w-4 mr-2" />
                                Export Record
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No consent records found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}