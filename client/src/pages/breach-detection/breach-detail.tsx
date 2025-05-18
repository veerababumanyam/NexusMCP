import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Check, Loader2, FileText, Clock, User, AlertCircle, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";

// Breach Detail Page
const BreachDetailPage = () => {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [falsePositiveDialogOpen, setFalsePositiveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionType, setResolutionType] = useState("resolved");
  const [falsePositiveNotes, setFalsePositiveNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  
  // Fetch breach details
  const { 
    data: breachData,
    isLoading: breachLoading,
    error: breachError
  } = useQuery({
    queryKey: ['/api/breach-detection/breaches', id],
    staleTime: 30000, // 30 seconds
  });
  
  // Fetch breach events
  const { 
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError
  } = useQuery({
    queryKey: ['/api/breach-detection/breaches', id, 'events'],
    staleTime: 30000, // 30 seconds
  });
  
  // Mutation to resolve breach
  const resolveMutation = useMutation({
    mutationFn: async (data: { notes: string, resolution: string }) => {
      const response = await fetch(`/api/breach-detection/breaches/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve breach');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Breach resolved",
        description: "The breach has been successfully marked as resolved.",
      });
      setResolutionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches', id, 'events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/overview'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to resolve breach",
        description: error.message || "An error occurred while trying to resolve the breach.",
      });
    }
  });
  
  // Mutation to mark as false positive
  const falsePositiveMutation = useMutation({
    mutationFn: async (data: { notes: string }) => {
      const response = await fetch(`/api/breach-detection/breaches/${id}/false-positive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark as false positive');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Marked as false positive",
        description: "The breach has been marked as a false positive.",
      });
      setFalsePositiveDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches', id, 'events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/overview'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Operation failed",
        description: error.message || "An error occurred while processing your request.",
      });
    }
  });
  
  // Mutation to add comment
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await fetch(`/api/breach-detection/breaches/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          eventType: 'comment',
          details: { comment }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add comment');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comment added",
        description: "Your comment has been added to the breach record.",
      });
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/breach-detection/breaches', id, 'events'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to add comment",
        description: error.message || "An error occurred while adding your comment.",
      });
    }
  });
  
  // Handle resolve breach
  const handleResolveBreach = () => {
    if (!resolutionNotes.trim()) {
      toast({
        variant: "destructive",
        title: "Notes required",
        description: "Please provide resolution notes before resolving.",
      });
      return;
    }
    
    resolveMutation.mutate({
      notes: resolutionNotes,
      resolution: resolutionType
    });
  };
  
  // Handle false positive
  const handleFalsePositive = () => {
    if (!falsePositiveNotes.trim()) {
      toast({
        variant: "destructive",
        title: "Notes required",
        description: "Please provide notes explaining why this is a false positive.",
      });
      return;
    }
    
    falsePositiveMutation.mutate({
      notes: falsePositiveNotes
    });
  };
  
  // Handle add comment
  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast({
        variant: "destructive",
        title: "Comment required",
        description: "Please enter a comment before submitting.",
      });
      return;
    }
    
    addCommentMutation.mutate(newComment);
  };
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'PPpp'); // Format: Apr 29, 2021, 1:30 PM
    } catch (error) {
      return 'Unknown';
    }
  };
  
  // Format relative date for display
  const formatRelativeDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown';
    }
  };
  
  // Get event icon
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'detection':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'update':
        return <Activity className="h-5 w-5 text-blue-500" />;
      case 'resolution':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'comment':
        return <FileText className="h-5 w-5 text-gray-500" />;
      case 'escalation':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'investigation':
        return <User className="h-5 w-5 text-indigo-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
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
  
  if (breachLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild className="mb-6">
            <Link to="/breach-detection">
              Back to Breach Detection
            </Link>
          </Button>
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }
  
  if (breachError) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild className="mb-6">
            <Link to="/breach-detection">
              Back to Breach Detection
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-6 w-6" />
              Error Loading Breach Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to load breach detection details. The breach may have been deleted or you may not have permission to view it.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!breachData) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild className="mb-6">
            <Link to="/breach-detection">
              Back to Breach Detection
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Breach Not Found</h1>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-medium text-center">Breach Not Found</h3>
              <p className="text-sm text-center text-muted-foreground mt-1">
                The breach detection record you're looking for could not be found.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/breach-detection">
                  Return to Breach Detection
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild className="mb-6">
          <Link to="/breach-detection">
            Back to Breach Detection
          </Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">{breachData.title}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Breach ID: {breachData.id}</span>
              <span>•</span>
              <span>Detected {formatRelativeDate(breachData.detectedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {breachData.status !== 'resolved' && breachData.status !== 'false_positive' && (
              <>
                <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Check className="h-4 w-4" />
                      Resolve Breach
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Resolve Breach</DialogTitle>
                      <DialogDescription>
                        Mark this breach as resolved. Please provide details on how it was addressed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="resolution-type">Resolution Type</Label>
                        <Select
                          value={resolutionType}
                          onValueChange={setResolutionType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select resolution type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed (Issue corrected)</SelectItem>
                            <SelectItem value="mitigated">Mitigated (Controls in place)</SelectItem>
                            <SelectItem value="accepted_risk">Accepted Risk</SelectItem>
                            <SelectItem value="resolved">Resolved (Other)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resolution-notes">Resolution Notes</Label>
                        <Textarea
                          id="resolution-notes"
                          placeholder="Explain how the breach was addressed..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResolutionDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleResolveBreach}
                        disabled={resolveMutation.isPending}
                      >
                        {resolveMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resolving...
                          </>
                        ) : (
                          "Resolve Breach"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={falsePositiveDialogOpen} onOpenChange={setFalsePositiveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      False Positive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mark as False Positive</DialogTitle>
                      <DialogDescription>
                        Flag this breach detection as a false positive. Please provide details on why this is not a legitimate security concern.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="false-positive-notes">Explanation</Label>
                        <Textarea
                          id="false-positive-notes"
                          placeholder="Explain why this is a false positive..."
                          value={falsePositiveNotes}
                          onChange={(e) => setFalsePositiveNotes(e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setFalsePositiveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleFalsePositive}
                        disabled={falsePositiveMutation.isPending}
                      >
                        {falsePositiveMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Mark as False Positive"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="details">Breach Details</TabsTrigger>
              <TabsTrigger value="events">Activity Log</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>
            
            {/* Details Tab */}
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Breach Information</CardTitle>
                  <CardDescription>
                    Detailed information about the security breach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Description</h3>
                      <p className="mt-2 text-muted-foreground">
                        {breachData.description || "No description provided."}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium mb-3">Details</h3>
                        <dl className="space-y-3">
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-muted-foreground">Detection Type:</dt>
                            <dd className="text-sm">{breachData.detectionType}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-muted-foreground">Source:</dt>
                            <dd className="text-sm">{breachData.source}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-muted-foreground">Severity:</dt>
                            <dd className="text-sm">{getSeverityBadge(breachData.severity)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-muted-foreground">Status:</dt>
                            <dd className="text-sm">{getStatusBadge(breachData.status)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-muted-foreground">Detected At:</dt>
                            <dd className="text-sm">{formatDate(breachData.detectedAt)}</dd>
                          </div>
                          {breachData.workspaceId && (
                            <div className="flex justify-between">
                              <dt className="text-sm font-medium text-muted-foreground">Workspace:</dt>
                              <dd className="text-sm">{breachData.workspaceName || breachData.workspaceId}</dd>
                            </div>
                          )}
                          {breachData.ruleId && (
                            <div className="flex justify-between">
                              <dt className="text-sm font-medium text-muted-foreground">Detection Rule:</dt>
                              <dd className="text-sm">
                                <Button variant="link" size="sm" className="h-auto p-0 text-sm" asChild>
                                  <Link to={`/breach-detection/rules/${breachData.ruleId}`}>
                                    View Rule #{breachData.ruleId}
                                  </Link>
                                </Button>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-3">Resolution</h3>
                        {breachData.status === 'resolved' ? (
                          <dl className="space-y-3">
                            <div className="flex justify-between">
                              <dt className="text-sm font-medium text-muted-foreground">Resolved At:</dt>
                              <dd className="text-sm">{formatDate(breachData.resolvedAt)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm font-medium text-muted-foreground">Resolution Type:</dt>
                              <dd className="text-sm capitalize">{breachData.resolution ? breachData.resolution.replace('_', ' ') : 'N/A'}</dd>
                            </div>
                            <div className="flex flex-col">
                              <dt className="text-sm font-medium text-muted-foreground mb-1">Resolution Notes:</dt>
                              <dd className="text-sm bg-muted p-3 rounded-md mt-1">
                                {breachData.resolutionNotes || "No notes provided."}
                              </dd>
                            </div>
                          </dl>
                        ) : breachData.status === 'false_positive' ? (
                          <dl className="space-y-3">
                            <div className="flex justify-between">
                              <dt className="text-sm font-medium text-muted-foreground">Marked At:</dt>
                              <dd className="text-sm">{formatDate(breachData.resolvedAt)}</dd>
                            </div>
                            <div className="flex flex-col">
                              <dt className="text-sm font-medium text-muted-foreground mb-1">Explanation:</dt>
                              <dd className="text-sm bg-muted p-3 rounded-md mt-1">
                                {breachData.resolutionNotes || "No explanation provided."}
                              </dd>
                            </div>
                          </dl>
                        ) : (
                          <div className="flex items-center justify-center h-24 border rounded-md">
                            <p className="text-sm text-muted-foreground">This breach has not been resolved yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {breachData.affectedResources && Array.isArray(breachData.affectedResources) && breachData.affectedResources.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-3">Affected Resources</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {breachData.affectedResources.map((resource: string, index: number) => (
                            <li key={index} className="text-sm">{resource}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Events Tab */}
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>
                    Chronological record of all events related to this breach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-4 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : eventsError ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
                      <h3 className="text-lg font-medium text-center">Failed to load events</h3>
                      <p className="text-sm text-center text-muted-foreground mt-1">
                        An error occurred while loading the activity log.
                      </p>
                      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                        Retry
                      </Button>
                    </div>
                  ) : eventsData && eventsData.length > 0 ? (
                    <div className="relative space-y-0">
                      <div className="absolute top-0 bottom-0 left-5 w-px bg-border" />
                      {eventsData.map((event: any, index: number) => (
                        <div key={event.id} className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 rounded-full bg-background p-1 shadow-sm ring-1 ring-border">
                            {getEventIcon(event.eventType)}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize">
                                {event.eventType ? event.eventType.replace('_', ' ') : 'Unknown'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeDate(event.timestamp)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {event.eventType === 'detection' && (
                                <span>Breach was detected and logged in the system</span>
                              )}
                              {event.eventType === 'update' && (
                                <span>
                                  Breach details were updated
                                  {event.details?.updatedBy ? ` by ${event.details.updatedBy}` : ''}
                                </span>
                              )}
                              {event.eventType === 'resolution' && (
                                <span>
                                  Breach was resolved as "{event.details?.resolution || 'resolved'}"
                                  {event.details?.resolvedBy ? ` by ${event.details.resolvedBy}` : ''}
                                </span>
                              )}
                              {event.eventType === 'comment' && (
                                <div className="mt-1 bg-muted p-3 rounded-md">
                                  {event.details?.comment || 'No comment text'}
                                </div>
                              )}
                              {event.eventType === 'escalation' && (
                                <span>
                                  Breach was escalated 
                                  {event.details?.escalatedBy ? ` by ${event.details.escalatedBy}` : ''}
                                  {event.details?.escalatedTo ? ` to ${event.details.escalatedTo}` : ''}
                                </span>
                              )}
                              {event.eventType === 'investigation' && (
                                <span>
                                  Investigation was {event.details?.status || 'started'}
                                  {event.details?.investigator ? ` by ${event.details.investigator}` : ''}
                                </span>
                              )}
                            </div>
                            {event.userId && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                User: {event.userName || `ID: ${event.userId}`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium text-center">No activity yet</h3>
                      <p className="text-sm text-center text-muted-foreground mt-1">
                        There's no activity log for this breach yet
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col">
                  <div className="w-full border-t pt-6">
                    <h3 className="text-sm font-medium mb-2">Add Comment</h3>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={addCommentMutation.isPending || !newComment.trim()}
                      >
                        {addCommentMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Comment"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Evidence Tab */}
            <TabsContent value="evidence">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence</CardTitle>
                  <CardDescription>
                    Supporting evidence and technical details of the breach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {breachData.evidence && Object.keys(breachData.evidence).length > 0 ? (
                    <div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Evidence Type</TableHead>
                              <TableHead>Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breachData.evidence && typeof breachData.evidence === 'object' && Object.keys(breachData.evidence).length > 0 ? Object.entries(breachData.evidence).map(([key, value], index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium capitalize">{key ? key.replace('_', ' ') : 'Unknown'}</TableCell>
                                <TableCell>
                                  {typeof value === 'string' ? (
                                    value
                                  ) : Array.isArray(value) ? (
                                    <ul className="list-disc list-inside">
                                      {value.length > 0 ? value.map((item, i) => (
                                        <li key={i} className="text-sm">
                                          {typeof item === 'string' ? item : JSON.stringify(item)}
                                        </li>
                                      )) : <li className="text-sm">No items</li>}
                                    </ul>
                                  ) : (
                                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                                      {JSON.stringify(value, null, 2)}
                                    </pre>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium text-center">No evidence available</h3>
                      <p className="text-sm text-center text-muted-foreground mt-1">
                        There is no detailed evidence available for this breach
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Related Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Detection Source</h3>
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center">
                      {breachData.source === 'ip_access' ? (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-full">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-medium">IP Access Control</div>
                            <div className="text-xs text-muted-foreground">IP-based restriction violation</div>
                          </div>
                        </div>
                      ) : breachData.source === 'token_usage' ? (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Shield className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">Token Monitoring</div>
                            <div className="text-xs text-muted-foreground">OAuth token usage anomaly</div>
                          </div>
                        </div>
                      ) : breachData.source === 'oauth_event' ? (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <Activity className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-medium">OAuth Security Event</div>
                            <div className="text-xs text-muted-foreground">Authentication/authorization anomaly</div>
                          </div>
                        </div>
                      ) : breachData.source === 'anomaly_detection' ? (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 rounded-full">
                            <AlertCircle className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <div className="font-medium">Anomaly Detection</div>
                            <div className="text-xs text-muted-foreground">Behavioral anomaly detected</div>
                          </div>
                        </div>
                      ) : breachData.source === 'scanner' ? (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-full">
                            <ShieldAlert className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">Security Scanner</div>
                            <div className="text-xs text-muted-foreground">Security vulnerability scan</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-full">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium">Manual Report</div>
                            <div className="text-xs text-muted-foreground">Manually reported breach</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Recommendations</h3>
                  <ul className="space-y-3">
                    {breachData.source === 'ip_access' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Review IP allowlist configuration</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Check for unauthorized access attempts</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Update IP access policies if needed</span>
                        </li>
                      </>
                    )}
                    
                    {breachData.source === 'token_usage' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Review token usage patterns</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Check for compromised credentials</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Consider rotating affected tokens</span>
                        </li>
                      </>
                    )}
                    
                    {breachData.source === 'oauth_event' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Review authentication logs</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Check for suspicious login attempts</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Verify OAuth client configurations</span>
                        </li>
                      </>
                    )}
                    
                    {breachData.source === 'anomaly_detection' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Investigate unusual system behavior</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Review resource usage patterns</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Check for potential data exfiltration</span>
                        </li>
                      </>
                    )}
                    
                    {breachData.source === 'scanner' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Review scanner findings in detail</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Patch identified vulnerabilities</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Schedule follow-up scan after fixes</span>
                        </li>
                      </>
                    )}
                    
                    {breachData.source === 'manual' && (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Validate reported information</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Gather additional evidence if needed</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          <span>Document investigation findings</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Quick Links</h3>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                      <Link to="/breach-detection/rules">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Manage Detection Rules
                      </Link>
                    </Button>
                    
                    {breachData.source === 'ip_access' && (
                      <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                        <Link to="/ip-access-control">
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          IP Access Control
                        </Link>
                      </Button>
                    )}
                    
                    {breachData.source === 'token_usage' && (
                      <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                        <Link to="/token-management">
                          <Shield className="mr-2 h-4 w-4" />
                          Token Management
                        </Link>
                      </Button>
                    )}
                    
                    {breachData.source === 'scanner' && (
                      <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                        <Link to="/security-scanner">
                          <Activity className="mr-2 h-4 w-4" />
                          Security Scanner
                        </Link>
                      </Button>
                    )}
                    
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                      <Link to="/breach-detection">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        All Breaches
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BreachDetailPage;