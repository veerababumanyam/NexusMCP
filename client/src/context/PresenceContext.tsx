import React, { createContext, useContext, ReactNode } from 'react';
import { useCollaborationSocket } from '../hooks/useCollaborationSocket';
import { UserPresence, UserStatus } from '@shared/types/collaboration';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface PresenceContextType {
  isConnected: boolean;
  users: UserPresence[];
  error: string | null;
  updatePresence: (update: Partial<UserPresence>) => boolean;
  setStatus: (status: UserStatus) => boolean;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children, workspaceId }: { children: ReactNode, workspaceId?: number }) {
  const { user } = useAuth();
  const [location] = useLocation();
  
  const presenceHook = useCollaborationSocket({
    userId: user?.id || 0,
    username: user?.username || 'Anonymous',
    fullName: user?.fullName || undefined,
    avatarUrl: user?.avatarUrl || undefined,
    workspaceId,
    currentPage: location,
    autoReconnect: true
  });
  
  return (
    <PresenceContext.Provider value={presenceHook}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}