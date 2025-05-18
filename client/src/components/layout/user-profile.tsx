import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme-provider";
import { Moon, Sun } from "lucide-react";

export function UserProfile() {
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="p-4 border-t border-sidebar-border">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-start p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center w-full">
              <div className="bg-sidebar-accent rounded-full h-10 w-10 flex items-center justify-center text-sidebar-accent-foreground">
                <span className="font-semibold">
                  {user ? getInitials(user.fullName || user.username) : ""}
                </span>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm font-medium text-sidebar-foreground">
                  {user?.fullName || user?.username || "User"}
                </p>
                <p className="text-xs text-sidebar-foreground/70">
                  {/* Use correct property or default to a role */}
                  Admin
                </p>
              </div>
              <div className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground">
                <LogOut className="h-4 w-4" />
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light mode</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark mode</span>
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
