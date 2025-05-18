import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Settings,
  Save,
  Shield,
  Globe,
  Network,
  Server,
  Key,
  LogOut,
  Mail,
  BellRing,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";

// System Settings Form Schema
const systemSettingsSchema = z.object({
  systemName: z.string().min(3, "System name must be at least 3 characters"),
  apiUrl: z.string().url("Please enter a valid URL"),
  environment: z.string(),
  enabledFeatures: z.object({
    analytics: z.boolean().default(true),
    auditLogs: z.boolean().default(true),
    userManagement: z.boolean().default(true),
    sso: z.boolean().default(true),
    multiWorkspace: z.boolean().default(true),
  }),
  defaultTimeZone: z.string(),
  logRetentionDays: z.coerce.number().int().min(1).max(365),
  loggingLevel: z.string(),
});

// Security Settings Form Schema
const securitySettingsSchema = z.object({
  passwordPolicy: z.object({
    minLength: z.coerce.number().int().min(8).max(128),
    requireUppercase: z.boolean().default(true),
    requireLowercase: z.boolean().default(true),
    requireNumbers: z.boolean().default(true),
    requireSpecialChars: z.boolean().default(true),
    preventPasswordReuse: z.coerce.number().int().min(1).max(24),
    passwordExpireDays: z.coerce.number().int().min(0).max(365),
  }),
  mfaSettings: z.object({
    requireMfa: z.boolean().default(false),
    allowedMethods: z.array(z.string()).min(1, "At least one MFA method must be allowed"),
  }),
  sessionSettings: z.object({
    sessionTimeout: z.coerce.number().int().min(5).max(1440),
    singleSessionPerUser: z.boolean().default(false),
    enforceIpBinding: z.boolean().default(false),
  }),
  apiKeys: z.object({
    enabled: z.boolean().default(true),
    expirationDays: z.coerce.number().int().min(1).max(365),
  }),
});

// Notification Settings Form Schema
const notificationSettingsSchema = z.object({
  emailNotifications: z.object({
    securityAlerts: z.boolean().default(true),
    systemUpdates: z.boolean().default(true),
    userActivity: z.boolean().default(false),
    errorAlerts: z.boolean().default(true),
  }),
  webhookNotifications: z.object({
    enabled: z.boolean().default(false),
    url: z.string().url().optional().or(z.literal("")),
    events: z.array(z.string()),
  }),
});

