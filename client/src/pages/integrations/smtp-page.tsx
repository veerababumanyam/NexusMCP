import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Info as InfoIcon, 
  Mail, 
  Settings, 
  Key, 
  FileText, 
  RefreshCw, 
  PlusCircle, 
  Trash2, 
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Send as SendIcon,
  Shield as ShieldIcon,
  CheckCircle as CircleCheck,
  Globe,
  MailCheck,
  History,
  Search,
  Lock,
  Server
} from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Custom Alert component for success state
const CustomAlert = ({ variant, children, ...props }: { 
  variant?: "default" | "destructive" | "success"; 
  children: React.ReactNode;
  [key: string]: any;
}) => {
  const getVariantClass = () => {
    if (variant === "success") {
      return "border-green-500 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-950 dark:text-green-300";
    }
    return "";
  };
  
  return (
    <Alert {...props} variant={variant === "success" ? "default" : variant} className={`${props.className || ""} ${variant === "success" ? getVariantClass() : ""}`}>
      {children}
    </Alert>
  );
};

// SMTP configuration schema
const smtpConfigSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  provider: z.enum(["custom", "sendgrid", "microsoft365", "postfix", "gmail", "mailgun", "amazon_ses", "other"]),
  hostname: z.string().min(3, "Server hostname is required"),
  port: z.union([
    z.number().int().min(1).max(65535),
    z.string().regex(/^\d+$/).transform(Number)
  ]),
  encryption: z.enum(["none", "ssl", "tls", "starttls"]),
  authType: z.enum(["none", "plain", "login", "cram-md5", "oauth2"]),
  username: z.string().optional(),
  password: z.string().optional(),
  senderName: z.string().min(2, "Sender name is required").optional(),
  senderEmail: z.string().email("Must be a valid email").optional(),
  replyToEmail: z.string().email("Must be a valid email").optional(),
  apiKey: z.string().optional(),
  connectionTimeout: z.union([
    z.number().int().min(5).max(300),
    z.string().regex(/^\d+$/).transform(Number)
  ]).default(30),
  advanced: z.object({
    enableDKIM: z.boolean().default(false),
    dkimDomain: z.string().optional(),
    dkimSelector: z.string().optional(),
    dkimPrivateKey: z.string().optional(),
    enableSPF: z.boolean().default(false),
    spfRecord: z.string().optional(),
    enableDMARC: z.boolean().default(false),
    dmarcRecord: z.string().optional(),
    maxSendAttempts: z.union([
      z.number().int().min(1).max(10),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(3),
    sendRetryInterval: z.union([
      z.number().int().min(5).max(300),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(60),
    mxLookup: z.boolean().default(true)
  }).optional()
});

type SmtpConfig = z.infer<typeof smtpConfigSchema>;

// Email template schema
const emailTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Template name is required"),
  description: z.string().min(5, "Description is required"),
  type: z.enum([
    "welcome", 
    "password_reset", 
    "account_verification", 
    "notification", 
    "alert", 
    "report", 
    "invitation",
    "custom"
  ]),
  subject: z.string().min(3, "Subject is required"),
  bodyHtml: z.string().min(10, "HTML body is required"),
  bodyText: z.string().min(10, "Text body is required"),
  variables: z.array(z.object({
    key: z.string(),
    description: z.string()
  })).optional()
});

type EmailTemplate = z.infer<typeof emailTemplateSchema>;

// Test email schema
const testEmailSchema = z.object({
  recipient: z.string().email("Must be a valid email"),
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(10, "Message is required"),
  smtpConfigId: z.string().min(1, "SMTP configuration is required")
});

type TestEmail = z.infer<typeof testEmailSchema>;

