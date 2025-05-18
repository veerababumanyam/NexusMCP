import { Button } from "@/components/ui/button";
import { useSidebar } from "@/lib/sidebar-context";
import { useMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "wouter";

interface SidebarHeaderProps {
  onClose?: () => void;
}

export function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const { sidebarState, toggleSidebar } = useSidebar();
  const isMobile = useMobile();
  
  return (
    <div className="h-14 border-b border-border p-2 flex items-center justify-between">
      <Link href="/">
        <div className={cn(
          "flex items-center",
          sidebarState.collapsed && !isMobile && "justify-center"
        )}>
          <div className="h-8 w-8 rounded-md flex items-center justify-center bg-primary text-primary-foreground font-bold">
            N
          </div>
          
          {/* Only show text when sidebar is expanded or on mobile */}
          {(!sidebarState.collapsed || isMobile) && (
            <span className="ml-2 font-bold">NexusMCP</span>
          )}
        </div>
      </Link>
      
      {/* Only show close button on mobile */}
      {isMobile ? (
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      ) : (
        <Button 
          variant="ghost" 
          size="icon"
          className="hidden md:flex"
          onClick={toggleSidebar}
          aria-label={sidebarState.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarState.collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      )}
    </div>
  );
}