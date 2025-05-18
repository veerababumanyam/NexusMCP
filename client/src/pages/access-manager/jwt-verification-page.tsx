import { PageHeader } from "@/components/page-header";
import { TokenVerificationComponent } from "@/components/jwt/token-verification";
import { KeyRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

export default function JwtVerificationPage() {
  return (
    <div className="container py-6">
      <PageHeader
        title="JWT Verification"
        description="Verify JWT tokens and test token validation against your settings"
        icon={KeyRound}
      />

      <div className="grid gap-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Verification Tool</AlertTitle>
          <AlertDescription>
            Use this tool to validate JWT tokens against your configured settings. You can verify
            tokens using the default settings or specify a particular settings ID.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="token-verification" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token-verification">Token Verification</TabsTrigger>
            <TabsTrigger value="guide">Verification Guide</TabsTrigger>
          </TabsList>
          
          <TabsContent value="token-verification" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <TokenVerificationComponent />
              
              <Card>
                <CardHeader>
                  <CardTitle>About JWT Verification</CardTitle>
                  <CardDescription>
                    Understanding JSON Web Token validation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    JWT verification checks the token signature, expiration, and other claims 
                    against your configured settings. Valid tokens pass these checks:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Signature validation</strong> - confirms the token was issued by a trusted source
                    </li>
                    <li>
                      <strong>Expiration check</strong> - ensures the token is still valid
                    </li>
                    <li>
                      <strong>Audience & issuer</strong> - verifies the token is intended for this system
                    </li>
                    <li>
                      <strong>Revocation check</strong> - confirms the token hasn't been revoked
                    </li>
                  </ul>
                  <p>
                    When you specify a Settings ID, the system will use only that configuration for verification.
                    Otherwise, it will try all active settings until it finds a match.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="guide" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>JWT Verification Guide</CardTitle>
                  <CardDescription>
                    How to use the JWT verification tool effectively
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Basic Verification</h3>
                    <p>
                      Enter a complete JWT token in the verification field and click "Verify Token".
                      The system will check the token against your active JWT settings.
                    </p>
                    
                    <h3 className="text-lg font-medium">Specific Settings Verification</h3>
                    <p>
                      To verify against a specific JWT settings configuration, enter the Settings ID.
                      This is useful when you have multiple JWT configurations with different signing keys or algorithms.
                    </p>
                    
                    <h3 className="text-lg font-medium">Audit Trail</h3>
                    <p>
                      Enable "Record Token Usage" to track this verification in your audit logs.
                      This is useful for compliance and security monitoring.
                    </p>
                  </div>
                  
                  <div className="rounded-md bg-amber-50 p-4 dark:bg-amber-900/20">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="ml-2 text-sm font-medium text-amber-800 dark:text-amber-400">Important Note</h3>
                    </div>
                    <div className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                      Token verification is meant for testing purposes and should not be used for 
                      sensitive production tokens. For programmatic verification, use the 
                      <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-800/40">/api/jwt/verification</code> 
                      endpoints directly in your application code.
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Common JWT Verification Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Invalid signature</strong> - The token was signed with a key that doesn't match your settings
                    </li>
                    <li>
                      <strong>Token expired</strong> - The token's expiration time has passed
                    </li>
                    <li>
                      <strong>Incorrect audience</strong> - The token is intended for a different system
                    </li>
                    <li>
                      <strong>Issuer mismatch</strong> - The token was issued by an untrusted source
                    </li>
                    <li>
                      <strong>Token revoked</strong> - The token has been explicitly revoked in the system
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}