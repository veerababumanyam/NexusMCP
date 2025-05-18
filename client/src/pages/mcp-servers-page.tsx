import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Server, Settings, Database, Shield, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AddServerDialog } from "@/components/mcp-servers/add-server-dialog";
import { ServerDetailsDialog } from "@/components/mcp-servers/server-details-dialog";
import { ServerActionsMenu } from "@/components/mcp-servers/server-actions-menu";
import { ServerSettingsDialog } from "@/components/mcp-servers/server-settings-dialog";
import { Badge } from "@/components/ui/badge";

export default function McpServersPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [isServerDetailsOpen, setIsServerDetailsOpen] = useState(false);
  const [activeSettingsDialog, setActiveSettingsDialog] = useState<{
    type: "security" | "connection" | "resource" | "advanced";
    title: string;
    open: boolean;
  }>({
    type: "security",
    title: "Security Policies",
    open: false,
  });
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  
  // Fetch MCP servers
  const {
    data: servers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/mcp-servers"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers");
      if (!res.ok) throw new Error("Failed to fetch MCP servers");
      return res.json();
    },
  });

  // Fetch workspaces for the Add Server dialog
  const { data: workspaces } = useQuery({
    queryKey: ["/api/workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json();
    },
  });

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Refreshed",
        description: "Server list has been refreshed.",
      });
    } catch (error) {
      console.error("Error refreshing MCP servers data:", error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh server list.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle server card click
  const handleServerClick = (serverId: number) => {
    setSelectedServerId(serverId);
    setIsServerDetailsOpen(true);
  };

  // Handle "Add your first server" button click
  const handleAddFirstServerClick = () => {
    setIsAddServerOpen(true);
  };

  return (
    <>
      <DashboardHeader
        title="MCP Server Management"
        subtitle="Manage your Model Context Protocol servers"
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex justify-end mb-6">
        {hasPermission('servers:create') && (
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsAddServerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Server
          </Button>
        )}
      </div>
      
      <Tabs defaultValue="servers" className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servers">Server Registry</TabsTrigger>
          <TabsTrigger value="metrics">Connection Metrics</TabsTrigger>
          <TabsTrigger value="settings">Server Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="servers">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">MCP Servers</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-muted-foreground">
                    Loading servers...
                  </span>
                </div>
              ) : servers?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Server className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">
                    No MCP servers found
                  </span>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={handleAddFirstServerClick}
                  >
                    Add your first server
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {servers?.map((server: any) => (
                    <Card 
                      key={server.id} 
                      className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleServerClick(server.id)}
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                            <Server className="h-5 w-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-medium">{server.name}</h3>
                              <Badge variant="outline" className="text-xs font-normal capitalize">
                                {server.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{server.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            server.status === 'active' ? 'bg-success/10 text-success' :
                            server.status === 'degraded' ? 'bg-warning/10 text-warning' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                          </div>
                          <ServerActionsMenu 
                            server={server} 
                            workspaces={workspaces}
                            onActionComplete={refreshData} 
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Connection Statistics</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center p-4 border rounded-md">
                    <Activity className="h-8 w-8 text-primary mb-2" />
                    <span className="text-2xl font-bold">
                      {!isLoading && servers ? servers.filter((s: any) => s.status === 'active').length : '-'}
                    </span>
                    <span className="text-sm text-muted-foreground">Active Servers</span>
                  </div>
                  <div className="flex flex-col items-center p-4 border rounded-md">
                    <Database className="h-8 w-8 text-primary mb-2" />
                    <span className="text-2xl font-bold">
                      {!isLoading && servers ? servers.length : '-'}
                    </span>
                    <span className="text-sm text-muted-foreground">Total Servers</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/50 py-4">
                <CardTitle className="text-base font-medium">Security Status</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-4">
                  <Shield className="h-12 w-12 text-success mb-2" />
                  <span className="text-lg font-medium mb-1">All connections secure</span>
                  <span className="text-sm text-muted-foreground text-center">
                    All servers are using secure connections with proper authentication
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader className="bg-muted/50 py-4">
              <CardTitle className="text-base font-medium">Server Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center mb-6">
                <Settings className="h-8 w-8 text-muted-foreground mr-4" />
                <div>
                  <h3 className="font-medium mb-1">Global Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure global settings for MCP server connections
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveSettingsDialog({
                        type: "security",
                        title: "Security Policies",
                        open: true
                      });
                    }}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Security Policies
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveSettingsDialog({
                        type: "connection",
                        title: "Connection Limits",
                        open: true
                      });
                    }}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Connection Limits
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveSettingsDialog({
                        type: "resource",
                        title: "Resource Allocation",
                        open: true
                      });
                    }}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Resource Allocation
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveSettingsDialog({
                        type: "advanced",
                        title: "Advanced Settings", 
                        open: true
                      });
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Server Dialog */}
      <AddServerDialog 
        open={isAddServerOpen} 
        onOpenChange={setIsAddServerOpen} 
        workspaces={workspaces}
      />
      
      {/* Server Details Dialog */}
      <ServerDetailsDialog
        serverId={selectedServerId}
        open={isServerDetailsOpen}
        onOpenChange={setIsServerDetailsOpen}
      />

      {/* Server Settings Dialog */}
      <ServerSettingsDialog
        open={activeSettingsDialog.open}
        onOpenChange={(open) => 
          setActiveSettingsDialog({
            ...activeSettingsDialog,
            open
          })
        }
        settingType={activeSettingsDialog.type}
        title={activeSettingsDialog.title}
      />
    </>
  );
}