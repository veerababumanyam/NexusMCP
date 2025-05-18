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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, 
  Save, 
  Mail,
  Send,
  MessageSquare,
  BellRing,
  Webhook,
  Check,
  X,
  Shield,
  AlertTriangle,
  RefreshCw,
  Server,
  Bell,
  Settings,
  Globe,
  ArrowRight,
  Mail as MailIcon,
  Info,
  MailCheck
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// SMTP Configuration schema
const communicationConfigSchema = z.object({
  // Email settings
  smtpEnabled: z.boolean().default(false),
  smtpHost: z.string().min(1, "SMTP host is required").or(z.literal("")),
  smtpPort: z.string().regex(/^\d+$/, "Port must be a number").or(z.literal("")),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpRequireTls: z.boolean().default(true),
  smtpRejectUnauthorized: z.boolean().default(true),
  fromEmail: z.string().email("Must be a valid email").or(z.literal("")),
  fromName: z.string().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryInterval: z.number().int().min(0).max(3600).default(60),
  isDefault: z.boolean().default(true),
  isActive: z.boolean().default(true),
  
  // Notification settings
  enableNotifications: z.boolean().default(true),
  notificationEvents: z.object({
    userEvents: z.boolean().default(true),
    serverStatusEvents: z.boolean().default(true),
    apiKeyEvents: z.boolean().default(true),
    auditEvents: z.boolean().default(true),
    authEvents: z.boolean().default(true),
    configEvents: z.boolean().default(true),
    mcpEvents: z.boolean().default(true),
    workspaceEvents: z.boolean().default(true),
  }).default({}),
  
  // Slack settings
  slackEnabled: z.boolean().default(false),
  slackWebhookUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  slackChannel: z.string().optional(),
  slackUsername: z.string().optional(),
  
  // Webhook settings
  webhooksEnabled: z.boolean().default(false),
  webhookEndpoint: z.string().url("Must be a valid URL").or(z.literal("")),
  webhookSecret: z.string().optional(),
  webhookFormat: z.enum(["json", "form"]).default("json"),
});

type CommunicationConfigFormValues = z.infer<typeof communicationConfigSchema>;

const notificationTypes = [
  { id: "userEvents", label: "User Created/Updated/Deleted", icon: <MailIcon className="h-4 w-4 mr-2" /> },
  { id: "serverStatusEvents", label: "Server Status Changes", icon: <Server className="h-4 w-4 mr-2" /> },
  { id: "apiKeyEvents", label: "API Key Created/Revoked", icon: <Shield className="h-4 w-4 mr-2" /> },
  { id: "auditEvents", label: "Audit Log Events", icon: <Info className="h-4 w-4 mr-2" /> },
  { id: "authEvents", label: "Authentication Events", icon: <MailCheck className="h-4 w-4 mr-2" /> },
  { id: "configEvents", label: "System Configuration Changes", icon: <Settings className="h-4 w-4 mr-2" /> },
  { id: "mcpEvents", label: "MCP Server Events", icon: <Globe className="h-4 w-4 mr-2" /> },
  { id: "workspaceEvents", label: "Workspace Events", icon: <Bell className="h-4 w-4 mr-2" /> },
];

