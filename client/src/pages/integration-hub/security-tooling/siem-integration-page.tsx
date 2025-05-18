import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Send, AlertTriangle, Database, Shield, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import { securityToolingFormSchema, SiemFormValues } from "@shared/schema_security_tooling";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SIEM_SYSTEMS, SECURITY_AUTH_TYPES, LOG_FORMATS } from "@shared/schema_security_tooling";

// Define type for security event
type SecurityEvent = {
  value: string;
  label: string;
  severity: number;
};

// Define the page component
export default function SiemIntegrationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("integrations");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<number | null>(null);

  // Fetch SIEM integrations
  const { data: integrations = [], isLoading: isLoadingIntegrations, refetch: refetchIntegrations } = useQuery({
    queryKey: ["/api/security-tooling", { type: "siem" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security-tooling?type=siem");
      const data = await res.json();
      return data.integrations || [];
    }
  });

  // Fetch security event types for testing
  const { data: eventTypes = [], isLoading: isLoadingEventTypes } = useQuery({
    queryKey: ["/api/security-tooling/siem/event-types"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/security-tooling/siem/event-types");
      return await res.json();
    }
  });

  // Form for adding a new SIEM integration
  const form = useForm<SiemFormValues>({
    resolver: zodResolver(securityToolingFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "siem",
      system: undefined,
      authType: undefined,
      host: "",
      port: undefined,
      apiKey: "",
      username: "",
      password: "",
      logFormat: undefined,
      config: {
        useHTTPS: true,
        compressLogs: false,
        includeMetadata: true,
        enableRealTimeAlerts: false
      }
    }
  });

  // Form for testing security event
  const testEventForm = useForm({
    defaultValues: {
      eventType: "auth.login",
      data: {
        message: "Test security event",
        resourceType: "user",
        outcome: "success"
      }
    }
  });

  // Create SIEM integration mutation
  const createMutation = useMutation({
    mutationFn: async (values: SiemFormValues) => {
      const res = await apiRequest("POST", "/api/security-tooling", values);
      return await res.json();
    },
    onSuccess: () => {
      setAddDialogOpen(false);
      form.reset();
      refetchIntegrations();
      toast({
        title: "Integration Added",
        description: "SIEM integration has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete SIEM integration mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/security-tooling/${id}`);
    },
    onSuccess: () => {
      refetchIntegrations();
      toast({
        title: "Integration Deleted",
        description: "SIEM integration has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Toggle SIEM integration mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/security-tooling/${id}`, { enabled });
      return await res.json();
    },
    onSuccess: () => {
      refetchIntegrations();
      toast({
        title: "Integration Updated",
        description: "SIEM integration status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update integration",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Test SIEM integration mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/security-tooling/${id}/test`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Test security event mutation
  const testEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/security-tooling/siem/test-event", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setTestDialogOpen(false);
      toast({
        title: "Event Sent",
        description: `Security event '${data.event.eventType}' has been forwarded to configured SIEM systems.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Event",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (values: SiemFormValues) => {
    createMutation.mutate(values);
  };

  // Handle test event submission
  const onTestEventSubmit = (values: any) => {
    testEventMutation.mutate(values);
  };

  // Get the system icon based on the SIEM system
  const getSystemIcon = (system: string) => {
    switch (system) {
      case 'splunk':
        return <Database className="h-5 w-5" />;
      case 'qradar':
        return <Shield className="h-5 w-5" />;
      case 'sentinel':
        return <AlertTriangle className="h-5 w-5" />;
      case 'arcsight':
        return <Lock className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  // Render the system name with proper casing
  const formatSystemName = (system: string) => {
    switch (system) {
      case 'splunk':
        return 'Splunk';
      case 'qradar':
        return 'IBM QRadar';
      case 'sentinel':
        return 'Azure Sentinel';
      case 'arcsight':
        return 'ArcSight';
      default:
        return system.charAt(0).toUpperCase() + system.slice(1);
    }
  };

  // Determine the severity badge color based on severity level
  const getSeverityBadgeColor = (severity: number) => {
    if (severity >= 8) return "destructive";
    if (severity >= 5) return "warning";
    if (severity >= 3) return "secondary";
    return "outline";
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SIEM Integration</h1>
          <p className="text-muted-foreground">
            Connect NexusMCP with Security Information and Event Management (SIEM) systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchIntegrations()}
            disabled={isLoadingIntegrations}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="events">Event Testing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          {integrations.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No SIEM Integrations</CardTitle>
                <CardDescription>
                  You haven't added any SIEM integrations yet. Add an integration to forward security
                  events.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Integration
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="grid gap-4">
              {integrations.map((integration: any) => (
                <Card key={integration.id} className={!integration.enabled ? "opacity-70" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center">
                      {getSystemIcon(integration.system)}
                      <div className="ml-2">
                        <CardTitle className="text-xl">{integration.name}</CardTitle>
                        <CardDescription>{formatSystemName(integration.system)}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={integration.enabled ? "default" : "outline"}>
                      {integration.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Host:</p>
                        <p className="text-sm text-muted-foreground">
                          {integration.host}:{integration.port || "Default"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Log Format:</p>
                        <p className="text-sm text-muted-foreground">
                          {(integration.logFormat || "json").toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Auth Type:</p>
                        <p className="text-sm text-muted-foreground">
                          {integration.authType}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Added:</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(integration.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {integration.description && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Description:</p>
                        <p className="text-sm text-muted-foreground">{integration.description}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: integration.id, enabled: checked })
                        }
                        id={`enable-${integration.id}`}
                      />
                      <Label htmlFor={`enable-${integration.id}`}>
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </Label>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnectionMutation.mutate(integration.id)}
                        disabled={testConnectionMutation.isPending}
                      >
                        Test Connection
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this integration?")) {
                            deleteMutation.mutate(integration.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Event Testing</CardTitle>
              <CardDescription>
                Test forwarding security events to your configured SIEM systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrations.filter((i: any) => i.enabled).length === 0 ? (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Enabled Integrations</AlertTitle>
                  <AlertDescription>
                    You need at least one enabled SIEM integration to forward events.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      Select an event type to test forwarding to your configured SIEM systems.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {eventTypes.map((event: SecurityEvent) => (
                      <Card key={event.value} className="cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setTestDialogOpen(true);
                          testEventForm.setValue("eventType", event.value);
                        }}>
                        <CardHeader className="flex flex-row items-center justify-between py-2">
                          <div>
                            <CardTitle className="text-base">{event.label}</CardTitle>
                          </div>
                          <Badge variant={getSeverityBadgeColor(event.severity)}>
                            Severity {event.severity}
                          </Badge>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => setTestDialogOpen(true)}
                disabled={integrations.filter((i: any) => i.enabled).length === 0}
              >
                <Send className="mr-2 h-4 w-4" />
                Test Event
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SIEM Settings</CardTitle>
              <CardDescription>
                Configure general settings for SIEM integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Event Buffering</Label>
                    <p className="text-sm text-muted-foreground">
                      Buffer events before sending to SIEM systems
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Include User Context</Label>
                    <p className="text-sm text-muted-foreground">
                      Add user details to security events
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Include IP Information</Label>
                    <p className="text-sm text-muted-foreground">
                      Add IP addresses to security events
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Auto-Retry Failed Events</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically retry sending failed events
                    </p>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported SIEM Systems</CardTitle>
              <CardDescription>
                Security Information and Event Management systems supported by NexusMCP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System</TableHead>
                    <TableHead>Default Port</TableHead>
                    <TableHead>Log Formats</TableHead>
                    <TableHead>API Versions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Splunk</TableCell>
                    <TableCell>8088</TableCell>
                    <TableCell>JSON, CEF</TableCell>
                    <TableCell>8.0, 8.1, 8.2</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">IBM QRadar</TableCell>
                    <TableCell>514</TableCell>
                    <TableCell>LEEF, CEF</TableCell>
                    <TableCell>12.0, 13.0</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Azure Sentinel</TableCell>
                    <TableCell>443</TableCell>
                    <TableCell>JSON, CEF</TableCell>
                    <TableCell>2021-10-01, 2022-07-01</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">ArcSight</TableCell>
                    <TableCell>514</TableCell>
                    <TableCell>CEF</TableCell>
                    <TableCell>7.0, 7.5</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Integration Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add SIEM Integration</DialogTitle>
            <DialogDescription>
              Connect NexusMCP to a Security Information and Event Management system
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Integration Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Production Splunk" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SIEM System</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select SIEM system" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SIEM_SYSTEMS.map((system) => (
                            <SelectItem key={system} value={system}>
                              {formatSystemName(system)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description of this integration" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host</FormLabel>
                      <FormControl>
                        <Input placeholder="siem.example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Default port will be used if empty"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="authType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authentication Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select authentication type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SECURITY_AUTH_TYPES.map((authType) => (
                          <SelectItem key={authType} value={authType}>
                            {authType
                              .split("_")
                              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(" ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("authType") === "api_key" && (
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch("authType") === "basic_auth" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="logFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Log Format</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select log format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOG_FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {format.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="config.useHTTPS"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Use HTTPS</FormLabel>
                        <FormDescription>
                          Use secure connection for forwarding
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
                  control={form.control}
                  name="config.compressLogs"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Compress Logs</FormLabel>
                        <FormDescription>
                          Compress logs before sending
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="config.includeMetadata"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Include Metadata</FormLabel>
                        <FormDescription>
                          Add system metadata to events
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
                  control={form.control}
                  name="config.enableRealTimeAlerts"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Real-Time Alerts</FormLabel>
                        <FormDescription>
                          Enable real-time alerting
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Integration
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Test Event Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Security Event</DialogTitle>
            <DialogDescription>
              Send a test security event to your SIEM integrations
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={testEventForm.handleSubmit(onTestEventSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={testEventForm.watch("eventType")}
                onValueChange={(value) => testEventForm.setValue("eventType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((event: SecurityEvent) => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Input
                value={testEventForm.watch("data.message")}
                onChange={(e) => testEventForm.setValue("data.message", e.target.value)}
                placeholder="Event message"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resource Type</Label>
                <Input
                  value={testEventForm.watch("data.resourceType")}
                  onChange={(e) => testEventForm.setValue("data.resourceType", e.target.value)}
                  placeholder="user, role, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Input
                  value={testEventForm.watch("data.outcome")}
                  onChange={(e) => testEventForm.setValue("data.outcome", e.target.value)}
                  placeholder="success, failure, etc."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTestDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={testEventMutation.isPending || integrations.filter((i: any) => i.enabled).length === 0}
              >
                {testEventMutation.isPending && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}