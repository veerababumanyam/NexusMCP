import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface AuthLayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function AuthLayout({ children, requireAuth = true }: AuthLayoutProps) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Handle authentication logic
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated and auth is required
  if (requireAuth && !user) {
    navigate('/auth');
    return null;
  }

  // Redirect to dashboard if already authenticated and on auth page
  if (!requireAuth && user) {
    navigate('/');
    return null;
  }

  return <>{children}</>;
}