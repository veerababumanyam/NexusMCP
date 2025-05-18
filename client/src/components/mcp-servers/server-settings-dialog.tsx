import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Security Policies Form Schema
const securityFormSchema = z.object({
  enforceTls: z.boolean().default(true),
  apiKeyRotationDays: z.number().min(1).max(365).default(90),
  enforceOAuth: z.boolean().default(false),
  allowedAuthMethods: z.array(z.string()).default(["api_key", "oauth", "basic"]),
  ipAllowList: z.string().optional(),
  ipDenyList: z.string().optional(),
  enforceIpFilter: z.boolean().default(false),
});

// Connection Limits Form Schema
const connectionFormSchema = z.object({
  maxConnectionsPerServer: z.number().min(1).max(1000).default(100),
  connectionTimeoutSeconds: z.number().min(5).max(300).default(30),
  retryAttemptsOnFailure: z.number().min(0).max(10).default(3),
  retryDelaySeconds: z.number().min(1).max(60).default(5),
  enableCircuitBreaker: z.boolean().default(true),
  monitorHeartbeatIntervalSeconds: z.number().min(5).max(300).default(60),
});

// Resource Allocation Form Schema
const resourceFormSchema = z.object({
  maxConcurrentRequests: z.number().min(1).max(1000).default(50),
  requestTimeoutSeconds: z.number().min(1).max(300).default(30),
  maxRequestSizeKb: z.number().min(1).max(10240).default(1024),
  enableLoadBalancing: z.boolean().default(true),
  loadBalancingStrategy: z.enum(["round_robin", "least_connections", "weighted"]).default("least_connections"),
});

// Advanced Settings Form Schema
const advancedFormSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  enableRequestCompression: z.boolean().default(true),
  enableResponseCompression: z.boolean().default(true),
  proxyBufferSizeKb: z.number().min(4).max(1024).default(64),
  enableTelemetry: z.boolean().default(true),
  telemetryInterval: z.number().min(10).max(3600).default(60),
});

// Union type for all forms
type SettingType = "security" | "connection" | "resource" | "advanced";

type ServerSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingType: SettingType;
  title: string;
};

