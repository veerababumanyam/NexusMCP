import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/sidebar-context";
import { SidebarHeader } from "./sidebar-header";
import { SidebarNavigation } from "./sidebar-navigation";
import { SidebarProfile } from "./sidebar-profile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const { sidebarState } = useSidebar();
  
  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-background border-r border-border",
        sidebarState.collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <SidebarHeader onClose={onClose} />
      
      <ScrollArea className="flex-1">
        <SidebarNavigation />
      </ScrollArea>
      
      <SidebarProfile />
    </div>
  );
}