import { Link, useLocation } from "wouter";
import { UserProfile } from "./user-profile";
import {
  LayoutDashboard,
  Server,
  Drill,
  Users,
  Shield,
  User,
  History,
  BarChart,
  Settings,
  Plug,
  Key,
  Network,
  ShieldCheck,
  LockKeyhole,
  CreditCard,
  AlertTriangle
} from "lucide-react";

interface SidebarNavProps {
  className?: string;
  onNavItemClick?: () => void;
}

export function SidebarNav({ className = "", onNavItemClick }: SidebarNavProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard className="text-lg mr-3" /> },
    { href: "/servers", label: "MCP Servers", icon: <Server className="text-lg mr-3" /> },
    { href: "/tools", label: "Tools", icon: <Drill className="text-lg mr-3" /> },
    { href: "/workspaces", label: "Workspaces", icon: <Users className="text-lg mr-3" /> },
    { href: "/policies", label: "Policy Management", icon: <Shield className="text-lg mr-3" /> },
    { href: "/users", label: "User Management", icon: <User className="text-lg mr-3" /> },
    { href: "/api-keys", label: "API Keys", icon: <Key className="text-lg mr-3" /> },
    { href: "/ip-access-rules", label: "IP Access Rules", icon: <Network className="text-lg mr-3" /> },
    { href: "/ldap-directories", label: "LDAP Directories", icon: <ShieldCheck className="text-lg mr-3" /> },
    { href: "/security-policies", label: "Security Policies", icon: <LockKeyhole className="text-lg mr-3" /> },
    { href: "/audit", label: "Audit Logs", icon: <History className="text-lg mr-3" /> },
    { href: "/analytics", label: "Analytics", icon: <BarChart className="text-lg mr-3" /> },
    { href: "/settings", label: "System Settings", icon: <Settings className="text-lg mr-3" /> },
    { href: "/plugins", label: "Plugins", icon: <Plug className="text-lg mr-3" /> },
    
    // Financial Services section
    { href: "/financial/anomaly-detection-test", label: "Anomaly Detection Test", icon: <AlertTriangle className="text-lg mr-3" /> },
  ];

  return (
    <aside className={`bg-sidebar w-64 flex-shrink-0 overflow-y-auto flex flex-col shadow-md ${className}`}>
      {/* Logo */}
      <div className="px-4 py-6 flex items-center border-b border-sidebar-border">
        <svg className="w-8 h-8 text-sidebar-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="ml-3 text-xl font-semibold text-sidebar-foreground">NexusMCP</span>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavItemClick}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? "text-sidebar-foreground bg-sidebar-accent"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <UserProfile />
    </aside>
  );
}