// Email Settings Form Schema
const emailSettingsSchema = z.object({
  smtpServer: z.string().min(1, "SMTP server is required"),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUsername: z.string().min(1, "SMTP username is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  senderEmail: z.string().email("Please enter a valid email"),
  senderName: z.string().min(1, "Sender name is required"),
  enableSsl: z.boolean().default(true),
});

type SystemSettingsValues = z.infer<typeof systemSettingsSchema>;
type SecuritySettingsValues = z.infer<typeof securitySettingsSchema>;
type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>;
type EmailSettingsValues = z.infer<typeof emailSettingsSchema>;

// API functions
async function getSystemSettings() {
  const res = await apiRequest("GET", "/api/settings/system");
  return await res.json();
}

async function getSecuritySettings() {
  const res = await apiRequest("GET", "/api/settings/security");
  return await res.json();
}

async function getNotificationSettings() {
  const res = await apiRequest("GET", "/api/settings/notifications");
  return await res.json();
}

async function getEmailSettings() {
  const res = await apiRequest("GET", "/api/settings/email");
  return await res.json();
}

async function updateSystemSettings(data: SystemSettingsValues) {
  const res = await apiRequest("PUT", "/api/settings/system", data);
  return await res.json();
}

async function updateSecuritySettings(data: SecuritySettingsValues) {
  const res = await apiRequest("PUT", "/api/settings/security", data);
  return await res.json();
}

async function updateNotificationSettings(data: NotificationSettingsValues) {
  const res = await apiRequest("PUT", "/api/settings/notifications", data);
  return await res.json();
}

async function updateEmailSettings(data: EmailSettingsValues) {
  const res = await apiRequest("PUT", "/api/settings/email", data);
  return await res.json();
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("system");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Fetch settings data
  const {
    data: systemSettings,
    isLoading: isLoadingSystem,
    refetch: refetchSystem,
  } = useQuery({
    queryKey: ["/api/settings/system"],
    queryFn: getSystemSettings,
  });

  const {
    data: securitySettings,
    isLoading: isLoadingSecurity,
    refetch: refetchSecurity,
  } = useQuery({
    queryKey: ["/api/settings/security"],
    queryFn: getSecuritySettings,
  });

  const {
    data: notificationSettings,
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["/api/settings/notifications"],
    queryFn: getNotificationSettings,
  });

  const {
    data: emailSettings,
    isLoading: isLoadingEmail,
    refetch: refetchEmail,
  } = useQuery({
    queryKey: ["/api/settings/email"],
    queryFn: getEmailSettings,
  });

  // Update mutations
  const updateSystemMutation = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "System settings have been updated successfully",
      });
      refetchSystem();
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateSecurityMutation = useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Security settings have been updated successfully",
      });
      refetchSecurity();
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Notification settings have been updated successfully",
      });
      refetchNotifications();
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: updateEmailSettings,
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Email settings have been updated successfully",
      });
      refetchEmail();
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Form setup for each settings section
  const systemForm = useForm<SystemSettingsValues>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: systemSettings || {
      systemName: "",
      apiUrl: "",
      environment: "production",
      enabledFeatures: {
        analytics: true,
        auditLogs: true,
        userManagement: true,
        sso: true,
        multiWorkspace: true,
      },
      defaultTimeZone: "UTC",
      logRetentionDays: 30,
      loggingLevel: "info",
    },
  });

  const securityForm = useForm<SecuritySettingsValues>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: securitySettings || {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventPasswordReuse: 5,
        passwordExpireDays: 90,
      },
      mfaSettings: {
        requireMfa: false,
        allowedMethods: ["totp", "sms"],
      },
      sessionSettings: {
        sessionTimeout: 30,
        singleSessionPerUser: false,
        enforceIpBinding: false,
      },
      apiKeys: {
        enabled: true,
        expirationDays: 30,
      },
    },
  });

  const notificationForm = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: notificationSettings || {
      emailNotifications: {
        securityAlerts: true,
        systemUpdates: true,
        userActivity: false,
        errorAlerts: true,
      },
      webhookNotifications: {
        enabled: false,
        url: "",
        events: ["user.created", "login.failed"],
      },
    },
  });

  const emailForm = useForm<EmailSettingsValues>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: emailSettings || {
      smtpServer: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      senderEmail: "",
      senderName: "",
      enableSsl: true,
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (systemSettings) {
      systemForm.reset(systemSettings);
    }
  }, [systemSettings, systemForm]);

  useEffect(() => {
    if (securitySettings) {
      securityForm.reset(securitySettings);
    }
  }, [securitySettings, securityForm]);

  useEffect(() => {
    if (notificationSettings) {
      notificationForm.reset(notificationSettings);
    }
  }, [notificationSettings, notificationForm]);

  useEffect(() => {
    if (emailSettings) {
      emailForm.reset(emailSettings);
    }
  }, [emailSettings, emailForm]);

  // Form submission handlers
  const onSubmitSystemSettings = (data: SystemSettingsValues) => {
    updateSystemMutation.mutate(data);
  };

  const onSubmitSecuritySettings = (data: SecuritySettingsValues) => {
    updateSecurityMutation.mutate(data);
  };

  const onSubmitNotificationSettings = (data: NotificationSettingsValues) => {
    updateNotificationsMutation.mutate(data);
  };

  const onSubmitEmailSettings = (data: EmailSettingsValues) => {
    updateEmailMutation.mutate(data);
  };

  // Test SMTP connection
  const testSmtpConnection = async () => {
    try {
      toast({
        title: "Testing SMTP connection",
        description: "Attempting to connect to SMTP server...",
      });
      
      const data = emailForm.getValues();
      const res = await apiRequest("POST", "/api/settings/email/test", data);
      const result = await res.json();
      
      if (result.success) {
        toast({
          title: "Connection successful",
          description: "SMTP connection test was successful.",
          variant: "default",
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.message || "Failed to connect to SMTP server",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to SMTP server",
        variant: "destructive",
      });
    }
  };

  // Handle test webhook
  const testWebhook = async () => {
    try {
      toast({
        title: "Testing webhook",
        description: "Sending test event to webhook URL...",
      });
      
      const data = {
        url: notificationForm.getValues().webhookNotifications.url,
      };
      const res = await apiRequest("POST", "/api/settings/notifications/webhook/test", data);
      const result = await res.json();
      
      if (result.success) {
        toast({
          title: "Webhook test successful",
          description: "Test event was successfully sent to the webhook.",
          variant: "default",
        });
      } else {
        toast({
          title: "Webhook test failed",
          description: result.message || "Failed to send test event",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Webhook test failed",
        description: error.message || "Failed to send test event",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DashboardHeader
        title="Settings"
        subtitle="Configure system, security, and notification preferences"
      />

      <Tabs defaultValue="system" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full md:w-auto">
          <TabsTrigger value="system" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            <span>System</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <BellRing className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1">
            <Mail className="h-4 w-4" />
            <span>Email</span>
          </TabsTrigger>
          <TabsTrigger value="oauth" className="flex items-center gap-1" 
            onClick={() => window.location.href = "/settings/oauth"}>
            <Lock className="h-4 w-4" />
            <span>OAuth</span>
          </TabsTrigger>
        </TabsList>
        
        {/* System Settings Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure core system settings and enabled features
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSystem ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...systemForm}>
                  <form onSubmit={systemForm.handleSubmit(onSubmitSystemSettings)} className="space-y-6">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <FormField
                        control={systemForm.control}
                        name="systemName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>System Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="NexusMCP" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              The name of your system as it appears in the UI
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={systemForm.control}
                        name="apiUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API URL</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="https://api.example.com" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Base URL for API endpoints
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                      <FormField
                        control={systemForm.control}
                        name="environment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Environment</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select environment" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="development">Development</SelectItem>
                                <SelectItem value="staging">Staging</SelectItem>
                                <SelectItem value="production">Production</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Current deployment environment
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={systemForm.control}
                        name="defaultTimeZone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Time Zone</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                                <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                                <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Default time zone for displaying dates
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={systemForm.control}
                        name="loggingLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logging Level</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select logging level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="error">Error</SelectItem>
                                <SelectItem value="warn">Warning</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="debug">Debug</SelectItem>
                                <SelectItem value="trace">Trace</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Verbosity level for system logs
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={systemForm.control}
                      name="logRetentionDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Log Retention (Days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1}
                              max={365}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Number of days to retain system logs
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                      <h3 className="text-md font-medium mb-2">Enabled Features</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        <FormField
                          control={systemForm.control}
                          name="enabledFeatures.analytics"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Analytics</FormLabel>
                                <FormDescription>
                                  Usage and performance metrics
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
                          control={systemForm.control}
                          name="enabledFeatures.auditLogs"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Audit Logs</FormLabel>
                                <FormDescription>
                                  Detailed activity tracking
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
                          control={systemForm.control}
                          name="enabledFeatures.userManagement"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>User Management</FormLabel>
                                <FormDescription>
                                  User and role administration
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
                          control={systemForm.control}
                          name="enabledFeatures.sso"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Single Sign-On</FormLabel>
                                <FormDescription>
                                  SSO, SAML, and OIDC support
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
                          control={systemForm.control}
                          name="enabledFeatures.multiWorkspace"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Multi-Workspace</FormLabel>
                                <FormDescription>
                                  Multiple isolated workspaces
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
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={updateSystemMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {updateSystemMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Settings Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure password policies, MFA, and API security
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSecurity ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...securityForm}>
                  <form onSubmit={securityForm.handleSubmit(onSubmitSecuritySettings)} className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Password Policy</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <FormField
                          control={securityForm.control}
                          name="passwordPolicy.minLength"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Length</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={8}
                                  max={128}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Minimum required password length
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={securityForm.control}
                          name="passwordPolicy.preventPasswordReuse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password History</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={24}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Number of previous passwords to prevent reuse
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mt-4">
                        <FormField
                          control={securityForm.control}
                          name="passwordPolicy.passwordExpireDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password Expiration (Days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={0}
                                  max={365}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Days before password expires (0 = never)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mt-4">
                        <FormField
                          control={securityForm.control}
                          name="passwordPolicy.requireUppercase"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Require Uppercase</FormLabel>
                                <FormDescription>
                                  Require at least one uppercase letter
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
                          name="passwordPolicy.requireLowercase"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Require Lowercase</FormLabel>
                                <FormDescription>
                                  Require at least one lowercase letter
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
                          name="passwordPolicy.requireNumbers"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Require Numbers</FormLabel>
                                <FormDescription>
                                  Require at least one number
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
                          name="passwordPolicy.requireSpecialChars"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Require Special Characters</FormLabel>
                                <FormDescription>
                                  Require at least one special character
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
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-medium mb-3">Multi-Factor Authentication</h3>
                      <FormField
                        control={securityForm.control}
                        name="mfaSettings.requireMfa"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Require MFA</FormLabel>
                              <FormDescription>
                                Require all users to set up multi-factor authentication
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
                      
                      <div className="mt-4">
                        <FormField
                          control={securityForm.control}
                          name="mfaSettings.allowedMethods"
                          render={() => (
                            <FormItem>
                              <div className="mb-4">
                                <FormLabel className="text-base">Allowed MFA Methods</FormLabel>
                                <FormDescription>
                                  Select the allowed MFA methods
                                </FormDescription>
                              </div>
                              <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                                <FormField
                                  control={securityForm.control}
                                  name="mfaSettings.allowedMethods"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes("totp")}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, "totp"])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== "totp"
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          TOTP (Authenticator Apps)
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="mfaSettings.allowedMethods"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes("sms")}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, "sms"])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== "sms"
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          SMS
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="mfaSettings.allowedMethods"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes("email")}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, "email"])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== "email"
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Email
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="mfaSettings.allowedMethods"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes("webauthn")}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, "webauthn"])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== "webauthn"
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          WebAuthn/FIDO2
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                                <FormField
                                  control={securityForm.control}
                                  name="mfaSettings.allowedMethods"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes("recovery_codes")}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, "recovery_codes"])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== "recovery_codes"
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Recovery Codes
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-medium mb-3">Session Settings</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        <FormField
                          control={securityForm.control}
                          name="sessionSettings.sessionTimeout"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Timeout (Minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={5}
                                  max={1440}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Inactive session timeout
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mt-4">
                        <FormField
                          control={securityForm.control}
                          name="sessionSettings.singleSessionPerUser"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Single Session Per User</FormLabel>
                                <FormDescription>
                                  Limit users to one active session at a time
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
                          name="sessionSettings.enforceIpBinding"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Enforce IP Binding</FormLabel>
                                <FormDescription>
                                  Bind sessions to the originating IP address
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
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-medium mb-3">API Security</h3>
                      <FormField
                        control={securityForm.control}
                        name="apiKeys.enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Enable API Keys</FormLabel>
                              <FormDescription>
                                Allow users to generate API keys for programmatic access
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
                      
                      {securityForm.watch("apiKeys.enabled") && (
                        <FormField
                          control={securityForm.control}
                          name="apiKeys.expirationDays"
                          render={({ field }) => (
                            <FormItem className="mt-4">
                              <FormLabel>API Key Expiration (Days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={365}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Default expiration period for API keys
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={updateSecurityMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {updateSecurityMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notifications Settings Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure email and webhook notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingNotifications ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...notificationForm}>
                  <form onSubmit={notificationForm.handleSubmit(onSubmitNotificationSettings)} className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Email Notifications</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <FormField
                          control={notificationForm.control}
                          name="emailNotifications.securityAlerts"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Security Alerts</FormLabel>
                                <FormDescription>
                                  Failed login attempts, permission changes
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
                          control={notificationForm.control}
                          name="emailNotifications.systemUpdates"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>System Updates</FormLabel>
                                <FormDescription>
                                  System changes, maintenance notifications
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
                          control={notificationForm.control}
                          name="emailNotifications.userActivity"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>User Activity</FormLabel>
                                <FormDescription>
                                  New users, role changes, profile updates
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
                          control={notificationForm.control}
                          name="emailNotifications.errorAlerts"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Error Alerts</FormLabel>
                                <FormDescription>
                                  System errors and service disruptions
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
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-medium mb-3">Webhook Notifications</h3>
                      <FormField
                        control={notificationForm.control}
                        name="webhookNotifications.enabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Enable Webhooks</FormLabel>
                              <FormDescription>
                                Send event notifications to external systems
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
                      
                      {notificationForm.watch("webhookNotifications.enabled") && (
                        <>
                          <FormField
                            control={notificationForm.control}
                            name="webhookNotifications.url"
                            render={({ field }) => (
                              <FormItem className="mt-4">
                                <FormLabel>Webhook URL</FormLabel>
                                <div className="flex items-center space-x-2">
                                  <FormControl>
                                    <Input 
                                      placeholder="https://example.com/webhook" 
                                      {...field}
                                    />
                                  </FormControl>
                                  <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={testWebhook}
                                    disabled={!field.value}
                                    className="shrink-0"
                                    size="sm"
                                  >
                                    Test
                                  </Button>
                                </div>
                                <FormDescription>
                                  URL to receive webhook event notifications
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={notificationForm.control}
                            name="webhookNotifications.events"
                            render={() => (
                              <FormItem className="mt-4">
                                <div className="mb-4">
                                  <FormLabel className="text-base">Webhook Events</FormLabel>
                                  <FormDescription>
                                    Select events to trigger webhook notifications
                                  </FormDescription>
                                </div>
                                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("user.created")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "user.created"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "user.created"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            User Created
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("user.updated")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "user.updated"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "user.updated"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            User Updated
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("user.deleted")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "user.deleted"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "user.deleted"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            User Deleted
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("login.success")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "login.success"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "login.success"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            Login Success
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("login.failed")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "login.failed"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "login.failed"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            Login Failed
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                  <FormField
                                    control={notificationForm.control}
                                    name="webhookNotifications.events"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes("system.error")}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, "system.error"])
                                                  : field.onChange(
                                                      field.value?.filter(
                                                        (value) => value !== "system.error"
                                                      )
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal">
                                            System Error
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      disabled={updateNotificationsMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {updateNotificationsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Email Settings Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure SMTP server for sending system emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEmail ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onSubmitEmailSettings)} className="space-y-6">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <FormField
                        control={emailForm.control}
                        name="smtpServer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Server</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="smtp.example.com" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              SMTP server hostname
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1}
                                max={65535}
                                placeholder="587" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              SMTP server port
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <FormField
                        control={emailForm.control}
                        name="smtpUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="username@example.com" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              SMTP authentication username
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Password</FormLabel>
                            <div className="flex relative">
                              <FormControl>
                                <Input 
                                  type={showSmtpPassword ? "text" : "password"}
                                  placeholder="••••••••" 
                                  {...field}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 h-7"
                                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                              >
                                {showSmtpPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <FormDescription>
                              SMTP authentication password
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <FormField
                        control={emailForm.control}
                        name="senderEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sender Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="noreply@example.com" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Email address that appears in the From field
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="senderName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sender Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="NexusMCP System" 
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Name that appears in the From field
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={emailForm.control}
                      name="enableSsl"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Enable SSL/TLS</FormLabel>
                            <FormDescription>
                              Use secure connection for SMTP
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
                    
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={testSmtpConnection}
                        className="flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Test Connection
                      </Button>
                      
                      <Button 
                        type="submit" 
                        disabled={updateEmailMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {updateEmailMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save Settings
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}