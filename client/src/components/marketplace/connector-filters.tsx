import React from 'react';
import { ConnectorCategory } from '@shared/schema_marketplace';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  Shield,
  Star
} from 'lucide-react';

interface ConnectorFiltersProps {
  categories: ConnectorCategory[];
  selectedCategory: string;
  isVerified: boolean;
  isOfficial: boolean;
  isFeatured: boolean;
  onFilterChange: (filterName: string, value: boolean | string) => void;
  isLoading: boolean;
}

export function ConnectorFilters({
  categories,
  selectedCategory,
  isVerified,
  isOfficial,
  isFeatured,
  onFilterChange,
  isLoading
}: ConnectorFiltersProps) {
  // Handle category change
  const handleCategoryChange = (value: string) => {
    onFilterChange('category', value);
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="space-y-2">
        <Label htmlFor="category-select">Category</Label>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select
            value={selectedCategory}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger id="category-select">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Toggle Filters */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Filter By</h4>
        
        {/* Verified Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            <Label htmlFor="verified-filter" className="cursor-pointer">Verified</Label>
          </div>
          <Switch
            id="verified-filter"
            checked={isVerified}
            onCheckedChange={(checked) => onFilterChange('verified', checked)}
          />
        </div>
        
        {/* Official Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-green-500" />
            <Label htmlFor="official-filter" className="cursor-pointer">Official</Label>
          </div>
          <Switch
            id="official-filter"
            checked={isOfficial}
            onCheckedChange={(checked) => onFilterChange('official', checked)}
          />
        </div>
        
        {/* Featured Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <Label htmlFor="featured-filter" className="cursor-pointer">Featured</Label>
          </div>
          <Switch
            id="featured-filter"
            checked={isFeatured}
            onCheckedChange={(checked) => onFilterChange('featured', checked)}
          />
        </div>
      </div>
    </div>
  );
}