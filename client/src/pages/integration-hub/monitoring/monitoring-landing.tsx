import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, 
  Activity, 
  BarChart4, 
  Waves,
  ExternalLink,
  Plus
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";

export default function MonitoringLandingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [location, navigate] = useLocation();
  
  // Extract tab from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    
    // Only set active tab if it's a valid value
    if (tabParam && ['overview', 'apm', 'logging'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Update URL properly using wouter navigation
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', value);
    
    // Use navigate from wouter to update the URL without page refresh
    // This ensures proper handling of route changes with correct history state
    navigate(`/integration-hub/monitoring?tab=${value}`);
  };
  
  // Fetch available monitoring systems
  const { data: monitoringSystems, isLoading: isLoadingMonitoringSystems } = useQuery({
    queryKey: ['/api/public/monitoring/systems'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Fetch configured integrations 
  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ['/api/monitoring/integrations'],
  });

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <DashboardHeader 
        heading="Monitoring Integration Hub" 
        text="Connect your MCP platform with enterprise monitoring systems."
        className="px-0"
      >
        <Button onClick={() => navigate("/integration-hub/monitoring/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </DashboardHeader>

      <Alert variant="default" className="mb-6 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Enterprise Monitoring Integration Hub</AlertTitle>
        <AlertDescription>
          Connect with industry-standard monitoring tools for comprehensive visibility into application health, 
          performance, and usage. Supports APM tools (Datadog, Dynatrace, New Relic, etc.) and log aggregation systems 
          (Splunk, ELK Stack, Graylog, etc.) through standardized endpoints and formats.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="apm">APM Integrations</TabsTrigger>
          <TabsTrigger value="logging">Logging Integrations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-primary" />
                  APM Systems
                </CardTitle>
                <CardDescription>
                  Application Performance Monitoring systems
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingMonitoringSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    monitoringSystems?.apm?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("apm")}>
                  View APM Integrations
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Waves className="h-5 w-5 mr-2 text-primary" />
                  Logging Systems
                </CardTitle>
                <CardDescription>
                  Log aggregation and analysis platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold">
                  {isLoadingMonitoringSystems ? (
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  ) : (
                    monitoringSystems?.logging?.length || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available systems for integration
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange("logging")}>
                  View Logging Integrations
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Active Integrations</CardTitle>
                <CardDescription>
                  Your currently configured monitoring integrations
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
                      <BarChart4 className="h-10 w-10 text-muted-foreground/70" />
                    </div>
                    <h3 className="text-lg font-medium">No active integrations</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                      Add your first monitoring integration to connect with APM or logging systems
                    </p>
                    <Button onClick={() => navigate("/integration-hub/monitoring/new")}>
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
                        onClick={() => navigate(`/integration-hub/monitoring/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-md ${integration.type === 'apm' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-green-100 dark:bg-green-900'}`}>
                            {integration.type === 'apm' ? (
                              <Activity className={`h-5 w-5 ${integration.type === 'apm' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                            ) : (
                              <Waves className={`h-5 w-5 ${integration.type === 'apm' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.system} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
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
        
        <TabsContent value="apm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>APM Systems</CardTitle>
              <CardDescription>
                Connect your application with APM platforms for performance monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMonitoringSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading APM systems...
                </div>
              ) : !monitoringSystems?.apm || monitoringSystems.apm.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No APM systems available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no APM systems available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {monitoringSystems.apm.map((system) => (
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
                          onClick={() => navigate(`/integration-hub/monitoring/new?type=apm&system=${system.id}`)}
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
              <CardTitle>Active APM Integrations</CardTitle>
              <CardDescription>
                Your configured APM system integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'apm') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <Activity className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active APM integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                    Add your first APM integration to monitor application performance
                  </p>
                  <Button onClick={() => navigate("/integration-hub/monitoring/new?type=apm")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add APM Integration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'apm')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integration-hub/monitoring/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
                            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.system} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
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
        
        <TabsContent value="logging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logging Systems</CardTitle>
              <CardDescription>
                Connect your application with log aggregation platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMonitoringSystems ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading logging systems...
                </div>
              ) : !monitoringSystems?.logging || monitoringSystems.logging.length === 0 ? (
                <div className="py-6 text-center border rounded-lg">
                  <h3 className="text-lg font-medium">No logging systems available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no logging systems available to integrate with
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {monitoringSystems.logging.map((system) => (
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
                          onClick={() => navigate(`/integration-hub/monitoring/new?type=logging&system=${system.id}`)}
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
              <CardTitle>Active Logging Integrations</CardTitle>
              <CardDescription>
                Your configured log aggregation system integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingIntegrations ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : !integrations || !integrations.some(i => i.type === 'logging') ? (
                <div className="py-6 text-center border rounded-lg">
                  <div className="flex justify-center mb-3">
                    <Waves className="h-10 w-10 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-medium">No active logging integrations</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                    Add your first logging integration to centralize log data
                  </p>
                  <Button onClick={() => navigate("/integration-hub/monitoring/new?type=logging")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Logging Integration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations
                    .filter(integration => integration.type === 'logging')
                    .map((integration) => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between py-3 px-4 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => navigate(`/integration-hub/monitoring/${integration.id}`)}
                      >
                        <div className="flex items-center">
                          <div className="p-2 rounded-md bg-green-100 dark:bg-green-900">
                            <Waves className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{integration.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {integration.system} • {integration.status === 'active' ? 'Connected' : 'Disconnected'}
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