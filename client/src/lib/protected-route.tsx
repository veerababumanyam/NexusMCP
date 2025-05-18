import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  path: string;
  component?: React.ComponentType<any>;
  requiredPermission?: string;
  requiredRole?: string;
  children?: ReactNode;
}

export function ProtectedRoute({
  path,
  component,
  requiredPermission,
  requiredRole,
  children,
}: ProtectedRouteProps) {
  const { user, isLoading, mfaState, hasPermission, hasRole } = useAuth();

  // Show loading state while authentication check is in progress
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // Redirect to MFA verification if required
  if (mfaState?.required) {
    return (
      <Route path={path}>
        <Redirect to="/auth/mfa" />
      </Route>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check for specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Route path={path}>
        <Redirect to="/forbidden" />
      </Route>
    );
  }

  // Check for specific role if required
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Route path={path}>
        <Redirect to="/forbidden" />
      </Route>
    );
  }

  // User is authenticated and has required permissions
  const ComponentToRender = component;
  
  return (
    <Route path={path}>
      {ComponentToRender ? <ComponentToRender /> : children}
    </Route>
  );
}
