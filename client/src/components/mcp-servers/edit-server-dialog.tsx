import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Form validation schema
const serverFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Please enter a valid URL"),
  type: z.string(),
  apiKey: z.string().optional(),
  workspaceId: z.number().optional(),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface EditServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: any | null;
  workspaces?: { id: number; name: string }[];
}

export function EditServerDialog({
  open,
  onOpenChange,
  server,
  workspaces = [],
}: EditServerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // Configure form with validation schema
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      url: "https://",
      type: "primary",
      apiKey: "",
      workspaceId: undefined,
    },
  });

  // Update form when server changes
  useEffect(() => {
    if (server) {
      form.reset({
        name: server.name || "",
        url: server.url || "https://",
        type: server.type || "primary",
        apiKey: server.apiKey || "",
        workspaceId: server.workspaceId,
      });
    }
  }, [server, form]);

  // Update server mutation
  const updateServerMutation = useMutation({
    mutationFn: async (data: ServerFormValues) => {
      if (!server?.id) throw new Error("Server ID is required");
      const response = await apiRequest("PUT", `/api/mcp-servers/${server.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Server updated",
        description: "MCP server has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-servers", server?.id] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update server",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  function onSubmit(data: ServerFormValues) {
    updateServerMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit MCP Server</DialogTitle>
          <DialogDescription>
            Update the configuration for your Model Context Protocol server.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="pt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My MCP Server" />
                      </FormControl>
                      <FormDescription>
                        A recognizable name for the MCP server
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://mcp-server.example.com" />
                      </FormControl>
                      <FormDescription>
                        The URL of the MCP server (must be HTTPS for production)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select server type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="replica">Replica</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Type determines server priority and usage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="advanced" className="pt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter API key if required"
                          type="password"
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        API key for secure authentication with the MCP server
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {workspaces && workspaces.length > 0 && (
                  <FormField
                    control={form.control}
                    name="workspaceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace (Optional)</FormLabel>
                        <Select
                          onValueChange={(value) => 
                            field.onChange(value === "none" ? undefined : parseInt(value))
                          }
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a workspace" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Global (No Workspace)</SelectItem>
                            {workspaces.map((workspace) => (
                              <SelectItem key={workspace.id} value={workspace.id.toString()}>
                                {workspace.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Associate this server with a specific workspace
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateServerMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateServerMutation.isPending}>
                {updateServerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}