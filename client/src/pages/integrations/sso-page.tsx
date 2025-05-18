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
import { InfoIcon, ShieldCheck, Key, FileText, Globe, RefreshCw, PlusCircle, Upload, Download, Trash2 } from "lucide-react";
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

// Mock data for IdP providers
const mockProviders = [
  { id: 1, name: "Azure AD", protocol: "OIDC", status: "Active", users: 248 },
  { id: 2, name: "Okta", protocol: "SAML", status: "Active", users: 156 },
  { id: 3, name: "Google Workspace", protocol: "OIDC", status: "Inactive", users: 0 }
];

export default function SsoPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [configStatus, setConfigStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  
  const handleTestConfig = () => {
    setConfigStatus("testing");
    setTimeout(() => {
      setConfigStatus("success");
    }, 2000);
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        title="Single Sign-On (SSO) Integration" 
        description="Configure enterprise identity providers to enable secure authentication via SAML 2.0 and OpenID Connect (OIDC)."
        actions={
          <Button onClick={() => setActiveTab("setup")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Identity Provider
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
          <TabsTrigger value="oidc">OIDC/OAuth 2.0</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configured Identity Providers</CardTitle>
              <CardDescription>
                Manage your enterprise single sign-on identity providers
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
                        <Badge variant={provider.protocol === "SAML" ? "outline" : "secondary"}>
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
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab(provider.protocol.toLowerCase())}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  SAML 2.0
                </CardTitle>
                <CardDescription>
                  Security Assertion Markup Language
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  SAML 2.0 is an XML-based protocol that uses security tokens to pass user authentication 
                  data between an identity provider and a service provider.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="font-medium">Supported Identity Providers:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>Microsoft AD FS</li>
                      <li>Okta</li>
                      <li>OneLogin</li>
                      <li>Ping Identity</li>
                      <li>Shibboleth</li>
                      <li>Any SAML 2.0 IdP</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Key Benefits:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>Standardized protocol</li>
                      <li>Enhanced security</li>
                      <li>Federation support</li>
                      <li>Reduced password fatigue</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("saml")}>
                  Configure SAML
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  OpenID Connect (OIDC)
                </CardTitle>
                <CardDescription>
                  OAuth 2.0-based authentication protocol
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  OpenID Connect is an identity layer on top of OAuth 2.0 protocol, allowing clients 
                  to verify user identity and obtain basic profile information.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="font-medium">Supported Identity Providers:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>Azure Active Directory</li>
                      <li>Google Workspace</li>
                      <li>Okta</li>
                      <li>Auth0</li>
                      <li>Keycloak</li>
                      <li>Any OIDC provider</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Key Benefits:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>REST/JSON based</li>
                      <li>Mobile-friendly</li>
                      <li>Standardized token format</li>
                      <li>Modern authorization</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("oidc")}>
                  Configure OIDC
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="saml" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                SAML 2.0 Configuration
              </CardTitle>
              <CardDescription>
                Configure SAML-based single sign-on with your identity provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="saml-provider-name">Identity Provider Name</Label>
                  <Input id="saml-provider-name" placeholder="e.g., Okta, ADFS, Corporate IdP" />
                  <p className="text-sm text-muted-foreground mt-1">A descriptive name for this IdP configuration</p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Your Service Provider Configuration</h3>
                  <p className="text-sm text-muted-foreground">Provide these details to your identity provider</p>
                
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                      <Label htmlFor="saml-entity-id">Entity ID / Issuer</Label>
                      <div className="flex mt-1">
                        <Input 
                          id="saml-entity-id" 
                          value="https://nexusmcp.example.com/saml/metadata" 
                          readOnly 
                          className="flex-grow"
                        />
                        <Button variant="outline" size="sm" className="ml-2">Copy</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="saml-acs-url">ACS URL (Assertion Consumer Service)</Label>
                      <div className="flex mt-1">
                        <Input 
                          id="saml-acs-url" 
                          value="https://nexusmcp.example.com/saml/acs" 
                          readOnly 
                          className="flex-grow"
                        />
                        <Button variant="outline" size="sm" className="ml-2">Copy</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="saml-metadata">SAML Metadata URL</Label>
                      <div className="flex mt-1">
                        <Input 
                          id="saml-metadata" 
                          value="https://nexusmcp.example.com/saml/metadata" 
                          readOnly 
                          className="flex-grow"
                        />
                        <Button variant="outline" size="sm" className="ml-2">Copy</Button>
                      </div>
                      <div className="flex mt-2">
                        <Button variant="outline" size="sm" className="mr-2">
                          <Download className="h-4 w-4 mr-2" />
                          Download Metadata
                        </Button>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          View XML
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Identity Provider Details</h3>
                  <p className="text-sm text-muted-foreground">Enter the information provided by your identity provider</p>
                  
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label htmlFor="saml-idp-url">Identity Provider SSO URL</Label>
                      <Input id="saml-idp-url" placeholder="https://idp.example.com/saml/sso" />
                    </div>
                    
                    <div>
                      <Label htmlFor="saml-idp-issuer">Identity Provider Entity ID / Issuer</Label>
                      <Input id="saml-idp-issuer" placeholder="https://idp.example.com/saml/entity" />
                    </div>
                    
                    <div>
                      <Label htmlFor="saml-idp-cert">Identity Provider X.509 Certificate</Label>
                      <Textarea 
                        id="saml-idp-cert" 
                        placeholder="-----BEGIN CERTIFICATE-----&#10;MIICYzCCAcygAwIB...&#10;-----END CERTIFICATE-----" 
                        className="font-mono text-xs h-32"
                      />
                      <div className="flex mt-2">
                        <Button variant="outline" size="sm" className="mr-2">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Certificate
                        </Button>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Paste from Metadata
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Advanced SAML Options</h3>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="saml-sign-requests" />
                      <Label htmlFor="saml-sign-requests">Sign SAML requests</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="saml-encrypt-assertions" />
                      <Label htmlFor="saml-encrypt-assertions">Require encrypted assertions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="saml-force-authn" />
                      <Label htmlFor="saml-force-authn">Force authentication on each login</Label>
                    </div>
                    
                    <div className="space-y-1 mt-2">
                      <Label htmlFor="saml-name-id-format">NameID Format</Label>
                      <Select defaultValue="persistent">
                        <SelectTrigger id="saml-name-id-format" className="w-full">
                          <SelectValue placeholder="Select NameID format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="persistent">urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</SelectItem>
                          <SelectItem value="transient">urn:oasis:names:tc:SAML:2.0:nameid-format:transient</SelectItem>
                          <SelectItem value="email">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</SelectItem>
                          <SelectItem value="unspecified">urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">User Attribute Mapping</h3>
                  <p className="text-sm text-muted-foreground">Map SAML assertion attributes to user profile fields</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-username">Username Attribute</Label>
                      <Input id="saml-attr-username" placeholder="NameID" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-email">Email Attribute</Label>
                      <Input id="saml-attr-email" placeholder="email" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-firstname">First Name Attribute</Label>
                      <Input id="saml-attr-firstname" placeholder="firstName" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-lastname">Last Name Attribute</Label>
                      <Input id="saml-attr-lastname" placeholder="lastName" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-groups">Groups Attribute</Label>
                      <Input id="saml-attr-groups" placeholder="groups" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="saml-attr-roles">Roles Attribute</Label>
                      <Input id="saml-attr-roles" placeholder="roles" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Cancel</Button>
              <div className="flex space-x-2">
                <Button variant="secondary" onClick={handleTestConfig}>
                  {configStatus === "testing" ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : "Test Connection"}
                </Button>
                <Button>Save Configuration</Button>
              </div>
            </CardFooter>
          </Card>
          
          {configStatus === "success" && (
            <CustomAlert variant="success">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Connection Successful</AlertTitle>
              <AlertDescription>
                SAML configuration was validated successfully. Your users can now sign in using this identity provider.
              </AlertDescription>
            </CustomAlert>
          )}
        </TabsContent>
        
        <TabsContent value="oidc" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                OpenID Connect (OIDC) Configuration
              </CardTitle>
              <CardDescription>
                Configure OpenID Connect / OAuth 2.0 based single sign-on with your identity provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="oidc-provider-name">Identity Provider Name</Label>
                  <Input id="oidc-provider-name" placeholder="e.g., Azure AD, Google Workspace, Okta" />
                  <p className="text-sm text-muted-foreground mt-1">A descriptive name for this IdP configuration</p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Your Client Application Configuration</h3>
                  <p className="text-sm text-muted-foreground">Provide these details to your identity provider</p>
                
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <div>
                      <Label htmlFor="oidc-redirect-uri">Redirect URI / Callback URL</Label>
                      <div className="flex mt-1">
                        <Input 
                          id="oidc-redirect-uri" 
                          value="https://nexusmcp.example.com/oidc/callback" 
                          readOnly 
                          className="flex-grow"
                        />
                        <Button variant="outline" size="sm" className="ml-2">Copy</Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Required Scopes</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="secondary">openid</Badge>
                        <Badge variant="secondary">profile</Badge>
                        <Badge variant="secondary">email</Badge>
                        <Badge variant="outline">groups (optional)</Badge>
                        <Badge variant="outline">roles (optional)</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Identity Provider Details</h3>
                  <p className="text-sm text-muted-foreground">Enter the information provided by your OIDC provider</p>
                  
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label htmlFor="oidc-discovery-url">OpenID Connect Discovery URL (optional)</Label>
                      <Input id="oidc-discovery-url" placeholder="https://idp.example.com/.well-known/openid-configuration" />
                      <p className="text-sm text-muted-foreground mt-1">If provided, we'll auto-configure endpoints from discovery document</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="oidc-client-id">Client ID</Label>
                        <Input id="oidc-client-id" placeholder="your-client-id" />
                      </div>
                      <div>
                        <Label htmlFor="oidc-client-secret">Client Secret</Label>
                        <Input id="oidc-client-secret" type="password" placeholder="your-client-secret" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="oidc-auth-url">Authorization Endpoint</Label>
                        <Input id="oidc-auth-url" placeholder="https://idp.example.com/oauth2/authorize" />
                      </div>
                      <div>
                        <Label htmlFor="oidc-token-url">Token Endpoint</Label>
                        <Input id="oidc-token-url" placeholder="https://idp.example.com/oauth2/token" />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="oidc-jwks-url">JWKS URI (for signature verification)</Label>
                      <Input id="oidc-jwks-url" placeholder="https://idp.example.com/.well-known/jwks.json" />
                    </div>
                    
                    <div>
                      <Label htmlFor="oidc-userinfo-url">UserInfo Endpoint (optional)</Label>
                      <Input id="oidc-userinfo-url" placeholder="https://idp.example.com/oauth2/userinfo" />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Authentication Settings</h3>
                  <div className="space-y-3 mt-2">
                    <div className="space-y-1">
                      <Label htmlFor="oidc-response-type">Response Type</Label>
                      <Select defaultValue="code">
                        <SelectTrigger id="oidc-response-type" className="w-full">
                          <SelectValue placeholder="Select response type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="code">Authorization Code (most secure)</SelectItem>
                          <SelectItem value="implicit">Implicit</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="oidc-grant-type">Grant Type</Label>
                      <Select defaultValue="authorization_code">
                        <SelectTrigger id="oidc-grant-type" className="w-full">
                          <SelectValue placeholder="Select grant type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="authorization_code">Authorization Code</SelectItem>
                          <SelectItem value="implicit">Implicit</SelectItem>
                          <SelectItem value="refresh_token">Refresh Token</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch id="oidc-pkce" defaultChecked />
                      <Label htmlFor="oidc-pkce">Enable PKCE (Proof Key for Code Exchange)</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch id="oidc-refresh-tokens" />
                      <Label htmlFor="oidc-refresh-tokens">Use refresh tokens</Label>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-md font-medium">User Claim Mapping</h3>
                  <p className="text-sm text-muted-foreground">Map OIDC token claims to user profile fields</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-sub">User ID Claim</Label>
                      <Input id="oidc-claim-sub" placeholder="sub" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-email">Email Claim</Label>
                      <Input id="oidc-claim-email" placeholder="email" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-name">Full Name Claim</Label>
                      <Input id="oidc-claim-name" placeholder="name" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-preferred-username">Username Claim</Label>
                      <Input id="oidc-claim-preferred-username" placeholder="preferred_username" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-groups">Groups Claim</Label>
                      <Input id="oidc-claim-groups" placeholder="groups" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="oidc-claim-roles">Roles Claim</Label>
                      <Input id="oidc-claim-roles" placeholder="roles" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <Button variant="outline">Cancel</Button>
              <div className="flex space-x-2">
                <Button variant="secondary" onClick={handleTestConfig}>
                  {configStatus === "testing" ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : "Test Connection"}
                </Button>
                <Button>Save Configuration</Button>
              </div>
            </CardFooter>
          </Card>
          
          {configStatus === "success" && (
            <CustomAlert variant="success">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Connection Successful</AlertTitle>
              <AlertDescription>
                OpenID Connect configuration was validated successfully. Your users can now sign in using this identity provider.
              </AlertDescription>
            </CustomAlert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}