export function ServerSettingsDialog({
  open,
  onOpenChange,
  settingType,
  title,
}: ServerSettingsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // Security settings form
  const securityForm = useForm<z.infer<typeof securityFormSchema>>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      enforceTls: true,
      apiKeyRotationDays: 90,
      enforceOAuth: false,
      allowedAuthMethods: ["api_key", "oauth", "basic"],
      ipAllowList: "",
      ipDenyList: "",
      enforceIpFilter: false,
    },
  });

  // Connection settings form
  const connectionForm = useForm<z.infer<typeof connectionFormSchema>>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      maxConnectionsPerServer: 100,
      connectionTimeoutSeconds: 30,
      retryAttemptsOnFailure: 3,
      retryDelaySeconds: 5,
      enableCircuitBreaker: true,
      monitorHeartbeatIntervalSeconds: 60,
    },
  });

  // Resource settings form
  const resourceForm = useForm<z.infer<typeof resourceFormSchema>>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      maxConcurrentRequests: 50,
      requestTimeoutSeconds: 30,
      maxRequestSizeKb: 1024,
      enableLoadBalancing: true,
      loadBalancingStrategy: "least_connections",
    },
  });

  // Advanced settings form
  const advancedForm = useForm<z.infer<typeof advancedFormSchema>>({
    resolver: zodResolver(advancedFormSchema),
    defaultValues: {
      logLevel: "info",
      enableRequestCompression: true,
      enableResponseCompression: true,
      proxyBufferSizeKb: 64,
      enableTelemetry: true,
      telemetryInterval: 60,
    },
  });

  // Get settings queries
  const securitySettingsQuery = useQuery({
    queryKey: ["/api/mcp-servers/settings/security"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers/settings/security");
      if (!res.ok) throw new Error("Failed to fetch security settings");
      return res.json();
    },
    enabled: settingType === "security" && open
  });

  const connectionSettingsQuery = useQuery({
    queryKey: ["/api/mcp-servers/settings/connection"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers/settings/connection");
      if (!res.ok) throw new Error("Failed to fetch connection settings");
      return res.json();
    },
    enabled: settingType === "connection" && open
  });

  const resourceSettingsQuery = useQuery({
    queryKey: ["/api/mcp-servers/settings/resource"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers/settings/resource");
      if (!res.ok) throw new Error("Failed to fetch resource settings");
      return res.json();
    },
    enabled: settingType === "resource" && open
  });

  const advancedSettingsQuery = useQuery({
    queryKey: ["/api/mcp-servers/settings/advanced"],
    queryFn: async () => {
      const res = await fetch("/api/mcp-servers/settings/advanced");
      if (!res.ok) throw new Error("Failed to fetch advanced settings");
      return res.json();
    },
    enabled: settingType === "advanced" && open
  });

  // Update form values when settings load
  React.useEffect(() => {
    if (settingType === "security" && securitySettingsQuery.data) {
      securityForm.reset(securitySettingsQuery.data);
    } else if (settingType === "connection" && connectionSettingsQuery.data) {
      connectionForm.reset(connectionSettingsQuery.data);
    } else if (settingType === "resource" && resourceSettingsQuery.data) {
      resourceForm.reset(resourceSettingsQuery.data);
    } else if (settingType === "advanced" && advancedSettingsQuery.data) {
      advancedForm.reset(advancedSettingsQuery.data);
    }
  }, [
    settingType, 
    securitySettingsQuery.data, 
    connectionSettingsQuery.data, 
    resourceSettingsQuery.data, 
    advancedSettingsQuery.data
  ]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/mcp-servers/settings/${settingType}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: `${title} settings have been updated successfully.`,
      });
      // Invalidate specific setting type query
      queryClient.invalidateQueries({ queryKey: [`/api/mcp-servers/settings/${settingType}`] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Determine which form to use based on settingType
  const getFormContent = () => {
    switch (settingType) {
      case "security":
        return (
          <Form {...securityForm}>
            <form
              onSubmit={securityForm.handleSubmit((data) => updateSettingsMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={securityForm.control}
                name="enforceTls"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enforce TLS</FormLabel>
                      <FormDescription>
                        Require all MCP server connections to use HTTPS
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={securityForm.control}
                name="apiKeyRotationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key Rotation (Days)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={30}
                          max={365}
                          step={30}
                          defaultValue={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>30 days</span>
                          <span>{field.value} days</span>
                          <span>1 year</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Automatically force rotation of API keys after this period
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={securityForm.control}
                name="enforceOAuth"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enforce OAuth</FormLabel>
                      <FormDescription>
                        Require OAuth 2.1 for all server connections
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={securityForm.control}
                name="ipAllowList"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Allow List</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Example: 10.0.0.1, 192.168.1.0/24"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of IPs or CIDR blocks to allow
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={securityForm.control}
                name="ipDenyList"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Deny List</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Example: 10.0.0.2, 192.168.2.0/24"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of IPs or CIDR blocks to deny
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={securityForm.control}
                name="enforceIpFilter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enforce IP Filtering</FormLabel>
                      <FormDescription>
                        Apply IP allow/deny list to all server connections
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateSettingsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        );

      case "connection":
        return (
          <Form {...connectionForm}>
            <form
              onSubmit={connectionForm.handleSubmit((data) => updateSettingsMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={connectionForm.control}
                name="maxConnectionsPerServer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Connections Per Server</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of concurrent connections allowed per server
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={connectionForm.control}
                name="connectionTimeoutSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Timeout (Seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={300}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time to wait before considering a connection attempt failed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={connectionForm.control}
                name="retryAttemptsOnFailure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retry Attempts</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of retry attempts on connection failure
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={connectionForm.control}
                name="retryDelaySeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retry Delay (Seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Delay between retry attempts
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={connectionForm.control}
                name="enableCircuitBreaker"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Circuit Breaker</FormLabel>
                      <FormDescription>
                        Temporarily disable connections to failing servers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={connectionForm.control}
                name="monitorHeartbeatIntervalSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heartbeat Interval (Seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={300}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Interval between server health monitoring pings
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateSettingsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        );

      case "resource":
        return (
          <Form {...resourceForm}>
            <form
              onSubmit={resourceForm.handleSubmit((data) => updateSettingsMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={resourceForm.control}
                name="maxConcurrentRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Concurrent Requests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of concurrent requests allowed across all servers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resourceForm.control}
                name="requestTimeoutSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Timeout (Seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={300}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time to wait before terminating a request
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resourceForm.control}
                name="maxRequestSizeKb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Request Size (KB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10240}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum size of requests in kilobytes
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resourceForm.control}
                name="enableLoadBalancing"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Load Balancing</FormLabel>
                      <FormDescription>
                        Distribute requests across multiple servers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={resourceForm.control}
                name="loadBalancingStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Load Balancing Strategy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="round_robin">Round Robin</SelectItem>
                        <SelectItem value="least_connections">Least Connections</SelectItem>
                        <SelectItem value="weighted">Weighted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Algorithm used to distribute requests
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateSettingsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        );

      case "advanced":
        return (
          <Form {...advancedForm}>
            <form
              onSubmit={advancedForm.handleSubmit((data) => updateSettingsMutation.mutate(data))}
              className="space-y-6"
            >
              <FormField
                control={advancedForm.control}
                name="logLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Log Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select log level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Minimum level of logs to capture
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={advancedForm.control}
                name="enableRequestCompression"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Request Compression</FormLabel>
                      <FormDescription>
                        Compress outgoing requests to servers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={advancedForm.control}
                name="enableResponseCompression"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Response Compression</FormLabel>
                      <FormDescription>
                        Compress responses from servers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={advancedForm.control}
                name="proxyBufferSizeKb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proxy Buffer Size (KB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={4}
                        max={1024}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Size of buffer used for proxy connections
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={advancedForm.control}
                name="enableTelemetry"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Telemetry</FormLabel>
                      <FormDescription>
                        Collect detailed performance and usage metrics
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={advancedForm.control}
                name="telemetryInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telemetry Interval (Seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={10}
                        max={3600}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Interval between telemetry data collection
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateSettingsMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Configure global settings for all MCP server connections.
          </DialogDescription>
        </DialogHeader>
        {getFormContent()}
      </DialogContent>
    </Dialog>
  );
}