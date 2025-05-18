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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Save, 
  Database, 
  RefreshCw, 
  Clock, 
  Activity,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  HardDrive,
  BarChart
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Progress } from "@/components/ui/progress";

// Database configuration schema
const databaseConfigSchema = z.object({
  dbHost: z.string().min(1, "Host is required"),
  dbPort: z.string().regex(/^\d+$/, "Port must be a number"),
  dbName: z.string().min(1, "Database name is required"),
  dbUser: z.string().min(1, "Username is required"),
  dbPassword: z.string().optional(),
  dbSslMode: z.enum(["disable", "require", "verify-ca", "verify-full"]).default("require"),
  dbPoolMin: z.string().regex(/^\d+$/, "Min pool size must be a number"),
  dbPoolMax: z.string().regex(/^\d+$/, "Max pool size must be a number"),
  dbTimeout: z.string().regex(/^\d+$/, "Timeout must be a number"),
  dbStatementTimeout: z.string().regex(/^\d+$/, "Statement timeout must be a number"),
  enableSsl: z.boolean().default(true),
  enableConnectionPooling: z.boolean().default(true),
  backupEnabled: z.boolean().default(true),
  backupSchedule: z.string().default("0 0 * * *"),
  backupRetentionDays: z.string().regex(/^\d+$/, "Retention days must be a number"),
});

type DatabaseConfigFormValues = z.infer<typeof databaseConfigSchema>;

