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
  InfoIcon, 
  TicketIcon, 
  Key, 
  FileText, 
  RefreshCw, 
  PlusCircle, 
  Trash2, 
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Tag
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

// Validation schema for ticketing system
const ticketingSystemSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  isActive: z.boolean().default(true),
  type: z.enum(["servicenow", "jira", "zendesk", "salesforce", "freshdesk"]),
  config: z.object({
    // Base fields for all integrations
    apiUrl: z.string().url("Must be a valid URL"),
    authType: z.enum(["basic", "oauth", "token"]),
    
    // Conditionally required fields based on type and authType
    username: z.string().optional(),
    password: z.string().optional(),
    apiToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    
    // Optional configuration fields
    project: z.string().optional(),
    domain: z.string().optional(),
    subdomain: z.string().optional(),
    instanceUrl: z.string().optional(),
    customFields: z.record(z.string()).optional()
  })
});

type TicketingSystem = z.infer<typeof ticketingSystemSchema>;

// Create ticket schema
const createTicketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  category: z.string().optional(),
  dueDate: z.string().optional()
});

type CreateTicket = z.infer<typeof createTicketSchema>;

// Mock data for ticketing systems
const mockSystems = [
  { 
    id: 1, 
    name: "Corporate ServiceNow", 
    type: "servicenow", 
    status: "Active", 
    tickets: 124, 
    lastSync: "2025-05-02T10:15:30Z"
  },
  { 
    id: 2, 
    name: "Engineering Jira", 
    type: "jira", 
    status: "Active", 
    tickets: 89, 
    lastSync: "2025-05-03T08:20:15Z"
  },
  { 
    id: 3, 
    name: "Support Zendesk", 
    type: "zendesk", 
    status: "Inactive", 
    tickets: 0, 
    lastSync: null
  }
];

// Mock data for tickets
const mockTickets = [
  {
    id: "INC0012345",
    title: "MCP Server Connection Issue",
    description: "Unable to establish connection to MCP server in US-West region",
    status: "open",
    priority: "high",
    assignee: "John Smith",
    createdAt: "2025-05-01T09:20:15Z",
    updatedAt: "2025-05-03T14:35:10Z"
  },
  {
    id: "INC0012346",
    title: "Dashboard Performance Degradation",
    description: "Users reporting slow load times for analytics dashboard",
    status: "in_progress",
    priority: "medium",
    assignee: "Sarah Johnson",
    createdAt: "2025-05-02T11:45:30Z",
    updatedAt: "2025-05-03T10:15:22Z"
  },
  {
    id: "INC0012350",
    title: "User Authentication Failure",
    description: "Multiple users unable to authenticate after recent deployment",
    status: "open",
    priority: "critical",
    assignee: "Unassigned",
    createdAt: "2025-05-03T08:10:05Z",
    updatedAt: "2025-05-03T08:10:05Z"
  }
];

