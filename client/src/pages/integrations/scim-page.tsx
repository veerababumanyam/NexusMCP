import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoIcon, Key, Download, Copy, RefreshCw, PlusCircle, Trash2, Users, CogIcon, HistoryIcon } from "lucide-react";
import PageHeader from "@/components/layout/page-header";

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

// Mock data for sync activity
const syncActivityData = [
  { id: 1, timestamp: "2024-05-04T16:45:23Z", type: "User Creation", status: "Success", details: "User john.doe@example.com created" },
  { id: 2, timestamp: "2024-05-04T16:45:20Z", type: "Group Assignment", status: "Success", details: "User john.doe@example.com assigned to Developers" },
  { id: 3, timestamp: "2024-05-04T14:32:10Z", type: "User Update", status: "Success", details: "User sarah.smith@example.com updated" },
  { id: 4, timestamp: "2024-05-03T22:15:45Z", type: "User Deactivation", status: "Success", details: "User michael.brown@example.com deactivated" },
  { id: 5, timestamp: "2024-05-03T18:04:12Z", type: "Group Creation", status: "Success", details: "Group Marketing created" }
];

// Mock data for identity providers
const mockProviders = [
  { id: 1, name: "Okta", protocol: "SCIM 2.0", status: "Active", users: 248 },
  { id: 2, name: "Azure AD", protocol: "SCIM 2.0", status: "Active", users: 156 }
];