// Mock SMTP configurations for development
const mockConfigurations = [
  {
    id: "smtp1",
    name: "Primary Corporate SMTP",
    description: "Main corporate email relay for system notifications",
    provider: "microsoft365",
    hostname: "smtp.office365.com",
    port: 587,
    encryption: "tls",
    username: "notifications@company.com",
    isDefault: true,
    isActive: true,
    lastTested: "2025-05-01T10:15:30Z",
    status: "healthy"
  },
  {
    id: "smtp2",
    name: "SendGrid Integration",
    description: "SendGrid for marketing and bulk emails",
    provider: "sendgrid",
    hostname: "smtp.sendgrid.net",
    port: 587,
    encryption: "tls",
    username: "apikey",
    isDefault: false,
    isActive: true,
    lastTested: "2025-05-02T14:30:45Z",
    status: "healthy"
  },
  {
    id: "smtp3",
    name: "Backup SMTP Server",
    description: "Fallback server for critical notifications",
    provider: "postfix",
    hostname: "smtp-backup.internal.company.com",
    port: 25,
    encryption: "none",
    username: "system",
    isDefault: false,
    isActive: false,
    lastTested: "2025-04-15T09:20:10Z",
    status: "degraded"
  }
];

// Mock email templates
const mockTemplates = [
  {
    id: "template1",
    name: "Account Verification",
    description: "Template for new user account verification",
    type: "account_verification",
    subject: "Verify Your NexusMCP Account",
    lastUpdated: "2025-05-01T14:20:30Z"
  },
  {
    id: "template2",
    name: "Password Reset",
    description: "Password reset instructions template",
    type: "password_reset",
    subject: "Reset Your NexusMCP Password",
    lastUpdated: "2025-05-02T11:45:15Z"
  },
  {
    id: "template3",
    name: "System Alert",
    description: "Critical system alerts for administrators",
    type: "alert",
    subject: "ALERT: [severity] System Notification",
    lastUpdated: "2025-04-28T10:30:00Z"
  },
  {
    id: "template4",
    name: "Weekly Report",
    description: "Weekly system usage and performance report",
    type: "report",
    subject: "NexusMCP Weekly Performance Report",
    lastUpdated: "2025-05-03T08:15:40Z"
  }
];

// Email delivery logs for monitoring
const mockEmailLogs = [
  {
    id: "log1",
    recipient: "admin@company.com",
    subject: "Critical System Alert: Database Connection Lost",
    status: "delivered",
    sentAt: "2025-05-03T14:22:30Z",
    smtpConfig: "Primary Corporate SMTP",
    template: "System Alert",
    messageId: "<202505031422.1234567890@nexusmcp.company.com>"
  },
  {
    id: "log2",
    recipient: "john.smith@company.com",
    subject: "Verify Your NexusMCP Account",
    status: "delivered",
    sentAt: "2025-05-03T10:15:22Z",
    smtpConfig: "SendGrid Integration",
    template: "Account Verification",
    messageId: "<202505031015.9876543210@nexusmcp.company.com>"
  },
  {
    id: "log3",
    recipient: "jane.doe@company.com",
    subject: "Reset Your NexusMCP Password",
    status: "bounced",
    sentAt: "2025-05-02T16:40:05Z",
    smtpConfig: "Primary Corporate SMTP",
    template: "Password Reset",
    messageId: "<202505021640.5678901234@nexusmcp.company.com>"
  },
  {
    id: "log4",
    recipient: "security-team@company.com",
    subject: "NexusMCP Weekly Performance Report",
    status: "delayed",
    sentAt: "2025-05-01T09:00:15Z",
    smtpConfig: "SendGrid Integration",
    template: "Weekly Report",
    messageId: "<202505010900.1357924680@nexusmcp.company.com>"
  }
];

