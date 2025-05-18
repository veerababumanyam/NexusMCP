import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Code, Server, Wrench, Monitor, Puzzle, CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ServerDetailsDialogProps = {
  serverId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ServerDetailsDialog({
  serverId,
  open,
  onOpenChange,
}: ServerDetailsDialogProps) {
  const {
    data: server,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/mcp-servers", serverId],
    queryFn: async () => {
      if (!serverId) return null;
      const res = await fetch(`/api/mcp-servers/${serverId}`);
      if (!res.ok) throw new Error("Failed to fetch server details");
      return res.json();
    },
    enabled: open && !!serverId,
  });

  const {
    data: serverTools,
    isLoading: isLoadingTools,
  } = useQuery({
    queryKey: ["/api/mcp-servers", serverId, "tools"],
    queryFn: async () => {
      if (!serverId) return [];
      const res = await fetch(`/api/mcp-servers/${serverId}/tools`);
      if (!res.ok) throw new Error("Failed to fetch server tools");
      return res.json();
    },
    enabled: open && !!serverId,
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading server details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !server) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Failed to load server details. Please try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <div className="flex items-center mb-2">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center mr-3">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">{server.name}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {server.url}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={server.status === "active" ? "default" : "secondary"} className={server.status === "active" ? "bg-green-500" : ""}>
              {server.status}
            </Badge>
            <Badge variant="outline">{server.type}</Badge>
            {server.version && <Badge variant="outline">v{server.version}</Badge>}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="connection">Connection</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Server Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">{server.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium capitalize">{server.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">{server.version || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Added:</span>
                    <span className="font-medium">
                      {server.createdAt 
                        ? format(new Date(server.createdAt), "MMM d, yyyy") 
                        : "Unknown"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Resource Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tools:</span>
                    <span className="font-medium">{isLoadingTools ? "Loading..." : serverTools?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Sync:</span>
                    <span className="font-medium">
                      {server.lastSync 
                        ? format(new Date(server.lastSync), "MMM d, yyyy HH:mm") 
                        : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-primary mr-2" />
                    <span className="text-sm">Tool Discovery</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-primary mr-2" />
                    <span className="text-sm">Real-time Updates</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-primary mr-2" />
                    <span className="text-sm">OAuth 2.1 Authentication</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-primary mr-2" />
                    <span className="text-sm">WebSocket Support</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Available Tools</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTools ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">Loading tools...</span>
                  </div>
                ) : serverTools?.length === 0 ? (
                  <div className="py-8 text-center">
                    <Wrench className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No tools discovered</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Discover Tools
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serverTools?.map((tool: any) => (
                      <div key={tool.id} className="flex items-center justify-between border rounded-md p-2.5">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <Puzzle className="h-4 w-4 text-primary" />
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium">{tool.name}</h4>
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {tool.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connection">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Connection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL:</span>
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">{server.url}</code>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Key:</span>
                    <span className="font-medium">
                      {server.apiKey ? "●●●●●●●●●●●●" : "Not set"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connection Status:</span>
                    <Badge variant={server.status === "active" ? "default" : "secondary"} className={server.status === "active" ? "bg-green-500" : ""}>
                      {server.status}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Connected:</span>
                    <span className="font-medium">
                      {server.lastSync 
                        ? format(new Date(server.lastSync), "MMM d, yyyy HH:mm:ss") 
                        : "Never"}
                    </span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-between">
                  <Button variant="outline" size="sm">
                    <Monitor className="h-4 w-4 mr-2" />
                    Ping Server
                  </Button>
                  <Button variant="outline" size="sm">
                    <Code className="h-4 w-4 mr-2" />
                    Test Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}