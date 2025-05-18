import React, { useState } from "react";
import { MoreHorizontal, Edit, Trash2, RefreshCw, Power, PowerOff, Download, Link } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EditServerDialog } from "./edit-server-dialog";
import { DeleteServerDialog } from "./delete-server-dialog";

interface ServerActionsMenuProps {
  server: any;
  workspaces?: { id: number; name: string }[];
  onActionComplete?: () => void;
}

export function ServerActionsMenu({
  server,
  workspaces = [],
  onActionComplete,
}: ServerActionsMenuProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Server status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = server.status === "active" ? "disabled" : "active";
      await apiRequest("PATCH", `/api/mcp-servers/${server.id}/status`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      const newStatus = server.status === "active" ? "disabled" : "active";
      toast({
        title: `Server ${newStatus === "active" ? "enabled" : "disabled"}`,
        description: `"${server.name}" has been ${newStatus === "active" ? "enabled" : "disabled"} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-servers"] });
      if (onActionComplete) onActionComplete();
    },
    onError: (error) => {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Refresh server connection mutation
  const refreshServerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/mcp-servers/${server.id}/refresh`);
    },
    onSuccess: () => {
      toast({
        title: "Connection refreshed",
        description: `"${server.name}" connection has been refreshed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-servers"] });
      if (onActionComplete) onActionComplete();
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Copy connection string to clipboard
  const handleCopyConnectionString = () => {
    const connectionString = `${server.type}://${server.url.replace(/^https?:\/\//, "")}`;
    navigator.clipboard.writeText(connectionString)
      .then(() => {
        toast({
          title: "Connection string copied",
          description: "Connection string has been copied to clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy connection string to clipboard.",
          variant: "destructive",
        });
      });
  };

  // Generate connection token
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/mcp-servers/${server.id}/token`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.token) {
        navigator.clipboard.writeText(data.token)
          .then(() => {
            toast({
              title: "Connection token generated",
              description: "New token has been copied to clipboard.",
            });
          })
          .catch(() => {
            toast({
              title: "Copy failed",
              description: "Token generated but failed to copy to clipboard.",
              variant: "destructive",
            });
          });
      }
      if (onActionComplete) onActionComplete();
    },
    onError: (error) => {
      toast({
        title: "Token generation failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Server Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            setIsEditOpen(true);
          }}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Server
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            refreshServerMutation.mutate();
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Connection
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            toggleStatusMutation.mutate();
          }}>
            {server.status === "active" ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Disable Server
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Enable Server
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            handleCopyConnectionString();
          }}>
            <Link className="h-4 w-4 mr-2" />
            Copy Connection String
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            generateTokenMutation.mutate();
          }}>
            <Download className="h-4 w-4 mr-2" />
            Generate Connection Token
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e) => {
              e.stopPropagation();
              setIsDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Server
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditServerDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        server={server}
        workspaces={workspaces}
      />

      <DeleteServerDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        serverId={server.id}
        serverName={server.name}
      />
    </>
  );
}