export default function CommunicationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("email");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  
  // Fetch communication configuration from API
  const { data: configData, isLoading, isError, error, refetch } = useQuery<CommunicationConfigFormValues>({
    queryKey: ['/api/system/communication/smtp'],
    queryFn: async () => {
      const res = await fetch('/api/system/communication/smtp');
      if (!res.ok) {
        throw new Error('Failed to fetch SMTP configurations');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Reset form with fetched data
      form.reset(data);
    },
    onError: (err) => {
      console.error("Error fetching communication settings:", err);
      toast({
        title: "Error loading settings",
        description: "Could not load communication settings. Using defaults.",
        variant: "destructive",
      });
      // If there's an error, use default values
      form.reset(getDefaultValues());
    }
  });
  
  // Get default form values
  function getDefaultValues(): CommunicationConfigFormValues {
    return {
      smtpEnabled: false,
      smtpHost: "",
      smtpPort: "587",
      smtpUsername: "",
      smtpPassword: "",
      smtpRequireTls: true,
      smtpRejectUnauthorized: true,
      fromEmail: "",
      fromName: "NexusMCP Notifications",
      maxRetries: 3,
      retryInterval: 60,
      isDefault: true,
      isActive: true,
      
      enableNotifications: true,
      notificationEvents: {
        userEvents: true,
        serverStatusEvents: true,
        apiKeyEvents: true,
        auditEvents: true,
        authEvents: true,
        configEvents: true,
        mcpEvents: true,
        workspaceEvents: true,
      },
      
      slackEnabled: false,
      slackWebhookUrl: "",
      slackChannel: "#alerts",
      slackUsername: "NexusMCP Bot",
      
      webhooksEnabled: false,
      webhookEndpoint: "",
      webhookSecret: "",
      webhookFormat: "json",
    };
  }
  
  // Create form
  const form = useForm<CommunicationConfigFormValues>({
    resolver: zodResolver(communicationConfigSchema),
    defaultValues: configData || getDefaultValues(),
    mode: "onChange"
  });
  
  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: CommunicationConfigFormValues) => {
      const res = await apiRequest("POST", "/api/system/communication/smtp", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Changes saved",
        description: "Communication settings updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/system/communication/smtp'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save changes",
        description: error.message || "An error occurred while saving changes",
        variant: "destructive",
      });
    }
  });
  
  // Test SMTP connection mutation
  const testSmtpMutation = useMutation({
    mutationFn: async (data: CommunicationConfigFormValues) => {
      setTestingEmail(true);
      try {
        const res = await apiRequest("POST", "/api/system/communication/smtp/test", data);
        return await res.json();
      } finally {
        setTestingEmail(false);
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "SMTP connection successful",
          description: "Test email sent successfully",
        });
      } else {
        toast({
          title: "SMTP test failed",
          description: data.message || "Could not send test email",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "SMTP test failed",
        description: error.message || "An error occurred during the test",
        variant: "destructive",
      });
    }
  });
  
  // Test Slack connection mutation
  const testSlackMutation = useMutation({
    mutationFn: async (data: CommunicationConfigFormValues) => {
      setTestingSlack(true);
      try {
        const res = await apiRequest("POST", "/api/system/communication/slack/test", data);
        return await res.json();
      } finally {
        setTestingSlack(false);
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Slack integration successful",
          description: "Test message sent to Slack",
        });
      } else {
        toast({
          title: "Slack test failed",
          description: data.message || "Could not send test message to Slack",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Slack test failed",
        description: error.message || "An error occurred during the test",
        variant: "destructive",
      });
    }
  });
  
  // Test webhook connection mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (data: CommunicationConfigFormValues) => {
      setTestingWebhook(true);
      try {
        const res = await apiRequest("POST", "/api/system/communication/webhook/test", data);
        return await res.json();
      } finally {
        setTestingWebhook(false);
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Webhook test successful",
          description: "Test payload delivered successfully",
        });
      } else {
        toast({
          title: "Webhook test failed",
          description: data.message || "Could not deliver webhook payload",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Webhook test failed",
        description: error.message || "An error occurred during the test",
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: CommunicationConfigFormValues) => {
    saveConfigMutation.mutate(data);
  };
  
  // Test SMTP connection
  const handleTestEmail = () => {
    const data = form.getValues();
    testSmtpMutation.mutate(data);
  };
  
  // Test Slack connection
  const handleTestSlack = () => {
    const data = form.getValues();
    testSlackMutation.mutate(data);
  };
  
  // Test webhook connection
  const handleTestWebhook = () => {
    const data = form.getValues();
    testWebhookMutation.mutate(data);
  };
  
  // Refresh the settings data
  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing settings",
      description: "Fetching the latest communication settings",
    });
  };
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader 
        heading="System Communication" 
        text="Configure email, notifications, webhooks, and communication preferences."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={saveConfigMutation.isPending || !form.formState.isDirty}
            size="sm"
          >
            {saveConfigMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DashboardHeader>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading communication settings...</span>
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertTitle>Error loading settings</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || "An error occurred while loading communication settings. Please try refreshing."}
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="email" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="bg-background sticky top-0 z-10 pb-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="email" className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="slack" className="flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                Slack
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center">
                <Webhook className="h-4 w-4 mr-2" />
                Webhooks
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center">
                <BellRing className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* EMAIL TAB */}
              <TabsContent value="email" className="space-y-6">
                <Alert className="bg-primary/5 border-primary/20">
                  <Mail className="h-4 w-4 text-primary" />
                  <AlertTitle>Email Configuration</AlertTitle>
                  <AlertDescription>
                    Configure SMTP settings to enable email notifications and alerts.
                    {form.getValues("smtpEnabled") ? (
                      <Badge className="ml-2 bg-emerald-600" variant="secondary">Enabled</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-600" variant="secondary">Disabled</Badge>
                    )}
                  </AlertDescription>
                </Alert>
                
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/40">
                    <CardTitle>SMTP Configuration</CardTitle>
                    <CardDescription>
                      Set up your SMTP server for sending emails from the system
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <FormField
                      control={form.control}
                      name="smtpEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium">
                              Enable SMTP
                            </FormLabel>
                            <FormDescription>
                              Allow the system to send emails via SMTP
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
                        name="smtpHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="smtp.example.com" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              The hostname of your SMTP server
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="587" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Port for SMTP (typically 25, 465, or 587)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="smtpUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="username@example.com" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Username for SMTP authentication
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="smtpPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Password for SMTP authentication (leave blank to keep existing)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="notifications@example.com" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Email address that will appear as the sender
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fromName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="NexusMCP Notifications" 
                                {...field} 
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Name that will appear as the sender
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="maxRetries"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Retries</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                max="10"
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum number of retry attempts for failed emails
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="retryInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Retry Interval (seconds)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                max="3600"
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                value={field.value}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Seconds to wait between retry attempts
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="smtpRequireTls"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Require TLS
                              </FormLabel>
                              <FormDescription>
                                Require TLS encryption for SMTP connection
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="smtpRejectUnauthorized"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Verify SSL Certificate
                              </FormLabel>
                              <FormDescription>
                                Reject unauthorized SSL certificates
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Default Configuration
                              </FormLabel>
                              <FormDescription>
                                Use as the default SMTP configuration
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Active Status
                              </FormLabel>
                              <FormDescription>
                                Mark this SMTP configuration as active
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.getValues("smtpEnabled")}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-muted/20 border-t px-6 py-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleTestEmail}
                      disabled={!form.getValues("smtpEnabled") || testingEmail}
                    >
                      {testingEmail ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Test Email
                        </>
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {form.getValues("smtpEnabled") ? "SMTP Enabled" : "SMTP Disabled"}
                      </span>
                      {form.getValues("smtpEnabled") ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300">
                          <X className="h-3.5 w-3.5 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* SLACK TAB */}
              <TabsContent value="slack" className="space-y-6">
                <Alert className="bg-indigo-500/5 border-indigo-500/20">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  <AlertTitle>Slack Integration</AlertTitle>
                  <AlertDescription>
                    Connect the system to your Slack workspace for real-time notifications.
                    {form.getValues("slackEnabled") ? (
                      <Badge className="ml-2 bg-emerald-600" variant="secondary">Enabled</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-600" variant="secondary">Disabled</Badge>
                    )}
                  </AlertDescription>
                </Alert>
                
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/40">
                    <CardTitle>Slack Integration</CardTitle>
                    <CardDescription>
                      Connect your Slack workspace to receive notifications and alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <FormField
                      control={form.control}
                      name="slackEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium">
                              Enable Slack
                            </FormLabel>
                            <FormDescription>
                              Send notifications to your Slack workspace
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
                      name="slackWebhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://hooks.slack.com/services/..." 
                              {...field} 
                              disabled={!form.getValues("slackEnabled")}
                            />
                          </FormControl>
                          <FormDescription>
                            The webhook URL from your Slack app configuration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="slackChannel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Channel</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="#alerts" 
                                {...field} 
                                disabled={!form.getValues("slackEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Default channel for notifications (e.g., #alerts)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="slackUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bot Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="NexusMCP Bot" 
                                {...field} 
                                disabled={!form.getValues("slackEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Username shown for the bot in Slack
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="rounded-lg border p-4 shadow-sm">
                      <h3 className="text-base font-medium mb-3">Notification Types</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Select which events should be sent to Slack
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {notificationTypes.map((type) => (
                          <div key={type.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`slack-${type.id}`} 
                              disabled={!form.getValues("slackEnabled")}
                              defaultChecked
                            />
                            <label
                              htmlFor={`slack-${type.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                            >
                              {type.icon}
                              {type.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-muted/20 border-t px-6 py-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleTestSlack}
                      disabled={!form.getValues("slackEnabled") || testingSlack}
                    >
                      {testingSlack ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Test Slack Integration
                        </>
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {form.getValues("slackEnabled") ? "Slack Enabled" : "Slack Disabled"}
                      </span>
                      {form.getValues("slackEnabled") ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300">
                          <X className="h-3.5 w-3.5 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </CardFooter>
                </Card>
                
                <div className="flex items-start space-x-4">
                  <div className="rounded-full bg-indigo-500/10 p-3">
                    <Info className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium">Setting up Slack Integration</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      To create a Slack webhook, go to your Slack workspace, create a new Slack App, enable incoming webhooks,
                      and create a new webhook for your workspace. Copy the webhook URL and paste it above.
                    </p>
                    <div className="mt-2">
                      <a 
                        href="https://api.slack.com/messaging/webhooks" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center hover:underline"
                      >
                        Learn more about Slack webhooks
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* WEBHOOKS TAB */}
              <TabsContent value="webhooks" className="space-y-6">
                <Alert className="bg-cyan-500/5 border-cyan-500/20">
                  <Webhook className="h-4 w-4 text-cyan-600" />
                  <AlertTitle>Webhooks</AlertTitle>
                  <AlertDescription>
                    Configure outgoing webhooks to integrate with external systems.
                    {form.getValues("webhooksEnabled") ? (
                      <Badge className="ml-2 bg-emerald-600" variant="secondary">Enabled</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-600" variant="secondary">Disabled</Badge>
                    )}
                  </AlertDescription>
                </Alert>
                
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/40">
                    <CardTitle>Webhook Configuration</CardTitle>
                    <CardDescription>
                      Set up outgoing webhooks to notify external systems
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <FormField
                      control={form.control}
                      name="webhooksEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium">
                              Enable Webhooks
                            </FormLabel>
                            <FormDescription>
                              Send events to external webhook endpoints
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
                      name="webhookEndpoint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://example.com/api/webhook" 
                              {...field} 
                              disabled={!form.getValues("webhooksEnabled")}
                            />
                          </FormControl>
                          <FormDescription>
                            The URL that will receive webhook POST requests
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="webhookSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook Secret</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="your-webhook-secret-key" 
                                {...field} 
                                disabled={!form.getValues("webhooksEnabled")}
                              />
                            </FormControl>
                            <FormDescription>
                              Secret key used to sign webhook payloads
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="webhookFormat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payload Format</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={!form.getValues("webhooksEnabled")}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="form">Form Data</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Format of the webhook payload
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="rounded-lg border p-4 shadow-sm">
                      <h3 className="text-base font-medium mb-3">Notification Types</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Select which events should trigger webhooks
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {notificationTypes.map((type) => (
                          <div key={type.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`webhook-${type.id}`} 
                              disabled={!form.getValues("webhooksEnabled")}
                              defaultChecked
                            />
                            <label
                              htmlFor={`webhook-${type.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                            >
                              {type.icon}
                              {type.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Webhook Security</AlertTitle>
                      <AlertDescription className="mt-2">
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          <li>Always use HTTPS endpoints for webhook delivery</li>
                          <li>Verify webhook signatures using the secret key</li>
                          <li>Implement idempotent processing to handle duplicate webhook deliveries</li>
                          <li>Respond with 2xx status codes to acknowledge receipt</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-muted/20 border-t px-6 py-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={!form.getValues("webhooksEnabled") || testingWebhook}
                    >
                      {testingWebhook ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Test Webhook
                        </>
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {form.getValues("webhooksEnabled") ? "Webhooks Enabled" : "Webhooks Disabled"}
                      </span>
                      {form.getValues("webhooksEnabled") ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300">
                          <X className="h-3.5 w-3.5 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* NOTIFICATIONS TAB */}
              <TabsContent value="notifications" className="space-y-6">
                <Alert className="bg-purple-500/5 border-purple-500/20">
                  <BellRing className="h-4 w-4 text-purple-600" />
                  <AlertTitle>Notification Settings</AlertTitle>
                  <AlertDescription>
                    Configure system-wide notification preferences and settings.
                    {form.getValues("enableNotifications") ? (
                      <Badge className="ml-2 bg-emerald-600" variant="secondary">Enabled</Badge>
                    ) : (
                      <Badge className="ml-2 bg-amber-600" variant="secondary">Disabled</Badge>
                    )}
                  </AlertDescription>
                </Alert>
                
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/40">
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Configure when and how notifications are sent
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <FormField
                      control={form.control}
                      name="enableNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium">
                              Enable All Notifications
                            </FormLabel>
                            <FormDescription>
                              Master switch for all system notifications
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
                    
                    <h3 className="text-base font-medium">Notification Types</h3>
                    <p className="text-sm text-muted-foreground -mt-4">
                      Configure which events trigger notifications
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border rounded-lg p-4">
                      {notificationTypes.map((type) => (
                        <FormField
                          key={type.id}
                          control={form.control}
                          name={`notificationEvents.${type.id}` as any}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  id={`notify-${type.id}`} 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!form.getValues("enableNotifications")}
                                />
                              </FormControl>
                              <FormLabel htmlFor={`notify-${type.id}`} className="text-sm font-medium leading-none flex items-center">
                                {type.icon}
                                {type.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="grid grid-cols-1 gap-4">
                      <h3 className="text-base font-medium">Notification Delivery Methods</h3>
                      <p className="text-sm text-muted-foreground -mt-4 mb-2">
                        Select how notifications should be delivered
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-start space-x-2 border rounded-lg p-4">
                          <Checkbox 
                            id="method-email" 
                            defaultChecked
                            disabled={!form.getValues("enableNotifications") || !form.getValues("smtpEnabled")}
                          />
                          <div>
                            <label
                              htmlFor="method-email"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              Email
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Send notifications via email
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2 border rounded-lg p-4">
                          <Checkbox 
                            id="method-slack" 
                            defaultChecked
                            disabled={!form.getValues("enableNotifications") || !form.getValues("slackEnabled")}
                          />
                          <div>
                            <label
                              htmlFor="method-slack"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Slack
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Send notifications to Slack
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2 border rounded-lg p-4">
                          <Checkbox 
                            id="method-webhook" 
                            defaultChecked
                            disabled={!form.getValues("enableNotifications") || !form.getValues("webhooksEnabled")}
                          />
                          <div>
                            <label
                              htmlFor="method-webhook"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                            >
                              <Webhook className="h-4 w-4 mr-2" />
                              Webhooks
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Send via configured webhooks
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between bg-muted/20 border-t px-6 py-4">
                    <Button variant="default" type="submit" disabled={saveConfigMutation.isPending || !form.formState.isDirty}>
                      {saveConfigMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save All Settings
                        </>
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {form.getValues("enableNotifications") ? "Notifications Enabled" : "Notifications Disabled"}
                      </span>
                      {form.getValues("enableNotifications") ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300">
                          <X className="h-3.5 w-3.5 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      )}
    </div>
  );
}