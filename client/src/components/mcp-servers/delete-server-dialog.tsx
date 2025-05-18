import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DeleteServerDialogProps {
  serverId: number | null;
  serverName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteServerDialog({
  serverId,
  serverName,
  open,
  onOpenChange,
}: DeleteServerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete server mutation
  const deleteServerMutation = useMutation({
    mutationFn: async () => {
      if (!serverId) throw new Error("Server ID is required");
      await apiRequest("DELETE", `/api/mcp-servers/${serverId}`);
    },
    onSuccess: () => {
      toast({
        title: "Server deleted",
        description: `"${serverName}" has been deleted successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-servers"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete server",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteServerMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Are you sure you want to delete "<span className="font-medium">{serverName}</span>"? This action cannot be undone and will remove all connections and configuration for this server.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteServerMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteServerMutation.isPending}
          >
            {deleteServerMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Server
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}