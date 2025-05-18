import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ServerDetailsModalProps {
  server: {
    id: number;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

interface ServerTool {
  id: number;
  name: string;
  description: string;
  status: string;
}

export function ServerDetailsModal({
  server,
  isOpen,
  onClose,
}: ServerDetailsModalProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch server details
  const {
    data: serverDetails,
    isLoading: isLoadingServer,
    refetch: refetchServer,
  } = useQuery({
    queryKey: [`/api/mcp-servers/${server.id}`],
    enabled: isOpen && !!server.id,
  });

  // Fetch server tools
  const {
    data: serverTools,
    isLoading: isLoadingTools,
    refetch: refetchTools,
  } = useQuery<ServerTool[]>({
    queryKey: [`/api/mcp-servers/${server.id}/tools`],
    enabled: isOpen && !!server.id,
  });

  const refreshServerData = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetchServer(), refetchTools()]);
      toast({
        title: "Refreshed",
        description: "Server data has been refreshed",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh server data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  const isLoading = isLoadingServer || isLoadingTools || isRefreshing;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Server Details: {server.name}
            {isLoading && (
              <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mt-2">
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Server URL</p>
                    <p className="text-sm font-medium">{serverDetails?.url}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-sm font-medium text-success">
                      {serverDetails?.status || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Version</p>
                    <p className="text-sm font-medium">
                      {serverDetails?.version || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Synced</p>
                    <p className="text-sm font-medium">
                      {formatDate(serverDetails?.lastSync)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="text-sm font-medium">
                      {serverDetails?.type || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Workspace ID</p>
                    <p className="text-sm font-medium">
                      {serverDetails?.workspaceId || "None"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">
                  Available Tools ({serverTools?.length || 0})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {serverTools?.length === 0 ? (
                    <div className="col-span-full p-4 text-center text-muted-foreground">
                      No tools available for this server
                    </div>
                  ) : (
                    <>
                      {serverTools?.slice(0, 5).map((tool) => (
                        <div
                          key={tool.id}
                          className="border border-border rounded-lg p-3"
                        >
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                              >
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {tool.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {serverTools && serverTools.length > 5 && (
                        <div className="border border-border rounded-lg p-3 flex items-center justify-center">
                          <Button variant="link" className="text-primary">
                            View All Tools
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={refreshServerData}
            disabled={isLoading}
            className="mr-auto"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
