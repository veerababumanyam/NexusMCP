import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Settings,
  MoreVertical,
  Trash,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  ExternalLink,
  Calendar,
  Download,
  LayoutGrid,
  List,
  Loader2
} from 'lucide-react';

export default function MyConnectorsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeWorkspace, setActiveWorkspace] = useState<number | null>(null);
  const [connectorToUninstall, setConnectorToUninstall] = useState<{id: number, name: string} | null>(null);
  
  // Fetch installed connectors
  const {
    data: installationsData,
    isLoading: isLoadingInstallations,
    error: installationsError
  } = useQuery({
    queryKey: ['/api/marketplace/installations', activeWorkspace],
    queryFn: async () => {
      let url = '/api/marketplace/installations';
      if (activeWorkspace) {
        url += `?workspaceId=${activeWorkspace}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch installed connectors');
      }
      return await response.json();
    },
    enabled: !!user
  });
  
  // Fetch user workspaces
  const {
    data: workspaces,
    isLoading: isLoadingWorkspaces
  } = useQuery({
    queryKey: ['/api/workspaces'],
    queryFn: async () => {
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      return await response.json();
    },
    enabled: !!user
  });
  
  // Uninstall mutation
  const uninstallMutation = useMutation({
    mutationFn: async (installationId: number) => {
      const res = await apiRequest('DELETE', `/api/marketplace/installations/${installationId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Connector uninstalled",
        description: "The connector has been successfully uninstalled.",
        variant: "default",
      });
      
      // Invalidate installations query
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/installations'] });
      
      // Reset connector to uninstall
      setConnectorToUninstall(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Uninstallation failed",
        description: error.message || "Could not uninstall the connector. Please try again.",
        variant: "destructive",
      });
      
      // Reset connector to uninstall
      setConnectorToUninstall(null);
    }
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Handle uninstall confirmation
  const confirmUninstall = (installationId: number) => {
    uninstallMutation.mutate(installationId);
  };
  
  // Filter installations to active only
  const installations = installationsData?.installations?.filter(
    (installation: any) => installation.isActive
  ) || [];
  
  // Handle workspace change
  const handleWorkspaceChange = (workspaceId: number | null) => {
    setActiveWorkspace(workspaceId);
  };
  
  if (!user) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-6">
              You must be signed in to view your installed connectors.
            </p>
            <Button asChild>
              <Link href="/auth">
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Installed Connectors</h1>
          <p className="text-muted-foreground">
            Manage your installed connectors and their configurations
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              <Package className="h-4 w-4 mr-2" />
              Browse Marketplace
            </Link>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-2">
                <Settings className="h-4 w-4 mr-2" />
                Workspace
                <span className="sr-only">Select workspace</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleWorkspaceChange(null)}>
                <strong>All Workspaces</strong>
                {!activeWorkspace && <CheckCircle className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              
              {workspaces?.map((workspace: any) => (
                <DropdownMenuItem 
                  key={workspace.id} 
                  onClick={() => handleWorkspaceChange(workspace.id)}
                >
                  {workspace.name}
                  {activeWorkspace === workspace.id && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="sr-only">Grid View</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">List View</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Workspace Title */}
      {activeWorkspace && workspaces && (
        <div className="mb-6">
          <Badge variant="outline" className="text-base font-normal py-1 px-3">
            Showing connectors for: {workspaces.find((w: any) => w.id === activeWorkspace)?.name || 'Selected Workspace'}
          </Badge>
        </div>
      )}
      
      {isLoadingInstallations ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-52">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-6 w-4/5 mb-1" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : installations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Connectors Installed</h2>
            <p className="text-muted-foreground mb-6">
              You haven't installed any connectors yet. Browse the marketplace to find connectors.
            </p>
            <Button asChild>
              <Link href="/marketplace">
                Browse Marketplace
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installations.map((installation: any) => (
            <Card key={installation.id} className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <Avatar className="h-10 w-10">
                    {installation.connector.iconUrl ? (
                      <AvatarImage src={installation.connector.iconUrl} alt={installation.connector.name} />
                    ) : (
                      <AvatarFallback>{installation.connector.name.charAt(0).toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <Badge 
                    variant={installation.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {installation.status === 'active' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        {installation.status.charAt(0).toUpperCase() + installation.status.slice(1)}
                      </>
                    )}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{installation.connector.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {installation.connector.shortDescription || installation.connector.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2 pt-0 flex-grow">
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center mb-1">
                    <Package className="h-3 w-3 mr-2" />
                    Version {installation.version.version}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-2" />
                    Installed {formatDate(installation.installedAt)}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <Link href={`/marketplace/connectors/${installation.connector.slug}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Details
                  </Link>
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        // Navigate to settings page
                        window.location.href = `/marketplace/connectors/${installation.connector.slug}/settings`;
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        // Would check for updates
                        toast({
                          title: "Checking for updates",
                          description: `Checking updates for ${installation.connector.name}...`,
                        });
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check for Updates
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => {
                        setConnectorToUninstall({
                          id: installation.id,
                          name: installation.connector.name
                        });
                      }}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Uninstall
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        // List View
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connector</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installations.map((installation: any) => (
                <TableRow key={installation.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {installation.connector.iconUrl ? (
                          <AvatarImage src={installation.connector.iconUrl} alt={installation.connector.name} />
                        ) : (
                          <AvatarFallback>{installation.connector.name.charAt(0).toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="font-medium">{installation.connector.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-md">
                          {installation.connector.shortDescription || installation.connector.description}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{installation.version.version}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={installation.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {installation.status === 'active' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          {installation.status.charAt(0).toUpperCase() + installation.status.slice(1)}
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(installation.installedAt)}</TableCell>
                  <TableCell>
                    {installation.lastUsedAt ? (
                      formatDate(installation.lastUsedAt)
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        asChild
                      >
                        <Link href={`/marketplace/connectors/${installation.connector.slug}`}>
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Details</span>
                        </Link>
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              // Navigate to settings page
                              window.location.href = `/marketplace/connectors/${installation.connector.slug}/settings`;
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Would check for updates
                              toast({
                                title: "Checking for updates",
                                description: `Checking updates for ${installation.connector.name}...`,
                              });
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Check for Updates
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              setConnectorToUninstall({
                                id: installation.id,
                                name: installation.connector.name
                              });
                            }}
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Uninstall
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Uninstall Confirmation Dialog */}
      <AlertDialog 
        open={!!connectorToUninstall} 
        onOpenChange={(open) => !open && setConnectorToUninstall(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall Connector</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to uninstall <strong>{connectorToUninstall?.name}</strong>? 
              This action cannot be undone and may affect connected systems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => connectorToUninstall && confirmUninstall(connectorToUninstall.id)}
              disabled={uninstallMutation.isPending}
            >
              {uninstallMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uninstalling...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Uninstall
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}