import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function ForbiddenPage() {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-24 w-24 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You don't have permission to access this resource.
          </p>
          
          {user && (
            <div className="mt-6 text-sm text-muted-foreground">
              Logged in as: <span className="font-medium text-foreground">{user.username}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="default">
            <Link href="/">Go to Dashboard</Link>
          </Button>
          
          <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? "Logging out..." : "Logout and Switch Account"}
          </Button>
        </div>
      </div>
    </div>
  );
}