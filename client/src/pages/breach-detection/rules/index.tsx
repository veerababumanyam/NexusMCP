import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, AlarmClock, ShieldAlert, Filter, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Format date for display
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return format(date, 'MMM d, yyyy, HH:mm');
  } catch (error) {
    return 'Invalid date';
  }
};

// Get severity badge
const getSeverityBadge = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge className="bg-orange-500">High</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500">Medium</Badge>;
    case 'low':
      return <Badge className="bg-blue-500">Low</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

// Get rule type badge
const getRuleTypeBadge = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'behavior':
      return <Badge className="bg-purple-500">Behavior</Badge>;
    case 'signature':
      return <Badge className="bg-emerald-500">Signature</Badge>;
    case 'anomaly':
      return <Badge className="bg-amber-500">Anomaly</Badge>;
    case 'correlation':
      return <Badge className="bg-sky-500">Correlation</Badge>;
    default:
      return <Badge>Other</Badge>;
  }
};

// Get category icon
const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'access_control':
      return <Shield className="h-4 w-4" />;
    case 'authentication':
      return <ShieldAlert className="h-4 w-4" />;
    case 'timing':
      return <AlarmClock className="h-4 w-4" />;
    default:
      return <Filter className="h-4 w-4" />;
  }
};

const BreachRulesPage = () => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Fetch breach detection rules
  const { 
    data: rulesData,
    isLoading: rulesLoading,
    error: rulesError
  } = useQuery({
    queryKey: ['/api/breach-detection/rules'],
    staleTime: 60000, // 1 minute
  });
  
  // Filter and search rules
  const filteredRules = Array.isArray(rulesData) ? rulesData.filter((rule: any) => {
    const matchesCategory = categoryFilter === 'all' || rule.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || rule.severity === severityFilter;
    const matchesSearch = !searchQuery || 
      (rule.name && rule.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (rule.description && rule.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSeverity && matchesSearch;
  }) : [];
  
  // Get unique categories
  const categories = Array.isArray(rulesData) ? 
    Array.from(new Set(rulesData
      .filter(rule => rule && rule.category)
      .map((rule: any) => rule.category)))
      .filter(Boolean)
      .sort() : 
    [];
  
  if (rulesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Breach Detection Rules</h1>
            <p className="text-muted-foreground">Configure and manage breach detection rules</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Detection Rules</CardTitle>
            <CardDescription>
              Rules that define patterns for automatic breach detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="rounded-md border">
                <Skeleton className="h-[400px] w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (rulesError) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Breach Detection Rules</h1>
            <p className="text-muted-foreground">Configure and manage breach detection rules</p>
          </div>
          <Button asChild>
            <Link to="/breach-detection/rules/new">
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Link>
          </Button>
        </div>
        
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Rules</CardTitle>
            <CardDescription className="text-red-500">
              Could not load breach detection rules from the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">
              {rulesError instanceof Error ? rulesError.message : 'Unknown error occurred'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              <Loader2 className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle case where data is undefined or null
  if (!rulesData) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Breach Detection Rules</h1>
            <p className="text-muted-foreground">Configure and manage breach detection rules</p>
          </div>
          <Button asChild>
            <Link to="/breach-detection/rules/new">
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Detection Rules</CardTitle>
            <CardDescription>
              No rules found. Create your first breach detection rule.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-center">No Rules Available</h3>
            <p className="text-sm text-center text-muted-foreground mt-1 mb-4">
              You haven't created any breach detection rules yet.
            </p>
            <Button asChild>
              <Link to="/breach-detection/rules/new">
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Breach Detection Rules</h1>
          <p className="text-muted-foreground">Configure and manage breach detection rules</p>
        </div>
        <Button asChild>
          <Link to="/breach-detection/rules/new">
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Detection Rules</CardTitle>
          <CardDescription>
            Rules that define patterns for automatic breach detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-4">
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {typeof category === 'string' ? category.replace('_', ' ') : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={severityFilter}
                  onValueChange={setSeverityFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules && filteredRules.length > 0 ? (
                    filteredRules.map((rule: any) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(rule.category)}
                            <span>{rule.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getRuleTypeBadge(rule.type)}</TableCell>
                        <TableCell className="capitalize">{rule.category?.replace('_', ' ')}</TableCell>
                        <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                        <TableCell>{formatDate(rule.updatedAt || rule.createdAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" asChild>
                            <Link to={`/breach-detection/rules/${rule.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No rules found matching your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {Array.isArray(rulesData) && rulesData.length > 0 && (
                  <TableCaption>
                    {rulesData.length} total rule{rulesData.length !== 1 && 's'}
                    {filteredRules.length !== rulesData.length && 
                      `, ${filteredRules.length} matching your filters`}
                  </TableCaption>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BreachRulesPage;