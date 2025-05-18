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
  MessageSquare,
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
  Globe as GlobeIcon,
  History,
  Search,
  Lock,
  Bell,
  MessageCircle,
  Phone,
  Copy,
  Eye,
  Code,
  MessageSquareDashed,
  Smartphone,
  Network
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

// Messaging configuration schema
const messagingConfigSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  platform: z.enum(["slack", "ms_teams", "webhook", "custom"]),
  webhookUrl: z.string().url("Must be a valid URL").optional(),
  botToken: z.string().optional(),
  channel: z.string().optional(),
  credentials: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    tenantId: z.string().optional()
  }).optional(),
  connectionTimeout: z.union([
    z.number().int().min(5).max(300),
    z.string().regex(/^\d+$/).transform(Number)
  ]).default(30),
  advanced: z.object({
    maxSendAttempts: z.union([
      z.number().int().min(1).max(10),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(3),
    sendRetryInterval: z.union([
      z.number().int().min(5).max(300),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(60)
  }).optional()
});

type MessagingConfig = z.infer<typeof messagingConfigSchema>;

// SMS configuration schema
const smsConfigSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  provider: z.enum(["twilio", "vonage", "plivo", "custom"]),
  accountSid: z.string().min(3, "Account SID/ID is required"),
  authToken: z.string().min(3, "Auth token is required"),
  phoneNumber: z.string().optional(),
  connectionTimeout: z.union([
    z.number().int().min(5).max(300),
    z.string().regex(/^\d+$/).transform(Number)
  ]).default(30),
  advanced: z.object({
    maxSendAttempts: z.union([
      z.number().int().min(1).max(10),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(3),
    sendRetryInterval: z.union([
      z.number().int().min(5).max(300),
      z.string().regex(/^\d+$/).transform(Number)
    ]).default(60)
  }).optional()
});

type SmsConfig = z.infer<typeof smsConfigSchema>;

// Message template schema
const messageTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Template name is required"),
  description: z.string().min(5, "Description is required"),
  type: z.enum([
    "notification", 
    "alert", 
    "report", 
    "welcome",
    "custom"
  ]),
  platform: z.enum(["slack", "ms_teams", "sms", "webhook", "all"]),
  content: z.string().min(10, "Content is required"),
  format: z.enum(["markdown", "plain", "json"]).default("markdown"),
  variables: z.array(z.object({
    key: z.string(),
    description: z.string()
  })).optional(),
  blocks: z.any().optional() // For Slack/Teams structured messages
});

type MessageTemplate = z.infer<typeof messageTemplateSchema>;

// Test message schema
const testMessageSchema = z.object({
  recipient: z.string().min(3, "Recipient is required"),
  content: z.string().min(10, "Message content is required"),
  configId: z.string().min(1, "Configuration is required")
});

type TestMessage = z.infer<typeof testMessageSchema>;

// Mock messaging configurations for development
const mockMessagingConfigurations = [
  {
    id: "msg1",
    name: "Corporate Slack Channel",
    description: "Main company-wide Slack channel for system notifications",
    platform: "slack",
    channel: "#system-notifications",
    isDefault: true,
    isActive: true,
    lastTested: "2025-05-01T10:15:30Z",
    status: "healthy"
  },
  {
    id: "msg2",
    name: "IT Team MS Teams",
    description: "Microsoft Teams channel for IT department alerts",
    platform: "ms_teams",
    webhookUrl: "https://outlook.office.com/webhook/...",
    isDefault: false,
    isActive: true,
    lastTested: "2025-05-02T14:30:45Z",
    status: "healthy"
  },
  {
    id: "msg3",
    name: "Custom Webhook Integration",
    description: "Custom webhook for integration with internal systems",
    platform: "webhook",
    webhookUrl: "https://internal.company.com/api/webhook/notifications",
    isDefault: false,
    isActive: false,
    lastTested: "2025-04-15T09:20:10Z",
    status: "degraded"
  }
];

// Mock SMS configurations
const mockSmsConfigurations = [
  {
    id: "sms1",
    name: "Twilio Integration",
    description: "Twilio SMS for critical alerts",
    provider: "twilio",
    accountSid: "TWILIO_ACCOUNT_SID_PLACEHOLDER",
    isDefault: true,
    isActive: true,
    lastTested: "2025-05-01T11:20:30Z",
    status: "healthy"
  },
  {
    id: "sms2",
    name: "Vonage SMS",
    description: "Vonage SMS for marketing messages",
    provider: "vonage",
    accountSid: "VONAGE_API_KEY_PLACEHOLDER",
    isDefault: false,
    isActive: true,
    lastTested: "2025-05-02T15:40:50Z",
    status: "healthy"
  }
];