export default function SmtpPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [testingStatus, setTestingStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Form for SMTP configuration
  const smtpForm = useForm<SmtpConfig>({
    resolver: zodResolver(smtpConfigSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      isActive: true,
      provider: "custom",
      hostname: "",
      port: 587,
      encryption: "tls",
      authType: "plain",
      connectionTimeout: 30,
      advanced: {
        enableDKIM: false,
        enableSPF: false,
        enableDMARC: false,
        maxSendAttempts: 3,
        sendRetryInterval: 60,
        mxLookup: true
      }
    }
  });

  // Form for email template
  const templateForm = useForm<EmailTemplate>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "custom",
      subject: "",
      bodyHtml: "<html><body><h1>Hello, {{name}}!</h1><p>Your message here.</p></body></html>",
      bodyText: "Hello, {{name}}!\n\nYour message here.",
      variables: [
        { key: "name", description: "Recipient's name" }
      ]
    }
  });
  
  // Form for test email
  const testEmailForm = useForm<TestEmail>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: {
      recipient: "",
      subject: "Test Email from NexusMCP",
      message: "This is a test email sent from the NexusMCP SMTP configuration page.",
      smtpConfigId: ""
    }
  });
  
  // Handler for testing SMTP connection
  const handleTestConnection = () => {
    setTestingStatus("testing");
    // Simulate API call
    setTimeout(() => {
      // Random success/error for demo purposes
      const result = Math.random() > 0.3 ? "success" : "error";
      setTestingStatus(result);
      
      if (result === "success") {
        toast({
          title: "SMTP connection successful",
          description: "The SMTP server connection was verified successfully.",
          variant: "default",
        });
      } else {
        toast({
          title: "SMTP connection failed",
          description: "Unable to connect to the SMTP server. Please check your configuration.",
          variant: "destructive",
        });
      }
    }, 2000);
  };
  
  // Handler for sending test email
  const handleSendTestEmail = (data: TestEmail) => {
    toast({
      title: "Sending test email",
      description: "Attempting to send a test email to " + data.recipient,
    });
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Test email sent",
        description: "The test email was sent successfully to " + data.recipient,
        variant: "default",
      });
      testEmailForm.reset({
        ...testEmailForm.getValues(),
        recipient: "",
      });
    }, 2000);
  };
  
  // Handler for submitting SMTP configuration
  const handleSubmitSmtpConfig = (data: SmtpConfig) => {
    console.log("Submitting SMTP config:", data);
    toast({
      title: "SMTP configuration saved",
      description: `${data.name} has been successfully configured.`,
      variant: "default",
    });
    
    // Reset form and go back to overview
    smtpForm.reset();
    setActiveTab("overview");
  };
  
  // Handler for submitting email template
  const handleSubmitTemplate = (data: EmailTemplate) => {
    console.log("Submitting email template:", data);
    toast({
      title: "Email template saved",
      description: `${data.name} template has been successfully saved.`,
      variant: "default",
    });
    
    // Reset form and go back to templates tab
    templateForm.reset();
    setSelectedTemplateId(null);
  };
  
  // Function to load configuration by ID
  const loadConfiguration = (id: string) => {
    const config = mockConfigurations.find(c => c.id === id);
    if (config) {
      // Convert the mock data to form data structure
      smtpForm.reset({
        name: config.name,
        description: config.description,
        provider: config.provider as any,
        hostname: config.hostname,
        port: config.port,
        encryption: config.encryption as any,
        authType: "plain", // Default, not in mock
        username: config.username,
        isDefault: config.isDefault,
        isActive: config.isActive,
        connectionTimeout: 30,
        advanced: {
          enableDKIM: false,
          enableSPF: false,
          enableDMARC: false,
          maxSendAttempts: 3,
          sendRetryInterval: 60,
          mxLookup: true
        }
      });
      setSelectedConfigId(id);
      setActiveTab("configuration");
    }
  };
  
  // Function to load template by ID
  const loadTemplate = (id: string) => {
    const template = mockTemplates.find(t => t.id === id);
    if (template) {
      // Convert the mock data to form data structure
      templateForm.reset({
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type as any,
        subject: template.subject,
        bodyHtml: "<html><body><h1>Hello, {{name}}!</h1><p>Your message here.</p></body></html>", // Default
        bodyText: "Hello, {{name}}!\n\nYour message here.", // Default
        variables: [
          { key: "name", description: "Recipient's name" }
        ]
      });
      setSelectedTemplateId(id);
    }
  };
  
  // Function to delete configuration
  const deleteConfiguration = (id: string) => {
    // In a real app, this would make an API call
    toast({
      title: "SMTP configuration deleted",
      description: "The SMTP configuration has been removed.",
      variant: "default",
    });
  };
  
  // Function to delete template
  const deleteTemplate = (id: string) => {
    // In a real app, this would make an API call
    toast({
      title: "Email template deleted",
      description: "The email template has been removed.",
      variant: "default",
    });
  };
  
  // Selected provider type from the form
  const selectedProvider = smtpForm.watch("provider");
  const selectedAuthType = smtpForm.watch("authType");
  
  // Function to get provider icon
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "microsoft365": return <Mail className="h-4 w-4" />;
      case "sendgrid": return <SendIcon className="h-4 w-4" />;
      case "postfix": return <Server className="h-4 w-4" />;
      case "gmail": return <Mail className="h-4 w-4" />;
      case "mailgun": return <Globe className="h-4 w-4" />;
      case "amazon_ses": return <Globe className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };
  
  // Function to get provider display name
  const getProviderName = (provider: string) => {
    switch (provider) {
      case "microsoft365": return "Microsoft 365";
      case "sendgrid": return "SendGrid";
      case "postfix": return "Postfix";
      case "gmail": return "Gmail";
      case "mailgun": return "Mailgun";
      case "amazon_ses": return "Amazon SES";
      case "custom": return "Custom SMTP";
      default: return provider;
    }
  };
  
  // Function to get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "healthy": return "default";
      case "degraded": return "outline";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };
  
  // Function to get delivery status badge
  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Delivered</Badge>;
      case "bounced":
        return <Badge variant="destructive">Bounced</Badge>;
      case "delayed":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Delayed</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="SMTP Configuration" 
        description="Configure SMTP servers for system email delivery and create email templates"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => {
              setSelectedConfigId(null);
              smtpForm.reset();
              setActiveTab("configuration");
            }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add SMTP Server
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                testEmailForm.reset();
                setActiveTab("test");
              }}
            >
              <SendIcon className="mr-2 h-4 w-4" />
              Send Test Email
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-[600px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
          <TabsTrigger value="test">Test Email</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configured SMTP Servers</CardTitle>
              <CardDescription>
                Manage your enterprise SMTP relay configurations for system emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Last Tested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockConfigurations.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getProviderIcon(config.provider)}
                          <span className="ml-1">{getProviderName(config.provider)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{config.hostname}:{config.port}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(config.status)}>
                          {config.status === "healthy" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {config.status === "degraded" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {config.status.charAt(0).toUpperCase() + config.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {config.isDefault ? (
                          <Badge variant="secondary">Default</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {config.lastTested ? new Date(config.lastTested).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => loadConfiguration(config.id)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              testEmailForm.setValue("smtpConfigId", config.id);
                              setActiveTab("test");
                            }}
                          >
                            Test
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            onClick={() => deleteConfiguration(config.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Microsoft 365 SMTP Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Microsoft 365
                </CardTitle>
                <CardDescription>
                  Exchange Online SMTP relay
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Connect to Microsoft 365 Exchange Online SMTP relay services for sending emails from your organization's domain.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Server Settings:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Host: smtp.office365.com</li>
                    <li>Port: 587 (TLS)</li>
                    <li>Authentication: LOGIN</li>
                    <li>Requires valid M365 account</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  smtpForm.reset({
                    ...smtpForm.getValues(),
                    provider: "microsoft365",
                    hostname: "smtp.office365.com",
                    port: 587,
                    encryption: "tls",
                    authType: "login"
                  });
                  setActiveTab("configuration");
                }}>
                  Configure Microsoft 365
                </Button>
              </CardFooter>
            </Card>

            {/* SendGrid Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SendIcon className="h-5 w-5" />
                  SendGrid
                </CardTitle>
                <CardDescription>
                  Email delivery platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Integrate with SendGrid for reliable email delivery, especially for bulk emails and marketing communications.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>High deliverability rates</li>
                    <li>Advanced analytics</li>
                    <li>API or SMTP integration</li>
                    <li>Supports IP whitelisting</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  smtpForm.reset({
                    ...smtpForm.getValues(),
                    provider: "sendgrid",
                    hostname: "smtp.sendgrid.net",
                    port: 587,
                    encryption: "tls",
                    authType: "plain",
                    username: "apikey"
                  });
                  setActiveTab("configuration");
                }}>
                  Configure SendGrid
                </Button>
              </CardFooter>
            </Card>

            {/* Postfix Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Postfix
                </CardTitle>
                <CardDescription>
                  Self-hosted mail server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Connect to a self-hosted Postfix mail server for complete control over your email infrastructure.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Full infrastructure control</li>
                    <li>No external dependencies</li>
                    <li>On-premises security</li>
                    <li>Custom routing & policies</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  smtpForm.reset({
                    ...smtpForm.getValues(),
                    provider: "postfix",
                    hostname: "mail.yourdomain.com",
                    port: 25,
                    encryption: "none",
                    authType: "plain"
                  });
                  setActiveTab("configuration");
                }}>
                  Configure Postfix
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Email Templates Overview</CardTitle>
              <CardDescription>
                Manage your system email templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {template.type.replace("_", " ").split(" ").map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(" ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.subject}</TableCell>
                      <TableCell>
                        {new Date(template.lastUpdated).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              loadTemplate(template.id);
                              setActiveTab("templates");
                            }}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            onClick={() => deleteTemplate(template.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedTemplateId(null);
                  templateForm.reset();
                  setActiveTab("templates");
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Template
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedConfigId ? "Edit SMTP Configuration" : "New SMTP Configuration"}</CardTitle>
              <CardDescription>
                Configure an SMTP server for sending system emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...smtpForm}>
                <form onSubmit={smtpForm.handleSubmit(handleSubmitSmtpConfig)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic configuration section */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Basic Configuration</h3>
                        <p className="text-sm text-muted-foreground">
                          Set up the core SMTP server connection details
                        </p>
                      </div>
                      
                      <FormField
                        control={smtpForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Configuration Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Corporate SMTP Relay" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this SMTP configuration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Main corporate email server for system notifications" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider Type</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="custom">Custom SMTP Server</SelectItem>
                                <SelectItem value="microsoft365">Microsoft 365</SelectItem>
                                <SelectItem value="sendgrid">SendGrid</SelectItem>
                                <SelectItem value="postfix">Postfix</SelectItem>
                                <SelectItem value="gmail">Gmail</SelectItem>
                                <SelectItem value="mailgun">Mailgun</SelectItem>
                                <SelectItem value="amazon_ses">Amazon SES</SelectItem>
                                <SelectItem value="other">Other Provider</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select your email provider or choose custom for any SMTP server
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex space-x-4">
                        <FormField
                          control={smtpForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
                                <FormDescription>
                                  Enable or disable this configuration
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={smtpForm.control}
                          name="isDefault"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-0.5">
                                <FormLabel>Default</FormLabel>
                                <FormDescription>
                                  Use as default SMTP configuration
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    {/* Connection settings section */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Connection Settings</h3>
                        <p className="text-sm text-muted-foreground">
                          SMTP server connection and authentication details
                        </p>
                      </div>
                      
                      <FormField
                        control={smtpForm.control}
                        name="hostname"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Server Hostname</FormLabel>
                            <FormControl>
                              <Input placeholder="smtp.company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="65535"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value === "" ? "25" : e.target.value;
                                  field.onChange(Number(value));
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Common ports: 25 (default), 465 (SSL), 587 (TLS/STARTTLS)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="encryption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Encryption</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select encryption type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="ssl">SSL</SelectItem>
                                <SelectItem value="tls">TLS</SelectItem>
                                <SelectItem value="starttls">STARTTLS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
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
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="plain">Plain</SelectItem>
                                <SelectItem value="login">Login</SelectItem>
                                <SelectItem value="cram-md5">CRAM-MD5</SelectItem>
                                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {selectedAuthType !== "none" && (
                        <>
                          <FormField
                            control={smtpForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="smtp-user@company.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {selectedAuthType !== "oauth2" && (
                            <FormField
                              control={smtpForm.control}
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
                          )}
                          
                          {selectedAuthType === "oauth2" && (
                            <FormField
                              control={smtpForm.control}
                              name="apiKey"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>API Key / OAuth Token</FormLabel>
                                  <FormControl>
                                    <Input type="password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      )}
                      
                      {selectedProvider === "sendgrid" && (
                        <Alert className="mt-6 bg-muted">
                          <InfoIcon className="h-4 w-4" />
                          <AlertTitle>SendGrid Configuration</AlertTitle>
                          <AlertDescription>
                            For SendGrid, use "apikey" as the username and your API key as the password.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Sender Information */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium">Sender Information</h3>
                      <p className="text-sm text-muted-foreground">
                        Default sender details for outgoing emails
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={smtpForm.control}
                        name="senderName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sender Name</FormLabel>
                            <FormControl>
                              <Input placeholder="NexusMCP System" {...field} />
                            </FormControl>
                            <FormDescription>
                              The name that will appear in the From field
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="senderEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sender Email</FormLabel>
                            <FormControl>
                              <Input placeholder="noreply@company.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              The email address that will be used as the sender
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="replyToEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reply-To Email</FormLabel>
                            <FormControl>
                              <Input placeholder="support@company.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              Optional email address for recipients to reply to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smtpForm.control}
                        name="connectionTimeout"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Connection Timeout (seconds)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="5"
                                max="300"
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value === "" ? "30" : e.target.value;
                                  field.onChange(Number(value));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Advanced Settings (collapsible) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-medium">Advanced Settings</h3>
                        <p className="text-sm text-muted-foreground">
                          Configure security and delivery options
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Toggle the advanced section visibility
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">DKIM Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <FormField
                            control={smtpForm.control}
                            name="advanced.enableDKIM"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Enable DKIM</FormLabel>
                                  <FormDescription>
                                    Authenticate email with digital signatures
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
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">SPF Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <FormField
                            control={smtpForm.control}
                            name="advanced.enableSPF"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Enable SPF</FormLabel>
                                  <FormDescription>
                                    Specify authorized sending servers
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
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">DMARC Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <FormField
                            control={smtpForm.control}
                            name="advanced.enableDMARC"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-lg border p-3">
                                <div className="space-y-0.5">
                                  <FormLabel>Enable DMARC</FormLabel>
                                  <FormDescription>
                                    Domain-based message authentication
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
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("overview")}
                    >
                      Cancel
                    </Button>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTestConnection}
                        disabled={testingStatus === "testing"}
                      >
                        {testingStatus === "testing" ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            {testingStatus === "success" ? (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            ) : testingStatus === "error" ? (
                              <AlertTriangle className="mr-2 h-4 w-4" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Test Connection
                          </>
                        )}
                      </Button>
                      <Button type="submit">
                        Save Configuration
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Email Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedTemplateId ? "Edit Email Template" : "Create Email Template"}</CardTitle>
              <CardDescription>
                Design and manage reusable email templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...templateForm}>
                <form onSubmit={templateForm.handleSubmit(handleSubmitTemplate)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Template details */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Template Details</h3>
                        <p className="text-sm text-muted-foreground">
                          Basic information about this email template
                        </p>
                      </div>
                      
                      <FormField
                        control={templateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Password Reset Email" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this email template
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={templateForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Template used when users request a password reset" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={templateForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template Type</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select template type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="welcome">Welcome Email</SelectItem>
                                <SelectItem value="password_reset">Password Reset</SelectItem>
                                <SelectItem value="account_verification">Account Verification</SelectItem>
                                <SelectItem value="notification">Notification</SelectItem>
                                <SelectItem value="alert">System Alert</SelectItem>
                                <SelectItem value="report">Report</SelectItem>
                                <SelectItem value="invitation">Invitation</SelectItem>
                                <SelectItem value="custom">Custom Template</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Categorize this template by its purpose
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={templateForm.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Subject</FormLabel>
                            <FormControl>
                              <Input placeholder="Reset Your NexusMCP Password" {...field} />
                            </FormControl>
                            <FormDescription>
                              Subject line for emails sent using this template
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Template content */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Template Content</h3>
                        <p className="text-sm text-muted-foreground">
                          Create both HTML and text versions of your email
                        </p>
                      </div>
                      
                      <FormField
                        control={templateForm.control}
                        name="bodyHtml"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HTML Content</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="<html><body><h1>Hello, {{name}}!</h1><p>Your content here...</p></body></html>"
                                className="min-h-[200px] font-mono text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              HTML version of the email (supports variables like {{name}})
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={templateForm.control}
                        name="bodyText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plain Text Content</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Hello, {{name}}!\n\nYour content here..."
                                className="min-h-[100px] font-mono text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Plain text fallback version of the email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Template variables */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-medium">Template Variables</h3>
                        <p className="text-sm text-muted-foreground">
                          Variables that can be used in this template
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-muted rounded-lg p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variable</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Example</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">{"{{name}}"}</TableCell>
                            <TableCell>Recipient's name</TableCell>
                            <TableCell>John Smith</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">{"{{email}}"}</TableCell>
                            <TableCell>Recipient's email</TableCell>
                            <TableCell>john.smith@example.com</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">{"{{company}}"}</TableCell>
                            <TableCell>Company name</TableCell>
                            <TableCell>Acme Corporation</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">{"{{reset_link}}"}</TableCell>
                            <TableCell>Password reset URL</TableCell>
                            <TableCell>https://app.example.com/reset?token=abc123</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">{"{{verification_code}}"}</TableCell>
                            <TableCell>Account verification code</TableCell>
                            <TableCell>123456</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      
                      <p className="text-sm text-muted-foreground mt-4">
                        Use these variables in your template by including them with double curly braces,
                        like {"{{name}}"}. The system will replace them with the actual values when sending emails.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplateId(null);
                        setActiveTab("overview");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Save Template
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Delivery Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Logs</CardTitle>
              <CardDescription>
                Monitor and troubleshoot email delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Search by recipient or subject..." 
                    className="w-96"
                  />
                  <Button variant="secondary">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="bounced">Bounced</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SMTP Server</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockEmailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.sentAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{log.recipient}</TableCell>
                      <TableCell>{log.subject}</TableCell>
                      <TableCell>
                        {getDeliveryStatusBadge(log.status)}
                      </TableCell>
                      <TableCell>{log.smtpConfig}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing 4 of 124 logs
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Previous</Button>
                  <Button variant="outline" size="sm">Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Metrics</CardTitle>
              <CardDescription>
                Key performance indicators for email delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Delivery Rate Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Delivery Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">98.2%</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                    <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      +0.5% from previous period
                    </div>
                  </CardContent>
                </Card>
                
                {/* Bounce Rate Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Bounce Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">1.7%</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      +0.3% from previous period
                    </div>
                  </CardContent>
                </Card>
                
                {/* Average Delivery Time Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Avg. Delivery Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">2.4s</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                    <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      -0.3s from previous period
                    </div>
                  </CardContent>
                </Card>
                
                {/* Total Emails Sent Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Total Emails Sent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">35,427</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                    <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      +12.5% from previous period
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Test Email Tab */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>
                Verify your SMTP configuration by sending a test email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...testEmailForm}>
                <form onSubmit={testEmailForm.handleSubmit(handleSendTestEmail)} className="space-y-6">
                  <div className="grid grid-cols-1 max-w-xl gap-4">
                    <FormField
                      control={testEmailForm.control}
                      name="smtpConfigId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Configuration</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select SMTP configuration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockConfigurations.map((config) => (
                                <SelectItem key={config.id} value={config.id}>
                                  {config.name} {config.isDefault && "(Default)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={testEmailForm.control}
                      name="recipient"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="recipient@example.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Email address to send the test message to
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={testEmailForm.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Test Email from NexusMCP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={testEmailForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="This is a test email to verify SMTP configuration."
                              rows={5}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <CustomAlert variant="success" className="my-6">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Important Information</AlertTitle>
                    <AlertDescription>
                      This test will send an actual email to the recipient address. Make sure you have permission to send 
                      emails to the address you provide.
                    </AlertDescription>
                  </CustomAlert>
                  
                  <div className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("overview")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      <SendIcon className="mr-2 h-4 w-4" />
                      Send Test Email
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}