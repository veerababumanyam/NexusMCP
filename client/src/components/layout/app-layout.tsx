import { ReactNode, useEffect } from "react";
import { useSidebar } from "@/lib/sidebar-context";
import { useMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar/sidebar";
import { MobileHeader } from "./sidebar/mobile-header";
import { AnimatePresence, motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarState, isMobileSidebarOpen, setMobileSidebarOpen } = useSidebar();
  const isMobile = useMobile();
  
  // Close mobile sidebar on location change
  useEffect(() => {
    if (isMobile && isMobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
  }, [location]);
  
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Mobile header - only shown on mobile */}
      {isMobile && (
        <MobileHeader 
          onMenuClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)} 
          isSidebarOpen={isMobileSidebarOpen} 
        />
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {isMobile && isMobileSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
        
        {/* Sidebar - fixed on mobile, part of flex layout on desktop */}
        <AnimatePresence initial={false}>
          {(!isMobile || (isMobile && isMobileSidebarOpen)) && (
            <motion.div
              key="sidebar"
              initial={isMobile ? { x: -320 } : false}
              animate={{ x: 0 }}
              exit={isMobile ? { x: -320 } : false}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                isMobile ? "fixed top-0 bottom-0 left-0 z-40 h-full" : "flex-shrink-0 h-full"
              )}
            >
              <Sidebar 
                onClose={() => setMobileSidebarOpen(false)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Main content */}
        <main 
          className={cn(
            "flex-1 overflow-auto transition-all duration-200 ease-in-out",
            isMobile && "pt-14", // Add padding for mobile header
            !isMobile && !sidebarState.collapsed && "ml-0",
            !isMobile && sidebarState.collapsed && "ml-0"
          )}
        >
          <div className="container mx-auto px-4 py-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}