// Mock message templates
const mockTemplates = [
  {
    id: "template1",
    name: "System Alert",
    description: "Critical system alert for administrators",
    type: "alert",
    platform: "slack",
    format: "markdown",
    content: "*ALERT*: [severity] System notification\n\n[message]",
    lastUpdated: "2025-05-01T14:20:30Z"
  },
  {
    id: "template2",
    name: "Performance Report",
    description: "Regular system performance report",
    type: "report",
    platform: "ms_teams",
    format: "markdown",
    content: "## Performance Report\n\nPeriod: [period]\n\n[summary]",
    lastUpdated: "2025-05-02T11:45:15Z"
  },
  {
    id: "template3",
    name: "New User Welcome",
    description: "Welcome message for new users",
    type: "welcome",
    platform: "sms",
    format: "plain",
    content: "Welcome to NexusMCP, [name]! Your account has been created successfully.",
    lastUpdated: "2025-04-28T10:30:00Z"
  }
];

// Message delivery logs for monitoring
const mockMessageLogs = [
  {
    id: "log1",
    recipient: "#system-alerts",
    content: "ALERT: Database Connection Lost",
    status: "delivered",
    sentAt: "2025-05-03T14:22:30Z",
    platform: "slack",
    template: "System Alert",
    messageId: "1234567890.123456"
  },
  {
    id: "log2",
    recipient: "IT-Team Channel",
    content: "Performance Report: May 1-3, 2025",
    status: "delivered",
    sentAt: "2025-05-03T10:15:22Z",
    platform: "ms_teams",
    template: "Performance Report",
    messageId: "9876543210.987654"
  },
  {
    id: "log3",
    recipient: "+12345678901",
    content: "Welcome to NexusMCP, Jane! Your account has been created successfully.",
    status: "failed",
    sentAt: "2025-05-02T16:40:05Z",
    platform: "sms",
    template: "New User Welcome",
    messageId: null,
    failureReason: "Invalid phone number format"
  }
];

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [testingStatus, setTestingStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [configType, setConfigType] = useState<"messaging" | "sms">("messaging");
  const { toast } = useToast();
  
  // Form for messaging configuration
  const messagingForm = useForm<MessagingConfig>({
    resolver: zodResolver(messagingConfigSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      isActive: true,
      platform: "slack",
      connectionTimeout: 30,
      advanced: {
        maxSendAttempts: 3,
        sendRetryInterval: 60
      }
    }
  });

  // Form for SMS configuration
  const smsForm = useForm<SmsConfig>({
    resolver: zodResolver(smsConfigSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      isActive: true,
      provider: "twilio",
      accountSid: "",
      authToken: "",
      connectionTimeout: 30,
      advanced: {
        maxSendAttempts: 3,
        sendRetryInterval: 60
      }
    }
  });

  // Form for message template
  const templateForm = useForm<MessageTemplate>({
    resolver: zodResolver(messageTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "notification",
      platform: "all",
      content: "",
      format: "markdown",
      variables: [
        { key: "name", description: "Recipient's name" }
      ]
    }
  });
  
  // Form for test message
  const testMessageForm = useForm<TestMessage>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: {
      recipient: "",
      content: "This is a test message from NexusMCP.",
      configId: ""
    }
  });
  
  // Handler for testing messaging connection
  const handleTestConnection = () => {
    setTestingStatus("testing");
    // Simulate API call
    setTimeout(() => {
      // Random success/error for demo purposes
      const result = Math.random() > 0.2 ? "success" : "error";
      setTestingStatus(result);
      
      if (result === "success") {
        toast({
          title: `${configType === "messaging" ? "Messaging" : "SMS"} connection successful`,
          description: `The ${configType === "messaging" ? "messaging integration" : "SMS provider"} connection was verified successfully.`,
          variant: "default",
        });
      } else {
        toast({
          title: `${configType === "messaging" ? "Messaging" : "SMS"} connection failed`,
          description: `Unable to connect to the ${configType === "messaging" ? "messaging platform" : "SMS provider"}. Please check your configuration.`,
          variant: "destructive",
        });
      }
    }, 2000);
  };
  
  // Handler for sending test message
  const handleSendTestMessage = (data: TestMessage) => {
    toast({
      title: "Sending test message",
      description: "Attempting to send a test message to " + data.recipient,
    });
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Test message sent",
        description: "The test message was sent successfully to " + data.recipient,
        variant: "default",
      });
      testMessageForm.reset({
        ...testMessageForm.getValues(),
        recipient: "",
      });
    }, 2000);
  };
  
  // Handler for submitting messaging configuration
  const handleSubmitMessagingConfig = (data: MessagingConfig) => {
    console.log("Submitting messaging config:", data);
    toast({
      title: "Messaging configuration saved",
      description: `${data.name} has been successfully configured.`,
      variant: "default",
    });
    
    // Reset form and go back to overview
    messagingForm.reset();
    setActiveTab("overview");
  };
  
  // Handler for submitting SMS configuration
  const handleSubmitSmsConfig = (data: SmsConfig) => {
    console.log("Submitting SMS config:", data);
    toast({
      title: "SMS configuration saved",
      description: `${data.name} has been successfully configured.`,
      variant: "default",
    });
    
    // Reset form and go back to overview
    smsForm.reset();
    setActiveTab("overview");
  };
  
  // Handler for submitting message template
  const handleSubmitTemplate = (data: MessageTemplate) => {
    console.log("Submitting message template:", data);
    toast({
      title: "Message template saved",
      description: `${data.name} template has been successfully saved.`,
      variant: "default",
    });
    
    // Reset form and go back to templates tab
    templateForm.reset();
    setSelectedTemplateId(null);
  };
  
  // Function to load messaging configuration by ID
  const loadMessagingConfiguration = (id: string) => {
    const config = mockMessagingConfigurations.find(c => c.id === id);
    if (config) {
      // Convert the mock data to form data structure
      messagingForm.reset({
        name: config.name,
        description: config.description,
        platform: config.platform as any,
        webhookUrl: config.webhookUrl,
        channel: config.channel,
        isDefault: config.isDefault,
        isActive: config.isActive,
        connectionTimeout: 30,
        advanced: {
          maxSendAttempts: 3,
          sendRetryInterval: 60
        }
      });
      setSelectedConfigId(id);
      setConfigType("messaging");
      setActiveTab("configuration");
    }
  };
  
  // Function to load SMS configuration by ID
  const loadSmsConfiguration = (id: string) => {
    const config = mockSmsConfigurations.find(c => c.id === id);
    if (config) {
      // Convert the mock data to form data structure
      smsForm.reset({
        name: config.name,
        description: config.description,
        provider: config.provider as any,
        accountSid: config.accountSid,
        authToken: "**********", // Masked for security
        isDefault: config.isDefault,
        isActive: config.isActive,
        connectionTimeout: 30,
        advanced: {
          maxSendAttempts: 3,
          sendRetryInterval: 60
        }
      });
      setSelectedConfigId(id);
      setConfigType("sms");
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
        platform: template.platform as any,
        content: template.content,
        format: template.format as any,
        variables: [
          { key: "name", description: "Recipient's name" }
        ]
      });
      setSelectedTemplateId(id);
    }
  };
  
  // Function to delete configuration
  const deleteConfiguration = (id: string, type: "messaging" | "sms") => {
    // In a real app, this would make an API call
    toast({
      title: `${type === "messaging" ? "Messaging" : "SMS"} configuration deleted`,
      description: `The ${type === "messaging" ? "messaging" : "SMS"} configuration has been removed.`,
      variant: "default",
    });
  };
  
  // Function to delete template
  const deleteTemplate = (id: string) => {
    // In a real app, this would make an API call
    toast({
      title: "Message template deleted",
      description: "The message template has been removed.",
      variant: "default",
    });
  };
  
  // Selected platform/provider from the forms
  const selectedPlatform = messagingForm.watch("platform");
  const selectedSmsProvider = smsForm.watch("provider");
  
  // Function to get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "slack": return <MessageSquareDashed className="h-4 w-4" />;
      case "ms_teams": return <MessageCircle className="h-4 w-4" />; 
      case "webhook": return <GlobeIcon className="h-4 w-4" />;
      case "sms": return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };
  
  // Function to get SMS provider icon
  const getSmsProviderIcon = (provider: string) => {
    switch (provider) {
      case "twilio": return <Smartphone className="h-4 w-4" />;
      case "vonage": return <Phone className="h-4 w-4" />;
      case "plivo": return <Network className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };
  
  // Function to get platform display name
  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "slack": return "Slack";
      case "ms_teams": return "Microsoft Teams";
      case "webhook": return "Webhook";
      case "sms": return "SMS";
      case "all": return "All Platforms";
      default: return "Custom";
    }
  };
  
  // Function to get SMS provider display name
  const getSmsProviderName = (provider: string) => {
    switch (provider) {
      case "twilio": return "Twilio";
      case "vonage": return "Vonage";
      case "plivo": return "Plivo";
      default: return "Custom";
    }
  };
  
  // Function to get badge color based on status
  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case "healthy": return "default"; // Use default with custom colors
      case "degraded": return "secondary";
      case "unhealthy": return "destructive";
      default: return "outline";
    }
  };
  
  // Function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle2 className="h-4 w-4" />;
      case "degraded": return <AlertTriangle className="h-4 w-4" />;
      case "unhealthy": return <AlertTriangle className="h-4 w-4" />;
      default: return <InfoIcon className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-4">
        <MessageSquare className="h-6 w-6 mr-2" />
        <PageHeader 
          title="Messaging Integration"
          description="Configure messaging integrations for Slack, Microsoft Teams, SMS, and other platforms."
        />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid grid-cols-4 w-full sm:w-[500px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>Messaging Platforms</span>
                  <Badge variant="outline" className="ml-2">{mockMessagingConfigurations.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Platforms for sending messages to teams and channels
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setConfigType("messaging");
                      setSelectedConfigId(null);
                      setActiveTab("configuration");
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Platform
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // In a real app, this would refresh from the API
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <small className="text-muted-foreground">
                  Slack, Microsoft Teams, and Webhooks
                </small>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>SMS Providers</span>
                  <Badge variant="outline" className="ml-2">{mockSmsConfigurations.length}</Badge>
                </CardTitle>
                <CardDescription>
                  SMS gateways for sending text messages
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setConfigType("sms");
                      setSelectedConfigId(null);
                      setActiveTab("configuration");
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New SMS Provider
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // In a real app, this would refresh from the API
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <small className="text-muted-foreground">
                  Twilio, Vonage, and Plivo
                </small>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>Message Templates</span>
                  <Badge variant="outline" className="ml-2">{mockTemplates.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Reusable message templates with variables
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedTemplateId(null);
                      setActiveTab("templates");
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // In a real app, this would refresh from the API
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <small className="text-muted-foreground">
                  Cross-platform message templates
                </small>
              </CardFooter>
            </Card>
          </div>
          
          <Separator />
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Messaging Configurations</h3>
              <div className="flex gap-2">
                <div className="relative max-w-[250px]">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search configurations..." 
                    className="pl-8 max-w-[250px]"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="unhealthy">Unhealthy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Tested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMessagingConfigurations.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">
                          {config.name}
                          {config.isDefault && (
                            <Badge variant="outline" className="ml-2">Default</Badge>
                          )}
                          {!config.isActive && (
                            <Badge variant="outline" className="ml-2 bg-gray-100">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getPlatformIcon(config.platform)}
                            <span className="ml-2">{getPlatformName(config.platform)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{config.description}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(config.status)} className="flex w-fit items-center gap-1">
                            {getStatusIcon(config.status)}
                            <span className="capitalize">{config.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(config.lastTested).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => loadMessagingConfiguration(config.id)}
                              title="Edit"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                testMessageForm.setValue("configId", config.id);
                                testMessageForm.setValue("recipient", config.platform === "slack" ? config.channel || "#general" : "");
                                setActiveTab("configuration");
                              }}
                              title="Test"
                            >
                              <SendIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => deleteConfiguration(config.id, "messaging")}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <div className="flex justify-between items-center mt-8">
              <h3 className="text-lg font-medium">SMS Configurations</h3>
              <div className="flex gap-2">
                <div className="relative max-w-[250px]">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search SMS providers..." 
                    className="pl-8 max-w-[250px]"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Provider filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="vonage">Vonage</SelectItem>
                    <SelectItem value="plivo">Plivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Tested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSmsConfigurations.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">
                          {config.name}
                          {config.isDefault && (
                            <Badge variant="outline" className="ml-2">Default</Badge>
                          )}
                          {!config.isActive && (
                            <Badge variant="outline" className="ml-2 bg-gray-100">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getSmsProviderIcon(config.provider)}
                            <span className="ml-2">{getSmsProviderName(config.provider)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{config.description}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(config.status)} className="flex w-fit items-center gap-1">
                            {getStatusIcon(config.status)}
                            <span className="capitalize">{config.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(config.lastTested).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => loadSmsConfiguration(config.id)}
                              title="Edit"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                testMessageForm.setValue("configId", config.id);
                                testMessageForm.setValue("recipient", "+1234567890");
                                setActiveTab("configuration");
                              }}
                              title="Test"
                            >
                              <SendIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => deleteConfiguration(config.id, "sms")}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
              {selectedConfigId ? 
                `Edit ${configType === "messaging" ? "Messaging" : "SMS"} Configuration` : 
                `New ${configType === "messaging" ? "Messaging" : "SMS"} Configuration`
              }
            </h3>
            <div className="flex gap-2">
              {!selectedConfigId && (
                <>
                  <Button 
                    variant={configType === "messaging" ? "default" : "outline"} 
                    onClick={() => setConfigType("messaging")}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messaging
                  </Button>
                  <Button 
                    variant={configType === "sms" ? "default" : "outline"} 
                    onClick={() => setConfigType("sms")}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    SMS
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {configType === "messaging" ? (
            <Form {...messagingForm}>
              <form onSubmit={messagingForm.handleSubmit(handleSubmitMessagingConfig)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                      Configure the basic details for your messaging integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={messagingForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Development Slack Channel" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this configuration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={messagingForm.control}
                        name="platform"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Platform</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="slack">
                                  <div className="flex items-center">
                                    <MessageSquareDashed className="h-4 w-4 mr-2" />
                                    Slack
                                  </div>
                                </SelectItem>
                                <SelectItem value="ms_teams">
                                  <div className="flex items-center">
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Microsoft Teams
                                  </div>
                                </SelectItem>
                                <SelectItem value="webhook">
                                  <div className="flex items-center">
                                    <GlobeIcon className="h-4 w-4 mr-2" />
                                    Webhook
                                  </div>
                                </SelectItem>
                                <SelectItem value="custom">
                                  <div className="flex items-center">
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Custom
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The messaging platform to integrate with
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={messagingForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Used for sending system notifications to the development team"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A detailed description of this messaging integration's purpose
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={messagingForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Default Configuration
                              </FormLabel>
                              <FormDescription>
                                Make this the default messaging configuration
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
                        control={messagingForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Status
                              </FormLabel>
                              <FormDescription>
                                Enable or disable this messaging configuration
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
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Connection Details</CardTitle>
                    <CardDescription>
                      Configure the connection details for the selected platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedPlatform === "slack" && (
                      <>
                        <FormField
                          control={messagingForm.control}
                          name="botToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bot Token</FormLabel>
                              <FormControl>
                                <div className="flex">
                                  <Input 
                                    type="password" 
                                    placeholder="xoxb-..." 
                                    {...field} 
                                    className="flex-grow"
                                  />
                                  <Button 
                                    type="button" 
                                    variant="outline"
                                    className="ml-2"
                                    onClick={() => {
                                      /* Toggle password visibility */
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Slack Bot User OAuth Token (starts with xoxb-)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={messagingForm.control}
                          name="channel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Channel</FormLabel>
                              <FormControl>
                                <Input placeholder="#general" {...field} />
                              </FormControl>
                              <FormDescription>
                                Default channel to send messages to (include # for public channels)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Alert>
                          <InfoIcon className="h-4 w-4" />
                          <AlertTitle>Setting up Slack</AlertTitle>
                          <AlertDescription>
                            You need to create a Slack app in your workspace and add the <code>chat:write</code> scope.
                            <Button variant="link" size="sm" className="pl-1 h-auto" asChild>
                              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">
                                Go to Slack Apps
                              </a>
                            </Button>
                          </AlertDescription>
                        </Alert>
                      </>
                    )}
                    
                    {selectedPlatform === "ms_teams" && (
                      <>
                        <FormField
                          control={messagingForm.control}
                          name="webhookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Webhook URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://outlook.office.com/webhook/..." 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Microsoft Teams incoming webhook URL
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Alert>
                          <InfoIcon className="h-4 w-4" />
                          <AlertTitle>Setting up Microsoft Teams</AlertTitle>
                          <AlertDescription>
                            You need to add an Incoming Webhook connector to your Teams channel.
                            <Button variant="link" size="sm" className="pl-1 h-auto" asChild>
                              <a href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" target="_blank" rel="noopener noreferrer">
                                Read documentation
                              </a>
                            </Button>
                          </AlertDescription>
                        </Alert>
                      </>
                    )}
                    
                    {selectedPlatform === "webhook" && (
                      <>
                        <FormField
                          control={messagingForm.control}
                          name="webhookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Webhook URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://example.com/webhook" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                URL to send webhook data to
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={messagingForm.control}
                          name="credentials"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Authentication (Optional)</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormControl>
                                  <div>
                                    <Label htmlFor="webhook-auth-user">Username</Label>
                                    <Input 
                                      id="webhook-auth-user"
                                      placeholder="Username (optional)" 
                                      value={field.value?.clientId || ""}
                                      onChange={(e) => field.onChange({
                                        ...field.value,
                                        clientId: e.target.value
                                      })}
                                    />
                                  </div>
                                </FormControl>
                                <FormControl>
                                  <div>
                                    <Label htmlFor="webhook-auth-pass">Password/Token</Label>
                                    <Input 
                                      id="webhook-auth-pass"
                                      type="password"
                                      placeholder="Password/Token (optional)" 
                                      value={field.value?.clientSecret || ""}
                                      onChange={(e) => field.onChange({
                                        ...field.value,
                                        clientSecret: e.target.value
                                      })}
                                    />
                                  </div>
                                </FormControl>
                              </div>
                              <FormDescription>
                                Basic authentication credentials (if required)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
                    {selectedPlatform === "custom" && (
                      <Alert>
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Custom Integration</AlertTitle>
                        <AlertDescription>
                          Custom integrations require additional configuration. Please contact your administrator for assistance.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <FormField
                      control={messagingForm.control}
                      name="connectionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min={5}
                              max={300}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum time to wait for a connection (5-300 seconds)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Settings</CardTitle>
                    <CardDescription>
                      Optional advanced configuration options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={messagingForm.control}
                        name="advanced.maxSendAttempts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Send Attempts</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min={1}
                                max={10}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum number of retry attempts (1-10)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={messagingForm.control}
                        name="advanced.sendRetryInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Retry Interval (seconds)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min={5}
                                max={300}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Time to wait between retry attempts (5-300 seconds)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Test Connection</CardTitle>
                    <CardDescription>
                      Verify your messaging configuration by sending a test message
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...testMessageForm}>
                      <form onSubmit={testMessageForm.handleSubmit(handleSendTestMessage)} className="space-y-4">
                        <FormField
                          control={testMessageForm.control}
                          name="recipient"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Recipient</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={selectedPlatform === "slack" ? "#general" : 
                                              selectedPlatform === "ms_teams" ? "Team channel" : 
                                              "Recipient"}
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                {selectedPlatform === "slack" ? "Channel or user ID (use # for public channels)" : 
                                 selectedPlatform === "ms_teams" ? "Not required for Teams webhooks" : 
                                 "Recipient identifier"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={testMessageForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="This is a test message from NexusMCP."
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Test message content
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                          <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={handleTestConnection}
                            disabled={testingStatus === "testing"}
                          >
                            {testingStatus === "testing" ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Test Connection
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            type="submit" 
                            variant="secondary"
                            disabled={testingStatus === "testing"}
                          >
                            <SendIcon className="h-4 w-4 mr-2" />
                            Send Test Message
                          </Button>
                        </div>
                        
                        {testingStatus === "success" && (
                          <CustomAlert variant="success" className="mt-4">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Connection successful</AlertTitle>
                            <AlertDescription>
                              Successfully connected to the messaging platform.
                            </AlertDescription>
                          </CustomAlert>
                        )}
                        
                        {testingStatus === "error" && (
                          <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Connection failed</AlertTitle>
                            <AlertDescription>
                              Could not connect to the messaging platform. Please check your configuration.
                            </AlertDescription>
                          </Alert>
                        )}
                      </form>
                    </Form>
                  </CardContent>
                </Card>
                
                <div className="flex justify-between">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      messagingForm.reset();
                      setActiveTab("overview");
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="space-x-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => messagingForm.reset()}
                    >
                      Reset
                    </Button>
                    <Button type="submit">
                      {selectedConfigId ? "Update" : "Save"} Configuration
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(handleSubmitSmsConfig)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                      Configure the basic details for your SMS provider
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={smsForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Twilio SMS Integration" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this configuration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smsForm.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="twilio">
                                  <div className="flex items-center">
                                    <Smartphone className="h-4 w-4 mr-2" />
                                    Twilio
                                  </div>
                                </SelectItem>
                                <SelectItem value="vonage">
                                  <div className="flex items-center">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Vonage
                                  </div>
                                </SelectItem>
                                <SelectItem value="plivo">
                                  <div className="flex items-center">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Plivo
                                  </div>
                                </SelectItem>
                                <SelectItem value="custom">
                                  <div className="flex items-center">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Custom
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The SMS provider to integrate with
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={smsForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Used for sending critical alerts via SMS"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A detailed description of this SMS integration's purpose
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={smsForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Default Configuration
                              </FormLabel>
                              <FormDescription>
                                Make this the default SMS configuration
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
                        control={smsForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Status
                              </FormLabel>
                              <FormDescription>
                                Enable or disable this SMS configuration
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
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Connection Details</CardTitle>
                    <CardDescription>
                      Configure the connection details for the selected SMS provider
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={smsForm.control}
                      name="accountSid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {selectedSmsProvider === "twilio" ? "Account SID" : 
                             selectedSmsProvider === "vonage" ? "API Key" : 
                             selectedSmsProvider === "plivo" ? "Auth ID" : 
                             "Account ID"}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={selectedSmsProvider === "twilio" ? "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : 
                                          selectedSmsProvider === "vonage" ? "xxxxxxxx" : 
                                          selectedSmsProvider === "plivo" ? "MAxxxxxxxxxxxxxxxxxxxxxxxx" : 
                                          "Account identifier"}
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {selectedSmsProvider === "twilio" ? "Your Twilio Account SID" : 
                             selectedSmsProvider === "vonage" ? "Your Vonage API Key" : 
                             selectedSmsProvider === "plivo" ? "Your Plivo Auth ID" : 
                             "Your account identifier"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smsForm.control}
                      name="authToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {selectedSmsProvider === "twilio" ? "Auth Token" : 
                             selectedSmsProvider === "vonage" ? "API Secret" : 
                             selectedSmsProvider === "plivo" ? "Auth Token" : 
                             "Auth Token"}
                          </FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Input 
                                type="password" 
                                placeholder="••••••••••••••••••••••••••••••" 
                                {...field} 
                                className="flex-grow"
                              />
                              <Button 
                                type="button" 
                                variant="outline"
                                className="ml-2"
                                onClick={() => {
                                  /* Toggle password visibility */
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {selectedSmsProvider === "twilio" ? "Your Twilio Auth Token" : 
                             selectedSmsProvider === "vonage" ? "Your Vonage API Secret" : 
                             selectedSmsProvider === "plivo" ? "Your Plivo Auth Token" : 
                             "Your authentication token"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smsForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="+12345678901" {...field || ""} />
                          </FormControl>
                          <FormDescription>
                            Default sender phone number in E.164 format
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {selectedSmsProvider === "twilio" && (
                      <Alert>
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Setting up Twilio</AlertTitle>
                        <AlertDescription>
                          You need a Twilio account with SMS capabilities.
                          <Button variant="link" size="sm" className="pl-1 h-auto" asChild>
                            <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer">
                              Go to Twilio Console
                            </a>
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {selectedSmsProvider === "vonage" && (
                      <Alert>
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Setting up Vonage</AlertTitle>
                        <AlertDescription>
                          You need a Vonage account with SMS capabilities.
                          <Button variant="link" size="sm" className="pl-1 h-auto" asChild>
                            <a href="https://dashboard.nexmo.com/" target="_blank" rel="noopener noreferrer">
                              Go to Vonage Dashboard
                            </a>
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {selectedSmsProvider === "plivo" && (
                      <Alert>
                        <InfoIcon className="h-4 w-4" />
                        <AlertTitle>Setting up Plivo</AlertTitle>
                        <AlertDescription>
                          You need a Plivo account with SMS capabilities.
                          <Button variant="link" size="sm" className="pl-1 h-auto" asChild>
                            <a href="https://console.plivo.com/" target="_blank" rel="noopener noreferrer">
                              Go to Plivo Console
                            </a>
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <FormField
                      control={smsForm.control}
                      name="connectionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min={5}
                              max={300}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum time to wait for a connection (5-300 seconds)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Settings</CardTitle>
                    <CardDescription>
                      Optional advanced configuration options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={smsForm.control}
                        name="advanced.maxSendAttempts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Send Attempts</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min={1}
                                max={10}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum number of retry attempts (1-10)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={smsForm.control}
                        name="advanced.sendRetryInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Retry Interval (seconds)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min={5}
                                max={300}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Time to wait between retry attempts (5-300 seconds)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Test Connection</CardTitle>
                    <CardDescription>
                      Verify your SMS configuration by sending a test message
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...testMessageForm}>
                      <form onSubmit={testMessageForm.handleSubmit(handleSendTestMessage)} className="space-y-4">
                        <FormField
                          control={testMessageForm.control}
                          name="recipient"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Recipient Phone Number</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="+12345678901"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Phone number in E.164 format (+12345678901)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={testMessageForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="This is a test SMS from NexusMCP."
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Test SMS content
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                          <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={handleTestConnection}
                            disabled={testingStatus === "testing"}
                          >
                            {testingStatus === "testing" ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Test Connection
                              </>
                            )}
                          </Button>
                          
                          <Button 
                            type="submit" 
                            variant="secondary"
                            disabled={testingStatus === "testing"}
                          >
                            <SendIcon className="h-4 w-4 mr-2" />
                            Send Test SMS
                          </Button>
                        </div>
                        
                        {testingStatus === "success" && (
                          <CustomAlert variant="success" className="mt-4">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Connection successful</AlertTitle>
                            <AlertDescription>
                              Successfully connected to the SMS provider.
                            </AlertDescription>
                          </CustomAlert>
                        )}
                        
                        {testingStatus === "error" && (
                          <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Connection failed</AlertTitle>
                            <AlertDescription>
                              Could not connect to the SMS provider. Please check your configuration.
                            </AlertDescription>
                          </Alert>
                        )}
                      </form>
                    </Form>
                  </CardContent>
                </Card>
                
                <div className="flex justify-between">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      smsForm.reset();
                      setActiveTab("overview");
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="space-x-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => smsForm.reset()}
                    >
                      Reset
                    </Button>
                    <Button type="submit">
                      {selectedConfigId ? "Update" : "Save"} Configuration
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </TabsContent>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {selectedTemplateId ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Edit Message Template</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTemplateId(null)}
                >
                  Back to Templates
                </Button>
              </div>
              
              <Form {...templateForm}>
                <form onSubmit={templateForm.handleSubmit(handleSubmitTemplate)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Template Information</CardTitle>
                      <CardDescription>
                        Configure the message template details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={templateForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="System Alert Template" {...field} />
                              </FormControl>
                              <FormDescription>
                                A descriptive name for this template
                              </FormDescription>
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
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="notification">
                                    <div className="flex items-center">
                                      <Bell className="h-4 w-4 mr-2" />
                                      Notification
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="alert">
                                    <div className="flex items-center">
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      Alert
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="report">
                                    <div className="flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      Report
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="welcome">
                                    <div className="flex items-center">
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Welcome
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    <div className="flex items-center">
                                      <Settings className="h-4 w-4 mr-2" />
                                      Custom
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                The type of message template
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={templateForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Template for system alerts and notifications"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              A detailed description of this template's purpose
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={templateForm.control}
                          name="platform"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Platform</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select platform" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">
                                    <div className="flex items-center">
                                      <MessageSquare className="h-4 w-4 mr-2" />
                                      All Platforms
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="slack">
                                    <div className="flex items-center">
                                      <MessageSquareDashed className="h-4 w-4 mr-2" />
                                      Slack
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="ms_teams">
                                    <div className="flex items-center">
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Microsoft Teams
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="sms">
                                    <div className="flex items-center">
                                      <Phone className="h-4 w-4 mr-2" />
                                      SMS
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="webhook">
                                    <div className="flex items-center">
                                      <GlobeIcon className="h-4 w-4 mr-2" />
                                      Webhook
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Target platform for this template
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={templateForm.control}
                          name="format"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Format</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select format" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="markdown">
                                    <div className="flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      Markdown
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="plain">
                                    <div className="flex items-center">
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Plain Text
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="json">
                                    <div className="flex items-center">
                                      <Code className="h-4 w-4 mr-2" />
                                      JSON
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Content format for this template
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Template Content</CardTitle>
                      <CardDescription>
                        Define the content of the message template
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={templateForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder={
                                  field.value === "markdown" ? 
                                    "# Title\n\n**Bold text** and *italic text*\n\n- List item 1\n- List item 2" : 
                                  field.value === "plain" ? 
                                    "Simple text message with {{variable}} placeholders" : 
                                    '{"blocks":[{"type":"section","text":{"type":"mrkdwn","text":"*Bold* and _italic_ with {{variable}}."}}]}'
                                }
                                className="min-h-[200px] font-mono"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Template content with variable placeholders (use {{variable_name}} syntax)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label>Template Variables</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentVars = templateForm.getValues("variables") || [];
                              templateForm.setValue("variables", [
                                ...currentVars, 
                                { key: "", description: "" }
                              ]);
                            }}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Variable
                          </Button>
                        </div>
                        
                        {/* Display variable fields */}
                        {templateForm.watch("variables")?.map((_, index) => (
                          <div key={index} className="grid grid-cols-5 gap-4">
                            <div className="col-span-2">
                              <Label>Variable Name</Label>
                              <Input
                                placeholder="name"
                                value={templateForm.watch(`variables.${index}.key`)}
                                onChange={(e) => {
                                  const vars = [...templateForm.getValues("variables") || []];
                                  vars[index].key = e.target.value;
                                  templateForm.setValue("variables", vars);
                                }}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label>Description</Label>
                              <Input
                                placeholder="User's name"
                                value={templateForm.watch(`variables.${index}.description`)}
                                onChange={(e) => {
                                  const vars = [...templateForm.getValues("variables") || []];
                                  vars[index].description = e.target.value;
                                  templateForm.setValue("variables", vars);
                                }}
                              />
                            </div>
                            <div className="col-span-1 flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const vars = [...templateForm.getValues("variables") || []];
                                  vars.splice(index, 1);
                                  templateForm.setValue("variables", vars);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-between">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        templateForm.reset();
                        setSelectedTemplateId(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <div className="space-x-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => templateForm.reset()}
                      >
                        Reset
                      </Button>
                      <Button type="submit">
                        {selectedTemplateId ? "Update" : "Save"} Template
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Message Templates</h3>
                <div className="flex gap-2">
                  <div className="relative max-w-[250px]">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search templates..." 
                      className="pl-8 max-w-[250px]"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      setSelectedTemplateId(null);
                      templateForm.reset();
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </div>
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            {template.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {template.type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {getPlatformIcon(template.platform)}
                              <span className="ml-2">{getPlatformName(template.platform)}</span>
                            </div>
                          </TableCell>
                          <TableCell>{template.description}</TableCell>
                          <TableCell>
                            {new Date(template.lastUpdated).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => loadTemplate(template.id)}
                                title="Edit"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  // Copy to clipboard functionality
                                  navigator.clipboard.writeText(template.content);
                                  toast({
                                    title: "Template copied",
                                    description: "Template content copied to clipboard",
                                  });
                                }}
                                title="Copy"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => deleteTemplate(template.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        
        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Message Delivery Logs</h3>
            <div className="flex gap-2">
              <div className="relative max-w-[250px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-8 max-w-[250px]"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Message ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockMessageLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.sentAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.recipient}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getPlatformIcon(log.platform)}
                          <span className="ml-2">{getPlatformName(log.platform)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={log.content}>
                        {log.content}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            log.status === "delivered" ? "default" : 
                            log.status === "failed" ? "destructive" : 
                            log.status === "pending" ? "outline" : 
                            log.status === "delayed" ? "secondary" : 
                            log.status === "bounced" ? "destructive" : 
                            "default"
                          } 
                          className={`capitalize ${log.status === "delivered" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900" : ""}`}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.template}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.messageId || 
                          <Badge variant="outline" className="text-xs">
                            {log.failureReason || "N/A"}
                          </Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {mockMessageLogs.length} of {mockMessageLogs.length} messages
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={true}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={true}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}