import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Eye, 
  Edit, 
  RefreshCw,
  Server as ServerIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ServerDetailsModal } from "@/components/server/server-details-modal";

interface ServerTableProps {
  servers: Array<{
    id: number;
    name: string;
    url: string;
    type: string;
    status: string;
    tools: number;
    uptime?: string;
  }>;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ServerTable({ servers, onRefresh, isLoading = false }: ServerTableProps) {
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingServerId, setProcessingServerId] = useState<number | null>(null);

  const handleViewServer = (server: any) => {
    setSelectedServer(server);
    setIsModalOpen(true);
  };

  const handleEditServer = (server: any) => {
    toast({
      title: "Edit Server",
      description: `Editing server ${server.name}`,
    });
    // Implement edit functionality or navigation
  };

  const handleRestartServer = async (server: any) => {
    try {
      setProcessingServerId(server.id);
      
      // First disconnect if connected
      if (server.status === "connected") {
        await apiRequest("POST", `/api/mcp-servers/${server.id}/disconnect`, null);
      }
      
      // Then connect
      await apiRequest("POST", `/api/mcp-servers/${server.id}/connect`, null);
      
      toast({
        title: "Server Restarted",
        description: `Successfully restarted connection to ${server.name}`,
      });
      
      // Refresh server list after restart
      onRefresh();
    } catch (error) {
      toast({
        title: "Restart Failed",
        description: `Failed to restart server: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setProcessingServerId(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "connected":
      case "healthy":
        return "bg-success/10 text-success";
      case "warning":
      case "issues":
        return "bg-warning/10 text-warning";
      case "error":
      case "disconnected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "connected":
        return "Healthy";
      case "disconnected":
        return "Error";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="bg-muted/50 py-4">
          <CardTitle className="text-base font-medium">MCP Server Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead>Uptime</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-muted-foreground">Loading servers...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center">
                        <ServerIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground">No servers found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map((server) => (
                    <TableRow key={server.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white">
                            <ServerIcon className="h-4 w-4" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium">{server.name}</div>
                            <div className="text-xs text-muted-foreground">{server.url}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{server.type}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(server.status)}`}>
                          {getStatusLabel(server.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {server.tools} / {server.tools}
                      </TableCell>
                      <TableCell className="text-sm">
                        {server.uptime || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewServer(server)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-primary hover:text-primary/80" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditServer(server)}
                            title="Edit Server"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestartServer(server)}
                            disabled={processingServerId === server.id}
                            title="Restart Connection"
                          >
                            <RefreshCw className={`h-4 w-4 text-muted-foreground hover:text-foreground ${
                              processingServerId === server.id ? "animate-spin text-primary" : ""
                            }`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 py-3 px-6 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {servers.length > 0 && (
              <>
                Showing <span className="font-medium">{servers.length}</span> of{" "}
                <span className="font-medium">{servers.length}</span> servers
              </>
            )}
          </div>
          <Button variant="default" size="sm" onClick={onRefresh} disabled={isLoading}>
            View All
          </Button>
        </CardFooter>
      </Card>
      
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
