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
import { InfoIcon, Building2, UserPlus, ShieldCheck, Server, RefreshCw } from "lucide-react";
import PageHeader from "@/components/layout/page-header";

// Add custom variant to Badge
const CustomBadge = ({ variant, children, ...props }: { 
  variant?: "default" | "destructive" | "outline" | "secondary" | "success"; 
  children: React.ReactNode;
  [key: string]: any;
}) => {
  const getVariantClass = () => {
    if (variant === "success") {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800";
    }
    return "";
  };
  
  return (
    <Badge {...props} variant={variant === "success" ? "outline" : variant} className={`${props.className || ""} ${variant === "success" ? getVariantClass() : ""}`}>
      {children}
    </Badge>
  );
};

// Add custom variant to Alert
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

export default function DirectoryServicesPage() {
  const [activeDirectory, setActiveDirectory] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  
  const handleTestConnection = () => {
    // Simulate connection test
    setSyncStatus("syncing");
    setTimeout(() => {
      setSyncStatus("success");
    }, 2000);
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="Directory Services Integration" 
        description="Connect to corporate directory services for user authentication and management."
      />

      <Tabs defaultValue="ldap" className="w-full">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="ldap">LDAP</TabsTrigger>
          <TabsTrigger value="ad">Active Directory</TabsTrigger>
          <TabsTrigger value="settings">Sync Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ldap" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                LDAP Configuration
              </CardTitle>
              <CardDescription>
                Connect to any LDAP v3 compliant directory server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ldap-server">Server URL</Label>
                  <Input id="ldap-server" placeholder="ldap://example.com:389" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-baseDN">Base DN</Label>
                  <Input id="ldap-baseDN" placeholder="dc=example,dc=com" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ldap-bindDN">Bind DN</Label>
                  <Input id="ldap-bindDN" placeholder="cn=admin,dc=example,dc=com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-bindPassword">Bind Password</Label>
                  <Input id="ldap-bindPassword" type="password" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ldap-searchFilter">User Search Filter</Label>
                <Input id="ldap-searchFilter" placeholder="(&(objectClass=person)(uid={0}))" />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="ldap-ssl" />
                <Label htmlFor="ldap-ssl">Use SSL/TLS</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Reset</Button>
              <Button onClick={handleTestConnection}>
                {syncStatus === "syncing" ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : "Test Connection"}
              </Button>
            </CardFooter>
          </Card>
          
          <CustomAlert variant={syncStatus === "success" ? "success" : "default"}>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Connection Status</AlertTitle>
            <AlertDescription>
              {syncStatus === "success" 
                ? "Successfully connected to LDAP server."
                : "Click 'Test Connection' to verify your LDAP configuration."}
            </AlertDescription>
          </CustomAlert>
        </TabsContent>
        
        <TabsContent value="ad" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Active Directory Configuration
                </CardTitle>
                <CustomBadge variant={activeDirectory ? "success" : "outline"}>
                  {activeDirectory ? "Enabled" : "Disabled"}
                </CustomBadge>
              </div>
              <CardDescription>
                Connect to Microsoft Active Directory for enterprise authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ad-domain">Domain</Label>
                  <Input id="ad-domain" placeholder="example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-server">Domain Controller</Label>
                  <Input id="ad-server" placeholder="dc01.example.com" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ad-username">Service Account Username</Label>
                  <Input id="ad-username" placeholder="service_account@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ad-password">Service Account Password</Label>
                  <Input id="ad-password" type="password" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ad-searchBase">Search Base</Label>
                <Input id="ad-searchBase" placeholder="OU=Users,DC=example,DC=com" />
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="ad-enabled" checked={activeDirectory} onCheckedChange={setActiveDirectory} />
                <Label htmlFor="ad-enabled">Enable Active Directory Integration</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Reset</Button>
              <Button onClick={handleTestConnection}>
                {syncStatus === "syncing" ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : "Test Connection"}
              </Button>
            </CardFooter>
          </Card>
          
          <CustomAlert variant={syncStatus === "success" ? "success" : "default"}>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Connection Status</AlertTitle>
            <AlertDescription>
              {syncStatus === "success" 
                ? "Successfully connected to Active Directory."
                : "Click 'Test Connection' to verify your Active Directory configuration."}
            </AlertDescription>
          </CustomAlert>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                User Synchronization Settings
              </CardTitle>
              <CardDescription>
                Configure how users and groups are synchronized from your directory service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sync-schedule">Synchronization Schedule</Label>
                <Select defaultValue="daily">
                  <SelectTrigger id="sync-schedule" className="w-full">
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Synchronization Options</Label>
                <div className="grid gap-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="sync-users" defaultChecked />
                    <Label htmlFor="sync-users">Sync User Accounts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="sync-groups" defaultChecked />
                    <Label htmlFor="sync-groups">Sync Group Memberships</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="sync-attrs" defaultChecked />
                    <Label htmlFor="sync-attrs">Sync User Attributes</Label>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>User Provisioning</Label>
                <div className="grid gap-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-create" defaultChecked />
                    <Label htmlFor="auto-create">Auto-create users on first login</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-disable" defaultChecked />
                    <Label htmlFor="auto-disable">Disable users when removed from directory</Label>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Reset to Defaults</Button>
              <Button>Save Settings</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                SCIM 2.0 Provisioning
              </CardTitle>
              <CardDescription>
                Enable System for Cross-domain Identity Management (SCIM) for automated user provisioning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="scim-enabled" />
                <Label htmlFor="scim-enabled">Enable SCIM Provisioning</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scim-endpoint">SCIM Endpoint</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="scim-endpoint" 
                    value="https://nexusmcp.example.com/scim/v2" 
                    readOnly
                    className="flex-grow"
                  />
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scim-token">Bearer Token</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="scim-token" 
                    type="password" 
                    value="••••••••••••••••" 
                    readOnly
                    className="flex-grow"
                  />
                  <Button variant="outline" size="sm">Reveal</Button>
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
                <p className="text-sm text-muted-foreground">Provide this token to your IdP when configuring SCIM integration</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Reset Token</Button>
              <Button disabled>Generate New Token</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}