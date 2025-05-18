import React from 'react';
import { Link } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Connector } from '@shared/schema_marketplace';
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
import { Loader2, Star, Shield, CheckCircle, Download } from 'lucide-react';

interface ConnectorCardProps {
  connector: Connector;
  onInstall?: (connector: Connector) => void;
}

export function ConnectorCard({ connector, onInstall }: ConnectorCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Installation mutation
  const installMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/marketplace/connectors/${connector.id}/install`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connector installed",
        description: `${connector.name} has been installed successfully.`,
        variant: "default",
      });
      
      // Invalidate any relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/installations'] });
      
      // Call the parent's onInstall handler if provided
      if (onInstall) {
        onInstall(connector);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Installation failed",
        description: error.message || "Could not install the connector. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle installation button click
  const handleInstall = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    installMutation.mutate();
  };
  
  // Create a function to get the first letter for the avatar fallback
  const getAvatarFallback = (name: string) => {
    return name.charAt(0).toUpperCase();
  };
  
  return (
    <Card className="h-full flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/marketplace/connectors/${connector.slug}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-2">
            <Avatar className="h-8 w-8">
              {connector.iconUrl ? (
                <AvatarImage src={connector.iconUrl} alt={connector.name} />
              ) : (
                <AvatarFallback>{getAvatarFallback(connector.name)}</AvatarFallback>
              )}
            </Avatar>
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
          <CardTitle className="text-lg line-clamp-1">{connector.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {connector.shortDescription || connector.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-2 pt-0 flex-grow">
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="mr-4 flex items-center">
              <Download className="h-3 w-3 mr-1" />
              {connector.downloadCount}
            </span>
            <span className="flex items-center">
              <Star className="h-3 w-3 mr-1 text-yellow-500" />
              {connector.rating}/5
            </span>
          </div>
          
          <div className="mt-2 flex flex-wrap gap-1">
            {connector.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Link>
      <CardFooter>
        <Button 
          variant="default" 
          size="sm" 
          className="w-full"
          onClick={handleInstall}
          disabled={installMutation.isPending}
        >
          {installMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Install
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}