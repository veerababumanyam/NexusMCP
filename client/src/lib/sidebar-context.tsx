import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMobile } from "@/hooks/use-mobile";

interface SidebarState {
  collapsed: boolean;
  expandedGroups: string[];
  activeGroup: string | null;
}

interface SidebarContextType {
  sidebarState: SidebarState;
  toggleSidebar: () => void;
  toggleGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (isOpen: boolean) => void;
}

const defaultState: SidebarState = {
  collapsed: false,
  expandedGroups: ["dashboard"],
  activeGroup: "dashboard",
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SidebarState>(() => {
    // Load state from localStorage if available
    const savedState = localStorage.getItem("nexusmcp-sidebar-state");
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (error) {
        console.error("Failed to parse sidebar state from localStorage:", error);
        return defaultState;
      }
    }
    return defaultState;
  });
  
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useMobile();
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("nexusmcp-sidebar-state", JSON.stringify(state));
  }, [state]);
  
  // Close mobile sidebar when changing from mobile to desktop
  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);
  
  // Function to toggle sidebar collapse state
  const toggleSidebar = () => {
    setState((prev) => ({
      ...prev,
      collapsed: !prev.collapsed,
    }));
  };
  
  // Function to toggle expansion state of a navigation group
  const toggleGroup = (groupId: string) => {
    setState((prev) => {
      const isExpanded = prev.expandedGroups.includes(groupId);
      
      if (isExpanded) {
        // Remove group from expanded groups
        return {
          ...prev,
          expandedGroups: prev.expandedGroups.filter((id) => id !== groupId),
        };
      } else {
        // Add group to expanded groups
        return {
          ...prev,
          expandedGroups: [...prev.expandedGroups, groupId],
        };
      }
    });
  };
  
  // Function to set the active navigation group
  const setActiveGroup = (groupId: string) => {
    setState((prev) => {
      // Only update if the groupId is different
      if (prev.activeGroup === groupId) return prev;
      
      // Check if group is already expanded
      const isExpanded = prev.expandedGroups.includes(groupId);
      
      return {
        ...prev,
        activeGroup: groupId,
        // Also expand the group if it's not already expanded
        expandedGroups: isExpanded ? 
          prev.expandedGroups : 
          [...prev.expandedGroups, groupId],
      };
    });
  };
  
  return (
    <SidebarContext.Provider
      value={{
        sidebarState: state,
        toggleSidebar,
        toggleGroup,
        setActiveGroup,
        isMobileSidebarOpen,
        setMobileSidebarOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  
  return context;
}