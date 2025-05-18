import { useMobile } from "@/hooks/use-mobile";
import { navigation, NavGroup, NavItem } from "@/lib/navigation-config";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { HTMLAttributes } from "react";
import { Link, useLocation } from "wouter";

interface SidebarNavigationProps extends HTMLAttributes<HTMLDivElement> {}

export function SidebarNavigation({ className, ...props }: SidebarNavigationProps) {
  const { sidebarState, toggleGroup, setActiveGroup } = useSidebar();
  const isMobile = useMobile();
  
  // TODO: Implement actual permission checks
  // This is a placeholder for the permission system
  const hasPermission = (permission?: string) => {
    // For now, assume the user has all permissions
    return true;
  };
  
  // Filter navigation items based on permissions
  const filteredNavigation = navigation.filter(group => {
    if (group.requiresPermission && !hasPermission(group.requiresPermission)) {
      return false;
    }
    
    // Filter out groups with no visible items
    const hasVisibleItems = group.items.some(item => 
      !item.requiresPermission || hasPermission(item.requiresPermission)
    );
    
    return hasVisibleItems;
  });

  return (
    <div className={cn("py-2 overflow-y-auto flex-1", className)} {...props}>
      {filteredNavigation.map((group) => (
        <NavigationGroup 
          key={group.id} 
          group={group} 
          collapsed={sidebarState.collapsed && !isMobile}
          isExpanded={sidebarState.expandedGroups.includes(group.id)}
          isActive={sidebarState.activeGroup === group.id}
          onToggle={() => toggleGroup(group.id)}
          onSetActive={() => setActiveGroup(group.id)}
        />
      ))}
    </div>
  );
}

interface NavGroupProps {
  group: NavGroup;
  collapsed: boolean;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onSetActive: () => void;
}

function NavigationGroup({ group, collapsed, isExpanded, isActive, onToggle, onSetActive }: NavGroupProps) {
  const [location] = useLocation();
  
  // Check if any item in the group is active
  const hasActiveItem = group.items.some(item => item.href === location);
  
  // If an item is active, ensure group is marked as active and expanded
  if (hasActiveItem && !isActive) {
    onSetActive();
  }
  
  return (
    <div className="mb-2 px-3">
      {/* Group Header */}
      {!collapsed && (
        <div 
          className={cn(
            "flex items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer",
            isActive && "text-foreground"
          )}
          onClick={onToggle}
        >
          <span>{group.title}</span>
          <button className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      )}
      
      {/* Group Items */}
      {(!collapsed && isExpanded || collapsed) && (
        <div className={cn("space-y-1", collapsed && "mt-2")}>
          {group.items.map((item) => (
            <NavigationItem 
              key={item.href} 
              item={item} 
              collapsed={collapsed}
              isActive={location === item.href}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}

function NavigationItem({ item, collapsed, isActive }: NavItemProps) {
  // Filter out items that the user doesn't have permission to see
  if (item.requiresPermission) {
    // TEMP: Skip permission check for now
  }

  const Icon = item.icon;
  
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center py-2 px-3 rounded-md text-sm font-medium cursor-pointer",
          isActive 
            ? "bg-accent text-accent-foreground" 
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? item.title : undefined}
      >
        {Icon && (
          <div className={cn(item.color ? item.color : "", "mr-2")}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        {!collapsed && <span>{item.title}</span>}
      </div>
    </Link>
  );
}