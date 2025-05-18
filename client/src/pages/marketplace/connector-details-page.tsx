import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Shield,
  Star,
  Download,
  Calendar,
  Link as LinkIcon,
  Package,
  Info,
  Terminal,
  Settings,
  FileText,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Tag
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConnectorDetailsPage() {
  const { slug } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch connector details
  const {
    data: connector,
    isLoading: isLoadingConnector,
    error: connectorError
  } = useQuery({
    queryKey: [`/api/marketplace/connectors/${slug}`],
    queryFn: async () => {
      const response = await fetch(`/api/marketplace/connectors/${slug}`);
      if (!response.ok) {
        throw new Error('Failed to fetch connector details');
      }
      return await response.json();
    }
  });
  
  // Check if user has installed this connector
  const {
    data: userInstallations,
    isLoading: isLoadingInstallations
  } = useQuery({
    queryKey: ['/api/marketplace/installations'],
    queryFn: async () => {
      if (!user) return { installations: [] };
      
      const response = await fetch('/api/marketplace/installations');
      if (!response.ok) {
        throw new Error('Failed to fetch installations');
      }
      return await response.json();
    },
    enabled: !!user
  });
  
  // Check if already installed
  const isInstalled = userInstallations?.installations?.some(
    (installation) => installation.connectorId === connector?.id
  );
  
  // Installation mutation
  const installMutation = useMutation({
    mutationFn: async () => {
      if (!connector) return null;
      const res = await apiRequest('POST', `/api/marketplace/connectors/${connector.id}/install`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Connector installed",
        description: `${connector?.name} has been installed successfully.`,
        variant: "default",
      });
      
      // Invalidate installations query
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/installations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Installation failed",
        description: error.message || "Could not install the connector. Please try again.",
        variant: "destructive",
      });
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
  
  // Handle installation
  const handleInstall = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to install connectors",
        variant: "destructive"
      });
      return;
    }
    
    installMutation.mutate();
  };
  
  if (isLoadingConnector) {
    return (
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/marketplace" className="text-sm font-medium text-blue-600 flex items-center hover:underline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Marketplace
          </Link>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/4">
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          
          <div className="md:w-3/4">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2 mb-4" />
            
            <div className="flex space-x-2 mb-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
            
            <Skeleton className="h-24 w-full mb-6" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }
  
  if (connectorError || !connector) {
    return (
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/marketplace" className="text-sm font-medium text-blue-600 flex items-center hover:underline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Marketplace
          </Link>
        </div>
        
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-2xl font-bold mb-2">Connector Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The connector you're looking for could not be found or may have been removed.
            </p>
            <Button asChild>
              <Link href="/marketplace">
                Browse Marketplace
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/marketplace" className="text-sm font-medium text-blue-600 flex items-center hover:underline">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Marketplace
        </Link>
      </div>
      
      {/* Connector Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="md:w-1/4">
          <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
            {connector.iconUrl ? (
              <img 
                src={connector.iconUrl} 
                alt={connector.name} 
                className="w-32 h-32 object-contain" 
              />
            ) : (
              <div className="w-32 h-32 bg-background rounded-full flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">
                  {connector.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="md:w-3/4">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{connector.name}</h1>
            <div className="flex gap-1">
              {connector.isVerified && (
                <Badge variant="outline" className="text-blue-500 bg-blue-50 hover:bg-blue-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
              {connector.isOfficial && (
                <Badge variant="outline" className="text-green-500 bg-green-50 hover:bg-green-100">
                  <Shield className="h-3 w-3 mr-1" />
                  Official
                </Badge>
              )}
            </div>
          </div>
          
          <div className="text-muted-foreground mb-4">
            by <Link href={`/marketplace/publishers/${connector.publisher?.slug}`} className="text-blue-600 hover:underline">
              {connector.publisher?.name}
            </Link>
            {connector.publisher?.isVerified && (
              <CheckCircle className="inline-block h-3 w-3 ml-1 text-blue-500" />
            )}
          </div>
          
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span>{connector.downloadCount} downloads</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{connector.rating}/5 ({connector.reviewCount} reviews)</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {formatDate(connector.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              <span>Version {connector.version}</span>
            </div>
          </div>
          
          <p className="text-base mb-6">
            {connector.description}
          </p>
          
          <Button 
            variant="default" 
            size="lg"
            onClick={handleInstall}
            disabled={isInstalled || installMutation.isPending || isLoadingInstallations}
          >
            {installMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Installing...
              </>
            ) : isInstalled ? (
              "Installed"
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Install Connector
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Connector Tags */}
      {connector.tags && connector.tags.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {connector.tags.map((tag) => (
              <Badge 
                key={tag.id} 
                variant="secondary"
                className="cursor-pointer"
                onClick={() => {
                  window.location.href = `/marketplace?tag=${tag.id}`;
                }}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Connector Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About {connector.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p>{connector.description}</p>
              </div>
              
              {/* Publisher Info */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">About the Publisher</h3>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {connector.publisher?.logoUrl ? (
                      <AvatarImage src={connector.publisher?.logoUrl} alt={connector.publisher?.name} />
                    ) : (
                      <AvatarFallback>{connector.publisher?.name.charAt(0).toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{connector.publisher?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {connector.publisher?.description || "No description available"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Links */}
              {(connector.websiteUrl || connector.repositoryUrl || connector.documentationUrl || connector.supportUrl) && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">Resources</h3>
                  <ul className="space-y-2">
                    {connector.websiteUrl && (
                      <li>
                        <a 
                          href={connector.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Website
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </li>
                    )}
                    {connector.repositoryUrl && (
                      <li>
                        <a 
                          href={connector.repositoryUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Repository
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </li>
                    )}
                    {connector.documentationUrl && (
                      <li>
                        <a 
                          href={connector.documentationUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Documentation
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </li>
                    )}
                    {connector.supportUrl && (
                      <li>
                        <a 
                          href={connector.supportUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <Info className="h-4 w-4 mr-2" />
                          Support
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* License */}
              {connector.licenseName && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">License</h3>
                  <p>
                    {connector.licenseName}
                    {connector.licenseUrl && (
                      <a 
                        href={connector.licenseUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-2"
                      >
                        View License
                        <ExternalLink className="h-3 w-3 ml-1 inline" />
                      </a>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="versions">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                Previous releases and update history for {connector.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connector.versions?.length > 0 ? (
                <div className="space-y-6">
                  {connector.versions.map((version, index) => (
                    <div key={version.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium flex items-center">
                            Version {version.version}
                            {version.isLatest && (
                              <Badge className="ml-2" variant="secondary">Latest</Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Released on {formatDate(version.createdAt)}
                          </p>
                        </div>
                      </div>
                      
                      {version.changelog && (
                        <div className="mt-2 text-sm">
                          <h4 className="font-medium">Changelog:</h4>
                          <p className="whitespace-pre-line">{version.changelog}</p>
                        </div>
                      )}
                      
                      {version.releaseNotes && (
                        <div className="mt-2 text-sm">
                          <h4 className="font-medium">Release Notes:</h4>
                          <p className="whitespace-pre-line">{version.releaseNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No version history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Options</CardTitle>
              <CardDescription>
                Required settings and configuration options for this connector
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connector.configSchema ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <pre className="text-sm overflow-auto">
                      {JSON.stringify(connector.configSchema, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Installation</h3>
                    <p className="text-sm mb-2">
                      This connector can be installed automatically through the marketplace or manually with the following command:
                    </p>
                    <div className="p-3 bg-muted rounded-md font-mono text-sm flex justify-between items-center">
                      <code>npm install {connector.packageName || connector.name.toLowerCase()}</code>
                      <Button variant="ghost" size="sm">
                        <Terminal className="h-4 w-4" />
                        <span className="sr-only">Copy</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-4">
                    This connector doesn't require any specific configuration or the configuration schema is not available.
                  </p>
                  
                  <h3 className="text-lg font-medium mb-2">Installation</h3>
                  <p className="text-sm mb-2">
                    This connector can be installed automatically through the marketplace or manually with the following command:
                  </p>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm flex justify-between items-center">
                    <code>npm install {connector.packageName || connector.name.toLowerCase()}</code>
                    <Button variant="ghost" size="sm">
                      <Terminal className="h-4 w-4" />
                      <span className="sr-only">Copy</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documentation">
          <Card>
            <CardHeader>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                Installation guides and usage documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connector.documentationUrl ? (
                <div className="space-y-4">
                  <p>
                    Detailed documentation for this connector is available on the publisher's website.
                  </p>
                  <Button asChild variant="outline">
                    <a 
                      href={connector.documentationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Full Documentation
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Documentation Not Available</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    The publisher has not provided detailed documentation for this connector yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>User Reviews</CardTitle>
              <CardDescription>
                See what others are saying about this connector
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connector.reviews && connector.reviews.length > 0 ? (
                <div className="space-y-6">
                  {connector.reviews.map(review => (
                    <div key={review.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{review.user?.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{review.user?.username || 'Anonymous'}</h4>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      {review.title && (
                        <h5 className="font-medium mt-2">{review.title}</h5>
                      )}
                      
                      {review.content && (
                        <p className="text-sm mt-1">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Reviews Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Be the first to review this connector and help others make their decision.
                  </p>
                  
                  {user && (
                    <Button className="mt-4" variant="outline">
                      Write a Review
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}