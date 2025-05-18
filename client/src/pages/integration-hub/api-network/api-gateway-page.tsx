import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Router,
  ExternalLink,
  Plus,
  ShieldCheck,
  Globe,
  BarChart3,
  ChevronRight,
  Code,
  Settings
} from "lucide-react";
import { useLocation } from "wouter";

export default function ApiGatewayPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [location, navigate] = useLocation();
  
  // Sample data for API endpoints
  const endpoints = [
    {
      id: 1,
      name: "/api/monitoring/metrics",
      description: "Exposes application metrics in Prometheus-compatible format for APM systems",
      method: "GET",
      auth: "API Key",
      rateLimit: "100 req/min",
      status: "active"
    },
    {
      id: 2,
      name: "/api/monitoring/health",
      description: "System health check endpoint compatible with standard monitoring probes",
      method: "GET",
      auth: "None",
      rateLimit: "500 req/min",
      status: "active"
    },
    {
      id: 3,
      name: "/api/monitoring/logs",
      description: "Streaming endpoint for log aggregation in standardized format",
      method: "GET",
      auth: "OAuth",
      rateLimit: "50 req/min",
      status: "active"
    }
  ];

  // Sample gateway stats
  const gatewayStats = {
    totalRequests: "1.2M",
    avgLatency: "87ms",
    errorRate: "0.03%",
    uptime: "99.998%"
  };

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">API Gateway Configuration</h1>
          <p className="text-muted-foreground mt-1">Configure API endpoints for enterprise monitoring systems.</p>
        </div>
        <Button onClick={() => navigate("/integrations/api-gateway/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Endpoint
        </Button>
      </div>

      <Alert variant="default" className="mb-6 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Enterprise Monitoring Integration</AlertTitle>
        <AlertDescription>
          The API Gateway exposes standardized endpoints for monitoring tools to interact with the platform. 
          These endpoints provide metrics in Prometheus-compatible format, health check APIs, and log streaming capabilities 
          for integration with various monitoring systems.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Monitoring Endpoints</TabsTrigger>
          <TabsTrigger value="settings">Gateway Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gatewayStats.totalRequests}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gatewayStats.avgLatency}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gatewayStats.errorRate}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gatewayStats.uptime}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Endpoints</CardTitle>
                <CardDescription>
                  Endpoints exposed for monitoring systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {endpoints.map((endpoint) => (
                    <div 
                      key={endpoint.id} 
                      className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/integrations/api-gateway/${endpoint.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Badge className="mr-2" variant={endpoint.method === "GET" ? "default" : "outline"}>
                            {endpoint.method}
                          </Badge>
                          <span className="font-mono text-sm">{endpoint.name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("endpoints")}>
                  View All Endpoints
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Integration Features</CardTitle>
                <CardDescription>
                  Available monitoring integration capabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900 mr-3">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium">Prometheus Metrics</h4>
                        <p className="text-sm text-muted-foreground">Standardized metrics exposure</p>
                      </div>
                    </div>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-green-100 dark:bg-green-900 mr-3">
                        <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-medium">Health Probe API</h4>
                        <p className="text-sm text-muted-foreground">Standard health monitoring</p>
                      </div>
                    </div>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900 mr-3">
                        <Code className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-medium">Log Stream API</h4>
                        <p className="text-sm text-muted-foreground">Standardized log format</p>
                      </div>
                    </div>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("settings")}>
                  Configure Settings
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Endpoints</CardTitle>
              <CardDescription>
                API endpoints exposed for monitoring system integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpoints.map((endpoint) => (
                  <div 
                    key={endpoint.id} 
                    className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/integrations/api-gateway/${endpoint.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Badge className="mr-2" variant={endpoint.method === "GET" ? "default" : "outline"}>
                          {endpoint.method}
                        </Badge>
                        <span className="font-mono text-sm">{endpoint.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{endpoint.auth}</Badge>
                        <Badge variant="secondary">{endpoint.rateLimit}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
                    <div className="mt-3 text-xs">
                      <span className="font-medium">Sample URL: </span>
                      <code className="bg-secondary p-1 rounded">https://api.example.com{endpoint.name}</code>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Documentation</CardTitle>
              <CardDescription>
                Documentation for monitoring system integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium">Prometheus Metrics Endpoint</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    This endpoint exposes metrics in Prometheus-compatible format for APM systems to scrape.
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Endpoint</div>
                      <div className="col-span-2 font-mono">/api/monitoring/metrics</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Method</div>
                      <div className="col-span-2">GET</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Auth</div>
                      <div className="col-span-2">API Key (via header)</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Format</div>
                      <div className="col-span-2">Prometheus Text Format</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Sample Response</div>
                      <div className="col-span-2 font-mono text-xs bg-secondary p-2 rounded whitespace-pre">
                        {`# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{code="200",handler="api"} 1234
http_requests_total{code="400",handler="api"} 12

# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 1000
http_request_duration_seconds_bucket{le="0.2"} 1500
http_request_duration_seconds_bucket{le="0.5"} 2000
http_request_duration_seconds_bucket{le="1"} 2500
http_request_duration_seconds_bucket{le="+Inf"} 3000`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gateway Settings</CardTitle>
              <CardDescription>
                Configure API Gateway for monitoring systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon="info"
                title="Settings Configuration"
                description="The API Gateway settings are managed through infrastructure-as-code and your organization's configuration management system. Contact your administrator to make changes to the gateway configuration."
                actions={
                  <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    View Documentation
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}