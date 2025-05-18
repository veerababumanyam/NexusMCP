import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  Layers, 
  Plus, 
  ChevronRight,
  Search,
  Edit,
  Trash2,
  Settings2,
  FileCode2,
  ArrowDownCircle,
  BookCopy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AgentTypesPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [isTypeDetailsOpen, setIsTypeDetailsOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  
  // Fetch agent types
  const {
    data: agentTypes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/agent-types"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/agent-types");
        if (!res.ok) throw new Error("Failed to fetch agent types");
        return res.json();
      } catch (error) {
        console.error("Error fetching agent types:", error);
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
        title: "Agent types refreshed",
        description: "Agent type registry has been updated.",
      });
    } catch (error) {
      console.error("Error refreshing agent types:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh agent type registry.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter agent types based on search query
  const filteredAgentTypes = agentTypes?.filter((type: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      type.name.toLowerCase().includes(query) ||
      type.description?.toLowerCase().includes(query) ||
      type.category?.toLowerCase().includes(query)
    );
  });
  
  // Category badge class
  const getCategoryBadgeClass = (category: string) => {
    switch (category?.toLowerCase()) {
      case "ml":
      case "machine learning":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "utility":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "integration":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "workflow":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "security":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Handle view type details
  const handleViewTypeDetails = (type: any) => {
    setSelectedType(type);
    setIsTypeDetailsOpen(true);
  };

  return (
    <>
      <DashboardHeader
        title="Agent Types"
        subtitle="Manage and explore MCP agent type definitions"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agent types..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {hasPermission('agents:manage') && (
          <Button
            onClick={() => setIsAddTypeOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Agent Type
          </Button>
        )}
      </div>
      
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">Agent Type Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isRefreshing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-muted-foreground">
                Loading agent types...
              </span>
            </div>
          ) : filteredAgentTypes?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Layers className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-muted-foreground">
                {searchQuery ? "No agent types match your search" : "No agent types found"}
              </span>
              {!searchQuery && hasPermission('agents:manage') && (
                <Button
                  variant="link"
                  onClick={() => setIsAddTypeOpen(true)}
                  className="mt-2"
                >
                  Add your first agent type
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredAgentTypes?.map((type: any) => (
                <div key={type.id} className="p-4 hover:bg-muted/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-base font-medium flex items-center">
                          {type.name}
                          <span className="text-sm text-muted-foreground ml-2">v{type.version}</span>
                        </h3>
                        <p className="text-sm text-muted-foreground">{type.description || "No description"}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {type.category && (
                        <Badge className={`${getCategoryBadgeClass(type.category)}`}>
                          {type.category}
                        </Badge>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewTypeDetails(type)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {type.capabilities && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {type.capabilities.map((capability: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6">
          <div className="text-sm text-muted-foreground">
            {filteredAgentTypes?.length ? (
              <>
                Total: <span className="font-medium">{filteredAgentTypes.length}</span> agent types
                {searchQuery && agentTypes?.length !== filteredAgentTypes.length && (
                  <> (filtered from {agentTypes.length})</>
                )}
              </>
            ) : null}
          </div>
        </CardFooter>
      </Card>
      
      {/* Add Agent Type Dialog */}
      <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Agent Type</DialogTitle>
            <DialogDescription>
              Define a new agent type for your MCP platform.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Tabs defaultValue="import">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="import">Import</TabsTrigger>
                <TabsTrigger value="template">From Template</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
              
              <TabsContent value="import" className="pt-4">
                <div className="flex items-center justify-center py-6 border-2 border-dashed rounded-lg">
                  <div className="text-center">
                    <ArrowDownCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="font-medium mb-1">Import Agent Type Schema</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop, or click to select
                    </p>
                    <Button variant="outline" size="sm">
                      Select File
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="template" className="pt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">ML Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Template for machine learning inference agents
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Utility Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Template for general purpose utility agents
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Integration Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Template for third-party service integration agents
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">A2A-Compatible Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Template for agents that support agent-to-agent communication
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="pt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manual agent type creation will be available in a future update.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddTypeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsAddTypeOpen(false);
              toast({
                title: "Agent type added",
                description: "New agent type has been added successfully."
              });
              // In a real implementation, we would add the agent type to the database
              refreshData();
            }}>
              Add Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Agent Type Details Dialog */}
      {selectedType && (
        <Dialog open={isTypeDetailsOpen} onOpenChange={setIsTypeDetailsOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {selectedType.name}
                <span className="text-sm text-muted-foreground ml-2">v{selectedType.version}</span>
                {selectedType.category && (
                  <Badge className={`ml-2 ${getCategoryBadgeClass(selectedType.category)}`}>
                    {selectedType.category}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedType.description}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="docs">Documentation</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Properties</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Version:</span>
                          <span>{selectedType.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span>{selectedType.category || "Uncategorized"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span>{new Date(selectedType.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Updated:</span>
                          <span>{new Date(selectedType.updatedAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">A2A Support:</span>
                          <span>{selectedType.supportsA2A ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-2">Capabilities</h3>
                      {selectedType.capabilities?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedType.capabilities.map((capability: string, index: number) => (
                            <Badge key={index} variant="outline">
                              {capability}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No capabilities defined</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Configuration Parameters</h3>
                    {selectedType.configSchema ? (
                      <Accordion type="single" collapsible className="w-full">
                        {Object.entries(selectedType.configSchema.properties || {}).map(([key, value]: [string, any]) => (
                          <AccordionItem key={key} value={key}>
                            <AccordionTrigger className="text-sm font-medium">
                              {key}
                              {selectedType.configSchema.required?.includes(key) && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{value.description}</p>
                                <div className="text-xs">
                                  <span className="font-medium">Type:</span> {value.type}
                                  {value.enum && (
                                    <div className="mt-1">
                                      <span className="font-medium">Allowed values:</span>{" "}
                                      {value.enum.join(", ")}
                                    </div>
                                  )}
                                  {value.default !== undefined && (
                                    <div className="mt-1">
                                      <span className="font-medium">Default:</span>{" "}
                                      {JSON.stringify(value.default)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <p className="text-sm text-muted-foreground">No configuration parameters defined</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="schema" className="pt-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => {
                        toast({
                          title: "Schema copied",
                          description: "Agent type schema copied to clipboard."
                        });
                      }}
                    >
                      Copy
                    </Button>
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedType, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="docs" className="pt-4">
                  <div className="flex items-center justify-center py-10">
                    <div className="text-center">
                      <BookCopy className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="font-medium mb-1">Documentation</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Documentation for this agent type will be available in a future update.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            <DialogFooter>
              {hasPermission('agents:manage') && (
                <div className="flex space-x-2 mr-auto">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileCode2 className="h-4 w-4" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
              <Button onClick={() => setIsTypeDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}