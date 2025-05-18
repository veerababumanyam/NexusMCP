import { createContext, ReactNode, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { 
  User, 
  InsertUser, 
  LocalLoginCredentials,
  MfaVerification,
  AuthProvider as IdentityProvider
} from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Type for MFA verification state
type MfaVerificationState = {
  required: boolean;
  userId?: number;
  preferredMethod?: string;
};

// Extended auth context with MFA and SSO support
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  
  // Authentication mutations
  loginMutation: UseMutationResult<any, Error, LocalLoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  
  // MFA handling
  mfaState: MfaVerificationState;
  verifyMfaMutation: UseMutationResult<any, Error, MfaVerification>;
  
  // SSO handling
  authProviders: IdentityProvider[];
  loadingProviders: boolean;
  
  // Permissions and roles
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  
  // Helper methods
  initiateOAuthLogin: (providerId: number) => void;
  generateMfaRecoveryCodesMutation: UseMutationResult<string[], Error, void>;
  
  // Check if user is authenticated
  isAuthenticated: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // MFA state management
  const [mfaState, setMfaState] = useState<MfaVerificationState>({
    required: false
  });
  
  // Fetch current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        // Try the new endpoint first
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          // Handle both response formats: { user: {...} } or directly {...}
          return data.user || data;
        }
        
        // Fall back to the old endpoint
        const fallbackRes = await fetch("/api/user");
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return data;
        }
        
        if (res.status === 401 || fallbackRes.status === 401) {
          return null;
        }
        
        throw new Error("Failed to fetch user data");
      } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Fetch user permissions if needed
  const {
    data: userPermissions,
  } = useQuery<string[]>({
    queryKey: ["/api/auth/permissions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user, // Only fetch if user is logged in
  });
  
  // Fetch user roles if needed
  const {
    data: userRoles,
  } = useQuery<any[]>({
    queryKey: ["/api/auth/roles"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user, // Only fetch if user is logged in
  });
  
  // Fetch available auth providers
  const {
    data: authProviders = [],
    isLoading: loadingProviders,
  } = useQuery<IdentityProvider[]>({
    queryKey: ["/api/auth/providers"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: true, // Always fetch providers so they can be shown on the login page
  });
  
  // Login mutation with MFA support
  const loginMutation = useMutation({
    mutationFn: async (credentials: LocalLoginCredentials) => {
      const res = await apiRequest("POST", "/api/auth/local", credentials);
      return await res.json();
    },
    onSuccess: (data) => {
      // Check if MFA is required
      if (data.mfaRequired) {
        setMfaState({
          required: true,
          userId: data.userId,
          preferredMethod: data.preferredMethod
        });
        
        toast({
          title: "MFA Verification Required",
          description: "Please complete the multi-factor authentication to continue.",
        });
        
        return;
      }
      
      // Normal login success - handle both response formats
      const userData = data.user || data;
      queryClient.setQueryData(["/api/auth/me"], userData);
      setMfaState({ required: false });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username || 'user'}!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });
  
  // MFA verification mutation
  const verifyMfaMutation = useMutation({
    mutationFn: async (verificationData: MfaVerification) => {
      const res = await apiRequest("POST", "/api/auth/mfa/verify", verificationData);
      return await res.json();
    },
    onSuccess: (data) => {
      // MFA verification succeeded, user is logged in
      queryClient.setQueryData(["/api/auth/me"], data.user);
      setMfaState({ required: false });
      
      toast({
        title: "Verification successful",
        description: "You have been authenticated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });
  
  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });
  
  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      setMfaState({ required: false });
      
      // Invalidate all queries to force refetch
      queryClient.invalidateQueries();
      
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Generate MFA recovery codes
  const generateMfaRecoveryCodesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mfa/recovery-codes/generate");
      const data = await res.json();
      return data.recoveryCodes;
    },
    onSuccess: (recoveryCodes) => {
      toast({
        title: "Recovery codes generated",
        description: "Keep these codes in a safe place. You'll need them if you lose access to your authenticator.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate recovery codes",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Helper for OAuth login
  const initiateOAuthLogin = (providerId: number) => {
    // Redirect to the OAuth flow
    const redirectUri = window.location.origin + '/auth/callback';
    window.location.href = `/api/auth/oauth/${providerId}?redirectUri=${encodeURIComponent(redirectUri)}`;
  };
  
  // Permission check
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // For now, let's consider this a development mode where all authenticated users have all permissions
    // When implementing a proper RBAC system, this should check real permissions
    const permissions = userPermissions || [];
    
    if (permissions.length > 0) {
      // Direct match
      if (permissions.includes(permission)) return true;
      
      // Wildcard match (e.g., "servers:*" should grant "servers:view")
      const permissionNamespace = permission.split(':')[0];
      if (permissions.includes(`${permissionNamespace}:*`)) return true;
      
      // Global wildcard
      if (permissions.includes('*')) return true;
      
      // No matching permission found in the list
      return false;
    }
    
    // During development, before RBAC is fully implemented, assume all users have permissions
    // This should be removed in production
    return true;
  };
  
  // Role check
  const hasRole = (role: string): boolean => {
    if (!user) return false;
    
    // Use roles from API response if available
    const roles = userRoles || [];
    
    if (roles.length > 0) {
      // Check if user has the specific role or admin role
      return roles.some(r => 
        r.name === role || 
        r.name === 'admin'
      );
    }
    
    // During development, before RBAC is fully implemented, assume all users have the requested role
    // This should be removed in production
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        mfaState,
        verifyMfaMutation,
        authProviders,
        loadingProviders,
        hasPermission,
        hasRole,
        initiateOAuthLogin,
        generateMfaRecoveryCodesMutation,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
