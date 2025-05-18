import React, { useState } from 'react';
import { useCollaborationSocket } from '../../hooks/useCollaborationSocket';
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { UserStatus } from '@shared/types/collaboration';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { 
  Users,
  User,
  Clock,
  MapPin
} from 'lucide-react';

interface PresenceIndicatorProps {
  workspaceId?: number;
  showMaxUsers?: number;
  compact?: boolean;
}

export function PresenceIndicator({
  workspaceId,
  showMaxUsers = 5,
  compact = false
}: PresenceIndicatorProps) {
  const { user } = useAuth();
  const [showAllUsers, setShowAllUsers] = useState(false);
  
  const {
    isConnected,
    users,
    error
  } = useCollaborationSocket({
    userId: user?.id || 0,
    username: user?.username || 'Anonymous',
    fullName: user?.fullName || undefined,
    avatarUrl: user?.avatarUrl || undefined,
    workspaceId,
    autoReconnect: true
  });
  
  if (!isConnected) {
    return null;
  }
  
  if (error) {
    return (
      <div className="text-red-500 text-sm flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        Connection Error
      </div>
    );
  }
  
  // Remove current user from the list
  const otherUsers = users.filter(u => u.userId !== user?.id);
  
  // Sort users by status: online first, then away, then busy, then offline
  const sortedUsers = [...otherUsers].sort((a, b) => {
    const statusOrder = {
      [UserStatus.ONLINE]: 0,
      [UserStatus.AWAY]: 1,
      [UserStatus.BUSY]: 2,
      [UserStatus.OFFLINE]: 3
    };
    
    return statusOrder[a.status] - statusOrder[b.status];
  });
  
  // Decide how many users to show
  const displayedUsers = showAllUsers 
    ? sortedUsers 
    : sortedUsers.slice(0, showMaxUsers);
    
  const hasMoreUsers = sortedUsers.length > showMaxUsers;
  
  if (displayedUsers.length === 0) {
    return (
      <div className="text-muted-foreground text-sm flex items-center gap-2">
        <Users size={16} />
        <span>No other active users</span>
      </div>
    );
  }
  
  // Count users by status
  const onlineCount = sortedUsers.filter(u => u.status === UserStatus.ONLINE).length;
  const awayCount = sortedUsers.filter(u => u.status === UserStatus.AWAY).length;
  const busyCount = sortedUsers.filter(u => u.status === UserStatus.BUSY).length;
  
  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">
            {sortedUsers.length} {sortedUsers.length === 1 ? 'user' : 'users'} online
          </span>
          
          <div className="flex ml-auto gap-2">
            {onlineCount > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                {onlineCount} online
              </Badge>
            )}
            {awayCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                {awayCount} away
              </Badge>
            )}
            {busyCount > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 hover:bg-red-500/20">
                {busyCount} busy
              </Badge>
            )}
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap gap-1">
        {displayedUsers.map(user => (
          <HoverCard key={user.userId}>
            <HoverCardTrigger asChild>
              <div className="relative cursor-pointer">
                <Avatar className="h-8 w-8 border border-border">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                  ) : (
                    <AvatarFallback>
                      {user.fullName 
                        ? user.fullName.substring(0, 2).toUpperCase() 
                        : user.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span 
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background
                    ${user.status === UserStatus.ONLINE ? 'bg-green-500' : 
                      user.status === UserStatus.AWAY ? 'bg-amber-500' : 
                      user.status === UserStatus.BUSY ? 'bg-red-500' : 'bg-gray-500'}`} 
                />
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" align="start">
              <div className="flex gap-4">
                <Avatar className="h-14 w-14">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                  ) : (
                    <AvatarFallback>
                      {user.fullName 
                        ? user.fullName.substring(0, 2).toUpperCase() 
                        : user.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold">{user.fullName || user.username}</h4>
                  
                  <div className="flex items-center">
                    <User className="mr-1 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{user.username}</span>
                  </div>
                  
                  {user.currentPage && (
                    <div className="flex items-center">
                      <MapPin className="mr-1 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {user.currentPage.startsWith('/') 
                          ? user.currentPage 
                          : `/${user.currentPage}`}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Active {formatDistanceToNow(new Date(user.lastSeen || Date.now()), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ))}
        
        {hasMoreUsers && !showAllUsers && (
          <button 
            onClick={() => setShowAllUsers(true)}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium cursor-pointer hover:bg-muted-foreground/20"
          >
            +{sortedUsers.length - showMaxUsers}
          </button>
        )}
        
        {showAllUsers && hasMoreUsers && (
          <button 
            onClick={() => setShowAllUsers(false)}
            className="text-sm text-primary hover:underline cursor-pointer ml-2"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}