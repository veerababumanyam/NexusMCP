import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  MessageSquare, 
  Users,
  Clock,
  CalendarDays,
  Filter,
  StickyNote,
  UserCircle2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Reply,
  PanelRightOpen,
  ThumbsUp,
  Share2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

export default function CollaborationPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState("all");
  const [isAddAnnotationOpen, setIsAddAnnotationOpen] = useState(false);
  const [filterView, setFilterView] = useState("all");
  const [selectedAnnotation, setSelectedAnnotation] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch workspaces
  const { data: workspaces } = useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/workspaces");
        if (!res.ok) throw new Error("Failed to fetch workspaces");
        return res.json();
      } catch (error) {
        console.error("Error fetching workspaces:", error);
        return [];
      }
    },
  });
  
  // Fetch annotations
  const {
    data: annotations,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/annotations", activeWorkspace],
    queryFn: async () => {
      try {
        const url = activeWorkspace === "all" 
          ? "/api/annotations" 
          : `/api/annotations?workspaceId=${activeWorkspace}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch annotations");
        return res.json();
      } catch (error) {
        console.error("Error fetching annotations:", error);
        return [];
      }
    },
  });

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Annotations refreshed",
        description: "Collaboration annotations have been updated.",
      });
    } catch (error) {
      console.error("Error refreshing annotations:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh collaboration annotations.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter annotations
  const filteredAnnotations = annotations?.filter((annotation: any) => {
    if (filterView === "all") return true;
    if (filterView === "mine") return annotation.createdBy?.id === user?.id;
    if (filterView === "unread") return !annotation.isRead;
    if (filterView === "mentions") return annotation.mentions?.some((mention: any) => mention.userId === user?.id);
    return true;
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return "Today, " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return "Yesterday, " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays < 7) {
        return diffDays + " days ago";
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return "Unknown date";
    }
  };
  
  // View annotation details
  const viewAnnotationDetails = (annotation: any) => {
    setSelectedAnnotation(annotation);
  };

  return (
    <>
      <DashboardHeader
        title="Collaboration"
        subtitle="Collaborate with teammates using annotations and shared workspaces"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Select 
            value={activeWorkspace} 
            onValueChange={setActiveWorkspace}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workspaces</SelectItem>
              {workspaces?.map((workspace: any) => (
                <SelectItem key={workspace.id} value={workspace.id.toString()}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {filterView === "all" ? "All" : 
                  filterView === "mine" ? "Mine" : 
                  filterView === "unread" ? "Unread" :
                  filterView === "mentions" ? "Mentions" : "Filter"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52">
              <div className="space-y-1">
                <Button 
                  variant={filterView === "all" ? "default" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setFilterView("all")}
                >
                  All Annotations
                </Button>
                <Button 
                  variant={filterView === "mine" ? "default" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setFilterView("mine")}
                >
                  My Annotations
                </Button>
                <Button 
                  variant={filterView === "unread" ? "default" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setFilterView("unread")}
                >
                  Unread
                </Button>
                <Button 
                  variant={filterView === "mentions" ? "default" : "ghost"} 
                  className="w-full justify-start"
                  onClick={() => setFilterView("mentions")}
                >
                  Mentions
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <Button
          onClick={() => setIsAddAnnotationOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Annotation
        </Button>
      </div>
      
      <Tabs defaultValue="annotations" className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="annotations">Annotations</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="annotations">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Collaboration Annotations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading annotations...
                  </span>
                </div>
              ) : filteredAnnotations?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">
                    No annotations found
                  </span>
                  <Button
                    variant="link"
                    onClick={() => setIsAddAnnotationOpen(true)}
                    className="mt-2"
                  >
                    Create your first annotation
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAnnotations?.map((annotation: any) => (
                    <div 
                      key={annotation.id} 
                      className={`p-4 hover:bg-muted/50 cursor-pointer ${
                        !annotation.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => viewAnnotationDetails(annotation)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <Avatar className="h-10 w-10 mr-4">
                            {annotation.createdBy?.avatar ? (
                              <AvatarImage src={annotation.createdBy.avatar} alt={annotation.createdBy.name} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {annotation.createdBy?.name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center">
                              <span className="font-medium">{annotation.createdBy?.name || "Unknown User"}</span>
                              {annotation.workspace && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {annotation.workspace.name}
                                </Badge>
                              )}
                              {annotation.mentions?.some((mention: any) => mention.userId === user?.id) && (
                                <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-xs">
                                  Mentioned
                                </Badge>
                              )}
                              {!annotation.isRead && (
                                <Badge className="ml-2 bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              {formatDate(annotation.createdAt)}
                              {annotation.target && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{annotation.target.type}</span>
                                </>
                              )}
                            </div>
                            <p className="mt-2 text-sm line-clamp-2">
                              {annotation.content}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {annotation.replyCount > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {annotation.replyCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 py-3 px-6">
              <div className="text-sm text-muted-foreground">
                {filteredAnnotations?.length ? (
                  <>
                    Showing <span className="font-medium">{filteredAnnotations.length}</span> annotation(s)
                    {filterView !== "all" && annotations?.length !== filteredAnnotations.length && (
                      <> (filtered from {annotations.length})</>
                    )}
                  </>
                ) : null}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {[...Array(5)].map((_, i) => {
                  const date = new Date();
                  date.setHours(date.getHours() - i * 2);
                  
                  return (
                    <div key={i} className="flex items-start">
                      <div className="mr-4 mt-0.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {String.fromCharCode(65 + (i % 26))}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div>
                        <div className="flex items-center text-sm">
                          <span className="font-medium">
                            {["Alice Smith", "Bob Johnson", "Charlie Lee", "Dana Park", "Evan Chen"][i % 5]}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {i === 0 ? "added a new annotation" : 
                             i === 1 ? "replied to an annotation" : 
                             i === 2 ? "mentioned you" : 
                             i === 3 ? "edited an annotation" : 
                             "created a workspace"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Workspace Overview */}
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Workspace Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "12"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Users active today
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Annotations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <StickyNote className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : annotations?.length || "0"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total annotations
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 text-muted-foreground mr-2" />
                  <div className="text-2xl font-bold">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "28"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Activities this week
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Annotation Dialog */}
      <Dialog open={isAddAnnotationOpen} onOpenChange={setIsAddAnnotationOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Annotation</DialogTitle>
            <DialogDescription>
              Add a new annotation to collaborate with your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="workspace" className="text-sm font-medium block mb-1.5">
                  Workspace
                </label>
                <Select defaultValue={activeWorkspace === "all" ? (workspaces?.[0]?.id?.toString() || "") : activeWorkspace}>
                  <SelectTrigger>
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
              
              <div>
                <label htmlFor="targetType" className="text-sm font-medium block mb-1.5">
                  Target Type
                </label>
                <Select defaultValue="general">
                  <SelectTrigger>
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label htmlFor="content" className="text-sm font-medium block mb-1.5">
                  Content
                </label>
                <Textarea
                  id="content"
                  placeholder="Write your annotation here..."
                  className="min-h-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use @ to mention users and # to reference specific items
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Visibility
                </label>
                <Select defaultValue="workspace">
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Workspace Members</SelectItem>
                    <SelectItem value="selected">Selected Users</SelectItem>
                    <SelectItem value="private">Private (Only Me)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddAnnotationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsAddAnnotationOpen(false);
              toast({
                title: "Annotation created",
                description: "Your annotation has been created successfully."
              });
              refreshData();
            }}>
              Create Annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Annotation Details Dialog */}
      {selectedAnnotation && (
        <Dialog 
          open={selectedAnnotation !== null} 
          onOpenChange={(open) => !open && setSelectedAnnotation(null)}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Annotation Details</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <div className="flex items-start mb-6">
                <Avatar className="h-10 w-10 mr-4">
                  {selectedAnnotation.createdBy?.avatar ? (
                    <AvatarImage src={selectedAnnotation.createdBy.avatar} alt={selectedAnnotation.createdBy.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedAnnotation.createdBy?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium">{selectedAnnotation.createdBy?.name || "Unknown User"}</span>
                        {selectedAnnotation.workspace && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {selectedAnnotation.workspace.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {formatDate(selectedAnnotation.createdAt)}
                        {selectedAnnotation.target && (
                          <>
                            <span className="mx-1">•</span>
                            <span>{selectedAnnotation.target.type}</span>
                            {selectedAnnotation.target.name && (
                              <span>: {selectedAnnotation.target.name}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            toast({
                              title: "Editing annotation",
                              description: "Edit mode enabled."
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            toast({
                              title: "Sharing annotation",
                              description: "Share options opened."
                            });
                          }}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            toast({
                              title: "Deleting annotation",
                              description: "Annotation deleted."
                            });
                            setSelectedAnnotation(null);
                            refreshData();
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="mt-4">
                    <p className="whitespace-pre-wrap">{selectedAnnotation.content}</p>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => {
                        toast({
                          title: "Reaction added",
                          description: "You liked this annotation."
                        });
                      }}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Like
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => {
                        toast({
                          title: "Smart action",
                          description: "AI assistant analyzing annotation..."
                        });
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Smart Action
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => {
                        toast({
                          title: "Annotation panel",
                          description: "Opening annotation in side panel."
                        });
                      }}
                    >
                      <PanelRightOpen className="h-3.5 w-3.5" />
                      Open in Panel
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Replies</h3>
                
                {selectedAnnotation.replies?.length > 0 ? (
                  <div className="space-y-4 mb-4">
                    {selectedAnnotation.replies.map((reply: any) => (
                      <div key={reply.id} className="flex items-start">
                        <Avatar className="h-8 w-8 mr-3">
                          {reply.user?.avatar ? (
                            <AvatarImage src={reply.user.avatar} alt={reply.user.name} />
                          ) : null}
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            {reply.user?.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted rounded-md p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <span className="text-sm font-medium">{reply.user?.name || "Unknown User"}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-sm mt-1">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-4">
                    No replies yet
                  </div>
                )}
                
                <div className="flex items-start">
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea 
                      placeholder="Write a reply..." 
                      className="min-h-20"
                    />
                    <div className="flex justify-end mt-2">
                      <Button size="sm" className="gap-1.5">
                        <Reply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}