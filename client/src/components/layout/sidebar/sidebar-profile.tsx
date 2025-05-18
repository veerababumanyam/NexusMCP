import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/lib/sidebar-context";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Moon,
  Settings,
  Sun,
  SunMoon,
  User,
  Globe,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/language-selector";

export function SidebarProfile() {
  const { sidebarState } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  
  // TODO: Replace with actual user data from authentication
  const user = {
    name: "Admin User",
    email: "admin@nexusmcp.com",
    imageUrl: null, // No image, will use fallback
    role: "Administrator",
  };
  
  return (
    <div className="p-4 border-t border-border mt-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full flex items-center p-2 hover:bg-secondary rounded-lg transition-colors",
              sidebarState.collapsed && "justify-center p-0"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.imageUrl || ""} alt={user.name} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {!sidebarState.collapsed && (
              <div className="ml-3 flex flex-col items-start text-left">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.role}
                </p>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <Link href="/profile">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>{t("profile.title")}</span>
              </DropdownMenuItem>
            </Link>
            
            <Link href="/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t("settings.title")}</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className={cn(theme === "light" && "bg-accent text-accent-foreground")}
            >
              <Sun className="mr-2 h-4 w-4" />
              <span>{t("theme.light")}</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className={cn(theme === "dark" && "bg-accent text-accent-foreground")}
            >
              <Moon className="mr-2 h-4 w-4" />
              <span>{t("theme.dark")}</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className={cn(theme === "system" && "bg-accent text-accent-foreground")}
            >
              <SunMoon className="mr-2 h-4 w-4" />
              <span>{t("theme.system")}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <div className="cursor-default">
                <Globe className="mr-2 h-4 w-4" />
                <span className="mr-2">{t("language.current")}</span>
                <div className="ml-auto">
                  <LanguageSelector variant="subtle" showLabel={true} align="end" />
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          <Link href="/auth">
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("auth.logout")}</span>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}