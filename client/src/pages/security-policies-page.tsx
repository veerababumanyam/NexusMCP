import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Fingerprint, 
  Key, 
  KeyRound, 
  Loader2, 
  Lock, 
  LockKeyhole, 
  RefreshCw, 
  Save, 
  Shield, 
  ShieldAlert, 
  Timer, 
  User
} from "lucide-react";
import { z } from "zod";

// Security policy interface
interface SecurityPolicy {
  id: number;
  workspaceId: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiryDays: number;
  passwordHistory: number;
  maxLoginAttempts: number;
  loginLockoutMinutes: number;
  mfaRequired: boolean;
  mfaRememberDays: number;
  mfaAllowedMethods: string[];
  sessionTimeoutMinutes: number;
  sessionMaxConcurrent: number;
  forceReauthHighRisk: boolean;
  alertOnLocationChange: boolean;
  alertOnNewDevice: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SecurityPoliciesPage() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1); // Default to first workspace
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch workspaces
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['/api/workspaces'],
    retry: false,
  });

  // Fetch security policy for the selected workspace
  const {
    data,
    isLoading: isLoadingPolicy,
    isError: isErrorPolicy,
    refetch: refetchPolicy,
  } = useQuery({
    queryKey: ['/api/security-policies', { workspaceId: selectedWorkspaceId }],
    enabled: !!selectedWorkspaceId,
    onSuccess: (data) => {
      setPolicy(data);
      setHasChanges(false);
    },
  });

  // Save policy mutation
  const savePolicyMutation = useMutation({
    mutationFn: async (policyData: Partial<SecurityPolicy>) => {
      const response = await fetch('/api/security-policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(policyData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save security policy');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Security policy saved successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/security-policies'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save security policy",
        variant: "destructive",
      });
    },
  });

  // Reset policy mutation
  const resetPolicyMutation = useMutation({
    mutationFn: async (workspaceId: number) => {
      const response = await fetch(`/api/security-policies/${workspaceId}/reset`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset security policy');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Security policy reset to defaults",
      });
      setPolicy(data);
      setHasChanges(false);
      setIsResetting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/security-policies'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset security policy",
        variant: "destructive",
      });
      setIsResetting(false);
    },
  });

  // Handle policy field updates
  const updatePolicy = (field: keyof SecurityPolicy, value: any) => {
    if (policy) {
      setPolicy({ ...policy, [field]: value });
      setHasChanges(true);
    }
  };

  // Handle save policy
  const handleSavePolicy = () => {
    if (policy) {
      savePolicyMutation.mutate(policy);
    }
  };

  // Handle reset policy
  const handleResetPolicy = () => {
    setIsResetting(false);
    if (selectedWorkspaceId) {
      resetPolicyMutation.mutate(selectedWorkspaceId);
    }
  };

  // Calculate password strength based on policy
  const calculatePasswordStrength = (): number => {
    if (!policy) return 0;
    
    let strength = 0;
    
    // Base strength from length
    strength += Math.min(policy.passwordMinLength / 2, 5);
    
    // Additional requirements
    if (policy.passwordRequireUppercase) strength += 1;
    if (policy.passwordRequireLowercase) strength += 1;
    if (policy.passwordRequireNumbers) strength += 1;
    if (policy.passwordRequireSymbols) strength += 2;
    
    return Math.min(strength, 10);
  };

  // Password strength color and text
  const passwordStrength = calculatePasswordStrength();
  const strengthColor = 
    passwordStrength < 4 ? "text-red-500" :
    passwordStrength < 7 ? "text-yellow-500" :
    "text-green-500";
  const strengthText = 
    passwordStrength < 4 ? "Weak" :
    passwordStrength < 7 ? "Moderate" :
    "Strong";

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Security Policies</h1>
          <p className="text-muted-foreground">Configure security requirements and authentication policies</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetchPolicy()} disabled={isLoadingPolicy}>
            {isLoadingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button 
            onClick={handleSavePolicy} 
            disabled={!hasChanges || savePolicyMutation.isPending}
          >
            {savePolicyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Workspace Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Workspace Selection</CardTitle>
          <CardDescription>
            Select which workspace to configure security policies for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="workspace-select" className="min-w-32">Workspace</Label>
            <Select
              disabled={isLoadingWorkspaces || !workspaces?.length}
              value={selectedWorkspaceId.toString()}
              onValueChange={(value) => {
                if (hasChanges) {
                  // Show confirmation before switching
                  if (confirm("You have unsaved changes. Are you sure you want to switch workspaces?")) {
                    setSelectedWorkspaceId(parseInt(value));
                  }
                } else {
                  setSelectedWorkspaceId(parseInt(value));
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[250px]" id="workspace-select">
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces?.map((workspace: any) => (
                  <SelectItem key={workspace.id} value={workspace.id.toString()}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoadingPolicy ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isErrorPolicy ? (
        <div className="py-12 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive opacity-70" />
          <p className="mt-4 text-lg font-medium text-destructive">Error loading security policy</p>
          <Button variant="outline" onClick={() => refetchPolicy()} className="mt-4">
            Try again
          </Button>
        </div>
      ) : !policy ? (
        <div className="py-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <p className="mt-4 text-lg font-medium">No security policy found</p>
          <p className="text-muted-foreground">Create a policy to secure your workspace</p>
        </div>
      ) : (
        <Tabs defaultValue="password" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full sm:w-[600px]">
            <TabsTrigger value="password">
              <KeyRound className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Password</span>
            </TabsTrigger>
            <TabsTrigger value="mfa">
              <Fingerprint className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">MFA</span>
            </TabsTrigger>
            <TabsTrigger value="session">
              <Timer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Session</span>
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
          </TabsList>

          {/* Password Settings Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Key className="h-5 w-5 mr-2" />
                    Password Security
                  </CardTitle>
                  <div className="flex items-center">
                    <span className="mr-2">Strength:</span>
                    <span className={`font-medium ${strengthColor}`}>{strengthText}</span>
                    <div className="w-20 h-2 ml-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          passwordStrength < 4 ? "bg-red-500" : 
                          passwordStrength < 7 ? "bg-yellow-500" : 
                          "bg-green-500"
                        }`} 
                        style={{ width: `${passwordStrength * 10}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <CardDescription>
                  Configure password requirements and expiration settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="password-min-length">Minimum Password Length: {policy.passwordMinLength} characters</Label>
                    </div>
                    <Slider
                      id="password-min-length"
                      defaultValue={[policy.passwordMinLength]}
                      min={6}
                      max={24}
                      step={1}
                      onValueChange={(value) => updatePolicy("passwordMinLength", value[0])}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: 12+ characters for strong security
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="require-uppercase">Require uppercase letters</Label>
                      </div>
                      <Switch
                        id="require-uppercase"
                        checked={policy.passwordRequireUppercase}
                        onCheckedChange={(checked) => updatePolicy("passwordRequireUppercase", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="require-lowercase">Require lowercase letters</Label>
                      </div>
                      <Switch
                        id="require-lowercase"
                        checked={policy.passwordRequireLowercase}
                        onCheckedChange={(checked) => updatePolicy("passwordRequireLowercase", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="require-numbers">Require numbers</Label>
                      </div>
                      <Switch
                        id="require-numbers"
                        checked={policy.passwordRequireNumbers}
                        onCheckedChange={(checked) => updatePolicy("passwordRequireNumbers", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="require-symbols">Require special characters</Label>
                      </div>
                      <Switch
                        id="require-symbols"
                        checked={policy.passwordRequireSymbols}
                        onCheckedChange={(checked) => updatePolicy("passwordRequireSymbols", checked)}
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="password-expiry">Password Expiry</Label>
                        <span className="text-sm text-muted-foreground">{policy.passwordExpiryDays} days</span>
                      </div>
                      <Slider
                        id="password-expiry"
                        defaultValue={[policy.passwordExpiryDays]}
                        min={0}
                        max={365}
                        step={30}
                        onValueChange={(value) => updatePolicy("passwordExpiryDays", value[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {policy.passwordExpiryDays === 0 
                          ? "Passwords never expire" 
                          : `Users will be prompted to change passwords every ${policy.passwordExpiryDays} days`}
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="password-history">Password History</Label>
                        <span className="text-sm text-muted-foreground">{policy.passwordHistory} passwords</span>
                      </div>
                      <Slider
                        id="password-history"
                        defaultValue={[policy.passwordHistory]}
                        min={0}
                        max={24}
                        step={1}
                        onValueChange={(value) => updatePolicy("passwordHistory", value[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {policy.passwordHistory === 0 
                          ? "Password history not enforced" 
                          : `Users cannot reuse their last ${policy.passwordHistory} passwords`}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
                        <span className="text-sm text-muted-foreground">{policy.maxLoginAttempts} attempts</span>
                      </div>
                      <Slider
                        id="max-login-attempts"
                        defaultValue={[policy.maxLoginAttempts]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(value) => updatePolicy("maxLoginAttempts", value[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Account will be locked after {policy.maxLoginAttempts} failed login attempts
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="lockout-duration">Lockout Duration</Label>
                        <span className="text-sm text-muted-foreground">{policy.loginLockoutMinutes} minutes</span>
                      </div>
                      <Slider
                        id="lockout-duration"
                        defaultValue={[policy.loginLockoutMinutes]}
                        min={5}
                        max={60}
                        step={5}
                        onValueChange={(value) => updatePolicy("loginLockoutMinutes", value[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Duration account remains locked after too many failed attempts
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MFA Settings Tab */}
          <TabsContent value="mfa">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Fingerprint className="h-5 w-5 mr-2" />
                  Multi-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Configure MFA requirements and settings for additional security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="require-mfa" className="text-base font-medium">Require MFA for all users</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Force all users to set up multi-factor authentication
                    </p>
                  </div>
                  <Switch
                    id="require-mfa"
                    checked={policy.mfaRequired}
                    onCheckedChange={(checked) => updatePolicy("mfaRequired", checked)}
                  />
                </div>

                <div>
                  <Label>Allowed MFA Methods</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="mfa-totp"
                        checked={policy.mfaAllowedMethods.includes("totp")}
                        onCheckedChange={(checked) => {
                          const methods = checked 
                            ? [...policy.mfaAllowedMethods, "totp"] 
                            : policy.mfaAllowedMethods.filter(m => m !== "totp");
                          updatePolicy("mfaAllowedMethods", methods);
                        }}
                      />
                      <Label htmlFor="mfa-totp">Time-based One-Time Password (TOTP)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="mfa-webauthn"
                        checked={policy.mfaAllowedMethods.includes("webauthn")}
                        onCheckedChange={(checked) => {
                          const methods = checked 
                            ? [...policy.mfaAllowedMethods, "webauthn"] 
                            : policy.mfaAllowedMethods.filter(m => m !== "webauthn");
                          updatePolicy("mfaAllowedMethods", methods);
                        }}
                      />
                      <Label htmlFor="mfa-webauthn">WebAuthn / FIDO2 (Security Keys)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="mfa-sms"
                        checked={policy.mfaAllowedMethods.includes("sms")}
                        onCheckedChange={(checked) => {
                          const methods = checked 
                            ? [...policy.mfaAllowedMethods, "sms"] 
                            : policy.mfaAllowedMethods.filter(m => m !== "sms");
                          updatePolicy("mfaAllowedMethods", methods);
                        }}
                      />
                      <Label htmlFor="mfa-sms">SMS / Text Message</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="mfa-email"
                        checked={policy.mfaAllowedMethods.includes("email")}
                        onCheckedChange={(checked) => {
                          const methods = checked 
                            ? [...policy.mfaAllowedMethods, "email"] 
                            : policy.mfaAllowedMethods.filter(m => m !== "email");
                          updatePolicy("mfaAllowedMethods", methods);
                        }}
                      />
                      <Label htmlFor="mfa-email">Email</Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select which MFA methods are available to users
                  </p>
                </div>

                <Separator className="my-2" />

                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="mfa-remember">MFA Remember Period</Label>
                    <span className="text-sm text-muted-foreground">
                      {policy.mfaRememberDays === 0 ? "Never" : `${policy.mfaRememberDays} days`}
                    </span>
                  </div>
                  <Slider
                    id="mfa-remember"
                    defaultValue={[policy.mfaRememberDays]}
                    min={0}
                    max={90}
                    step={1}
                    onValueChange={(value) => updatePolicy("mfaRememberDays", value[0])}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {policy.mfaRememberDays === 0 
                      ? "MFA will be required on every login" 
                      : `Users won't need to enter MFA again on the same device for ${policy.mfaRememberDays} days`}
                  </p>
                </div>

                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="force-reauth" className="text-base font-medium">
                      Force re-authentication for high-risk actions
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Require MFA confirmation for sensitive operations even within an active session
                    </p>
                  </div>
                  <Switch
                    id="force-reauth"
                    checked={policy.forceReauthHighRisk}
                    onCheckedChange={(checked) => updatePolicy("forceReauthHighRisk", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Session Settings Tab */}
          <TabsContent value="session">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Timer className="h-5 w-5 mr-2" />
                  Session Security
                </CardTitle>
                <CardDescription>
                  Configure session duration and concurrent session limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="session-timeout">Session Timeout</Label>
                    <span className="text-sm text-muted-foreground">
                      {policy.sessionTimeoutMinutes === 0 
                        ? "No timeout" 
                        : policy.sessionTimeoutMinutes < 60 
                          ? `${policy.sessionTimeoutMinutes} minutes` 
                          : `${Math.floor(policy.sessionTimeoutMinutes / 60)} hours ${policy.sessionTimeoutMinutes % 60} minutes`}
                    </span>
                  </div>
                  <Slider
                    id="session-timeout"
                    defaultValue={[policy.sessionTimeoutMinutes]}
                    min={0}
                    max={480}
                    step={15}
                    onValueChange={(value) => updatePolicy("sessionTimeoutMinutes", value[0])}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {policy.sessionTimeoutMinutes === 0 
                      ? "Sessions will not expire due to inactivity (not recommended)" 
                      : `Users will be logged out after ${policy.sessionTimeoutMinutes} minutes of inactivity`}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="max-concurrent">Maximum Concurrent Sessions</Label>
                    <span className="text-sm text-muted-foreground">
                      {policy.sessionMaxConcurrent === 0 ? "Unlimited" : policy.sessionMaxConcurrent}
                    </span>
                  </div>
                  <Slider
                    id="max-concurrent"
                    defaultValue={[policy.sessionMaxConcurrent]}
                    min={0}
                    max={10}
                    step={1}
                    onValueChange={(value) => updatePolicy("sessionMaxConcurrent", value[0])}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {policy.sessionMaxConcurrent === 0 
                      ? "Users can have unlimited concurrent sessions" 
                      : policy.sessionMaxConcurrent === 1 
                        ? "Users can only be logged in on one device at a time" 
                        : `Users can be logged in on up to ${policy.sessionMaxConcurrent} devices simultaneously`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts & Notifications Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Alerts & Notifications
                </CardTitle>
                <CardDescription>
                  Configure security alerts and notifications for suspicious activities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="alert-location" className="text-base font-medium">
                      Alert on unusual location
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Notify users when their account is accessed from a new location
                    </p>
                  </div>
                  <Switch
                    id="alert-location"
                    checked={policy.alertOnLocationChange}
                    onCheckedChange={(checked) => updatePolicy("alertOnLocationChange", checked)}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="alert-device" className="text-base font-medium">
                      Alert on new device
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Notify users when their account is accessed from a new device
                    </p>
                  </div>
                  <Switch
                    id="alert-device"
                    checked={policy.alertOnNewDevice}
                    onCheckedChange={(checked) => updatePolicy("alertOnNewDevice", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setIsResetting(true)}
          disabled={isLoadingPolicy || resetPolicyMutation.isPending}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
        
        {hasChanges && (
          <Button 
            onClick={handleSavePolicy} 
            disabled={savePolicyMutation.isPending}
          >
            {savePolicyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetting} onOpenChange={setIsResetting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Security Policy</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all security settings to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPolicyMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPolicy}
              disabled={resetPolicyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetPolicyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...
                </>
              ) : (
                "Reset Policy"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}