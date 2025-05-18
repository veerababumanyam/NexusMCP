import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  Shield,
  ShieldCheck,
  ShieldX,
  Settings,
  Lock,
  ArrowUpDown,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useLocation } from "wouter";

export default function WafPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [location, navigate] = useLocation();
  
  // Sample data for WAF rules
  const wafRules = [
    {
      id: 1,
      name: "Rate Limiting - Monitoring APIs",
      description: "Rate limits on metrics and health check APIs to prevent DoS attacks",
      category: "Rate Limiting",
      severity: "Medium",
      status: "active"
    },
    {
      id: 2,
      name: "SQL Injection Prevention",
      description: "Prevents SQL injection attacks through monitoring API endpoints",
      category: "Injection",
      severity: "Critical",
      status: "active"
    },
    {
      id: 3,
      name: "Log4j Protection",
      description: "Blocks Log4Shell exploitation attempts via HTTP headers",
      category: "Remote Code Execution",
      severity: "Critical",
      status: "active"
    },
    {
      id: 4,
      name: "XSS Protection",
      description: "Prevents cross-site scripting attacks via request parameters",
      category: "XSS",
      severity: "High",
      status: "active"
    }
  ];

  // Sample WAF stats
  const wafStats = {
    blockedRequests: "23.4K",
    threatScore: 82,
    activeRules: 42,
    lastUpdate: "5 hours ago"
  };
  
  // Sample monitoring-related firewall configurations
  const monitoringConfigs = [
    {
      id: 1,
      name: "APM Access Controls",
      description: "IP whitelisting for APM tools like Datadog, New Relic, and Dynatrace",
      status: "enabled"
    },
    {
      id: 2,
      name: "Logging Rate Limiting",
      description: "Special rate limits for log streaming endpoints",
      status: "enabled"
    },
    {
      id: 3,
      name: "Health Probes Protection",
      description: "Allow health check endpoints to bypass certain security rules",
      status: "enabled"
    }
  ];

  return (
    <div className="flex-1 space-y-4 pt-6 px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Web Application Firewall</h1>
          <p className="text-muted-foreground mt-1">Security configuration for monitoring system integration</p>
        </div>
        <Button onClick={() => navigate("/integrations/waf/rules/new")}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <Alert variant="default" className="mb-6 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Monitoring System Protection</AlertTitle>
        <AlertDescription>
          The WAF is configured to protect monitoring endpoints while ensuring availability for legitimate monitoring tools. 
          Rate limiting, IP whitelisting, and special rules are applied to maintain security without impacting monitoring functionality.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Security Rules</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring Config</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{wafStats.blockedRequests}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Threat Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{wafStats.threatScore}/100</div>
                <Progress value={wafStats.threatScore} className="h-2 mt-2" />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{wafStats.activeRules}</div>
                <p className="text-xs text-muted-foreground">Security rules enabled</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Update</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{wafStats.lastUpdate}</div>
                <p className="text-xs text-muted-foreground">Rule set update</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Security Rules</CardTitle>
                <CardDescription>
                  WAF rules for monitoring integration security
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {wafRules.slice(0, 3).map((rule) => (
                    <div 
                      key={rule.id} 
                      className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/integrations/waf/rules/${rule.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`p-1.5 rounded-full 
                            ${rule.severity === 'Critical' ? 'bg-red-100 dark:bg-red-900' : 
                             rule.severity === 'High' ? 'bg-orange-100 dark:bg-orange-900' : 
                             'bg-yellow-100 dark:bg-yellow-900'}`}
                          >
                            <ShieldCheck className={`h-4 w-4 
                              ${rule.severity === 'Critical' ? 'text-red-600 dark:text-red-400' : 
                               rule.severity === 'High' ? 'text-orange-600 dark:text-orange-400' : 
                               'text-yellow-600 dark:text-yellow-400'}`} 
                            />
                          </div>
                          <span className="font-medium ml-2">{rule.name}</span>
                        </div>
                        <Badge variant={
                          rule.severity === 'Critical' ? 'destructive' : 
                          rule.severity === 'High' ? 'default' : 'secondary'
                        }>{rule.severity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("rules")}>
                  View All Rules
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Configurations</CardTitle>
                <CardDescription>
                  WAF settings for monitoring integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monitoringConfigs.map((config) => (
                    <div key={config.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 rounded-md bg-green-100 dark:bg-green-900 mr-3">
                          <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h4 className="font-medium">{config.name}</h4>
                          <p className="text-sm text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>Enabled</span>
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setActiveTab("monitoring")}>
                  Configure Settings
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WAF Security Rules</CardTitle>
              <CardDescription>
                Security rules for monitoring integration protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wafRules.map((rule) => (
                  <div 
                    key={rule.id} 
                    className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/integrations/waf/rules/${rule.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-1.5 rounded-full 
                          ${rule.severity === 'Critical' ? 'bg-red-100 dark:bg-red-900' : 
                           rule.severity === 'High' ? 'bg-orange-100 dark:bg-orange-900' : 
                           'bg-yellow-100 dark:bg-yellow-900'}`}
                        >
                          <ShieldCheck className={`h-4 w-4 
                            ${rule.severity === 'Critical' ? 'text-red-600 dark:text-red-400' : 
                             rule.severity === 'High' ? 'text-orange-600 dark:text-orange-400' : 
                             'text-yellow-600 dark:text-yellow-400'}`} 
                          />
                        </div>
                        <span className="font-medium ml-2">{rule.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{rule.category}</Badge>
                        <Badge variant={
                          rule.severity === 'Critical' ? 'destructive' : 
                          rule.severity === 'High' ? 'default' : 'secondary'
                        }>{rule.severity}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{rule.description}</p>
                    <div className="mt-3 text-xs flex justify-between">
                      <span>
                        <span className="font-medium">Status: </span>
                        <Badge variant="outline" className="ml-1">
                          {rule.status === 'active' ? (
                            <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1 text-red-500" />
                          )}
                          {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                        </Badge>
                      </span>
                      <Button variant="ghost" size="sm">
                        Edit Rule
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Integration Settings</CardTitle>
              <CardDescription>
                WAF configuration specific to monitoring tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium">APM Tool IP Whitelist</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Allows specific IP ranges for APM tools to bypass rate limiting and certain WAF rules.
                  </p>
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                      <span className="font-mono text-sm">192.168.1.0/24</span>
                      <Badge variant="outline">Datadog</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                      <span className="font-mono text-sm">10.0.0.0/8</span>
                      <Badge variant="outline">New Relic</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                      <span className="font-mono text-sm">172.16.0.0/12</span>
                      <Badge variant="outline">Dynatrace</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">
                    Edit Whitelist
                  </Button>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium">Rate Limit Exceptions</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Special rate limit configurations for monitoring endpoints.
                  </p>
                  <div className="space-y-2 mt-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium">Endpoint</div>
                      <div className="font-medium">Default Limit</div>
                      <div className="font-medium">APM Tool Limit</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-secondary/50 p-2 rounded">
                      <div className="font-mono">/api/monitoring/metrics</div>
                      <div>100 req/min</div>
                      <div>500 req/min</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-secondary/50 p-2 rounded">
                      <div className="font-mono">/api/monitoring/health</div>
                      <div>500 req/min</div>
                      <div>1000 req/min</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm bg-secondary/50 p-2 rounded">
                      <div className="font-mono">/api/monitoring/logs</div>
                      <div>50 req/min</div>
                      <div>200 req/min</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">
                    Edit Rate Limits
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Security Documentation</CardTitle>
              <CardDescription>
                WAF configuration documentation for integration teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon="info"
                title="Security Documentation"
                description="Comprehensive documentation for configuring monitoring tools to work with our WAF security settings is available in the developer portal. This includes API keys, IP whitelisting procedures, and security best practices."
                actions={
                  <Button variant="outline">
                    <Lock className="mr-2 h-4 w-4" />
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