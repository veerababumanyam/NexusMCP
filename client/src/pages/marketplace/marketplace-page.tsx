import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch, useLocation } from 'wouter';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Filter,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/skeleton-card';
import { ConnectorCard } from '@/components/marketplace/connector-card';
import { MarketplaceStats } from '@/components/marketplace/marketplace-stats';
import { ConnectorFilters } from '@/components/marketplace/connector-filters';

export default function MarketplacePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearch();
  const [, navigate] = useLocation();
  
  // Parse search parameters
  const query = new URLSearchParams(searchParams);
  const searchQuery = query.get('q') || '';
  const categoryId = query.get('category') || '';
  const tagId = query.get('tag') || '';
  const publisherId = query.get('publisher') || '';
  const sort = query.get('sort') || 'popularity';
  const page = parseInt(query.get('page') || '1');
  const verified = query.get('verified') === 'true';
  const official = query.get('official') === 'true';
  const featured = query.get('featured') === 'true';
  
  // Local state for search form
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const [selectedSort, setSelectedSort] = useState(sort);
  const [currentPage, setCurrentPage] = useState(page);
  const [isVerifiedFilter, setIsVerifiedFilter] = useState(verified);
  const [isOfficialFilter, setIsOfficialFilter] = useState(official);
  const [isFeaturedFilter, setIsFeaturedFilter] = useState(featured);
  
  // Fetch connectors with search parameters
  const {
    data: connectorsData,
    isLoading: isLoadingConnectors,
    error: connectorsError
  } = useQuery({
    queryKey: ['/api/marketplace/connectors', searchQuery, categoryId, tagId, publisherId, sort, page, verified, official, featured],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (categoryId) params.append('categoryId', categoryId);
      if (tagId) params.append('tagId', tagId);
      if (publisherId) params.append('publisherId', publisherId);
      if (sort) params.append('sort', sort);
      if (page > 1) params.append('page', page.toString());
      if (verified) params.append('verified', 'true');
      if (official) params.append('official', 'true');
      if (featured) params.append('featured', 'true');
      
      const response = await fetch(`/api/marketplace/connectors?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch connectors');
      }
      return await response.json();
    }
  });
  
  // Fetch categories
  const {
    data: categories,
    isLoading: isLoadingCategories
  } = useQuery({
    queryKey: ['/api/marketplace/categories'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return await response.json();
    }
  });
  
  // Fetch marketplace stats
  const {
    data: marketplaceStats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ['/api/marketplace/stats'],
    queryFn: async () => {
      const response = await fetch('/api/marketplace/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace statistics');
      }
      return await response.json();
    }
  });
  
  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update URL parameters
    const params = new URLSearchParams();
    if (searchInput) params.append('q', searchInput);
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedSort) params.append('sort', selectedSort);
    if (isVerifiedFilter) params.append('verified', 'true');
    if (isOfficialFilter) params.append('official', 'true');
    if (isFeaturedFilter) params.append('featured', 'true');
    
    // Reset page to 1 when searching
    setCurrentPage(1);
    
    // Navigate to the new URL
    navigate(`/marketplace?${params.toString()}`);
  };
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    // Update the page in state and URL
    setCurrentPage(newPage);
    
    // Update URL with the new page
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    navigate(`/marketplace?${params.toString()}`);
  };
  
  // Handle filter changes
  const handleFilterChange = (filterName: string, value: boolean | string) => {
    const params = new URLSearchParams(searchParams);
    
    switch (filterName) {
      case 'verified':
        setIsVerifiedFilter(value as boolean);
        if (value) {
          params.set('verified', 'true');
        } else {
          params.delete('verified');
        }
        break;
      case 'official':
        setIsOfficialFilter(value as boolean);
        if (value) {
          params.set('official', 'true');
        } else {
          params.delete('official');
        }
        break;
      case 'featured':
        setIsFeaturedFilter(value as boolean);
        if (value) {
          params.set('featured', 'true');
        } else {
          params.delete('featured');
        }
        break;
      case 'sort':
        setSelectedSort(value as string);
        params.set('sort', value as string);
        break;
      case 'category':
        setSelectedCategory(value as string);
        if (value) {
          params.set('category', value as string);
        } else {
          params.delete('category');
        }
        break;
    }
    
    // Reset page to 1 when changing filters
    params.delete('page');
    setCurrentPage(1);
    
    // Navigate with updated params
    navigate(`/marketplace?${params.toString()}`);
  };
  
  // Display error if needed
  useEffect(() => {
    if (connectorsError) {
      toast({
        title: "Error loading connectors",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  }, [connectorsError, toast]);
  
  // Prepare connectors data from the API response
  const connectors = connectorsData?.connectors || [];
  const totalConnectors = connectorsData?.total || 0;
  const totalPages = connectorsData?.totalPages || 1;
  
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Connector Marketplace</h1>
          <p className="text-muted-foreground">
            Discover, install, and manage connectors to extend your platform capabilities
          </p>
        </div>
        
        <Button variant="default" asChild>
          <Link href="/marketplace/submit">
            Submit Connector
          </Link>
        </Button>
      </div>
      
      {/* Marketplace Stats Section */}
      {!isLoadingStats && marketplaceStats && (
        <MarketplaceStats stats={marketplaceStats} />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectorFilters 
                categories={categories || []}
                selectedCategory={selectedCategory}
                isVerified={isVerifiedFilter}
                isOfficial={isOfficialFilter}
                isFeatured={isFeaturedFilter}
                onFilterChange={handleFilterChange}
                isLoading={isLoadingCategories}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content Area */}
        <div className="lg:col-span-9">
          {/* Search and Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="flex w-full max-w-lg items-center space-x-2">
                <Input
                  placeholder="Search connectors..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </form>
            
            <div className="flex items-center">
              <Select value={selectedSort} onValueChange={(value) => handleFilterChange('sort', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="downloads">Most Downloads</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Results Summary */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoadingConnectors 
                ? 'Loading connectors...' 
                : `Showing ${connectors.length} of ${totalConnectors} connectors`}
            </p>
          </div>
          
          {/* Connectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingConnectors ? (
              // Skeleton loading state
              Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))
            ) : connectors.length > 0 ? (
              // Display connectors
              connectors.map((connector) => (
                <ConnectorCard 
                  key={connector.id} 
                  connector={connector}
                  onInstall={() => {
                    if (!user) {
                      toast({
                        title: "Authentication required",
                        description: "Please sign in to install connectors",
                        variant: "destructive"
                      });
                      return;
                    }
                    // Install logic is implemented in connector-card component
                  }}
                />
              ))
            ) : (
              // No results
              <div className="col-span-3 py-12 text-center">
                <p className="text-lg font-medium">No connectors found</p>
                <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Previous
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  // Show current page and nearby pages
                  let pageNumber: number;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={i}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}