import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  Save, 
  Activity,
  Bell,
  BarChart,
  LineChart,
  AlertTriangle,
  RefreshCw,
  Cpu,
  HardDrive,
  AlertCircle,
  Wrench,
  ShieldAlert
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Progress } from "@/components/ui/progress";

// Monitoring configuration schema
const monitoringConfigSchema = z.object({
  enableMetricsCollection: z.boolean().default(true),
  metricsInterval: z.string().regex(/^\d+$/, "Interval must be a number"),
  enableAlerts: z.boolean().default(true),
  alertChannels: z.array(z.string()).default([]),
  cpuThreshold: z.string().regex(/^\d+$/, "Threshold must be a number"),
  memoryThreshold: z.string().regex(/^\d+$/, "Threshold must be a number"),
  diskThreshold: z.string().regex(/^\d+$/, "Threshold must be a number"),
  responseTimeThreshold: z.string().regex(/^\d+$/, "Threshold must be a number"),
  errorRateThreshold: z.string().regex(/^\d+$/, "Threshold must be a number"),
  retentionDays: z.string().regex(/^\d+$/, "Retention days must be a number"),
  loggingLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  enablePrometheus: z.boolean().default(false),
  prometheusEndpoint: z.string().optional(),
  enableTrace: z.boolean().default(false),
  samplingRate: z.string().regex(/^\d+$/, "Rate must be a number"),
});

type MonitoringConfigFormValues = z.infer<typeof monitoringConfigSchema>;