export default function DatabasePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("connection");
  const [testingConnection, setTestingConnection] = useState(false);
  
  // Fetch database configuration from API
  const { data: dbConfig, isLoading } = useQuery<DatabaseConfigFormValues>({
    queryKey: ['/api/system/database'],
    onSuccess: (data) => {
      // Reset form with fetched data
      form.reset(data);
    },
    onError: () => {
      // If there's an error, use default values
      form.reset({
        dbHost: "localhost",
        dbPort: "5432",
        dbName: "nexusmcp",
        dbUser: "postgres",
        dbPassword: "",
        dbSslMode: "require",
        dbPoolMin: "2",
        dbPoolMax: "10",
        dbTimeout: "30",
        dbStatementTimeout: "30",
        enableSsl: true,
        enableConnectionPooling: true,
        backupEnabled: true,
        backupSchedule: "0 0 * * *",
        backupRetentionDays: "30",
      });
    }
  });
  
  // Mock database statistics (would normally come from API)
  const dbStats = {
    connectionCount: 8,
    maxConnections: 100,
    uptime: "5 days, 6 hours",
    size: "1.2 GB",
    tables: 42,
    avgQueryTime: "15ms",
    slowQueries: 3,
    lastBackup: "2023-03-01 02:00:00",
    backupSize: "950 MB",
    diskUsage: 32,
    cacheMissRate: 3.2,
    loadAverage: [0.6, 0.8, 0.9]
  };
  
  // Create form
  const form = useForm<DatabaseConfigFormValues>({
    resolver: zodResolver(databaseConfigSchema),
    defaultValues: dbConfig || {
      dbHost: "localhost",
      dbPort: "5432",
      dbName: "nexusmcp",
      dbUser: "postgres",
      dbPassword: "",
      dbSslMode: "require",
      dbPoolMin: "2",
      dbPoolMax: "10",
      dbTimeout: "30",
      dbStatementTimeout: "30",
      enableSsl: true,
      enableConnectionPooling: true,
      backupEnabled: true,
      backupSchedule: "0 0 * * *",
      backupRetentionDays: "30",
    },
  });
  
  // Save database configuration mutation
  const saveDbConfigMutation = useMutation({
    mutationFn: async (data: DatabaseConfigFormValues) => {
      const res = await apiRequest("POST", "/api/system/database", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Database configuration saved",
        description: "The database configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/database'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving database configuration",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Test database connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (data: DatabaseConfigFormValues) => {
      setTestingConnection(true);
      try {
        const res = await apiRequest("POST", "/api/system/database/test", data);
        return await res.json();
      } finally {
        setTestingConnection(false);
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to the database.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.message || "Failed to connect to the database.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: DatabaseConfigFormValues) => {
    saveDbConfigMutation.mutate(data);
  };
  
  // Test database connection
  const handleTestConnection = () => {
    const data = form.getValues();
    testConnectionMutation.mutate(data);
  };
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader 
        heading="Database Configuration" 
        text="Configure and monitor your database connection."
      >
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Test Connection
              </>
            )}
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={saveDbConfigMutation.isPending}
          >
            {saveDbConfigMutation.isPending ? (
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
      
      <Tabs defaultValue="connection" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connection">
            <Database className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Activity className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Clock className="h-4 w-4 mr-2" />
            Backup & Recovery
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <BarChart className="h-4 w-4 mr-2" />
            Monitoring
          </TabsTrigger>
        </TabsList>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <TabsContent value="connection" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Database Connection</CardTitle>
                  <CardDescription>
                    Configure your database connection settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dbHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host</FormLabel>
                          <FormControl>
                            <Input placeholder="localhost" {...field} />
                          </FormControl>
                          <FormDescription>
                            Database server hostname or IP address
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dbPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input placeholder="5432" {...field} />
                          </FormControl>
                          <FormDescription>
                            Database server port
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dbName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Database Name</FormLabel>
                          <FormControl>
                            <Input placeholder="nexusmcp" {...field} />
                          </FormControl>
                          <FormDescription>
                            Name of the database to connect to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dbUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="postgres" {...field} />
                          </FormControl>
                          <FormDescription>
                            Database user with appropriate permissions
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="dbPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Database password (leave empty to keep current password)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="enableSsl"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable SSL
                          </FormLabel>
                          <FormDescription>
                            Use SSL encryption for database connections
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
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Connection Settings</CardTitle>
                  <CardDescription>
                    Configure advanced database connection parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="dbSslMode"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>SSL Mode</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {["disable", "require", "verify-ca", "verify-full"].map((mode) => (
                            <Button
                              key={mode}
                              type="button"
                              variant={field.value === mode ? "default" : "outline"}
                              className="w-full justify-start"
                              onClick={() => field.onChange(mode)}
                              disabled={!form.getValues().enableSsl && mode !== "disable"}
                            >
                              {mode}
                            </Button>
                          ))}
                        </div>
                        <FormDescription>
                          SSL mode for database connections
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="enableConnectionPooling"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Connection Pooling
                          </FormLabel>
                          <FormDescription>
                            Maintain a pool of database connections for improved performance
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dbPoolMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Pool Size</FormLabel>
                          <FormControl>
                            <Input placeholder="2" {...field} disabled={!form.getValues().enableConnectionPooling} />
                          </FormControl>
                          <FormDescription>
                            Minimum number of connections to maintain in the pool
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dbPoolMax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Pool Size</FormLabel>
                          <FormControl>
                            <Input placeholder="10" {...field} disabled={!form.getValues().enableConnectionPooling} />
                          </FormControl>
                          <FormDescription>
                            Maximum number of connections to allow in the pool
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dbTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input placeholder="30" {...field} />
                          </FormControl>
                          <FormDescription>
                            Maximum time to wait when establishing a connection
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dbStatementTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statement Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input placeholder="30" {...field} />
                          </FormControl>
                          <FormDescription>
                            Maximum time allowed for any SQL statement to execute
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Database Performance Metrics</CardTitle>
                  <CardDescription>
                    Current performance statistics for your database
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Current Connections</Label>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-semibold">{dbStats.connectionCount}</span>
                          <span className="text-sm text-muted-foreground">of {dbStats.maxConnections}</span>
                        </div>
                        <Progress value={(dbStats.connectionCount / dbStats.maxConnections) * 100} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Average Query Time</Label>
                        <div className="text-xl font-semibold">{dbStats.avgQueryTime}</div>
                        <div className="text-sm text-muted-foreground">Last 24 hours</div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Slow Queries</Label>
                        <div className="text-xl font-semibold">{dbStats.slowQueries}</div>
                        <div className="text-sm text-muted-foreground">Last 24 hours</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Database Size</Label>
                        <div className="text-xl font-semibold">{dbStats.size}</div>
                        <div className="text-sm text-muted-foreground">{dbStats.tables} tables</div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Cache Miss Rate</Label>
                        <div className="text-xl font-semibold">{dbStats.cacheMissRate}%</div>
                        <div className="text-sm text-muted-foreground">Last hour</div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Load Average</Label>
                        <div className="text-xl font-semibold">{dbStats.loadAverage[0]}</div>
                        <div className="text-sm text-muted-foreground">{dbStats.loadAverage.join(' / ')}</div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <Label className="text-muted-foreground">Disk Usage</Label>
                      <div className="flex items-center mt-2">
                        <Progress value={dbStats.diskUsage} className="h-2 flex-1 mr-4" />
                        <span className="text-sm font-medium">{dbStats.diskUsage}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t px-6 py-4">
                  <a 
                    href="#" 
                    className="flex items-center text-sm text-primary hover:underline"
                    onClick={(e) => e.preventDefault()}
                  >
                    View Detailed Performance Metrics
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="backup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Backup & Recovery Settings</CardTitle>
                  <CardDescription>
                    Configure automated database backup settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="backupEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Automated Backups
                          </FormLabel>
                          <FormDescription>
                            Schedule regular database backups
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
                    name="backupSchedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Schedule (cron format)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="0 0 * * *" 
                            {...field} 
                            disabled={!form.getValues().backupEnabled}
                          />
                        </FormControl>
                        <FormDescription>
                          Cron expression for backup schedule (e.g., "0 0 * * *" for daily at midnight)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="backupRetentionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Retention Period (days)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="30" 
                            {...field} 
                            disabled={!form.getValues().backupEnabled}
                          />
                        </FormControl>
                        <FormDescription>
                          Number of days to retain backup files before automatic deletion
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium">Last Backup</h4>
                        <p className="text-sm text-muted-foreground">{dbStats.lastBackup}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{dbStats.backupSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          toast({
                            title: "Manual backup started",
                            description: "Database backup process has been initiated.",
                          });
                        }}
                      >
                        Run Manual Backup
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          toast({
                            title: "Restore interface",
                            description: "Database restore interface would open here.",
                          });
                        }}
                      >
                        Restore from Backup
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="monitoring" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Database Monitoring</CardTitle>
                  <CardDescription>
                    Configure monitoring and alerting for your database
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-medium">Performance Monitoring</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Track query performance, load metrics, and slow queries with detailed insights
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center">
                            <Switch id="performance-monitor" defaultChecked />
                            <Label htmlFor="performance-monitor" className="ml-2">Enabled</Label>
                          </div>
                          <Button 
                            variant="link" 
                            className="text-primary"
                            onClick={(e) => e.preventDefault()}
                          >
                            Configure
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-primary/10">
                        <HardDrive className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-medium">Space Monitoring</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Monitor database size, disk usage trends, and table growth patterns
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center">
                            <Switch id="space-monitor" defaultChecked />
                            <Label htmlFor="space-monitor" className="ml-2">Enabled</Label>
                          </div>
                          <Button 
                            variant="link" 
                            className="text-primary"
                            onClick={(e) => e.preventDefault()}
                          >
                            Configure
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-primary/10">
                        <AlertCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-medium">Alert Configuration</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Set up alerts for critical database events and performance thresholds
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center">
                            <Switch id="alerts" defaultChecked />
                            <Label htmlFor="alerts" className="ml-2">Enabled</Label>
                          </div>
                          <Button 
                            variant="link" 
                            className="text-primary"
                            onClick={(e) => e.preventDefault()}
                          >
                            Configure
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-primary/10">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-medium">Security Monitoring</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Track failed login attempts, permission changes, and suspicious activities
                        </p>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center">
                            <Switch id="security-monitor" defaultChecked />
                            <Label htmlFor="security-monitor" className="ml-2">Enabled</Label>
                          </div>
                          <Button 
                            variant="link" 
                            className="text-primary"
                            onClick={(e) => e.preventDefault()}
                          >
                            Configure
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <div className="w-full space-y-2">
                    <h4 className="text-sm font-medium">Integration Options</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button variant="outline" size="sm" className="justify-start">
                        Prometheus
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        Grafana
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        Datadog
                      </Button>
                      <Button variant="outline" size="sm" className="justify-start">
                        New Relic
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
                disabled={saveDbConfigMutation.isPending}
              >
                {saveDbConfigMutation.isPending ? (
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