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
  Check,
  ExternalLink,
  History,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  LayoutList,
  Eye
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

export default function ToolVersionsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { toast } = useToast();
  
  // Fetch tool versions
  const {
    data: toolVersions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/tools/versions"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/tools/versions");
        if (!res.ok) throw new Error("Failed to fetch tool versions");
        return res.json();
      } catch (error) {
        console.error("Error fetching tool versions:", error);
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
        title: "Tool versions refreshed",
        description: "Tool version registry has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing tool versions:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh tool version registry.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter tool versions based on search query
  const filteredToolVersions = toolVersions?.filter((tool: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description?.toLowerCase().includes(query) ||
      tool.server?.name?.toLowerCase().includes(query) ||
      tool.version?.toLowerCase().includes(query)
    );
  });
  
  // Sort tool versions
  const sortedToolVersions = [...(filteredToolVersions || [])].sort((a, b) => {
    let compareA, compareB;
    
    switch (sortBy) {
      case "name":
        compareA = a.name;
        compareB = b.name;
        break;
      case "version":
        compareA = a.version;
        compareB = b.version;
        break;
      case "server":
        compareA = a.server?.name || "";
        compareB = b.server?.name || "";
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
  
  // View version history
  const viewVersionHistory = (tool: any) => {
    setSelectedTool(tool);
    setIsVersionHistoryOpen(true);
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

  return (
    <>
      <DashboardHeader
        title="Tool Versions"
        subtitle="Browse and manage MCP tool version history"
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
          
          <Select value="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Servers</SelectItem>
              <SelectItem value="server1">Production-MCP-01</SelectItem>
              <SelectItem value="server2">Production-MCP-02</SelectItem>
              <SelectItem value="server3">Dev-MCP-01</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            toast({
              title: "Exporting report",
              description: "Tool version report is being generated."
            });
          }}
        >
          <FileText className="h-4 w-4" />
          Export Report
        </Button>
      </div>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Tool Version Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading tool versions...
              </span>
            </div>
          ) : sortedToolVersions?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                {searchQuery ? "No tools match your search" : "No tool versions found"}
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
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="gap-1 p-0 h-auto font-medium"
                      onClick={() => toggleSort("version")}
                    >
                      Version
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
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">
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
                {sortedToolVersions?.map((tool: any) => (
                  <TableRow key={`${tool.id}-${tool.version}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <div className="mr-2">
                          {tool.isActive && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              Active
                            </Badge>
                          )}
                        </div>
                        <span>{tool.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{tool.version}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tool.server?.name || "Unknown"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {tool.status === "stable" ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          Stable
                        </Badge>
                      ) : tool.status === "beta" ? (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                          Beta
                        </Badge>
                      ) : tool.status === "deprecated" ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          Deprecated
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {tool.status || "Unknown"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
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
                            onClick={() => {
                              toast({
                                title: "Viewing schema",
                                description: `Viewing schema for ${tool.name}`
                              });
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Schema
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => viewVersionHistory(tool)}
                          >
                            <History className="h-4 w-4 mr-2" />
                            Version History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.open(`/tools/${tool.id}`, "_blank");
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in Registry
                          </DropdownMenuItem>
                          {!tool.isActive && (
                            <DropdownMenuItem
                              onClick={() => {
                                toast({
                                  title: "Version activated",
                                  description: `Version ${tool.version} of ${tool.name} is now active.`
                                });
                              }}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Set as Active
                            </DropdownMenuItem>
                          )}
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
            {sortedToolVersions?.length ? (
              <>
                Total: <span className="font-medium">{sortedToolVersions.length}</span> version(s)
                {searchQuery && toolVersions?.length !== sortedToolVersions.length && (
                  <> (filtered from {toolVersions.length})</>
                )}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>
      
      {/* Version History Dialog */}
      {selectedTool && (
        <Dialog open={isVersionHistoryOpen} onOpenChange={setIsVersionHistoryOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Version History - {selectedTool.name}</DialogTitle>
              <DialogDescription>
                View the complete version history for this tool
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <LayoutList className="h-5 w-5 mr-2 text-muted-foreground" />
                  <span className="font-medium">All Versions</span>
                </div>
                <Select defaultValue="newest">
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-6">
                {[...Array(5)].map((_, i) => {
                  const version = `${parseInt(selectedTool.version.split('.')[0])}.${parseInt(selectedTool.version.split('.')[1]) - i}.0`;
                  const isActive = i === 0;
                  const date = new Date();
                  date.setDate(date.getDate() - i * 14);
                  
                  return (
                    <div key={i} className="border-l-2 pl-4 relative">
                      {isActive && (
                        <div className="absolute left-[-5px] top-0 h-2 w-2 rounded-full bg-primary"></div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <Tag className="h-4 w-4 mr-2 text-primary" />
                            <span className="font-medium">{version}</span>
                            {isActive && (
                              <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">
                                Active
                              </Badge>
                            )}
                            {i === 2 && (
                              <Badge variant="outline" className="ml-2">
                                LTS
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center">
                            <CalendarClock className="h-3.5 w-3.5 mr-1" />
                            Released on {date.toLocaleDateString()}
                          </div>
                          <div className="mt-2 text-sm">
                            {i === 0 ? (
                              <p>Added support for streaming responses and improved error handling</p>
                            ) : i === 1 ? (
                              <p>Performance optimizations and bug fixes</p>
                            ) : i === 2 ? (
                              <p>Long-term support version with stability improvements</p>
                            ) : i === 3 ? (
                              <p>Added new authentication options</p>
                            ) : (
                              <p>Initial release</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              toast({
                                title: "Viewing schema",
                                description: `Viewing schema for version ${version}`
                              });
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Schema
                          </Button>
                          
                          {!isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                toast({
                                  title: "Version activated",
                                  description: `Version ${version} is now active.`
                                });
                                setIsVersionHistoryOpen(false);
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <DialogFooter>
              <div className="flex justify-between w-full">
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    toast({
                      title: "Comparing versions",
                      description: "Version comparison tool will be available in a future update."
                    });
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <ArrowRight className="h-4 w-4" />
                  Compare Versions
                </Button>
                <Button onClick={() => setIsVersionHistoryOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}