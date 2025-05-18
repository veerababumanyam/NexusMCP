import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { 
  KeyRound, 
  ShieldCheck, 
  FileText, 
  UserCog, 
  Users, 
  Key, 
  Shield, 
  Lock, 
  FileBarChart,
  Fingerprint,
  ServerCog,
  FileKey
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccessManagerDashboard() {
  return (
    <div className="container py-8 px-4">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Access Manager</h1>
        <p className="text-muted-foreground">
          Enterprise-grade authentication, authorization, and access control
        </p>
      </div>
      
      <Tabs defaultValue="main-features" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="main-features">Main Features</TabsTrigger>
          <TabsTrigger value="enterprise-security">Enterprise Security</TabsTrigger>
        </TabsList>

        <TabsContent value="main-features">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Role Management */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <UserCog className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Role Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Configure role-based access control (RBAC) with fine-grained permissions for enterprise security.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/role-management">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    Manage Roles
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            
            {/* Access Policies */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <FileKey className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Access Policies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Define comprehensive access policies for the OAuth flow and RBAC/ABAC policy engine with fine-grained control.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/permission-sets">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    Manage Policies
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            
            {/* OAuth Clients */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>OAuth Clients</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Manage OAuth 2.1 clients, dynamic client registration, and mTLS certificates for secure API access.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/client-management">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    Manage Clients
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            
            {/* Identity Providers */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Fingerprint className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Identity Providers</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Configure enterprise authentication providers including SAML, OIDC, and LDAP identity provider integration.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/identity-providers">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    Configure Providers
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            
            {/* JWT Settings */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>JWT Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Configure JWT token settings, signing keys, and token validation parameters for secure authentication.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/jwt-settings">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    Configure JWT
                  </Button>
                </Link>
              </CardFooter>
            </Card>
            
            {/* Audit Logs */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Audit Logs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Review comprehensive audit trails with full traceability of access events and compliance reporting.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Link to="/access-manager/audit-logs">
                  <Button className="w-full" type="button" onClick={(e) => e.stopPropagation()}>
                    View Audit Logs
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="enterprise-security">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* API Key Management */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Key className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>API Keys</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Manage long-lived API keys with usage limits, expiration, and scope restrictions for service accounts.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" disabled>
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>
            
            {/* Security Policies */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Security Policies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="min-h-[80px]">
                  Define security policies including password requirements, MFA enforcement, and IP-based access controls.
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" disabled>
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Enterprise Security Features</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">OAuth 2.1 Compliance</h3>
              <p className="text-sm text-muted-foreground">
                Full implementation of OAuth 2.1 with PKCE, token revocation, and self-contained access tokens.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">mTLS Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Mutual TLS certificate-based authentication for high-security client verification.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Fine-Grained RBAC</h3>
              <p className="text-sm text-muted-foreground">
                Hierarchical role-based access with permission inheritance and wildcard support.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <ServerCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Dynamic Registration</h3>
              <p className="text-sm text-muted-foreground">
                Automate client registration with metadata validation per RFC 7591 and registration access tokens.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <FileBarChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Compliance Reporting</h3>
              <p className="text-sm text-muted-foreground">
                Pre-built reports and data exports for SOC 2, GDPR, HIPAA, and custom audit requirements.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Zero Trust Security</h3>
              <p className="text-sm text-muted-foreground">
                Continuous verification, minimal scope privileges, and comprehensive access auditing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}