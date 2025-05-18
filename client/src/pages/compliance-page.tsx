import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  FileCheck, 
  Shield, 
  Clipboard, 
  ClipboardCheck, 
  ArrowUpDown,
  Plus,
  Filter,
  RefreshCw,
  Download,
  FileUp 
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

// Compliance Management Page
export default function CompliancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("frameworks");
  const [workspaceId, setWorkspaceId] = useState<number | undefined>(undefined);

  // Fetch workspaces
  const { data: workspaces } = useQuery({
    queryKey: ["/api/workspaces"],
    enabled: !!user,
  });

  // Handle workspace selection
  const handleWorkspaceChange = (value: string) => {
    setWorkspaceId(parseInt(value, 10));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage compliance frameworks, controls, assessments, and reports
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={workspaceId?.toString()} onValueChange={handleWorkspaceChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces?.map((workspace: any) => (
                <SelectItem key={workspace.id} value={workspace.id.toString()}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="frameworks" className="mt-6">
            <FrameworksTab workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="controls" className="mt-6">
            <ControlsTab workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="assessments" className="mt-6">
            <AssessmentsTab workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="evidence" className="mt-6">
            <EvidenceTab workspaceId={workspaceId} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ReportsTab workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Frameworks Tab Component
function FrameworksTab({ workspaceId }: { workspaceId?: number }) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Query for frameworks
  const { data: frameworks, isLoading, refetch } = useQuery({
    queryKey: ["/api/compliance/frameworks", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/frameworks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Create framework mutation
  const createFramework = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/compliance/frameworks", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Framework created",
        description: "The compliance framework has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create framework",
        description: error.message || "An error occurred while creating the framework.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleCreateFramework = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createFramework.mutate({
      name: formData.get("name"),
      version: formData.get("version"),
      category: formData.get("category"),
      description: formData.get("description"),
      isActive: true,
      workspaceId,
    });
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Workspace</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a workspace to manage compliance frameworks.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Compliance Frameworks</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Framework
        </Button>
      </div>

      {frameworks?.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Controls</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {frameworks.map((framework: any) => (
                <TableRow key={framework.id}>
                  <TableCell className="font-medium">{framework.name}</TableCell>
                  <TableCell>{framework.version}</TableCell>
                  <TableCell>{framework.category}</TableCell>
                  <TableCell>
                    {framework.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* TODO: Show control count */}
                    -
                  </TableCell>
                  <TableCell>{new Date(framework.lastUpdated || framework.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/10">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No frameworks found</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Get started by adding a compliance framework like SOC 2, ISO 27001, or GDPR.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Framework
          </Button>
        </div>
      )}

      {/* Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add Compliance Framework</DialogTitle>
            <DialogDescription>
              Add a new compliance framework to your workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFramework}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Framework Name</Label>
                <Input id="name" name="name" placeholder="SOC 2" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="version">Version</Label>
                <Input id="version" name="version" placeholder="2022.1" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue="security">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="privacy">Privacy</SelectItem>
                    <SelectItem value="industry">Industry Specific</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="SOC 2 Type 2 Compliance Framework" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createFramework.isPending}>
                Create Framework
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Controls Tab Component
function ControlsTab({ workspaceId }: { workspaceId?: number }) {
  const { toast } = useToast();
  const [frameworkFilter, setFrameworkFilter] = useState<string | undefined>(undefined);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Query for frameworks (for filter)
  const { data: frameworks } = useQuery({
    queryKey: ["/api/compliance/frameworks", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/frameworks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Query for controls
  const { data: controls, isLoading, refetch } = useQuery({
    queryKey: ["/api/compliance/controls", { workspaceId, frameworkId: frameworkFilter }],
    queryFn: () => {
      let url = `/api/compliance/controls?workspaceId=${workspaceId}`;
      if (frameworkFilter) {
        url += `&frameworkId=${frameworkFilter}`;
      }
      return apiRequest("GET", url).then(res => res.json());
    },
    enabled: !!workspaceId,
  });

  // Create control mutation
  const createControl = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/compliance/controls", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Control created",
        description: "The compliance control has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create control",
        description: error.message || "An error occurred while creating the control.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleCreateControl = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createControl.mutate({
      code: formData.get("code"),
      name: formData.get("name"),
      description: formData.get("description"),
      frameworkId: parseInt(formData.get("frameworkId") as string, 10),
      category: formData.get("category"),
      severity: formData.get("severity"),
      implementationStatus: formData.get("implementationStatus"),
      workspaceId,
    });
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Workspace</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a workspace to manage compliance controls.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Compliance Controls</h2>
        <div className="flex gap-3">
          <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="undefined">All Frameworks</SelectItem>
              {frameworks?.map((framework: any) => (
                <SelectItem key={framework.id} value={framework.id.toString()}>
                  {framework.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Control
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : controls?.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controls.map((control: any) => (
                <TableRow key={control.id}>
                  <TableCell className="font-medium">{control.code}</TableCell>
                  <TableCell>{control.name}</TableCell>
                  <TableCell>{control.category}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        control.severity === 'high' 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : control.severity === 'medium'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                      }
                    >
                      {control.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        control.implementationStatus === 'implemented' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : control.implementationStatus === 'in_progress'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : control.implementationStatus === 'not_implemented'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                      }
                    >
                      {control.implementationStatus.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/10">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No controls found</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            {frameworkFilter 
              ? "No controls found for the selected framework." 
              : "No controls available. Add a control or select a different framework."}
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Control
          </Button>
        </div>
      )}

      {/* Create Control Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add Compliance Control</DialogTitle>
            <DialogDescription>
              Add a new compliance control to a framework.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateControl}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="frameworkId">Framework</Label>
                <Select name="frameworkId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks?.map((framework: any) => (
                      <SelectItem key={framework.id} value={framework.id.toString()}>
                        {framework.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Control Code</Label>
                <Input id="code" name="code" placeholder="ACC-01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Control Name</Label>
                <Input id="name" name="name" placeholder="Access Control Policy" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue="access_control">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access_control">Access Control</SelectItem>
                    <SelectItem value="encryption">Encryption</SelectItem>
                    <SelectItem value="data_protection">Data Protection</SelectItem>
                    <SelectItem value="audit_logging">Audit & Logging</SelectItem>
                    <SelectItem value="network_security">Network Security</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="severity">Severity</Label>
                <Select name="severity" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="implementationStatus">Implementation Status</Label>
                <Select name="implementationStatus" defaultValue="not_implemented">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_implemented">Not Implemented</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="implemented">Implemented</SelectItem>
                    <SelectItem value="not_applicable">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Description of the control requirements" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createControl.isPending}>
                Create Control
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Assessments Tab Component
function AssessmentsTab({ workspaceId }: { workspaceId?: number }) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Query for frameworks (for create assessment)
  const { data: frameworks } = useQuery({
    queryKey: ["/api/compliance/frameworks", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/frameworks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Query for assessments
  const { data: assessments, isLoading, refetch } = useQuery({
    queryKey: ["/api/compliance/assessments", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/assessments?workspaceId=${workspaceId}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Create assessment mutation
  const createAssessment = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/compliance/assessments", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Assessment created",
        description: "The compliance assessment has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create assessment",
        description: error.message || "An error occurred while creating the assessment.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleCreateAssessment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createAssessment.mutate({
      name: formData.get("name"),
      description: formData.get("description"),
      frameworkId: parseInt(formData.get("frameworkId") as string, 10),
      status: formData.get("status"),
      startDate: new Date(formData.get("startDate") as string).toISOString(),
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string).toISOString() : null,
      workspaceId,
    });
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clipboard className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Workspace</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a workspace to manage compliance assessments.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Compliance Assessments</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Assessment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : assessments?.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((assessment: any) => (
            <Card key={assessment.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{assessment.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {frameworks?.find((f: any) => f.id === assessment.frameworkId)?.name || 'Framework'}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      assessment.status === 'completed' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : assessment.status === 'in_progress'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : assessment.status === 'not_started'
                            ? 'bg-gray-50 text-gray-700 border-gray-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                    }
                  >
                    {assessment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground mb-2">Progress</div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{assessment.progress || 0}%</span>
                  </div>
                  <Progress value={assessment.progress || 0} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start Date:</span>
                    <div>{new Date(assessment.startDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End Date:</span>
                    <div>
                      {assessment.endDate 
                        ? new Date(assessment.endDate).toLocaleDateString() 
                        : 'Not set'}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/20 pt-3">
                <div className="flex justify-between w-full">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  <Button variant="outline" size="sm">
                    Resume Assessment
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/10">
          <Clipboard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No assessments found</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Start your compliance journey by creating an assessment for a framework.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Assessment
          </Button>
        </div>
      )}

      {/* Create Assessment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Start New Assessment</DialogTitle>
            <DialogDescription>
              Create a new compliance assessment for a framework.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAssessment}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Assessment Name</Label>
                <Input id="name" name="name" placeholder="SOC 2 Annual Assessment" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frameworkId">Framework</Label>
                <Select name="frameworkId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks?.map((framework: any) => (
                      <SelectItem key={framework.id} value={framework.id.toString()}>
                        {framework.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue="not_started">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Assessment description" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createAssessment.isPending}>
                Create Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Evidence Tab Component
function EvidenceTab({ workspaceId }: { workspaceId?: number }) {
  const { toast } = useToast();

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileCheck className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Workspace</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a workspace to manage compliance evidence.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Compliance Evidence</h2>
        <div className="flex gap-3">
          <Select>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by control" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Controls</SelectItem>
              {/* Controls would be listed here */}
            </SelectContent>
          </Select>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Evidence
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/10">
        <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Control</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Please select a specific control to manage evidence or add new evidence for a control.
        </p>
      </div>
    </div>
  );
}

// Reports Tab Component
function ReportsTab({ workspaceId }: { workspaceId?: number }) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Query for frameworks (for filter)
  const { data: frameworks } = useQuery({
    queryKey: ["/api/compliance/frameworks", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/frameworks${workspaceId ? `?workspaceId=${workspaceId}` : ""}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Query for assessments (for create report)
  const { data: assessments } = useQuery({
    queryKey: ["/api/compliance/assessments", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/assessments?workspaceId=${workspaceId}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Query for reports
  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ["/api/compliance/reports", { workspaceId }],
    queryFn: () => apiRequest("GET", `/api/compliance/reports?workspaceId=${workspaceId}`).then(res => res.json()),
    enabled: !!workspaceId,
  });

  // Create report mutation
  const createReport = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/compliance/reports", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Report created",
        description: "The compliance report has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create report",
        description: error.message || "An error occurred while creating the report.",
        variant: "destructive",
      });
    },
  });

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const res = await apiRequest("POST", `/api/compliance/reports/${id}/generate`, { workspaceId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Report generated",
        description: "The compliance report has been generated successfully.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate report",
        description: error.message || "An error occurred while generating the report.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleCreateReport = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Handle framework ids as an array
    const frameworkIdsStr = formData.get("frameworkIds") as string;
    const frameworkIds = frameworkIdsStr ? [parseInt(frameworkIdsStr, 10)] : [];
    
    // Get assessment id if provided
    const assessmentIdStr = formData.get("assessmentId") as string;
    const assessmentId = assessmentIdStr ? parseInt(assessmentIdStr, 10) : null;
    
    createReport.mutate({
      name: formData.get("name"),
      description: formData.get("description"),
      type: formData.get("type"),
      format: formData.get("format"),
      frameworkIds,
      assessmentId,
      workspaceId,
    });
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">Select a Workspace</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a workspace to manage compliance reports.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Compliance Reports</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : reports?.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report: any) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.name}</TableCell>
                  <TableCell>{report.type.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{report.format.toUpperCase()}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={
                        report.status === 'generated' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : report.status === 'approved'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : report.status === 'draft'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                      }
                    >
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {report.status === 'draft' ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => generateReport.mutate({ id: report.id })}
                          loading={generateReport.isPending && generateReport.variables?.id === report.id}
                        >
                          <FileUp className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/compliance/reports/${report.id}/download?workspaceId=${workspaceId}`} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border rounded-lg p-8 bg-muted/10">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No reports found</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Create reports based on assessments or frameworks for audit and compliance purposes.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Report
          </Button>
        </div>
      )}

      {/* Create Report Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Compliance Report</DialogTitle>
            <DialogDescription>
              Create a new compliance report based on an assessment or framework.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateReport}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Report Name</Label>
                <Input id="name" name="name" placeholder="Annual Compliance Report" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Report Type</Label>
                <Select name="type" defaultValue="framework_assessment">
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="framework_assessment">Framework Assessment</SelectItem>
                    <SelectItem value="gap_analysis">Gap Analysis</SelectItem>
                    <SelectItem value="executive_summary">Executive Summary</SelectItem>
                    <SelectItem value="audit_ready">Audit-Ready Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="format">Report Format</Label>
                <Select name="format" defaultValue="pdf">
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="docx">DOCX</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source">Report Source</Label>
                <Select name="source" defaultValue="assessment">
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assessment">From Assessment</SelectItem>
                    <SelectItem value="framework">From Framework</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assessmentId">Assessment</Label>
                <Select name="assessmentId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments?.map((assessment: any) => (
                      <SelectItem key={assessment.id} value={assessment.id.toString()}>
                        {assessment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frameworkIds">Framework</Label>
                <Select name="frameworkIds">
                  <SelectTrigger>
                    <SelectValue placeholder="Select framework" />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks?.map((framework: any) => (
                      <SelectItem key={framework.id} value={framework.id.toString()}>
                        {framework.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Report description" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createReport.isPending}>
                Create Report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}