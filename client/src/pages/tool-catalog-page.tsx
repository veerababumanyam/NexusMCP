import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  FileText, 
  Search,
  MoreHorizontal,
  ArrowUpDown,
  Tag,
  ExternalLink,
  Info,
  ArrowRight,
  Server,
  Wrench,
  FileJson,
  Workflow,
  Languages
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function ToolCatalogPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [isToolDetailsOpen, setIsToolDetailsOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string>("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { toast } = useToast();
  
  // Fetch tools
  const {
    data: tools,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/tools", { serverId: selectedServer !== "all" ? selectedServer : undefined }],
    queryFn: async () => {
      try {
        const url = new URL("/api/tools", window.location.origin);
        if (selectedServer !== "all") {
          url.searchParams.append("serverId", selectedServer);
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch tools");
        return res.json();
      } catch (error) {
        console.error("Error fetching tools:", error);
        return [];
      }
    },
  });

  // Fetch servers for filtering
  const { data: servers } = useQuery({
    queryKey: ["/api/mcp-servers"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/mcp-servers");
        if (!res.ok) throw new Error("Failed to fetch servers");
        return res.json();
      } catch (error) {
        console.error("Error fetching servers:", error);
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
        title: "Tool catalog refreshed",
        description: "Tool catalog has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing tools:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh tool catalog.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sync tools for specific server
  const syncToolsForServer = async (serverId: string) => {
    try {
      const res = await fetch(`/api/tools/sync/${serverId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync tools");
      const data = await res.json();
      
      toast({
        title: "Tools synchronized",
        description: `Successfully synchronized ${data.data?.length || 0} tools.`,
      });
      
      refetch();
    } catch (error) {
      console.error("Error syncing tools:", error);
      toast({
        title: "Sync failed",
        description: "Failed to synchronize tools.",
        variant: "destructive",
      });
    }
  };
  
  // Filter tools based on search query
  const filteredTools = tools?.manifests?.filter((tool: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description?.toLowerCase().includes(query) ||
      tool.category?.toLowerCase().includes(query) ||
      (tool.tags && tool.tags.some((tag: string) => tag.toLowerCase().includes(query)))
    );
  });
  
  // Sort tools
  const sortedTools = [...(filteredTools || [])].sort((a, b) => {
    let compareA, compareB;
    
    switch (sortBy) {
      case "name":
        compareA = a.name;
        compareB = b.name;
        break;
      case "category":
        compareA = a.category || "";
        compareB = b.category || "";
        break;
      case "server":
        compareA = a.serverId;
        compareB = b.serverId;
        break;
      case "updated":
        compareA = new Date(a.updatedAt || 0).getTime();
        compareB = new Date(b.updatedAt || 0).getTime();
        break;
      default:
        compareA = a.name;
        compareB = b.name;
    }
    
    if (sortOrder === "asc") {
      return compareA > compareB ? 1 : -1;
    } else {
      return compareA < compareB ? 1 : -1;
    }
  });
  
  // Toggle sort order
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };
  
  // View tool details
  const viewToolDetails = (tool: any) => {
    setSelectedTool(tool);
    setIsToolDetailsOpen(true);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch (e) {
      return "Unknown";
    }
  };

  // Get server name by ID
  const getServerNameById = (serverId: number) => {
    const server = servers?.find((s: any) => s.id === serverId);
    return server?.name || `Server ${serverId}`;
  };

  return (
    <>
      <DashboardHeader
        title="Tool Catalog"
        subtitle="Browse and manage MCP tool catalog"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select
            value={selectedServer}
            onValueChange={(value) => setSelectedServer(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              {servers?.map((server: any) => (
                <SelectItem key={server.id} value={server.id.toString()}>
                  {server.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (selectedServer !== "all") {
                syncToolsForServer(selectedServer);
              } else {
                toast({
                  title: "Select a server",
                  description: "Please select a specific server to sync tools.",
                });
              }
            }}
          >
            <Workflow className="h-4 w-4" />
            Sync Tools
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              toast({
                title: "Exporting report",
                description: "Tool catalog report is being generated."
              });
            }}
          >
            <FileText className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Tool Catalog</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading tool catalog...
              </span>
            </div>
          ) : !sortedTools?.length ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Wrench className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                {searchQuery ? "No tools match your search" : "No tools found"}
              </span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">
                    <Button 
                      variant="ghost" 
                      className="gap-1 p-0 h-auto font-medium"
                      onClick={() => toggleSort("name")}
                    >
                      Tool Name
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="gap-1 p-0 h-auto font-medium"
                      onClick={() => toggleSort("category")}
                    >
                      Category
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="gap-1 p-0 h-auto font-medium"
                      onClick={() => toggleSort("server")}
                    >
                      Server
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <Button 
                      variant="ghost" 
                      className="gap-1 p-0 h-auto font-medium"
                      onClick={() => toggleSort("updated")}
                    >
                      Last Updated
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTools?.map((tool: any) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">
                      {tool.name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate">
                      {tool.description || "No description available"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="capitalize"
                      >
                        {tool.category || "Uncategorized"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{getServerNameById(tool.serverId)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(tool.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
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
                            onClick={() => viewToolDetails(tool)}
                          >
                            <Info className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              toast({
                                title: "Viewing schema",
                                description: `Viewing schema for ${tool.name}`
                              });
                            }}
                          >
                            <FileJson className="h-4 w-4 mr-2" />
                            View Schema
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.open(`/tools/${tool.id}`, "_blank");
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in Registry
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6">
          <div className="text-sm text-muted-foreground">
            {sortedTools?.length ? (
              <>
                Total: <span className="font-medium">{sortedTools.length}</span> tool(s)
                {searchQuery && tools?.manifests?.length !== sortedTools.length && (
                  <> (filtered from {tools.manifests.length})</>
                )}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>
      
      {/* Tool Details Dialog */}
      {selectedTool && (
        <Dialog open={isToolDetailsOpen} onOpenChange={setIsToolDetailsOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tool Details - {selectedTool.name}</DialogTitle>
              <DialogDescription>
                Detailed information about this tool
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="details">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
                <TabsTrigger value="versions">Versions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Tool Name</h3>
                    <p className="font-medium">{selectedTool.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Category</h3>
                    <Badge variant="outline" className="capitalize">
                      {selectedTool.category || "Uncategorized"}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Server</h3>
                    <p>{getServerNameById(selectedTool.serverId)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Updated</h3>
                    <p>{formatDate(selectedTool.updatedAt)}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                    <p className="text-sm">{selectedTool.description || "No description available"}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTool.tags && selectedTool.tags.length > 0 ? (
                      selectedTool.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tags</p>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="schema">
                <div className="bg-muted/30 p-4 rounded-md overflow-auto max-h-[300px]">
                  <pre className="text-xs">
                    {selectedTool.schema 
                      ? JSON.stringify(selectedTool.schema, null, 2) 
                      : "No schema available"}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="versions">
                {selectedTool.versionHistory && selectedTool.versionHistory.length > 0 ? (
                  <div className="space-y-4">
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              {selectedTool.version} (Current)
                            </TableCell>
                            <TableCell>{formatDate(selectedTool.updatedAt)}</TableCell>
                          </TableRow>
                          {selectedTool.versionHistory.map((version: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{version.version}</TableCell>
                              <TableCell>{formatDate(version.checkedAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No version history available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsToolDetailsOpen(false)}
              >
                Close
              </Button>
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open in Registry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}