export default function ScimPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [enableProvisioning, setEnableProvisioning] = useState(true);
  const [configStatus, setConfigStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  const handleTestConfig = () => {
    setConfigStatus("testing");
    setTimeout(() => {
      setConfigStatus("success");
    }, 2000);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(field);
        setTimeout(() => setCopySuccess(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="SCIM User Provisioning" 
        description="Automate user lifecycle management with System for Cross-domain Identity Management (SCIM 2.0)"
        actions={
          <Button onClick={() => setActiveTab("setup")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add SCIM Provider
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Configuration</TabsTrigger>
          <TabsTrigger value="activity">Sync Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SCIM Providers</CardTitle>
              <CardDescription>
                Connected identity providers using SCIM 2.0 for automated user provisioning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active Users</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {provider.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={provider.status === "Active" ? "default" : "outline"}>
                          {provider.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{provider.users}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab("setup")}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CogIcon className="h-5 w-5" />
                User Provisioning Status
              </CardTitle>
              <CardDescription>
                Current SCIM provisioning status and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">404</div>
                    <p className="text-xs text-muted-foreground mt-1">+12 this week</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SCIM Provisioned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">384</div>
                    <p className="text-xs text-muted-foreground mt-1">95% of total users</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Last Sync</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-md font-bold">4 minutes ago</div>
                    <p className="text-xs text-muted-foreground mt-1">No errors reported</p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6">
                <h3 className="text-md font-semibold mb-3">Recent Activity</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncActivityData.slice(0, 3).map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="text-sm">{formatDate(activity.timestamp)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{activity.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{activity.details}</TableCell>
                        <TableCell>
                          <Badge variant={activity.status === "Success" ? "default" : "destructive"} className="font-normal">
                            {activity.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-2">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("activity")}>
                    View All Activity
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                SCIM 2.0 Configuration
              </CardTitle>
              <CardDescription>
                Configure automated user provisioning with SCIM 2.0
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="enable-provisioning" 
                  checked={enableProvisioning}
                  onCheckedChange={setEnableProvisioning}
                />
                <Label htmlFor="enable-provisioning" className="font-medium">Enable SCIM User Provisioning</Label>
              </div>
              
              {enableProvisioning && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-md font-medium">SCIM 2.0 Provider Settings</h3>
                    <p className="text-sm text-muted-foreground">Choose your identity provider and enter the required details</p>
                    
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label htmlFor="scim-provider">Identity Provider</Label>
                        <Select defaultValue="azure">
                          <SelectTrigger id="scim-provider" className="w-full">
                            <SelectValue placeholder="Select identity provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="azure">Microsoft Azure AD</SelectItem>
                            <SelectItem value="okta">Okta</SelectItem>
                            <SelectItem value="onelogin">OneLogin</SelectItem>
                            <SelectItem value="ping">Ping Identity</SelectItem>
                            <SelectItem value="gsuite">Google Workspace</SelectItem>
                            <SelectItem value="other">Other SCIM 2.0 Provider</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="scim-display-name">Provider Display Name</Label>
                        <Input id="scim-display-name" placeholder="e.g., Corporate Azure AD" />
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-md font-medium">NexusMCP SCIM Endpoint Information</h3>
                    <p className="text-sm text-muted-foreground">Provide these details to your identity provider</p>
                    
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label htmlFor="scim-base-url">SCIM 2.0 Base URL</Label>
                        <div className="flex mt-1">
                          <Input 
                            id="scim-base-url" 
                            value="https://nexusmcp.example.com/api/scim/v2" 
                            readOnly 
                            className="flex-grow"
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-2" 
                            onClick={() => handleCopy("https://nexusmcp.example.com/api/scim/v2", "url")}
                          >
                            {copySuccess === "url" ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="scim-token">Bearer Token</Label>
                        <div className="flex mt-1">
                          <Input 
                            id="scim-token" 
                            type="password" 
                            value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzY2ltX3Rva2VuIiwiaWF0IjoxNTE2MjM5MDIyfQ.S" 
                            readOnly 
                            className="flex-grow"
                          />
                          <Button variant="outline" size="sm" className="ml-2">
                            Reveal
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-2" 
                            onClick={() => handleCopy("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzY2ltX3Rva2VuIiwiaWF0IjoxNTE2MjM5MDIyfQ.S", "token")}
                          >
                            {copySuccess === "token" ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                        <Button variant="outline" size="sm" className="mt-2">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate New Token
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>SCIM Endpoints Reference</Label>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Resource</TableHead>
                              <TableHead>Endpoint</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Users</TableCell>
                              <TableCell className="font-mono text-sm">/api/scim/v2/Users</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Groups</TableCell>
                              <TableCell className="font-mono text-sm">/api/scim/v2/Groups</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Service Provider Config</TableCell>
                              <TableCell className="font-mono text-sm">/api/scim/v2/ServiceProviderConfig</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Resource Types</TableCell>
                              <TableCell className="font-mono text-sm">/api/scim/v2/ResourceTypes</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Schemas</TableCell>
                              <TableCell className="font-mono text-sm">/api/scim/v2/Schemas</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download SCIM Documentation
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-md font-medium">User Provisioning Options</h3>
                    <div className="space-y-3 mt-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="auto-activate" defaultChecked />
                        <Label htmlFor="auto-activate">Automatically activate provisioned users</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="sync-groups" defaultChecked />
                        <Label htmlFor="sync-groups">Sync group memberships</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="deactivate-deleted" defaultChecked />
                        <Label htmlFor="deactivate-deleted">Deactivate users when removed from IdP</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="sync-profile" defaultChecked />
                        <Label htmlFor="sync-profile">Update user profiles on change</Label>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-md font-medium">Attribute Mapping</h3>
                    <p className="text-sm text-muted-foreground">Map SCIM attributes to user profile fields</p>
                    
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="map-username">Username</Label>
                        <Select defaultValue="userName">
                          <SelectTrigger id="map-username">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="userName">userName</SelectItem>
                            <SelectItem value="emails">emails[type eq "work"].value</SelectItem>
                            <SelectItem value="externalId">externalId</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="map-email">Email</Label>
                        <Select defaultValue="emails">
                          <SelectTrigger id="map-email">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="emails">emails[type eq "work"].value</SelectItem>
                            <SelectItem value="userName">userName</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="map-firstname">First Name</Label>
                        <Select defaultValue="name.givenName">
                          <SelectTrigger id="map-firstname">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name.givenName">name.givenName</SelectItem>
                            <SelectItem value="name.formatted">name.formatted (split)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="map-lastname">Last Name</Label>
                        <Select defaultValue="name.familyName">
                          <SelectTrigger id="map-lastname">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name.familyName">name.familyName</SelectItem>
                            <SelectItem value="name.formatted">name.formatted (split)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Cancel</Button>
              <div className="flex space-x-2">
                <Button variant="secondary" onClick={handleTestConfig} disabled={!enableProvisioning}>
                  {configStatus === "testing" ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : "Test Connection"}
                </Button>
                <Button disabled={!enableProvisioning}>Save Configuration</Button>
              </div>
            </CardFooter>
          </Card>
          
          {configStatus === "success" && (
            <CustomAlert variant="success">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Connection Successful</AlertTitle>
              <AlertDescription>
                SCIM endpoint configuration was validated successfully. Your IdP can now provision users to NexusMCP.
              </AlertDescription>
            </CustomAlert>
          )}
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5" />
                User Provisioning Activity
              </CardTitle>
              <CardDescription>
                Recent SCIM synchronization events and user provisioning activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncActivityData.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="text-sm">{formatDate(activity.timestamp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{activity.type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{activity.details}</TableCell>
                      <TableCell>
                        <Badge variant={activity.status === "Success" ? "default" : "destructive"} className="font-normal">
                          {activity.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <div className="text-sm text-muted-foreground">
                Showing latest 5 provisioning events
              </div>
              <Button variant="outline" size="sm">
                Export Full Log
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}