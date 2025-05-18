import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import { usePresence } from '@/context/PresenceContext';
import { UserStatus } from '@shared/types/collaboration';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Clock, 
  Users, 
  Globe, 
  PanelRight, 
  Activity, 
  Send 
} from 'lucide-react';

export default function CollaborationDemoPage() {
  const [workspaceId, setWorkspaceId] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<string>('/collaboration/demo');
  const [currentView, setCurrentView] = useState<string>('default');
  const [customMetadata, setCustomMetadata] = useState<string>('');
  
  const presence = usePresence();
  
  const handleStatusChange = (status: string) => {
    presence.setStatus(status as UserStatus);
  };
  
  const handleUpdatePresence = () => {
    presence.updatePresence({
      currentPage,
      currentView,
      metadata: customMetadata ? JSON.parse(customMetadata) : undefined
    });
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collaboration Demo</h1>
          <p className="text-muted-foreground">
            Test and visualize real-time presence features
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Users
              </CardTitle>
              <CardDescription>
                Users currently active in this workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PresenceIndicator workspaceId={workspaceId} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Your Status
              </CardTitle>
              <CardDescription>
                Set your status and availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button 
                  variant={presence.users.find(u => u.userId === 1)?.status === UserStatus.ONLINE ? "default" : "outline"}
                  className="flex items-center gap-2 justify-start"
                  onClick={() => handleStatusChange(UserStatus.ONLINE)}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  Online
                </Button>
                
                <Button 
                  variant={presence.users.find(u => u.userId === 1)?.status === UserStatus.AWAY ? "default" : "outline"}
                  className="flex items-center gap-2 justify-start"
                  onClick={() => handleStatusChange(UserStatus.AWAY)}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  Away
                </Button>
                
                <Button 
                  variant={presence.users.find(u => u.userId === 1)?.status === UserStatus.BUSY ? "default" : "outline"}
                  className="flex items-center gap-2 justify-start"
                  onClick={() => handleStatusChange(UserStatus.BUSY)}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  Busy
                </Button>
                
                <Button 
                  variant={presence.users.find(u => u.userId === 1)?.status === UserStatus.OFFLINE ? "default" : "outline"}
                  className="flex items-center gap-2 justify-start"
                  onClick={() => handleStatusChange(UserStatus.OFFLINE)}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-500"></span>
                  Offline
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Connection Status
              </CardTitle>
              <CardDescription>
                Current WebSocket connection status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-3 w-3 rounded-full ${presence.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className="font-medium">
                    {presence.isConnected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                
                {presence.error && (
                  <div className="text-red-500 text-sm mt-2">
                    Error: {presence.error}
                  </div>
                )}
                
                <div className="text-sm text-muted-foreground mt-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      Active users: {presence.users.length}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PanelRight className="h-5 w-5" />
                Update Presence
              </CardTitle>
              <CardDescription>
                Modify your presence information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="location">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="location">Location</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>
                
                <TabsContent value="location" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace">Workspace</Label>
                    <Select 
                      value={workspaceId.toString()} 
                      onValueChange={(value) => setWorkspaceId(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Development</SelectItem>
                        <SelectItem value="2">Production</SelectItem>
                        <SelectItem value="3">Testing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currentPage">Current Page</Label>
                    <Input 
                      id="currentPage"
                      value={currentPage}
                      onChange={(e) => setCurrentPage(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currentView">Current View</Label>
                    <Input 
                      id="currentView"
                      value={currentView}
                      onChange={(e) => setCurrentView(e.target.value)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="metadata" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="metadata">Custom Metadata (JSON)</Label>
                    <textarea 
                      id="metadata"
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder='{"key": "value"}'
                      value={customMetadata}
                      onChange={(e) => setCustomMetadata(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter valid JSON to attach custom metadata to your presence
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <Separator className="my-4" />
              
              <Button 
                className="w-full flex items-center gap-2"
                onClick={handleUpdatePresence}
              >
                <Send className="h-4 w-4" />
                Update Presence
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Information
              </CardTitle>
              <CardDescription>
                Current user presence details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {presence.users.filter(u => u.userId === 1).map(user => (
                  <div key={user.userId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      <span className="text-muted-foreground">{user.status}</span>
                      <span 
                        className={`ml-auto h-2.5 w-2.5 rounded-full 
                          ${user.status === UserStatus.ONLINE ? 'bg-green-500' : 
                            user.status === UserStatus.AWAY ? 'bg-amber-500' : 
                            user.status === UserStatus.BUSY ? 'bg-red-500' : 'bg-gray-500'}`}
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Location:</span>
                      <span className="text-muted-foreground">{user.currentPage}</span>
                    </div>
                    
                    {user.currentView && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">View:</span>
                        <span className="text-muted-foreground">{user.currentView}</span>
                      </div>
                    )}
                    
                    {user.metadata && Object.keys(user.metadata).length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">Metadata:</span>
                        <code className="text-xs bg-muted p-2 rounded-md whitespace-pre-wrap">
                          {JSON.stringify(user.metadata, null, 2)}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
                
                {presence.users.filter(u => u.userId === 1).length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    No information available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}