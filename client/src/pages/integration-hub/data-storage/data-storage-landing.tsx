import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Database, Server, BarChart3, FileBox } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataIntegration } from "@shared/schema_data_storage_bi";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { queryClient } from "@/lib/queryClient";

export default function DataStorageLandingPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Query to fetch data storage integrations
  const { data, isLoading, error } = useQuery<{ 
    integrations: DataIntegration[],
    count: number,
    page: number,
    totalPages: number
  }>({
    queryKey: ["/api/data-storage"],
    select: (data) => {
      return {
        integrations: data.integrations || [],
        count: data.count || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1
      };
    }
  });

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  // Filter integrations based on search, tab, and status
  const filteredIntegrations = data?.integrations.filter((integration) => {
    // Filter by search
    const matchesSearch = !search || 
      integration.name.toLowerCase().includes(search.toLowerCase()) ||
      (integration.description && integration.description.toLowerCase().includes(search.toLowerCase()));

    // Filter by tab (integration type)
    const matchesTab = activeTab === "all" || integration.type === activeTab;

    // Filter by status
    const matchesStatus = statusFilter === "all" || integration.status === statusFilter;

    return matchesSearch && matchesTab && matchesStatus;
  }) || [];

  // Get the icon based on integration type
  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case "database":
        return <Database className="h-5 w-5" />;
      case "data_warehouse":
        return <Server className="h-5 w-5" />;
      case "bi_tool":
        return <BarChart3 className="h-5 w-5" />;
      case "file_storage":
        return <FileBox className="h-5 w-5" />;
      default:
        return <Database className="h-5 w-5" />;
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500">Connected</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "disconnected":
        return <Badge variant="outline">Disconnected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "configured":
        return <Badge variant="outline">Configured</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageTitle title="Data Storage & BI Integration" description="Connect to databases, data warehouses, BI tools, and file storage systems" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Search integrations..." 
            value={search}
            onChange={handleSearchChange}
            className="h-9 w-[250px] md:w-[300px] lg:w-[400px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Filter by status</SelectLabel>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="configured">Configured</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/integration-hub/data-storage/bi-tool">
              <BarChart3 className="mr-2 h-4 w-4" /> Connect BI Tool
            </Link>
          </Button>
          <Button asChild>
            <Link href="/integration-hub/data-storage/new">
              <Plus className="mr-2 h-4 w-4" /> Add Integration
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-[600px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="database">Databases</TabsTrigger>
          <TabsTrigger value="data_warehouse">Data Warehouses</TabsTrigger>
          <TabsTrigger value="bi_tool">BI Tools</TabsTrigger>
          <TabsTrigger value="file_storage">File Storage</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {renderIntegrations(filteredIntegrations, isLoading, error, navigate, getIntegrationIcon, getStatusBadge)}
        </TabsContent>
        
        <TabsContent value="database" className="mt-6">
          {renderIntegrations(filteredIntegrations, isLoading, error, navigate, getIntegrationIcon, getStatusBadge)}
        </TabsContent>
        
        <TabsContent value="data_warehouse" className="mt-6">
          {renderIntegrations(filteredIntegrations, isLoading, error, navigate, getIntegrationIcon, getStatusBadge)}
        </TabsContent>
        
        <TabsContent value="bi_tool" className="mt-6">
          {renderIntegrations(filteredIntegrations, isLoading, error, navigate, getIntegrationIcon, getStatusBadge)}
        </TabsContent>
        
        <TabsContent value="file_storage" className="mt-6">
          {renderIntegrations(filteredIntegrations, isLoading, error, navigate, getIntegrationIcon, getStatusBadge)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function renderIntegrations(
  integrations: DataIntegration[],
  isLoading: boolean,
  error: Error | null,
  navigate: (path: string) => void,
  getIntegrationIcon: (type: string) => JSX.Element,
  getStatusBadge: (status: string) => JSX.Element
) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="warning"
        title="Failed to load integrations"
        description="There was an error loading your integrations. Please try again."
        actions={
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/data-storage"] })}>
            Retry
          </Button>
        }
      />
    );
  }

  if (integrations.length === 0) {
    return (
      <EmptyState
        icon="database"
        title="No integrations found"
        description="No data storage integrations match your filters. Try changing your search terms or add a new integration."
        actions={
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/integration-hub/data-storage/bi-tool">
                <BarChart3 className="mr-2 h-4 w-4" /> Connect BI Tool
              </Link>
            </Button>
            <Button asChild>
              <Link href="/integration-hub/data-storage/new">
                <Plus className="mr-2 h-4 w-4" /> Add Integration
              </Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {integrations.map((integration) => (
        <Card 
          key={integration.id} 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate(`/integration-hub/data-storage/${integration.id}`)}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {getIntegrationIcon(integration.type)}
                <div>
                  <CardTitle className="text-lg">{integration.name}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {integration.system}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(integration.status)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {integration.description || "No description provided"}
            </p>
          </CardContent>
          <CardFooter className="flex justify-between text-xs text-muted-foreground">
            <span>
              {integration.syncEnabled ? "Sync enabled" : "No sync"}
            </span>
            <span>
              Last updated: {new Date(integration.updatedAt).toLocaleDateString()}
            </span>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}