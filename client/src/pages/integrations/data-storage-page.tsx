import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { 
  AlertCircle, 
  Database, 
  Files, 
  BarChart4, 
  HardDrive, 
  Server, 
  Plus,
  ExternalLink,
} from "lucide-react";

export default function DataStoragePage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [location, navigate] = useLocation();
  
  // Extract tab from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    
    // Only set active tab if it's a valid value
    if (tabParam && ['overview', 'data-warehouse', 'bi-tools', 'databases', 'file-storage'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Use navigate from wouter to update the URL without page refresh
    // This ensures proper handling of route changes with correct history state
    navigate(`/integrations/data-storage?tab=${value}`);
  };
  
  // Fetch available storage systems
  const { data: storageSystems, isLoading: isLoadingStorageSystems } = useQuery({
    queryKey: ['/api/integrations/storage/systems'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Fetch configured integrations
  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ['/api/integrations/storage'],
  });

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <DashboardHeader 
        heading="Data Storage & Business Intelligence" 
        text="Connect your platform with enterprise data storage and BI solutions."
        className="px-0"
      >
        <Button onClick={() => navigate("/integrations/data-storage/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </DashboardHeader>

      <Alert variant="default" className="mb-6 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Enterprise Data Integration Hub</AlertTitle>
        <AlertDescription>
          Connect with enterprise data storage and BI platforms for centralized data management, 
          analytics, and business intelligence. Support for data warehouses, BI tools, databases, 
          and file storage solutions through standardized connectors and secure APIs.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data-warehouse">Data Warehouses</TabsTrigger>
          <TabsTrigger value="bi-tools">BI Tools</TabsTrigger>
          <TabsTrigger value="databases">Databases</TabsTrigger>
          <TabsTrigger value="file-storage">File Storage</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <HardDrive className="h-5 w-5 mr-2 text-primary" />
                  Data Warehouses
                </CardTitle>
                <CardDescription>
                  Cloud data warehouse solutions
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingStorageSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    storageSystems?.dataWarehouses?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("data-warehouse")}>
                  View Data Warehouses
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <BarChart4 className="h-5 w-5 mr-2 text-primary" />
                  BI Tools
                </CardTitle>
                <CardDescription>
                  Business intelligence platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingStorageSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    storageSystems?.biTools?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("bi-tools")}>
                  View BI Tools
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary" />
                  Databases
                </CardTitle>
                <CardDescription>
                  Database systems and services
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingStorageSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    storageSystems?.databases?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("databases")}>
                  View Databases
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Files className="h-5 w-5 mr-2 text-primary" />
                  File Storage
                </CardTitle>
                <CardDescription>
                  Cloud file storage platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingStorageSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    storageSystems?.fileStorage?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("file-storage")}>
                  View File Storage
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Active Integrations</CardTitle>
                <CardDescription>
                  Your currently configured data storage integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingIntegrations ? (
                  <div className="py-6 text-center text-muted-foreground">
                    Loading integrations...
                  </div>
                ) : !integrations || integrations.length === 0 ? (
                  <div className="py-6 text-center border rounded-lg">
                    <div className="flex justify-center mb-3">
                      <Server className="h-10 w-10 text-muted-foreground/70" />
                    </div>
                    <h3 className="text-lg font-medium">No active integrations</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                      Add your first data storage integration to connect with enterprise data platforms
                    </p>
                    <Button onClick={() => navigate("/integrations/data-storage/new")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Integration
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {integrations.map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integrations/data-storage/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-md ${getIconBgClass(integration.type)}`}>
                            {getIntegrationIcon(integration.type)}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.provider} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Data Warehouses Tab */}
        <TabsContent value="data-warehouse" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Warehouse Systems</CardTitle>
              <CardDescription>
                Connect your application with cloud data warehouse platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStorageSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading data warehouse systems...
                </div>
              ) : !storageSystems?.dataWarehouses || storageSystems.dataWarehouses.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No data warehouse systems available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no data warehouse systems available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {storageSystems.dataWarehouses.map((system) => (
                    <Card key={system.id} className="border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md font-medium">
                          {system.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {system.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {system.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          onClick={() => navigate(`/integrations/data-storage/new?type=data-warehouse&system=${system.id}`)}
                          className="w-full"
                          variant="outline"
                        >
                          Configure Integration
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active Data Warehouse Integrations</CardTitle>
              <CardDescription>
                Your configured data warehouse integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'data-warehouse') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <HardDrive className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active data warehouse integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Connect to enterprise data warehouse platforms like Snowflake, Redshift, or BigQuery
                  </p>
                  <Button onClick={() => navigate("/integrations/data-storage/new?type=data-warehouse")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Data Warehouse
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'data-warehouse')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integrations/data-storage/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900">
                            <HardDrive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.provider} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* BI Tools Tab */}
        <TabsContent value="bi-tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Intelligence Tools</CardTitle>
              <CardDescription>
                Connect your application with BI and analytics platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStorageSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading BI systems...
                </div>
              ) : !storageSystems?.biTools || storageSystems.biTools.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No BI tools available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no business intelligence tools available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {storageSystems.biTools.map((system) => (
                    <Card key={system.id} className="border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md font-medium">
                          {system.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {system.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {system.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          onClick={() => navigate(`/integrations/data-storage/new?type=bi-tools&system=${system.id}`)}
                          className="w-full"
                          variant="outline"
                        >
                          Configure Integration
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active BI Tools Integrations</CardTitle>
              <CardDescription>
                Your configured BI tool integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'bi-tools') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <BarChart4 className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active BI tool integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Connect to analytics platforms like Tableau, Power BI, Looker or Qlik
                  </p>
                  <Button onClick={() => navigate("/integrations/data-storage/new?type=bi-tools")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add BI Tool
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'bi-tools')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integrations/data-storage/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900">
                            <BarChart4 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.provider} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Databases Tab */}
        <TabsContent value="databases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Systems</CardTitle>
              <CardDescription>
                Connect your application with database systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStorageSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading database systems...
                </div>
              ) : !storageSystems?.databases || storageSystems.databases.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No database systems available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no database systems available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {storageSystems.databases.map((system) => (
                    <Card key={system.id} className="border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md font-medium">
                          {system.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {system.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {system.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          onClick={() => navigate(`/integrations/data-storage/new?type=databases&system=${system.id}`)}
                          className="w-full"
                          variant="outline"
                        >
                          Configure Integration
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active Database Integrations</CardTitle>
              <CardDescription>
                Your configured database integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'databases') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <Database className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active database integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Connect to database systems like PostgreSQL, MySQL, MongoDB or SQL Server
                  </p>
                  <Button onClick={() => navigate("/integrations/data-storage/new?type=databases")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Database
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'databases')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integrations/data-storage/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.provider} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* File Storage Tab */}
        <TabsContent value="file-storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Storage Systems</CardTitle>
              <CardDescription>
                Connect your application with file storage platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStorageSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading file storage systems...
                </div>
              ) : !storageSystems?.fileStorage || storageSystems.fileStorage.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No file storage systems available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no file storage systems available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {storageSystems.fileStorage.map((system) => (
                    <Card key={system.id} className="border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-md font-medium">
                          {system.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {system.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {system.features.map((feature, index) => (
                            <span key={index} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          onClick={() => navigate(`/integrations/data-storage/new?type=file-storage&system=${system.id}`)}
                          className="w-full"
                          variant="outline"
                        >
                          Configure Integration
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active File Storage Integrations</CardTitle>
              <CardDescription>
                Your configured file storage integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'file-storage') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <Files className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active file storage integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Connect to cloud storage platforms like AWS S3, Azure Blob, Google Drive or Dropbox
                  </p>
                  <Button onClick={() => navigate("/integrations/data-storage/new?type=file-storage")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add File Storage
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'file-storage')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integrations/data-storage/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                            <Files className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.provider} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to get the icon for an integration type
function getIntegrationIcon(type: string) {
  switch (type) {
    case 'data-warehouse':
      return <HardDrive className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    case 'bi-tools':
      return <BarChart4 className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
    case 'databases':
      return <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    case 'file-storage':
      return <Files className="h-5 w-5 text-green-600 dark:text-green-400" />;
    default:
      return <Server className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
  }
}

// Helper function to get the background color class for an integration type
function getIconBgClass(type: string) {
  switch (type) {
    case 'data-warehouse':
      return 'bg-amber-100 dark:bg-amber-900';
    case 'bi-tools':
      return 'bg-purple-100 dark:bg-purple-900';
    case 'databases':
      return 'bg-blue-100 dark:bg-blue-900';
    case 'file-storage':
      return 'bg-green-100 dark:bg-green-900';
    default:
      return 'bg-gray-100 dark:bg-gray-900';
  }
}