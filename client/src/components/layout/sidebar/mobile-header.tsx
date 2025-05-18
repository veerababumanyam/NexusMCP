import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";

interface MobileHeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export function MobileHeader({ onMenuClick, isSidebarOpen }: MobileHeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border flex items-center justify-between px-4 z-20">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2"
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          onClick={onMenuClick}
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        
        <Link href="/">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-md flex items-center justify-center bg-primary text-primary-foreground font-bold">
              N
            </div>
            <span className="ml-2 font-bold">NexusMCP</span>
          </div>
        </Link>
      </div>
    </div>
  );
}