export default function TicketingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSystem, setActiveSystem] = useState<number | null>(null);
  const [configStatus, setConfigStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const { toast } = useToast();
  
  // Form for creating a new ticketing system
  const systemForm = useForm<TicketingSystem>({
    resolver: zodResolver(ticketingSystemSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      type: "servicenow",
      config: {
        apiUrl: "",
        authType: "basic"
      }
    }
  });
  
  // Form for creating a new ticket
  const ticketForm = useForm<CreateTicket>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium"
    }
  });
  
  // Handler for testing integration connection
  const handleTestConnection = () => {
    setConfigStatus("testing");
    // Simulate API call
    setTimeout(() => {
      // Random success/error for demo purposes
      const result = Math.random() > 0.3 ? "success" : "error";
      setConfigStatus(result);
      
      if (result === "success") {
        toast({
          title: "Connection successful",
          description: "The ticketing system connection was verified successfully.",
          variant: "default",
        });
      } else {
        toast({
          title: "Connection failed",
          description: "Unable to connect to the ticketing system. Please check your configuration.",
          variant: "destructive",
        });
      }
    }, 2000);
  };
  
  // Handler for system form submission
  const handleSubmitSystem = (data: TicketingSystem) => {
    console.log("Submitting system config:", data);
    toast({
      title: "Ticketing system created",
      description: `${data.name} has been successfully configured.`,
      variant: "default",
    });
    // Reset form and go back to overview
    systemForm.reset();
    setActiveTab("overview");
  };
  
  // Handler for ticket form submission
  const handleSubmitTicket = (data: CreateTicket) => {
    console.log("Creating ticket:", data);
    toast({
      title: "Ticket created",
      description: "The ticket has been successfully created and assigned.",
      variant: "default",
    });
    // Reset form and close modal or whatever UI pattern is used
    ticketForm.reset();
  };
  
  const handleSyncTickets = (systemId: number) => {
    console.log(`Syncing tickets for system ID: ${systemId}`);
    toast({
      title: "Sync initiated",
      description: "Synchronizing tickets from the external system...",
      variant: "default",
    });
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Sync completed",
        description: "Successfully synchronized 12 tickets from the external system.",
        variant: "default",
      });
    }, 2000);
  };
  
  // Get the selected provider type from the form
  const selectedProviderType = systemForm.watch("type");
  const selectedAuthType = systemForm.watch("config.authType");
  
  // Function to get provider name from type
  const getProviderName = (type: string) => {
    switch (type) {
      case "servicenow": return "ServiceNow";
      case "jira": return "Jira Service Management";
      case "zendesk": return "Zendesk";
      case "salesforce": return "Salesforce Service Cloud";
      case "freshdesk": return "Freshdesk";
      default: return type;
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="Ticketing Integration" 
        description="Connect to enterprise ITSM systems like ServiceNow, Jira, Zendesk, Salesforce Service Cloud, and Freshdesk."
        actions={
          <Button onClick={() => {
            systemForm.reset();
            setActiveTab("setup");
          }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Ticketing System
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configured Ticketing Systems</CardTitle>
              <CardDescription>
                Manage your enterprise ticketing systems and IT service management integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSystems.map((system) => (
                    <TableRow key={system.id}>
                      <TableCell className="font-medium">{system.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getProviderName(system.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={system.status === "Active" ? "default" : "outline"}>
                          {system.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{system.tickets}</TableCell>
                      <TableCell>
                        {system.lastSync ? new Date(system.lastSync).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setActiveSystem(system.id);
                            setActiveTab("tickets");
                          }}
                        >
                          View Tickets
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSyncTickets(system.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ServiceNow Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5" />
                  ServiceNow
                </CardTitle>
                <CardDescription>
                  Enterprise IT Service Management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Connect to ServiceNow to create, track, and update incidents, problems, and change requests directly.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Automatic incident creation</li>
                    <li>Bi-directional ticket sync</li>
                    <li>Customizable workflows</li>
                    <li>SLA tracking</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  systemForm.reset({
                    ...systemForm.getValues(),
                    type: "servicenow"
                  });
                  setActiveTab("setup");
                }}>
                  Configure ServiceNow
                </Button>
              </CardFooter>
            </Card>

            {/* Jira Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5" />
                  Jira Service Management
                </CardTitle>
                <CardDescription>
                  Team-centric service management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Integrate with Jira Service Management for agile issue tracking and project management capabilities.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Project-based organization</li>
                    <li>Advanced workflow automation</li>
                    <li>Custom field mapping</li>
                    <li>Agile board integration</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  systemForm.reset({
                    ...systemForm.getValues(),
                    type: "jira"
                  });
                  setActiveTab("setup");
                }}>
                  Configure Jira
                </Button>
              </CardFooter>
            </Card>

            {/* Zendesk Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5" />
                  Zendesk
                </CardTitle>
                <CardDescription>
                  Customer service platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Connect to Zendesk to streamline customer support and service desk operations.
                </p>
                <div className="text-sm">
                  <p className="font-medium">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Unified ticket management</li>
                    <li>Knowledge base integration</li>
                    <li>Customer context sharing</li>
                    <li>Automated ticket routing</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => {
                  systemForm.reset({
                    ...systemForm.getValues(),
                    type: "zendesk"
                  });
                  setActiveTab("setup");
                }}>
                  Configure Zendesk
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticketing System Configuration</CardTitle>
              <CardDescription>
                Set up a connection to your enterprise ticketing system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...systemForm}>
                <form onSubmit={systemForm.handleSubmit(handleSubmitSystem)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={systemForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Integration Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Corporate ServiceNow" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this integration
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={systemForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Integration Type</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select ticketing system type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="servicenow">ServiceNow</SelectItem>
                                <SelectItem value="jira">Jira Service Management</SelectItem>
                                <SelectItem value="zendesk">Zendesk</SelectItem>
                                <SelectItem value="salesforce">Salesforce Service Cloud</SelectItem>
                                <SelectItem value="freshdesk">Freshdesk</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The type of ticketing system to connect to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={systemForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the purpose of this integration"
                              className="min-h-[80px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={systemForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active Status</FormLabel>
                            <FormDescription>
                              Enable or disable this integration
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
                  
                  <Separator />
                  
                  {/* Connection Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Connection Configuration</h3>
                    
                    <FormField
                      control={systemForm.control}
                      name="config.apiUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={`e.g. https://${selectedProviderType === 'zendesk' ? 'yourcompany.zendesk.com/api/v2' : 'instance.service-now.com/api'}`}
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            The base URL for the ticketing system's API
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={systemForm.control}
                      name="config.authType"
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
                              <SelectItem value="basic">Basic Authentication</SelectItem>
                              <SelectItem value="oauth">OAuth 2.0</SelectItem>
                              <SelectItem value="token">API Token</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The authentication method to use
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Dynamic fields based on auth type */}
                    {selectedAuthType === "basic" && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={systemForm.control}
                          name="config.username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="API Username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={systemForm.control}
                          name="config.password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="API Password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                    
                    {selectedAuthType === "token" && (
                      <FormField
                        control={systemForm.control}
                        name="config.apiToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Token</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter your API token" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    {selectedAuthType === "oauth" && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={systemForm.control}
                          name="config.clientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client ID</FormLabel>
                              <FormControl>
                                <Input placeholder="OAuth Client ID" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={systemForm.control}
                          name="config.clientSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Secret</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="OAuth Client Secret" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                    
                    {/* Service-specific fields */}
                    {selectedProviderType === "jira" && (
                      <FormField
                        control={systemForm.control}
                        name="config.project"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Project Key</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. SUPPORT, IT, or HELP" {...field} />
                            </FormControl>
                            <FormDescription>
                              The default Jira project key to use for tickets
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    {(selectedProviderType === "zendesk" || selectedProviderType === "freshdesk") && (
                      <FormField
                        control={systemForm.control}
                        name="config.subdomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subdomain</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={`yourcompany${selectedProviderType === 'zendesk' ? '.zendesk.com' : '.freshdesk.com'}`} 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Your {selectedProviderType === 'zendesk' ? 'Zendesk' : 'Freshdesk'} subdomain
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  
                  {/* Test Connection */}
                  <div className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleTestConnection}
                        disabled={configStatus === "testing"}
                      >
                        {configStatus === "testing" ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Test Connection
                          </>
                        )}
                      </Button>
                      
                      {configStatus === "success" && (
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          <span>Connection successful!</span>
                        </div>
                      )}
                      
                      {configStatus === "error" && (
                        <div className="flex items-center text-red-600 dark:text-red-400">
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          <span>Connection failed. Please check your settings.</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Form submission buttons */}
                  <div className="flex justify-end space-x-4 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        systemForm.reset();
                        setActiveTab("overview");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Configuration</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ticket Management</CardTitle>
                <CardDescription>
                  View and manage tickets from your connected systems
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    {mockSystems.map(system => (
                      <SelectItem key={system.id} value={system.id.toString()}>
                        {system.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => console.log("Refresh tickets")}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => console.log("Create ticket")}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Ticket
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Ticket ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-xs">{ticket.id}</TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {ticket.title}
                        <p className="text-xs text-muted-foreground truncate">{ticket.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          ticket.status === "open" 
                            ? "default" 
                            : ticket.status === "in_progress" 
                              ? "secondary" 
                              : "outline"
                        }>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          ticket.priority === "critical" 
                            ? "destructive" 
                            : ticket.priority === "high" 
                              ? "default"
                              : ticket.priority === "medium"
                                ? "secondary"
                                : "outline"
                        }>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{ticket.assignee}</TableCell>
                      <TableCell>{new Date(ticket.updatedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Ticket Creation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Ticket</CardTitle>
              <CardDescription>
                Submit a new ticket to the selected ticketing system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...ticketForm}>
                <form onSubmit={ticketForm.handleSubmit(handleSubmitTicket)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={ticketForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ticket Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter a descriptive title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={ticketForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={ticketForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide details about the issue or request"
                            className="min-h-[120px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={ticketForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ticket category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="incident">Incident</SelectItem>
                              <SelectItem value="service_request">Service Request</SelectItem>
                              <SelectItem value="problem">Problem</SelectItem>
                              <SelectItem value="change_request">Change Request</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={ticketForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-4 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => ticketForm.reset()}
                    >
                      Reset
                    </Button>
                    <Button type="submit">Create Ticket</Button>
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