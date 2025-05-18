import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Wallet, Key, Copy, Eye, EyeOff, KeyRound, Lock, Shield, 
  FileKey, MoreHorizontal, FileLock2, Clock, RefreshCw, Plus, Link, AlertCircle as InfoIcon 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function VaultPage() {
  // Get tab from URL query param if it exists
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['secrets', 'certificates', 'integrations'].includes(tabParam)) {
        return tabParam;
      }
      
      // Check if we were redirected from another page
      const fromParam = params.get('from');
      if (fromParam === 'integrations_secrets') {
        return 'secrets';
      }
    }
    return "secrets";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [redirectSource, setRedirectSource] = useState<string | null>(null);
  
  // Check for redirect source on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    setRedirectSource(fromParam);
    
    // Clear the redirect source after showing briefly
    const timer = setTimeout(() => {
      setRedirectSource(null);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSecretValue, setShowSecretValue] = useState<{[key: string]: boolean}>({});
  
  // Mock query for vault secrets
  const { data: vaultData, isLoading } = useQuery({
    queryKey: ["/api/security/vault"],
    queryFn: async () => {
      // This would fetch from the actual endpoint in a real implementation
      return {
        secrets: [
          {
            id: "api-key-openai",
            name: "OpenAI API Key",
            type: "api-key",
            createdAt: "2023-04-15T10:30:00Z",
            expiresAt: "2024-04-15T10:30:00Z",
            lastAccessed: "2023-05-02T08:45:00Z",
            accessCount: 238,
            tags: ["ai", "production"],
            maskedValue: "sk-*****************************abcd"
          },
          {
            id: "db-credentials",
            name: "Primary Database Credentials",
            type: "credentials",
            createdAt: "2023-03-10T14:22:00Z",
            expiresAt: "2023-09-10T14:22:00Z",
            lastAccessed: "2023-05-02T14:10:00Z",
            accessCount: 546,
            tags: ["database", "production", "critical"],
            maskedValue: "user:********/pass:****************"
          },
          {
            id: "aws-credentials",
            name: "AWS Access Keys",
            type: "cloud-credentials",
            createdAt: "2023-01-20T09:15:00Z",
            expiresAt: "2023-07-20T09:15:00Z",
            lastAccessed: "2023-04-28T16:32:00Z",
            accessCount: 124,
            tags: ["aws", "production", "infrastructure"],
            maskedValue: "AKI**************/******************"
          },
          {
            id: "jwt-signing",
            name: "JWT Signing Key",
            type: "encryption-key",
            createdAt: "2023-02-05T11:45:00Z",
            expiresAt: null,
            lastAccessed: "2023-05-01T22:15:00Z",
            accessCount: 10342,
            tags: ["auth", "production", "critical"],
            maskedValue: "*********************************"
          },
          {
            id: "stripe-webhook-secret",
            name: "Stripe Webhook Secret",
            type: "webhook-secret",
            createdAt: "2023-04-02T15:20:00Z",
            expiresAt: null,
            lastAccessed: "2023-04-25T18:05:00Z",
            accessCount: 32,
            tags: ["payment", "production"],
            maskedValue: "whsec_*************************"
          }
        ],
        certificates: [
          {
            id: "api-server-tls",
            name: "API Server TLS Certificate",
            issuer: "Let's Encrypt",
            issuedAt: "2023-03-01T00:00:00Z",
            expiresAt: "2023-06-01T00:00:00Z",
            domains: ["api.example.com", "api2.example.com"],
            keyType: "RSA 2048",
            status: "active"
          },
          {
            id: "internal-ca",
            name: "Internal Certificate Authority",
            issuer: "Self-signed",
            issuedAt: "2022-12-15T00:00:00Z",
            expiresAt: "2025-12-15T00:00:00Z",
            domains: ["*.internal.example.com"],
            keyType: "RSA 4096",
            status: "active"
          },
          {
            id: "mcp-server-tls",
            name: "MCP Server TLS Certificate",
            issuer: "DigiCert",
            issuedAt: "2023-01-10T00:00:00Z",
            expiresAt: "2023-07-10T00:00:00Z",
            domains: ["mcp.example.com"],
            keyType: "ECDSA P-256",
            status: "expiring-soon"
          }
        ],
        integrations: [
          {
            id: "hashicorp-vault",
            name: "HashiCorp Vault",
            status: "connected",
            syncStatus: "in-sync",
            lastSync: "2023-05-02T14:30:00Z",
            secretsCount: 42,
            endpoint: "https://vault.internal.example.com:8200",
            authMethod: "AppRole"
          },
          {
            id: "aws-secrets-manager",
            name: "AWS Secrets Manager",
            status: "connected",
            syncStatus: "in-sync",
            lastSync: "2023-05-02T14:00:00Z",
            secretsCount: 18,
            endpoint: "us-east-1",
            authMethod: "IAM Role"
          },
          {
            id: "azure-key-vault",
            name: "Azure Key Vault",
            status: "disconnected",
            syncStatus: "not-syncing",
            lastSync: "2023-04-15T10:25:00Z",
            secretsCount: 0,
            endpoint: "https://example-keyvault.vault.azure.net/",
            authMethod: "Service Principal"
          }
        ],
      };
    }
  });
  
  // Filter secrets by search query
  const getFilteredItems = (list: any[]) => {
    if (!list) return [];
    if (!searchQuery) return list;
    
    return list.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags && item.tags.some((tag: string) => 
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      ))
    );
  };
  
  const toggleSecretVisibility = (id: string) => {
    setShowSecretValue(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const filteredSecrets = vaultData?.secrets ? getFilteredItems(vaultData.secrets) : [];
  const filteredCertificates = vaultData?.certificates ? getFilteredItems(vaultData.certificates) : [];
  const filteredIntegrations = vaultData?.integrations ? getFilteredItems(vaultData.integrations) : [];
  
  const getExpiryBadge = (expiresAt: string | null) => {
    if (!expiresAt) return <Badge variant="outline">Never Expires</Badge>;
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntilExpiry < 30) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Expires in {daysUntilExpiry} days</Badge>;
    } else {
      return <Badge variant="outline">Expires in {daysUntilExpiry} days</Badge>;
    }
  };
  
  const getCertStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case "expiring-soon":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Expiring Soon</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getIntegrationStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>;
      case "disconnected":
        return <Badge variant="secondary">Disconnected</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Vault</h1>
          <p className="text-muted-foreground mt-1">
            Manage and secure sensitive credentials, certificates, and encryption keys
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Input
              placeholder="Search vault..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Secret
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Secret</DialogTitle>
                <DialogDescription>
                  Create a new secure secret in the vault.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Secret Name</label>
                  <Input id="name" placeholder="e.g., API Key, Database Credentials" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="type" className="text-sm font-medium">Secret Type</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select secret type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api-key">API Key</SelectItem>
                      <SelectItem value="credentials">Credentials</SelectItem>
                      <SelectItem value="cloud-credentials">Cloud Credentials</SelectItem>
                      <SelectItem value="encryption-key">Encryption Key</SelectItem>
                      <SelectItem value="webhook-secret">Webhook Secret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="value" className="text-sm font-medium">Secret Value</label>
                  <Input id="value" type="password" placeholder="Enter the secret value" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="expiry" className="text-sm font-medium">Expiry Date</label>
                  <Input id="expiry" type="date" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tags" className="text-sm font-medium">Tags (comma separated)</label>
                  <Input id="tags" placeholder="e.g., production, critical, api" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Add Secret</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {redirectSource && (
        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <InfoIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          <AlertTitle>Redirected to Security Vault</AlertTitle>
          <AlertDescription>
            {redirectSource === 'integrations_secrets' 
              ? 'You were redirected from Integrations Secrets page. The Secrets Management functionality is now consolidated here.'
              : `You were redirected from ${redirectSource}.`}
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6">
        <Shield className="h-4 w-4" />
        <AlertTitle>Vault Security</AlertTitle>
        <AlertDescription>
          All secrets are encrypted at rest using AES-256-GCM and in transit using TLS 1.3. 
          Access is logged and actions are auditable through the activity logs.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="secrets">
            <Key className="h-4 w-4 mr-2" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="certificates">
            <FileKey className="h-4 w-4 mr-2" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Lock className="h-4 w-4 mr-2" />
            Vault Integrations
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="secrets" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Stored Secrets</CardTitle>
              <CardDescription>
                Secure storage for API keys, credentials, and sensitive configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Secret Value</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Last Accessed</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Loading secrets...
                      </TableCell>
                    </TableRow>
                  ) : filteredSecrets.length > 0 ? (
                    filteredSecrets.map((secret) => (
                      <TableRow key={secret.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            {secret.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {secret.type.replace(/-/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                              {showSecretValue[secret.id] ? 
                                "actual-value-would-be-here" : 
                                secret.maskedValue}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleSecretVisibility(secret.id)}
                            >
                              {showSecretValue[secret.id] ? 
                                <EyeOff className="h-3.5 w-3.5" /> : 
                                <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {/* Would copy to clipboard */}}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getExpiryBadge(secret.expiresAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {new Date(secret.lastAccessed).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {secret.accessCount} accesses
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {secret.tags.map((tag: string, index: number) => (
                              <Badge 
                                key={index} 
                                variant="secondary" 
                                className="text-xs py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Rotate
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Clock className="h-4 w-4 mr-2" />
                                Update Expiry
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No secrets found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="certificates" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>TLS Certificates</CardTitle>
              <CardDescription>
                Manage TLS/SSL certificates for secure communication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Domains</TableHead>
                    <TableHead>Key Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Loading certificates...
                      </TableCell>
                    </TableRow>
                  ) : filteredCertificates.length > 0 ? (
                    filteredCertificates.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileLock2 className="h-4 w-4 text-green-500" />
                            {cert.name}
                          </div>
                        </TableCell>
                        <TableCell>{cert.issuer}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate">
                            {cert.domains.join(", ")}
                          </div>
                        </TableCell>
                        <TableCell>{cert.keyType}</TableCell>
                        <TableCell>
                          {getCertStatusBadge(cert.status)}
                        </TableCell>
                        <TableCell>
                          {new Date(cert.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Renew
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No certificates found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="justify-end">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Certificate
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="integrations" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>External Vault Integrations</CardTitle>
              <CardDescription>
                Connect to and sync with external secret management services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                  <p>Loading vault integrations...</p>
                ) : filteredIntegrations.length > 0 ? (
                  filteredIntegrations.map((integration) => (
                    <Card key={integration.id} className="bg-card/50">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          {getIntegrationStatusBadge(integration.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="space-y-3">
                          <div className="text-sm">
                            <div className="font-medium mb-1">Endpoint</div>
                            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs">
                              {integration.endpoint}
                            </code>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium mb-1">Authentication</div>
                            <Badge variant="outline">
                              {integration.authMethod}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Secrets Count</span>
                            <span className="font-medium">{integration.secretsCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Last Sync</span>
                            <span className="font-medium">
                              {integration.status === "connected" ? 
                                new Date(integration.lastSync).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                }) : 
                                "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sync Status</span>
                            <Badge variant={integration.syncStatus === "in-sync" ? "default" : "secondary"}>
                              {integration.syncStatus.replace(/-/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        {integration.status === "connected" ? (
                          <Button size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Now
                          </Button>
                        ) : (
                          <Button size="sm">
                            <Link className="h-4 w-4 mr-2" />
                            Connect
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <p className="col-span-full text-center py-8 text-muted-foreground">
                    No vault integrations found matching your search.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Integration
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}