export default function MonitoringPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("metrics");
  
  // Fetch monitoring configuration from API
  const { data: monitoringConfig, isLoading } = useQuery<MonitoringConfigFormValues>({
    queryKey: ['/api/system/monitoring'],
    onSuccess: (data) => {
      // Reset form with fetched data
      form.reset(data);
    },
    onError: () => {
      // If there's an error, use default values
      form.reset({
        enableMetricsCollection: true,
        metricsInterval: "60",
        enableAlerts: true,
        alertChannels: ["email"],
        cpuThreshold: "80",
        memoryThreshold: "80",
        diskThreshold: "90",
        responseTimeThreshold: "2000",
        errorRateThreshold: "5",
        retentionDays: "30",
        loggingLevel: "info",
        enablePrometheus: false,
        prometheusEndpoint: "/metrics",
        enableTrace: false,
        samplingRate: "10",
      });
    }
  });
  
  // Mock system metrics data
  const systemMetrics = {
    cpu: {
      current: 32,
      max: 100,
      avg: 28,
      trend: 'stable'
    },
    memory: {
      current: 48,
      max: 100,
      avg: 42,
      trend: 'increasing'
    },
    disk: {
      current: 67,
      max: 100,
      avg: 65,
      trend: 'stable'
    },
    network: {
      ingress: 14.2,
      egress: 8.7,
      connections: 245
    },
    requests: {
      count: 1245,
      avgResponseTime: 125,
      errorRate: 0.8
    },
    alerts: {
      total: 4,
      critical: 0,
      warning: 2,
      info: 2
    }
  };
  
  // Create form
  const form = useForm<MonitoringConfigFormValues>({
    resolver: zodResolver(monitoringConfigSchema),
    defaultValues: monitoringConfig || {
      enableMetricsCollection: true,
      metricsInterval: "60",
      enableAlerts: true,
      alertChannels: ["email"],
      cpuThreshold: "80",
      memoryThreshold: "80",
      diskThreshold: "90",
      responseTimeThreshold: "2000",
      errorRateThreshold: "5",
      retentionDays: "30",
      loggingLevel: "info",
      enablePrometheus: false,
      prometheusEndpoint: "/metrics",
      enableTrace: false,
      samplingRate: "10",
    },
  });
  
  // Save monitoring configuration mutation
  const saveMonitoringConfigMutation = useMutation({
    mutationFn: async (data: MonitoringConfigFormValues) => {
      const res = await apiRequest("POST", "/api/system/monitoring", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Monitoring configuration saved",
        description: "The monitoring configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/monitoring'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving monitoring configuration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Reset monitoring stats mutation
  const resetMonitoringStatsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/system/monitoring/reset");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Monitoring stats reset",
        description: "The monitoring statistics have been reset successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/monitoring'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error resetting monitoring stats",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: MonitoringConfigFormValues) => {
    saveMonitoringConfigMutation.mutate(data);
  };
  
  // Clear monitoring stats
  const handleClearStats = () => {
    if (confirm("Are you sure you want to reset all monitoring statistics? This action cannot be undone.")) {
      resetMonitoringStatsMutation.mutate();
    }
  };
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader 
        heading="System Monitoring" 
        text="Configure monitoring and view system performance metrics."
      >
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleClearStats}
            disabled={resetMonitoringStatsMutation.isPending}
          >
            {resetMonitoringStatsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Stats
              </>
            )}
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={saveMonitoringConfigMutation.isPending}
          >
            {saveMonitoringConfigMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DashboardHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.cpu.current}%</div>
            <Progress value={systemMetrics.cpu.current} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Average: {systemMetrics.cpu.avg}% • Trend: {systemMetrics.cpu.trend}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.memory.current}%</div>
            <Progress value={systemMetrics.memory.current} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Average: {systemMetrics.memory.avg}% • Trend: {systemMetrics.memory.trend}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics.disk.current}%</div>
            <Progress value={systemMetrics.disk.current} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Average: {systemMetrics.disk.avg}% • Trend: {systemMetrics.disk.trend}
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Network Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">INGRESS</p>
                <div className="text-xl font-bold">{systemMetrics.network.ingress} MB/s</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EGRESS</p>
                <div className="text-xl font-bold">{systemMetrics.network.egress} MB/s</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CONNECTIONS</p>
                <div className="text-xl font-bold">{systemMetrics.network.connections}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">COUNT</p>
                <div className="text-xl font-bold">{systemMetrics.requests.count}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AVG RESPONSE</p>
                <div className="text-xl font-bold">{systemMetrics.requests.avgResponseTime} ms</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ERROR RATE</p>
                <div className="text-xl font-bold">{systemMetrics.requests.errorRate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">CRITICAL</p>
                <div className="text-xl font-bold text-red-500">{systemMetrics.alerts.critical}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">WARNING</p>
                <div className="text-xl font-bold text-amber-500">{systemMetrics.alerts.warning}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">INFO</p>
                <div className="text-xl font-bold text-blue-500">{systemMetrics.alerts.info}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="metrics" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metrics">
            <BarChart className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="logging">
            <Activity className="h-4 w-4 mr-2" />
            Logging
          </TabsTrigger>
          <TabsTrigger value="tracing">
            <LineChart className="h-4 w-4 mr-2" />
            Tracing
          </TabsTrigger>
        </TabsList>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <TabsContent value="metrics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Metrics Collection</CardTitle>
                  <CardDescription>
                    Configure system metrics collection settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableMetricsCollection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Metrics Collection
                          </FormLabel>
                          <FormDescription>
                            Collect and store system performance metrics
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
                    name="metricsInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Interval (seconds)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="60" 
                            {...field} 
                            disabled={!form.getValues().enableMetricsCollection}
                          />
                        </FormControl>
                        <FormDescription>
                          How frequently metrics are collected (in seconds)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="retentionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retention Period (days)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="30" 
                            {...field} 
                            disabled={!form.getValues().enableMetricsCollection}
                          />
                        </FormControl>
                        <FormDescription>
                          How long metrics data is retained before automatic deletion
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="enablePrometheus"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Prometheus Endpoint
                          </FormLabel>
                          <FormDescription>
                            Expose Prometheus-compatible metrics endpoint
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.getValues().enableMetricsCollection}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="prometheusEndpoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prometheus Endpoint Path</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="/metrics" 
                            {...field} 
                            disabled={!form.getValues().enablePrometheus || !form.getValues().enableMetricsCollection}
                          />
                        </FormControl>
                        <FormDescription>
                          URL path for the Prometheus metrics endpoint
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Performance Thresholds</CardTitle>
                  <CardDescription>
                    Configure thresholds for alert triggers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="cpuThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPU Threshold (%)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="80" 
                              {...field} 
                              disabled={!form.getValues().enableMetricsCollection}
                            />
                          </FormControl>
                          <FormDescription>
                            Alert when CPU usage exceeds this percentage
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="memoryThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Memory Threshold (%)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="80" 
                              {...field} 
                              disabled={!form.getValues().enableMetricsCollection}
                            />
                          </FormControl>
                          <FormDescription>
                            Alert when memory usage exceeds this percentage
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="diskThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disk Threshold (%)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="90" 
                              {...field} 
                              disabled={!form.getValues().enableMetricsCollection}
                            />
                          </FormControl>
                          <FormDescription>
                            Alert when disk usage exceeds this percentage
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="responseTimeThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Response Time Threshold (ms)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="2000" 
                              {...field} 
                              disabled={!form.getValues().enableMetricsCollection}
                            />
                          </FormControl>
                          <FormDescription>
                            Alert when API response time exceeds this value (ms)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="errorRateThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Error Rate Threshold (%)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="5" 
                            {...field} 
                            disabled={!form.getValues().enableMetricsCollection}
                          />
                        </FormControl>
                        <FormDescription>
                          Alert when API error rate exceeds this percentage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="alerts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Alert Configuration</CardTitle>
                  <CardDescription>
                    Configure system alerts and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableAlerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Alert Notifications
                          </FormLabel>
                          <FormDescription>
                            Send notifications when alert thresholds are exceeded
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
                    name="alertChannels"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Alert Notification Channels</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {["email", "slack", "webhook", "sms"].map((channel) => (
                            <Button
                              key={channel}
                              type="button"
                              variant={field.value?.includes(channel) ? "default" : "outline"}
                              className="w-full justify-start"
                              onClick={() => {
                                const updatedValue = field.value?.includes(channel)
                                  ? field.value.filter(c => c !== channel)
                                  : [...(field.value || []), channel];
                                field.onChange(updatedValue);
                              }}
                              disabled={!form.getValues().enableAlerts}
                            >
                              {channel}
                            </Button>
                          ))}
                        </div>
                        <FormDescription>
                          Select channels for alert notifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full">
                    <h4 className="text-sm font-medium mb-2">Recent Alerts</h4>
                    <div className="space-y-2">
                      <div className="flex items-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Memory usage above threshold (48%)</p>
                          <p className="text-xs text-muted-foreground">10 minutes ago</p>
                        </div>
                      </div>
                      <div className="flex items-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Disk usage growing rapidly (67%)</p>
                          <p className="text-xs text-muted-foreground">1 hour ago</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="logging" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Logging Configuration</CardTitle>
                  <CardDescription>
                    Configure system logging settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="loggingLevel"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Logging Level</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {["debug", "info", "warn", "error"].map((level) => (
                            <Button
                              key={level}
                              type="button"
                              variant={field.value === level ? "default" : "outline"}
                              className="w-full justify-start"
                              onClick={() => field.onChange(level)}
                            >
                              {level}
                            </Button>
                          ))}
                        </div>
                        <FormDescription>
                          Minimum severity level for logged events
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full">
                    <h4 className="text-sm font-medium mb-2">Log File Status</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Current Log Size:</span>
                        <span>34.2 MB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Log Files:</span>
                        <span>12</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Size:</span>
                        <span>145.8 MB</span>
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          toast({
                            title: "Log rotation triggered",
                            description: "Log rotation process has been initiated.",
                          });
                        }}
                      >
                        Rotate Logs
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="tracing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distributed Tracing</CardTitle>
                  <CardDescription>
                    Configure distributed tracing for request flows
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enableTrace"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Distributed Tracing
                          </FormLabel>
                          <FormDescription>
                            Trace requests across distributed system components
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
                    name="samplingRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sampling Rate (%)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="10" 
                            {...field} 
                            disabled={!form.getValues().enableTrace}
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage of requests to trace (1-100)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full">
                    <h4 className="text-sm font-medium mb-2">Exporter Configuration</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={(e) => e.preventDefault()}
                        disabled={!form.getValues().enableTrace}
                      >
                        Jaeger
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={(e) => e.preventDefault()}
                        disabled={!form.getValues().enableTrace}
                      >
                        Zipkin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={(e) => e.preventDefault()}
                        disabled={!form.getValues().enableTrace}
                      >
                        OpenTelemetry
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={(e) => e.preventDefault()}
                        disabled={!form.getValues().enableTrace}
                      >
                        DataDog
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <div className="flex justify-end mt-6">
              <Button 
                type="submit" 
                className="w-full sm:w-auto"
                disabled={saveMonitoringConfigMutation.isPending}
              >
                {saveMonitoringConfigMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}